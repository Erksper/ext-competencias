<?php

namespace Espo\Modules\Competencias\Controllers;

use Espo\Core\Controllers\Record;

class Competencias extends Record
{
    protected function checkAccess(): bool
    {
        return $this->getUser()->isAdmin() || $this->getUser()->isRegular();
    }

    public function getActionGetAsesoresByOficina($params, $data, $request)
    {
        try {
            $oficinaId = $request->get('oficinaId');
            
            if (!$oficinaId) {
                return [
                    'success' => false,
                    'error' => 'ID de oficina no proporcionado'
                ];
            }
            
            $entityManager = $this->getEntityManager();
            $pdo = $entityManager->getPDO();
            
            $sql = "SELECT DISTINCT 
                        u.id, 
                        u.user_name, 
                        u.first_name, 
                        u.last_name,
                        GROUP_CONCAT(DISTINCT LOWER(r.name)) as roles
                    FROM user u
                    INNER JOIN team_user tu ON u.id = tu.user_id
                    LEFT JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                    LEFT JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                    WHERE tu.team_id = ?
                    AND u.deleted = 0
                    AND u.is_active = 1
                    GROUP BY u.id
                    ORDER BY u.first_name, u.last_name, u.user_name";
            
            $sth = $pdo->prepare($sql);
            $sth->execute([$oficinaId]);
            
            $usuarios = [];
            $rolesBusqueda = ['asesor', 'gerente', 'director', 'coordinador'];
            
            while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
                $firstName = $row['first_name'] ?? '';
                $lastName = $row['last_name'] ?? '';
                $userName = $row['user_name'] ?? '';
                
                $fullName = trim($firstName . ' ' . $lastName);
                if (empty($fullName)) {
                    $fullName = $userName;
                }
                if (empty($fullName)) {
                    $fullName = 'Usuario #' . substr($row['id'], 0, 8);
                }
                
                $roles = $row['roles'] ? explode(',', strtolower($row['roles'])) : [];
                
                $tieneRolValido = false;
                foreach ($rolesBusqueda as $rol) {
                    if (in_array($rol, $roles)) {
                        $tieneRolValido = true;
                        break;
                    }
                }
                
                if ($tieneRolValido) {
                    $usuarios[] = [
                        'id' => $row['id'],
                        'name' => $fullName,
                        'userName' => $userName,
                        'roles' => $roles
                    ];
                }
            }
            
            return [
                'success' => true,
                'data' => $usuarios,
                'total' => count($usuarios)
            ];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    public function getActionGetEncuestasByPeriodo($params, $data, $request)
    {
        try {
            $periodoId = $request->get('periodoId');
            $oficinaId = $request->get('oficinaId');
            
            if (!$periodoId) {
                return [
                    'success' => false,
                    'error' => 'ID de período no proporcionado'
                ];
            }
            
            $entityManager = $this->getEntityManager();
            
            $periodo = $entityManager->getEntity('Competencias', $periodoId);
            if (!$periodo) {
                return [
                    'success' => false,
                    'error' => 'Período no encontrado'
                ];
            }
            
            $fechaInicio = $periodo->get('fechaInicio');
            $fechaCierre = $periodo->get('fechaCierre');
            $fechaCierreMax = $fechaCierre . ' 23:59:59';
            
            $where = [
                'fechaCreacion>=' => $fechaInicio,
                'fechaCreacion<=' => $fechaCierreMax,
                'deleted' => 0
            ];
            
            if ($oficinaId) {
                $where['equipoId'] = $oficinaId;
            }
            
            $encuestas = $entityManager->getRepository('Encuesta')
                ->where($where)
                ->select(['id', 'usuarioEvaluadoId', 'estado', 'fechaEncuesta', 'porcentajeCompletado'])
                ->find();
            
            $resultado = [];
            foreach ($encuestas as $encuesta) {
                $resultado[] = [
                    'id' => $encuesta->get('id'),
                    'usuarioEvaluadoId' => $encuesta->get('usuarioEvaluadoId'),
                    'estado' => $encuesta->get('estado'),
                    'fechaEncuesta' => $encuesta->get('fechaEncuesta'),
                    'porcentajeCompletado' => $encuesta->get('porcentajeCompletado')
                ];
            }
            
            return [
                'success' => true,
                'data' => $resultado,
                'total' => count($resultado)
            ];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    public function getActionGetReporteGeneral($params, $data, $request)
    {
        try {
            $periodoId = $request->get('periodoId');
            $rolObjetivo = $request->get('rolObjetivo');
            
            if (!$periodoId || !$rolObjetivo) {
                return [
                    'success' => false,
                    'error' => 'Faltan parámetros requeridos'
                ];
            }
            
            $entityManager = $this->getEntityManager();
            $pdo = $entityManager->getPDO();
            
            $periodo = $entityManager->getEntity('Competencias', $periodoId);
            if (!$periodo) {
                return [
                    'success' => false,
                    'error' => 'Período no encontrado'
                ];
            }
            
            $fechaInicio = $periodo->get('fechaInicio');
            $fechaCierre = $periodo->get('fechaCierre');
            $fechaCierreMax = $fechaCierre . ' 23:59:59';
            
            if ($rolObjetivo === 'gerente') {
                $sqlPreguntas = "SELECT 
                                    p.id,
                                    p.categoria,
                                    p.sub_categoria,
                                    p.orden,
                                    p.texto_pregunta as texto
                                 FROM pregunta p
                                 WHERE p.esta_activa = 1
                                 AND p.deleted = 0
                                 AND p.rol_objetivo LIKE '%\"gerente\"%'
                                 ORDER BY p.categoria, p.sub_categoria, p.orden";
            } else {
                $sqlPreguntas = "SELECT 
                                    p.id,
                                    p.categoria,
                                    p.sub_categoria,
                                    p.orden,
                                    p.texto_pregunta as texto
                                 FROM pregunta p
                                 WHERE p.esta_activa = 1
                                 AND p.deleted = 0
                                 AND p.rol_objetivo LIKE '%\"asesor\"%'
                                 ORDER BY p.categoria, p.sub_categoria, p.orden";
            }
            
            $sth = $pdo->prepare($sqlPreguntas);
            $sth->execute();
            
            $preguntas = $sth->fetchAll(\PDO::FETCH_ASSOC);
            
            $sqlOficinas = "SELECT DISTINCT t.id, t.name
                            FROM team t
                            WHERE t.id NOT LIKE 'CLA%'
                            AND LOWER(t.id) != 'venezuela'
                            AND LOWER(t.name) != 'venezuela'
                            AND t.deleted = 0
                            ORDER BY t.name";
            
            $sth = $pdo->prepare($sqlOficinas);
            $sth->execute();
            $oficinas = $sth->fetchAll(\PDO::FETCH_ASSOC);
            
            $sqlEncuestas = "SELECT 
                                e.id,
                                e.equipo_id as equipoId,
                                t.name as equipoName,
                                e.usuario_evaluado_id as usuarioEvaluadoId,
                                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as usuarioEvaluadoName
                             FROM encuesta e
                             LEFT JOIN team t ON e.equipo_id = t.id AND t.deleted = 0
                             LEFT JOIN user u ON e.usuario_evaluado_id = u.id AND u.deleted = 0
                             WHERE e.rol_usuario = :rolUsuario
                             AND e.fecha_creacion >= :fechaInicio
                             AND e.fecha_creacion <= :fechaCierre
                             AND e.deleted = 0
                             ORDER BY e.fecha_creacion DESC";
            
            $sth = $pdo->prepare($sqlEncuestas);
            $sth->bindValue(':rolUsuario', $rolObjetivo);
            $sth->bindValue(':fechaInicio', $fechaInicio);
            $sth->bindValue(':fechaCierre', $fechaCierreMax);
            $sth->execute();
            
            $encuestas = $sth->fetchAll(\PDO::FETCH_ASSOC);
            
            if (empty($encuestas)) {
                return [
                    'success' => true,
                    'preguntas' => $this->_agruparPreguntas($preguntas),
                    'oficinas' => [],
                    'totalesPorPregunta' => [],
                    'totalesGenerales' => ['verdes' => 0, 'amarillos' => 0, 'rojos' => 0, 'total' => 0, 'porcentaje' => 0, 'color' => 'gris']
                ];
            }
            
            $encuestasIds = array_column($encuestas, 'id');
            
            if (empty($encuestasIds)) {
                $respuestas = [];
            } else {
                $placeholders = implode(',', array_fill(0, count($encuestasIds), '?'));
                
                $sqlRespuestas = "SELECT 
                                    r.encuesta_id as encuestaId,
                                    r.pregunta_id as preguntaId,
                                    r.respuesta
                                  FROM respuesta_encuesta r
                                  WHERE r.encuesta_id IN ($placeholders)
                                  AND r.deleted = 0";
                
                $sth = $pdo->prepare($sqlRespuestas);
                $sth->execute($encuestasIds);
                $respuestas = $sth->fetchAll(\PDO::FETCH_ASSOC);
            }
            
            $resultado = $this->_procesarDatosReporteGeneral(
                $preguntas, 
                $oficinas, 
                $encuestas, 
                $respuestas
            );
            
            return [
                'success' => true,
                'preguntas' => $this->_agruparPreguntas($preguntas),
                'oficinas' => $resultado['oficinas'],
                'totalesPorPregunta' => $resultado['totalesPorPregunta'],
                'totalesGenerales' => $resultado['totalesGenerales']
            ];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    private function _agruparPreguntas($preguntas)
    {
        $agrupadas = [];
        foreach ($preguntas as $p) {
            $cat = $p['categoria'] ?? 'Sin Categoría';
            $sub = $p['sub_categoria'] ?? 'General';
            
            if (!isset($agrupadas[$cat])) {
                $agrupadas[$cat] = [];
            }
            if (!isset($agrupadas[$cat][$sub])) {
                $agrupadas[$cat][$sub] = [];
            }
            
            $agrupadas[$cat][$sub][] = [
                'id' => $p['id'],
                'texto' => $p['texto'],
                'orden' => $p['orden'] ?? 0
            ];
        }
        
        foreach ($agrupadas as $cat => $subcats) {
            foreach ($subcats as $sub => $pregs) {
                usort($pregs, function($a, $b) {
                    return ($a['orden'] ?? 0) - ($b['orden'] ?? 0);
                });
                $agrupadas[$cat][$sub] = $pregs;
            }
        }
        
        return $agrupadas;
    }

    private function _procesarDatosReporteGeneral($preguntas, $oficinas, $encuestas, $respuestas)
    {
        $encuestasMap = [];
        foreach ($encuestas as $e) {
            $encuestasMap[$e['id']] = $e;
        }
        
        $preguntasIds = array_column($preguntas, 'id');
        $oficinasMap = [];
        $totalesPorPregunta = [];
        $totalesGenerales = ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0];
        
        foreach ($oficinas as $o) {
            $oficinasMap[$o['id']] = [
                'id' => $o['id'],
                'name' => $o['name'],
                'totalesPorPregunta' => [],
                'totalesOficina' => ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0]
            ];
            
            foreach ($preguntasIds as $pid) {
                $oficinasMap[$o['id']]['totalesPorPregunta'][$pid] = [
                    'verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0
                ];
            }
        }
        
        foreach ($preguntasIds as $pid) {
            $totalesPorPregunta[$pid] = [
                'verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0
            ];
        }
        
        foreach ($respuestas as $r) {
            $encuestaId = $r['encuestaId'];
            $preguntaId = $r['preguntaId'];
            $color = $r['respuesta'];
            
            if (!isset($encuestasMap[$encuestaId])) {
                continue;
            }
            
            $oficinaId = $encuestasMap[$encuestaId]['equipoId'];
            
            if (!isset($oficinasMap[$oficinaId])) {
                continue;
            }
            
            if (!isset($totalesPorPregunta[$preguntaId])) {
                continue;
            }
            
            if (isset($oficinasMap[$oficinaId]['totalesPorPregunta'][$preguntaId])) {
                $oficinasMap[$oficinaId]['totalesPorPregunta'][$preguntaId]['total']++;
                $oficinasMap[$oficinaId]['totalesPorPregunta'][$preguntaId][$color]++;
                
                $oficinasMap[$oficinaId]['totalesOficina']['total']++;
                $oficinasMap[$oficinaId]['totalesOficina'][$color]++;
            }
            
            if (isset($totalesPorPregunta[$preguntaId])) {
                $totalesPorPregunta[$preguntaId]['total']++;
                $totalesPorPregunta[$preguntaId][$color]++;
            }
            
            $totalesGenerales['total']++;
            $totalesGenerales[$color]++;
        }
        
        foreach ($oficinasMap as &$oficina) {
            foreach ($oficina['totalesPorPregunta'] as $pid => &$pregunta) {
                if ($pregunta['total'] > 0) {
                    $pregunta['porcentaje'] = round(($pregunta['verde'] / $pregunta['total']) * 100, 1);
                    $pregunta['color'] = $this->_calcularColor(
                        $pregunta['verde'], 
                        $pregunta['amarillo'], 
                        $pregunta['rojo'], 
                        $pregunta['total']
                    );
                } else {
                    $pregunta['porcentaje'] = 0;
                    $pregunta['color'] = 'gris';
                }
            }
            
            $ot = &$oficina['totalesOficina'];
            if ($ot['total'] > 0) {
                $ot['porcentaje'] = round(($ot['verde'] / $ot['total']) * 100, 1);
                $ot['color'] = $this->_calcularColor(
                    $ot['verde'], 
                    $ot['amarillo'], 
                    $ot['rojo'], 
                    $ot['total']
                );
            } else {
                $ot['porcentaje'] = 0;
                $ot['color'] = 'gris';
            }
        }
        
        foreach ($totalesPorPregunta as $pid => &$pregunta) {
            if ($pregunta['total'] > 0) {
                $pregunta['porcentaje'] = round(($pregunta['verde'] / $pregunta['total']) * 100, 1);
                $pregunta['color'] = $this->_calcularColor(
                    $pregunta['verde'], 
                    $pregunta['amarillo'], 
                    $pregunta['rojo'], 
                    $pregunta['total']
                );
            } else {
                $pregunta['porcentaje'] = 0;
                $pregunta['color'] = 'gris';
            }
        }
        
        if ($totalesGenerales['total'] > 0) {
            $totalesGenerales['porcentaje'] = round(($totalesGenerales['verde'] / $totalesGenerales['total']) * 100, 1);
            $totalesGenerales['color'] = $this->_calcularColor(
                $totalesGenerales['verde'],
                $totalesGenerales['amarillo'],
                $totalesGenerales['rojo'],
                $totalesGenerales['total']
            );
        } else {
            $totalesGenerales['porcentaje'] = 0;
            $totalesGenerales['color'] = 'gris';
        }
        
        $oficinasConDatos = array_filter($oficinasMap, function($oficina) {
            return $oficina['totalesOficina']['total'] > 0;
        });
        
        return [
            'oficinas' => array_values($oficinasConDatos),
            'totalesPorPregunta' => $totalesPorPregunta,
            'totalesGenerales' => $totalesGenerales
        ];
    }

    private function _calcularColor($verde, $amarillo, $rojo, $total)
    {
        if ($total === 0) return 'gris';
        
        $pV = ($verde / $total) * 100;
        $pA = ($amarillo / $total) * 100;
        $pR = ($rojo / $total) * 100;
        
        if ($pV >= 80) return 'verde';
        if ($pV >= 60) return 'amarillo';
        
        if ($pV >= 40) {
            if ($pR === 0) return 'amarillo';
            if ($pA >= $pR) return 'amarillo';
            return 'rojo';
        }
        
        return 'rojo';
    }

    public function getActionGetUserInfo($params, $data, $request)
    {
        try {
            $user = $this->getUser();
            $userId = $user->get('id');
            
            $entityManager = $this->getEntityManager();
            $pdo = $entityManager->getPDO();
            
            $sql = "SELECT 
                        u.id,
                        u.type,
                        u.user_name as userName,
                        u.first_name as firstName,
                        u.last_name as lastName,
                        GROUP_CONCAT(DISTINCT LOWER(r.name)) as roles
                    FROM user u
                    LEFT JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                    LEFT JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                    WHERE u.id = ?
                    AND u.deleted = 0
                    GROUP BY u.id";
            
            $sth = $pdo->prepare($sql);
            $sth->execute([$userId]);
            $userData = $sth->fetch(\PDO::FETCH_ASSOC);
            
            if (!$userData) {
                return [
                    'success' => false,
                    'error' => 'Usuario no encontrado'
                ];
            }
            
            $roles = $userData['roles'] ? explode(',', $userData['roles']) : [];
            
            $sqlTeams = "SELECT t.id, t.name
                        FROM team t
                        INNER JOIN team_user tu ON t.id = tu.team_id
                        WHERE tu.user_id = ?
                        AND tu.deleted = 0
                        AND t.deleted = 0";
            
            $sthTeams = $pdo->prepare($sqlTeams);
            $sthTeams->execute([$userId]);
            
            $teamIds = [];
            $teamNames = [];
            $claPattern = '/^CLA\d+$/i';
            $claId = null;
            $oficinaId = null;
            
            while ($row = $sthTeams->fetch(\PDO::FETCH_ASSOC)) {
                $teamIds[] = $row['id'];
                $teamNames[$row['id']] = $row['name'];
                
                if (preg_match($claPattern, $row['id'])) {
                    $claId = $row['id'];
                } elseif (strtolower($row['id']) !== 'venezuela' && strtolower($row['name']) !== 'venezuela') {
                    if (!$oficinaId) {
                        $oficinaId = $row['id'];
                    }
                }
            }
            
            return [
                'success' => true,
                'data' => [
                    'id' => $userId,
                    'type' => $userData['type'] ?? 'regular',
                    'name' => trim($userData['firstName'] . ' ' . $userData['lastName']) ?: $userData['userName'],
                    'userName' => $userData['userName'],
                    'roles' => $roles,
                    'teamIds' => $teamIds,
                    'teamNames' => $teamNames,
                    'claId' => $claId,
                    'oficinaId' => $oficinaId,
                    'esCasaNacional' => in_array('casa nacional', $roles),
                    'esGerente' => in_array('gerente', $roles) || in_array('director', $roles) || in_array('coordinador', $roles),
                    'esAsesor' => in_array('asesor', $roles)
                ]
            ];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    public function getActionGetOficinasByCLA($params, $data, $request)
    {
        try {
            $claId = $request->get('claId');
            
            if (!$claId) {
                return [
                    'success' => false,
                    'error' => 'ID de CLA no proporcionado'
                ];
            }
            
            $entityManager = $this->getEntityManager();
            $pdo = $entityManager->getPDO();
            
            $sqlUsuarios = "SELECT DISTINCT user_id 
                            FROM team_user 
                            WHERE team_id = :claId 
                            AND deleted = 0";
            
            $sthUsuarios = $pdo->prepare($sqlUsuarios);
            $sthUsuarios->bindValue(':claId', $claId);
            $sthUsuarios->execute();
            
            $usuariosDelCLA = [];
            while ($row = $sthUsuarios->fetch(\PDO::FETCH_ASSOC)) {
                $usuariosDelCLA[] = $row['user_id'];
            }
            
            if (empty($usuariosDelCLA)) {
                return [
                    'success' => true,
                    'data' => []
                ];
            }
            
            $placeholders = implode(',', array_fill(0, count($usuariosDelCLA), '?'));
            
            $sqlOficinas = "SELECT DISTINCT t.id, t.name
                            FROM team_user tu
                            INNER JOIN team t ON tu.team_id = t.id
                            WHERE tu.user_id IN ($placeholders)
                            AND t.id NOT LIKE 'CLA%'
                            AND LOWER(t.id) != 'venezuela'
                            AND LOWER(t.name) != 'venezuela'
                            AND tu.deleted = 0
                            AND t.deleted = 0
                            ORDER BY t.name";
            
            $sthOficinas = $pdo->prepare($sqlOficinas);
            $sthOficinas->execute($usuariosDelCLA);
            
            $oficinas = [];
            while ($row = $sthOficinas->fetch(\PDO::FETCH_ASSOC)) {
                $oficinas[] = [
                    'id' => $row['id'],
                    'name' => $row['name']
                ];
            }
            
            return [
                'success' => true,
                'data' => $oficinas,
                'total' => count($oficinas)
            ];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    public function getActionGetCLAs($params, $data, $request)
    {
        try {
            $entityManager = $this->getEntityManager();
            $pdo = $entityManager->getPDO();
            
            $sql = "SELECT id, name 
                    FROM team 
                    WHERE id LIKE 'CLA%' 
                    AND deleted = 0 
                    ORDER BY name";
            
            $sth = $pdo->prepare($sql);
            $sth->execute();
            
            $clas = [];
            while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
                $clas[] = [
                    'id' => $row['id'],
                    'name' => $row['name']
                ];
            }
            
            return [
                'success' => true,
                'data' => $clas
            ];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
}