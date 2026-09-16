<?php

namespace Espo\Modules\Competencias\Jobs;

use Espo\Core\Job\JobDataLess;
use Espo\ORM\EntityManager;
use Espo\Modules\Competencias\Traits\Loggable;
use PDO;

/**
 * Job programado: si hay un período ACTIVO, revisa cada encuesta creada
 * dentro de ese período (de asesores y también de gerentes/directores/
 * coordinadores, ya que ambos tipos conviven en la misma tabla) y
 * confirma que la oficina guardada en ella (encuesta.equipo_id) siga
 * coincidiendo con la oficina ACTUAL del usuario evaluado (según su
 * team_user vigente, igual que getActionGetUserInfo). Si el usuario se
 * cambió de oficina, la encuesta se elimina (junto con sus respuestas)
 * para que, en la oficina nueva, vuelva a aparecer como pendiente y se
 * le genere una evaluación ahí.
 *
 * No se hace nada si:
 *  - No hay un período activo (se sale de inmediato, sin ninguna
 *    consulta adicional ni log).
 *  - El usuario no tiene ninguna encuesta en el período activo: la
 *    lista de pendientes se arma dinámicamente contra la oficina
 *    actual (getActionGetAsesoresByOficina), así que no hay nada que
 *    corregir.
 *  - El usuario fue desactivado o eliminado: su team_user no cambia
 *    solo por eso, así que su oficina resuelta sigue siendo la misma
 *    y la encuesta existente se conserva tal cual. Si además fue
 *    eliminado del todo (sus team_user también quedan borrados), esta
 *    rutina tampoco toca su encuesta: solo actúa ante un cambio de
 *    oficina confirmado, nunca ante una ausencia de datos.
 *
 * Logging: se intenta escribir en la entidad 'SyncLog' (de
 * ext-sincronizacion) un log general con el resumen de la corrida y un
 * log individual por cada usuario afectado. Si esa entidad no existe
 * en esta instalación, cae a error_log automáticamente (ver trait
 * Loggable) y el job sigue funcionando con normalidad.
 *
 * Este job NO se registra para correr solo: solo queda disponible como
 * tipo de Scheduled Job en el panel de administración (metadata
 * "isSystem": false). Hay que crear el registro de Scheduled Job
 * manualmente desde Administración y asignarle el cron deseado.
 */
class SincronizarOficinaEncuestas implements JobDataLess
{
    use Loggable;

    private EntityManager $entityManager;

    public function __construct(EntityManager $entityManager)
    {
        $this->entityManager = $entityManager;
    }

    public function run(): void
    {
        $pdo = $this->entityManager->getPDO();

        $periodo = $this->obtenerPeriodoActivo($pdo);
        if (!$periodo) {
            return;
        }

        $encuestas = $this->obtenerEncuestasDelPeriodo($pdo, $periodo['fechaInicio'], $periodo['fechaCierre']);
        if (empty($encuestas)) {
            return;
        }

        $userIds = array_values(array_unique(array_column($encuestas, 'usuarioEvaluadoId')));
        $oficinaActualPorUsuario = $this->resolverOficinasPorUsuarios($pdo, $userIds);

        $aEliminar = [];
        foreach ($encuestas as $enc) {
            $oficinaActual = $oficinaActualPorUsuario[$enc['usuarioEvaluadoId']] ?? null;

            // Sin oficina resoluble hoy (por ejemplo, sus team_user también
            // quedaron eliminados): no se toca, solo actúa el cambio de
            // oficina confirmado, no la ausencia de datos.
            if ($oficinaActual === null) {
                continue;
            }

            if ($oficinaActual !== $enc['equipoId']) {
                $enc['oficinaNuevaId'] = $oficinaActual;
                $aEliminar[] = $enc;
            }
        }

        if (empty($aEliminar)) {
            return;
        }

        $encuestaIds = array_column($aEliminar, 'id');
        $tieneRespuestasPorEncuesta = $this->verificarSiTienenRespuestas($pdo, $encuestaIds);

        $pdo->beginTransaction();
        try {
            $this->eliminarEncuestasPorIds($pdo, $encuestaIds);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('[SincronizarOficinaEncuestas] Error: ' . $e->getMessage());
            $this->log(
                'error',
                'User',
                null,
                'Sincronizar Oficina Encuestas',
                'error',
                'Error crítico, no se aplicó ningún cambio: ' . $e->getMessage()
            );
            return;
        }

        $this->logResultados($pdo, $aEliminar, $tieneRespuestasPorEncuesta);
    }

    // =========================================================
    //  Periodo activo
    // =========================================================

    private function obtenerPeriodoActivo(PDO $pdo): ?array
    {
        $sql = "SELECT id, fecha_inicio as fechaInicio, fecha_cierre as fechaCierre
                FROM competencias
                WHERE deleted = 0 AND fecha_inicio <= CURDATE() AND fecha_cierre >= CURDATE()
                ORDER BY fecha_cierre DESC LIMIT 1";
        $sth = $pdo->prepare($sql);
        $sth->execute();
        $row = $sth->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    // =========================================================
    //  Encuestas del período activo
    // =========================================================

    private function obtenerEncuestasDelPeriodo(PDO $pdo, string $fechaInicio, string $fechaCierre): array
    {
        $fechaCierreMax = $fechaCierre . ' 23:59:59';

        $sql = "SELECT id, equipo_id as equipoId, usuario_evaluado_id as usuarioEvaluadoId, rol_usuario as rolUsuario
                FROM encuesta
                WHERE deleted = 0 AND fecha_creacion >= ? AND fecha_creacion <= ?";
        $sth = $pdo->prepare($sql);
        $sth->execute([$fechaInicio, $fechaCierreMax]);

        return $sth->fetchAll(PDO::FETCH_ASSOC);
    }

    // =========================================================
    //  Oficina actual de un conjunto de usuarios
    //  (idéntico al criterio usado en getActionGetUserInfo:
    //  primer equipo del usuario que no sea un CLA ni "Venezuela")
    // =========================================================

    private function resolverOficinasPorUsuarios(PDO $pdo, array $userIds): array
    {
        if (empty($userIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $sql = "SELECT tu.user_id as userId, t.id as teamId, t.name as teamName
                FROM team_user tu
                INNER JOIN team t ON tu.team_id = t.id AND t.deleted = 0
                WHERE tu.user_id IN ($placeholders) AND tu.deleted = 0";
        $sth = $pdo->prepare($sql);
        $sth->execute($userIds);

        $resultado = [];
        while ($row = $sth->fetch(PDO::FETCH_ASSOC)) {
            $uid = $row['userId'];
            if (isset($resultado[$uid])) {
                continue;
            }
            $esCLA = preg_match('/^CLA\d+$/i', $row['teamId']);
            $esVenezuela = (strtolower($row['teamId']) === 'venezuela' || strtolower($row['teamName']) === 'venezuela');
            if (!$esCLA && !$esVenezuela) {
                $resultado[$uid] = $row['teamId'];
            }
        }

        return $resultado;
    }

    // =========================================================
    //  ¿La encuesta ya tenía respuestas guardadas?
    // =========================================================

    private function verificarSiTienenRespuestas(PDO $pdo, array $encuestaIds): array
    {
        if (empty($encuestaIds)) {
            return [];
        }

        $ph = implode(',', array_fill(0, count($encuestaIds), '?'));
        $sql = "SELECT DISTINCT encuesta_id FROM respuesta_encuesta WHERE encuesta_id IN ($ph) AND deleted = 0";
        $sth = $pdo->prepare($sql);
        $sth->execute($encuestaIds);

        $conRespuestas = [];
        while ($row = $sth->fetch(PDO::FETCH_COLUMN)) {
            $conRespuestas[$row] = true;
        }

        return $conRespuestas;
    }

    // =========================================================
    //  Borrado en cascada: encuesta + sus respuestas
    // =========================================================

    private function eliminarEncuestasPorIds(PDO $pdo, array $encuestaIds): void
    {
        $ph = implode(',', array_fill(0, count($encuestaIds), '?'));

        $pdo->prepare("UPDATE respuesta_encuesta SET deleted = 1 WHERE encuesta_id IN ($ph) AND deleted = 0")
            ->execute($encuestaIds);

        $pdo->prepare("UPDATE encuesta SET deleted = 1 WHERE id IN ($ph) AND deleted = 0")
            ->execute($encuestaIds);
    }

    // =========================================================
    //  Logging: un resumen general + un detalle por usuario afectado
    // =========================================================

    private function logResultados(PDO $pdo, array $eliminadas, array $tieneRespuestasPorEncuesta): void
    {
        $userIds = array_column($eliminadas, 'usuarioEvaluadoId');
        $teamIds = array_merge(array_column($eliminadas, 'equipoId'), array_column($eliminadas, 'oficinaNuevaId'));
        $nombresUsuarios = $this->nombresPorUsuario($pdo, $userIds);
        $nombresEquipos  = $this->nombresPorEquipo($pdo, $teamIds);

        $conRespuestas = 0;
        foreach ($eliminadas as $enc) {
            if (!empty($tieneRespuestasPorEncuesta[$enc['id']])) {
                $conRespuestas++;
            }

            $nombreUsuario  = $nombresUsuarios[$enc['usuarioEvaluadoId']] ?? $enc['usuarioEvaluadoId'];
            $oficinaVieja   = $nombresEquipos[$enc['equipoId']] ?? $enc['equipoId'];
            $oficinaNueva   = $nombresEquipos[$enc['oficinaNuevaId']] ?? $enc['oficinaNuevaId'];
            $tuvoRespuestas = !empty($tieneRespuestasPorEncuesta[$enc['id']]);

            $this->log(
                'updated',
                'User',
                $enc['usuarioEvaluadoId'],
                $nombreUsuario,
                $tuvoRespuestas ? 'warning' : 'success',
                sprintf(
                    'Se cambió de "%s" a "%s". Se eliminó su encuesta de %s del período activo%s.',
                    $oficinaVieja,
                    $oficinaNueva,
                    $enc['rolUsuario'] === 'asesor' ? 'asesor' : 'gerente',
                    $tuvoRespuestas ? ' (ya tenía respuestas guardadas)' : ' (sin respuestas aún)'
                )
            );
        }

        $this->log(
            'info',
            'User',
            null,
            'Sincronizar Oficina Encuestas',
            'success',
            sprintf(
                'Encuestas eliminadas por cambio de oficina: %d (con respuestas ya guardadas: %d)',
                count($eliminadas),
                $conRespuestas
            )
        );
    }

    private function nombresPorUsuario(PDO $pdo, array $userIds): array
    {
        $userIds = array_values(array_unique(array_filter($userIds)));
        if (empty($userIds)) {
            return [];
        }

        $ph = implode(',', array_fill(0, count($userIds), '?'));
        $sql = "SELECT id, CONCAT(COALESCE(first_name,''),' ',COALESCE(last_name,'')) as nombre
                FROM user WHERE id IN ($ph)";
        $sth = $pdo->prepare($sql);
        $sth->execute($userIds);

        $resultado = [];
        while ($row = $sth->fetch(PDO::FETCH_ASSOC)) {
            $resultado[$row['id']] = trim($row['nombre']) ?: $row['id'];
        }

        return $resultado;
    }

    private function nombresPorEquipo(PDO $pdo, array $teamIds): array
    {
        $teamIds = array_values(array_unique(array_filter($teamIds)));
        if (empty($teamIds)) {
            return [];
        }

        $ph = implode(',', array_fill(0, count($teamIds), '?'));
        $sql = "SELECT id, name FROM team WHERE id IN ($ph)";
        $sth = $pdo->prepare($sql);
        $sth->execute($teamIds);

        $resultado = [];
        while ($row = $sth->fetch(PDO::FETCH_ASSOC)) {
            $resultado[$row['id']] = $row['name'];
        }

        return $resultado;
    }
}
