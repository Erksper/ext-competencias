<?php

namespace Espo\Modules\Competencias\Controllers;

use Espo\Core\Controllers\Record;

class Competencias extends Record
{
    protected function checkAccess(): bool
    {
        return $this->getUser()->isAdmin() || $this->getUser()->isRegular();
    }

    public function postActionObtenerPreguntasPorRol($params, $data, $request, $response)
    {
        error_log("MÉTODO DEPRECATED: obtenerPreguntasPorRol - Se carga desde JS ahora");
        
        return [
            'success' => true,
            'preguntas' => [],
            'total' => 0,
            'rol' => $data->rol ?? 'unknown',
            'debug' => 'MÉTODO DEPRECATED - Se carga desde JavaScript ahora'
        ];
    }

    public function postActionCrearPreguntas($params, $data, $request)
    {
        error_log("=== crearPreguntas llamado desde competenciasIndex.js ===");
        
        if (!$this->checkAccess()) {
            throw new \Espo\Core\Exceptions\Forbidden();
        }

        return [
            'success' => true,
            'message' => 'Las preguntas son creadas directamente por competenciasIndex.js',
            'preguntasCreadas' => 0,
            'preguntasExistentes' => 48
        ];
    }

    public function postActionGuardarEncuesta($params, $data, $request)
    {
        error_log("=== INICIO guardarEncuesta REAL ===");
        
        if (!$this->checkAccess()) {
            throw new \Espo\Core\Exceptions\Forbidden();
        }

        try {
            error_log("Datos encuesta recibidos: " . print_r($data, true));
            
            if (empty($data->evaluado) || empty($data->rol) || empty($data->respuestas)) {
                throw new \Exception('Faltan datos obligatorios para guardar la encuesta');
            }
            
            $evaluado = $data->evaluado;
            $evaluador = $data->evaluador ?? $this->getUser()->get('name');
            $rol = $data->rol;
            $equipo = $data->equipo ?? 'Sin equipo';
            $totalRespuestas = count($data->respuestas);
            
            error_log("GUARDANDO REAL - Evaluado: $evaluado, Evaluador: $evaluador, Rol: $rol, Respuestas: $totalRespuestas");
            
            $entityManager = $this->getEntityManager();
            
            $entityManager->getTransactionManager()->start();
            
            $encuestaData = [
                'name' => 'Evaluación ' . $evaluado . ' - ' . date('Y-m-d H:i:s'),
                'rolUsuario' => $rol,
                'fechaEncuesta' => date('Y-m-d H:i:s'),
                'estado' => 'completada',
                'totalPreguntas' => $totalRespuestas,
                'preguntasRespondidas' => $totalRespuestas,
                'porcentajeCompletado' => 100,
                'fechaCreacion' => date('Y-m-d H:i:s'),
                'fechaModificacion' => date('Y-m-d H:i:s'),
                'observaciones' => 'Encuesta completada desde el módulo web'
            ];
            
            if (!empty($data->teamId)) {
                $team = $entityManager->getEntity('Team', $data->teamId);
                if ($team) {
                    $encuestaData['equipoId'] = $team->get('id');
                    $encuestaData['equipoName'] = $team->get('name');
                    error_log("Equipo encontrado y enlazado: " . $team->get('name'));
                }
            }
            
            if (!empty($data->userId)) {
                $userEvaluado = $entityManager->getEntity('User', $data->userId);
                if ($userEvaluado) {
                    $encuestaData['usuarioEvaluadoId'] = $userEvaluado->get('id');
                    $encuestaData['usuarioEvaluadoName'] = $userEvaluado->get('name');
                    error_log("Usuario evaluado encontrado y enlazado: " . $userEvaluado->get('name'));
                }
            }
            
            $userEvaluador = $this->getUser();
            $encuestaData['usuarioEvaluadorId'] = $userEvaluador->get('id');
            $encuestaData['usuarioEvaluadorName'] = $userEvaluador->get('name');
            
            error_log("Creando encuesta con datos: " . print_r($encuestaData, true));
            
            $encuesta = $entityManager->createEntity('Encuesta', $encuestaData);
            
            if (!$encuesta) {
                throw new \Exception('No se pudo crear la entidad Encuesta');
            }
            
            $encuestaId = $encuesta->get('id');
            error_log("✅ Encuesta creada con ID: $encuestaId");
            
            $respuestasGuardadas = 0;
            $respuestasConError = 0;
            
            foreach ($data->respuestas as $respuesta) {
                try {
                    $pregunta = $entityManager->getEntity('Pregunta', $respuesta->pregunta);
                    
                    if (!$pregunta) {
                        error_log("⚠️  Pregunta no encontrada: " . $respuesta->pregunta);
                        $respuestasConError++;
                        continue;
                    }
                    
                    $respuestaData = [
                        'name' => 'Respuesta - ' . substr($pregunta->get('textoPregunta', 'Pregunta'), 0, 50) . '...',
                        'encuestaId' => $encuestaId,
                        'encuestaName' => $encuesta->get('name'),
                        'preguntaId' => $respuesta->pregunta,
                        'preguntaName' => $pregunta->get('textoPregunta') ?: $pregunta->get('name'),
                        'respuesta' => $respuesta->color,
                        'fechaCreacion' => date('Y-m-d H:i:s'),
                        'fechaModificacion' => date('Y-m-d H:i:s')
                    ];
                    
                    if (!empty($respuesta->comentario)) {
                        $respuestaData['comentario'] = $respuesta->comentario;
                    }
                    
                    $respuestaEntity = $entityManager->createEntity('RespuestaEncuesta', $respuestaData);
                    
                    if ($respuestaEntity) {
                        $respuestasGuardadas++;
                        error_log("✅ Respuesta guardada ID: " . $respuestaEntity->get('id') . " para pregunta: " . $respuesta->pregunta);
                    } else {
                        $respuestasConError++;
                        error_log("❌ Error creando RespuestaEncuesta para pregunta: " . $respuesta->pregunta);
                    }
                    
                } catch (\Exception $e) {
                    $respuestasConError++;
                    error_log("❌ Error procesando respuesta: " . $e->getMessage() . " - Pregunta: " . $respuesta->pregunta);
                }
            }
            
            if ($respuestasGuardadas !== $totalRespuestas) {
                $encuesta->set('preguntasRespondidas', $respuestasGuardadas);
                $porcentaje = $totalRespuestas > 0 ? ($respuestasGuardadas / $totalRespuestas) * 100 : 0;
                $encuesta->set('porcentajeCompletado', intval($porcentaje));
                $encuesta->set('fechaModificacion', date('Y-m-d H:i:s'));
                $entityManager->saveEntity($encuesta);
            }
            
            $entityManager->getTransactionManager()->commit();
            
            error_log("=== ENCUESTA GUARDADA EXITOSAMENTE ===");
            error_log("Encuesta ID: $encuestaId");
            error_log("Respuestas guardadas: $respuestasGuardadas");
            error_log("Respuestas con error: $respuestasConError");
            error_log("=== FIN guardarEncuesta REAL ===");

            return [
                'success' => true,
                'encuestaId' => $encuestaId,
                'respuestasGuardadas' => $respuestasGuardadas,
                'respuestasConError' => $respuestasConError,
                'message' => "Encuesta guardada exitosamente. $respuestasGuardadas de $totalRespuestas respuestas procesadas.",
                'porcentajeExito' => $totalRespuestas > 0 ? round(($respuestasGuardadas / $totalRespuestas) * 100, 2) : 0
            ];

        } catch (\Exception $e) {
            if (isset($entityManager) && $entityManager->getTransactionManager()->isInTransaction()) {
                $entityManager->getTransactionManager()->rollback();
            }
            
            error_log('❌ ERROR CRÍTICO guardando encuesta: ' . $e->getMessage());
            error_log('Stack trace: ' . $e->getTraceAsString());
            
            return [
                'success' => false,
                'error' => 'Error al guardar la encuesta: ' . $e->getMessage(),
                'details' => $e->getTraceAsString()
            ];
        }
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
            
            // Obtener TODOS los usuarios de la oficina (activos)
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
                // Construir nombre completo
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
                
                // Procesar roles
                $roles = $row['roles'] ? explode(',', strtolower($row['roles'])) : [];
                
                // Verificar si tiene alguno de los roles buscados
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
            
            // Obtener fechas del período
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
            
            // Construir where
            $where = [
                'fechaCreacion>=' => $fechaInicio,
                'fechaCreacion<=' => $fechaCierreMax,
                'deleted' => 0
            ];
            
            if ($oficinaId) {
                $where['equipoId'] = $oficinaId;
            }
            
            // Obtener encuestas
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

    // ============================================================
    // ENDPOINT PARA REPORTE GENERAL (CORREGIDO CON DELETED=0)
    // ============================================================
    
    public function getActionGetReporteGeneral($params, $data, $request)
    {
        try {
            $periodoId = $request->get('periodoId');
            $rolObjetivo = $request->get('rolObjetivo'); // 'asesor' o 'gerente'
            
            if (!$periodoId || !$rolObjetivo) {
                return [
                    'success' => false,
                    'error' => 'Faltan parámetros requeridos'
                ];
            }
            
            $entityManager = $this->getEntityManager();
            $pdo = $entityManager->getPDO();
            
            // 1. Obtener fechas del período
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
            
            // 2. Obtener preguntas activas del rol - CORREGIDO CON DELETED=0
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
            error_log("Preguntas activas para rol $rolObjetivo: " . count($preguntas));
            
            // 3. Obtener todas las oficinas (excluyendo CLAs y Venezuela) - solo activas
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
            
            // 4. Obtener todas las encuestas del período para el rol
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
            
            // 5. Obtener todas las respuestas de esas encuestas
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
            
            // 6. Procesar datos en backend
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
            error_log('❌ Error en getReporteGeneral: ' . $e->getMessage());
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
        
        // Ordenar preguntas por orden dentro de cada subcategoría
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
        // Mapear encuestas por ID para acceso rápido
        $encuestasMap = [];
        foreach ($encuestas as $e) {
            $encuestasMap[$e['id']] = $e;
        }
        
        // Inicializar estructuras
        $preguntasIds = array_column($preguntas, 'id');
        $oficinasMap = [];
        $totalesPorPregunta = [];
        $totalesGenerales = ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0];
        
        // Inicializar oficinas
        foreach ($oficinas as $o) {
            $oficinasMap[$o['id']] = [
                'id' => $o['id'],
                'name' => $o['name'],
                'totalesPorPregunta' => [],
                'totalesOficina' => ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0]
            ];
            
            // Inicializar cada pregunta para esta oficina
            foreach ($preguntasIds as $pid) {
                $oficinasMap[$o['id']]['totalesPorPregunta'][$pid] = [
                    'verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0
                ];
            }
        }
        
        // Inicializar totales por pregunta (global)
        foreach ($preguntasIds as $pid) {
            $totalesPorPregunta[$pid] = [
                'verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0
            ];
        }
        
        // Procesar cada respuesta
        foreach ($respuestas as $r) {
            $encuestaId = $r['encuestaId'];
            $preguntaId = $r['preguntaId'];
            $color = $r['respuesta'];
            
            // Validar que la encuesta existe
            if (!isset($encuestasMap[$encuestaId])) {
                continue;
            }
            
            $oficinaId = $encuestasMap[$encuestaId]['equipoId'];
            
            // Validar que la oficina existe
            if (!isset($oficinasMap[$oficinaId])) {
                continue;
            }
            
            // Validar que la pregunta existe en los totales
            if (!isset($totalesPorPregunta[$preguntaId])) {
                continue;
            }
            
            // Actualizar totales de oficina por pregunta
            if (isset($oficinasMap[$oficinaId]['totalesPorPregunta'][$preguntaId])) {
                $oficinasMap[$oficinaId]['totalesPorPregunta'][$preguntaId]['total']++;
                $oficinasMap[$oficinaId]['totalesPorPregunta'][$preguntaId][$color]++;
                
                // Actualizar totales generales de oficina
                $oficinasMap[$oficinaId]['totalesOficina']['total']++;
                $oficinasMap[$oficinaId]['totalesOficina'][$color]++;
            }
            
            // Actualizar totales por pregunta (global)
            if (isset($totalesPorPregunta[$preguntaId])) {
                $totalesPorPregunta[$preguntaId]['total']++;
                $totalesPorPregunta[$preguntaId][$color]++;
            }
            
            // Actualizar totales generales
            $totalesGenerales['total']++;
            $totalesGenerales[$color]++;
        }
        
        // Calcular porcentajes y colores para cada oficina (por pregunta)
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
            
            // Calcular totales de oficina
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
        
        // Calcular porcentajes y colores por pregunta (global)
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
        
        // Calcular totales generales
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
        
        // Filtrar oficinas que tienen al menos una encuesta
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
            
            // Obtener información del usuario
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
            
            // Procesar roles
            $roles = $userData['roles'] ? explode(',', $userData['roles']) : [];
            
            // Obtener equipos del usuario
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
            
            // Obtener usuarios del CLA
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
            
            // Obtener oficinas de esos usuarios
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

    public function getActionVerificarPreguntas($params, $data, $request)
    {
        try {
            $entityManager = $this->getEntityManager();
            $count = $entityManager->getRepository('Pregunta')
                ->where(['deleted' => 0])
                ->count();
            
            error_log("Verificando preguntas activas: $count encontradas");
            
            return [
                'success' => true,
                'tienePreguntas' => $count > 0,
                'totalPreguntas' => $count,
                'message' => $count > 0 ? "Se encontraron $count preguntas activas" : "No hay preguntas creadas"
            ];
        } catch (\Exception $e) {
            error_log('Error verificando preguntas: ' . $e->getMessage());
            return [
                'success' => false,
                'tienePreguntas' => false,
                'totalPreguntas' => 0,
                'error' => $e->getMessage()
            ];
        }
    }

    public function postActionVerificarReportesDisponibles($params, $data, $request)
    {
        error_log("=== INICIO verificarReportesDisponibles ===");
        
        if (!$this->checkAccess()) {
            throw new \Espo\Core\Exceptions\Forbidden();
        }

        try {
            $userId = $data->userId ?? $this->getUser()->get('id');
            $userName = $data->userName ?? $this->getUser()->get('name');
            
            error_log("Verificando reportes para usuario: $userName (ID: $userId)");
            
            $entityManager = $this->getEntityManager();
            
            $totalEncuestas = $entityManager->getRepository('Encuesta')
                ->where(['deleted' => 0])
                ->count();
                
            $encuestasAsesor = $entityManager->getRepository('Encuesta')
                ->where(['rolUsuario' => 'asesor', 'deleted' => 0])
                ->count();
                
            $encuestasGerente = $entityManager->getRepository('Encuesta')
                ->where(['rolUsuario' => 'gerente', 'deleted' => 0])
                ->count();
            
            error_log("Estadísticas: Total=$totalEncuestas, Asesores=$encuestasAsesor, Gerentes=$encuestasGerente");
            
            $reportesDisponibles = [];
            
            if ($encuestasAsesor > 0) {
                $reportesDisponibles[] = [
                    'tipo' => 'asesores',
                    'titulo' => 'Reporte de Asesores',
                    'descripcion' => 'Matriz de competencias evaluadas para todos los asesores',
                    'icono' => 'fa-users',
                    'disponible' => true,
                    'cantidadEncuestas' => $encuestasAsesor
                ];
            }
            
            if ($encuestasGerente > 0) {
                $reportesDisponibles[] = [
                    'tipo' => 'gerentes',
                    'titulo' => 'Reporte de Gerentes',
                    'descripcion' => 'Matriz de competencias evaluadas para gerentes y directores',
                    'icono' => 'fa-user-tie',
                    'disponible' => true,
                    'cantidadEncuestas' => $encuestasGerente
                ];
            }
            
            $estadisticas = [
                'totalEncuestas' => $totalEncuestas,
                'encuestasAsesor' => $encuestasAsesor,
                'encuestasGerente' => $encuestasGerente
            ];
            
            error_log("=== FIN verificarReportesDisponibles - Reportes: " . count($reportesDisponibles) . " ===");
            
            return [
                'success' => true,
                'reportes' => $reportesDisponibles,
                'estadisticas' => $estadisticas
            ];

        } catch (\Exception $e) {
            error_log('ERROR verificando reportes: ' . $e->getMessage());
            
            return [
                'success' => false,
                'error' => 'Error al verificar reportes: ' . $e->getMessage(),
                'reportes' => [],
                'estadisticas' => []
            ];
        }
    }
    
    private function obtenerEquiposAccesibles($userId)
    {
        $entityManager = $this->getEntityManager();
        $currentUser = $entityManager->getEntity('User', $userId);
        
        if (!$currentUser) {
            return [];
        }
        
        if ($currentUser->get('type') === 'admin') {
            $allTeams = $entityManager->getRepository('Team')
                ->where(['deleted' => 0])
                ->find()
                ->toArray();
            error_log("Usuario admin - Acceso a todos los equipos: " . count($allTeams));
            return array_column($allTeams, 'id');
        }
        
        $userTeams = $currentUser->get('teams');
        $teamIds = [];
        
        if ($userTeams) {
            foreach ($userTeams as $team) {
                if (!$team->get('deleted')) {
                    $teamIds[] = $team->get('id');
                }
            }
        }
        
        error_log("Usuario regular - Equipos accesibles: " . implode(', ', $teamIds));
        return $teamIds;
    }
    
    private function verificarAccesoAsesor($userId, $equiposAccesibles)
    {
        if (empty($equiposAccesibles)) {
            return false;
        }
        
        $entityManager = $this->getEntityManager();
        
        $encuestasAccesibles = $entityManager->getRepository('Encuesta')
            ->where([
                'rolUsuario' => 'asesor',
                'equipoId' => $equiposAccesibles,
                'deleted' => 0
            ])
            ->count();
        
        error_log("Encuestas de asesores accesibles: $encuestasAccesibles");
        return $encuestasAccesibles > 0;
    }
    
    private function verificarAccesoGerente($userId, $equiposAccesibles)
    {
        if (empty($equiposAccesibles)) {
            return false;
        }
        
        $entityManager = $this->getEntityManager();
        
        $encuestasAccesibles = $entityManager->getRepository('Encuesta')
            ->where([
                'rolUsuario' => 'gerente',
                'equipoId' => $equiposAccesibles,
                'deleted' => 0
            ])
            ->count();
        
        error_log("Encuestas de gerentes accesibles: $encuestasAccesibles");
        return $encuestasAccesibles > 0;
    }

    public function actionReports($params, $data, $request)
    {
        if (!$this->checkAccess()) {
            throw new \Espo\Core\Exceptions\Forbidden();
        }

        return [
            'view' => 'competencias:reportes'
        ];
    }

    public function actionReporteGerentes($params, $data, $request)
    {
        if (!$this->checkAccess()) {
            throw new \Espo\Core\Exceptions\Forbidden();
        }

        return [
            'view' => 'competencias:reporteGerentes'
        ];
    }

    public function actionReporteAsesores($params, $data, $request)
    {
        if (!$this->checkAccess()) {
            throw new \Espo\Core\Exceptions\Forbidden();
        }

        return [
            'view' => 'competencias:reporteAsesores'
        ];
    }

    public function getActionEstadisticas($params, $data, $request)
    {
        if (!$this->checkAccess()) {
            throw new \Espo\Core\Exceptions\Forbidden();
        }

        try {
            $entityManager = $this->getEntityManager();
            
            $totalEncuestas = $entityManager->getRepository('Encuesta')
                ->where(['deleted' => 0])
                ->count();
                
            $encuestasGerente = $entityManager->getRepository('Encuesta')
                ->where(['rolUsuario' => 'gerente', 'deleted' => 0])
                ->count();
                
            $encuestasAsesor = $entityManager->getRepository('Encuesta')
                ->where(['rolUsuario' => 'asesor', 'deleted' => 0])
                ->count();
            
            return [
                'success' => true,
                'totalEncuestas' => $totalEncuestas,
                'encuestasGerente' => $encuestasGerente,
                'encuestasAsesor' => $encuestasAsesor,
                'ultimasEncuestas' => $entityManager->getRepository('Encuesta')
                    ->select(['id', 'name', 'rolUsuario', 'fechaEncuesta', 'porcentajeCompletado'])
                    ->where(['deleted' => 0])
                    ->order('fechaEncuesta', 'DESC')
                    ->limit(0, 10)
                    ->find()
                    ->toArray()
            ];
        } catch (\Exception $e) {
            error_log('Error obteniendo estadísticas: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
}