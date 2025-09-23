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
        // MÉTODO DEPRECATED - Ya no se usa
        // Las preguntas se cargan directamente desde JavaScript via api/v1/Pregunta
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

        // Este método es llamado por competenciasIndex.js
        // La lógica de creación está en el JavaScript, no aquí
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
            
            // Validar datos obligatorios
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
            
            // Iniciar transacción
            $entityManager->getTransactionManager()->start();
            
            // 1. Crear la encuesta principal
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
            
            // Buscar y enlazar equipo si existe teamId
            if (!empty($data->teamId)) {
                $team = $entityManager->getEntity('Team', $data->teamId);
                if ($team) {
                    $encuestaData['equipoId'] = $team->get('id');
                    $encuestaData['equipoName'] = $team->get('name');
                    error_log("Equipo encontrado y enlazado: " . $team->get('name'));
                }
            }
            
            // Buscar y enlazar usuario evaluado si existe userId
            if (!empty($data->userId)) {
                $userEvaluado = $entityManager->getEntity('User', $data->userId);
                if ($userEvaluado) {
                    $encuestaData['usuarioEvaluadoId'] = $userEvaluado->get('id');
                    $encuestaData['usuarioEvaluadoName'] = $userEvaluado->get('name');
                    error_log("Usuario evaluado encontrado y enlazado: " . $userEvaluado->get('name'));
                }
            }
            
            // Enlazar usuario evaluador (actual)
            $userEvaluador = $this->getUser();
            $encuestaData['usuarioEvaluadorId'] = $userEvaluador->get('id');
            $encuestaData['usuarioEvaluadorName'] = $userEvaluador->get('name');
            
            error_log("Creando encuesta con datos: " . print_r($encuestaData, true));
            
            // Crear entidad Encuesta
            $encuesta = $entityManager->createEntity('Encuesta', $encuestaData);
            
            if (!$encuesta) {
                throw new \Exception('No se pudo crear la entidad Encuesta');
            }
            
            $encuestaId = $encuesta->get('id');
            error_log("✅ Encuesta creada con ID: $encuestaId");
            
            // 2. Guardar cada respuesta individual
            $respuestasGuardadas = 0;
            $respuestasConError = 0;
            
            foreach ($data->respuestas as $respuesta) {
                try {
                    // Verificar que la pregunta existe
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
            
            // 3. Actualizar estadísticas finales de la encuesta
            if ($respuestasGuardadas !== $totalRespuestas) {
                $encuesta->set('preguntasRespondidas', $respuestasGuardadas);
                $porcentaje = $totalRespuestas > 0 ? ($respuestasGuardadas / $totalRespuestas) * 100 : 0;
                $encuesta->set('porcentajeCompletado', intval($porcentaje));
                $encuesta->set('fechaModificacion', date('Y-m-d H:i:s'));
                $entityManager->saveEntity($encuesta);
            }
            
            // Confirmar transacción
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
            // Rollback en caso de error
            if ($entityManager->getTransactionManager()->isInTransaction()) {
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

    public function getActionVerificarPreguntas($params, $data, $request)
    {
        try {
            $entityManager = $this->getEntityManager();
            $count = $entityManager->getRepository('Pregunta')->count();
            
            error_log("Verificando preguntas: $count encontradas");
            
            return [
                'success' => true,
                'tienePreguntas' => $count > 0,
                'totalPreguntas' => $count,
                'message' => $count > 0 ? "Se encontraron $count preguntas" : "No hay preguntas creadas"
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

    /**
     * Verificar qué reportes están disponibles para el usuario actual
     */
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
            
            // Obtener estadísticas básicas
            $totalEncuestas = $entityManager->getRepository('Encuesta')->count();
            $encuestasAsesor = $entityManager->getRepository('Encuesta')
                ->where(['rolUsuario' => 'asesor'])
                ->count();
            $encuestasGerente = $entityManager->getRepository('Encuesta')
                ->where(['rolUsuario' => 'gerente'])
                ->count();
            
            error_log("Estadísticas: Total=$totalEncuestas, Asesores=$encuestasAsesor, Gerentes=$encuestasGerente");
            
            $reportesDisponibles = [];
            
            // Por simplicidad, mostrar ambos reportes si hay encuestas
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
    
    /**
     * Obtener los equipos a los que el usuario tiene acceso
     */
    private function obtenerEquiposAccesibles($userId)
    {
        $entityManager = $this->getEntityManager();
        $currentUser = $entityManager->getEntity('User', $userId);
        
        if (!$currentUser) {
            return [];
        }
        
        // Si es admin, tiene acceso a todos los equipos
        if ($currentUser->get('type') === 'admin') {
            $allTeams = $entityManager->getRepository('Team')->find()->toArray();
            error_log("Usuario admin - Acceso a todos los equipos: " . count($allTeams));
            return array_column($allTeams, 'id');
        }
        
        // Para usuarios regulares, obtener equipos donde es miembro
        $userTeams = $currentUser->get('teams');
        $teamIds = [];
        
        if ($userTeams) {
            foreach ($userTeams as $team) {
                $teamIds[] = $team->get('id');
            }
        }
        
        error_log("Usuario regular - Equipos accesibles: " . implode(', ', $teamIds));
        return $teamIds;
    }
    
    /**
     * Verificar si el usuario tiene acceso a encuestas de asesores
     */
    private function verificarAccesoAsesor($userId, $equiposAccesibles)
    {
        if (empty($equiposAccesibles)) {
            return false;
        }
        
        $entityManager = $this->getEntityManager();
        
        // Buscar encuestas de asesores en equipos accesibles
        $encuestasAccesibles = $entityManager->getRepository('Encuesta')
            ->where([
                'rolUsuario' => 'asesor',
                'equipoId' => $equiposAccesibles
            ])
            ->count();
        
        error_log("Encuestas de asesores accesibles: $encuestasAccesibles");
        return $encuestasAccesibles > 0;
    }
    
    /**
     * Verificar si el usuario tiene acceso a encuestas de gerentes
     */
    private function verificarAccesoGerente($userId, $equiposAccesibles)
    {
        if (empty($equiposAccesibles)) {
            return false;
        }
        
        $entityManager = $this->getEntityManager();
        
        // Buscar encuestas de gerentes en equipos accesibles
        $encuestasAccesibles = $entityManager->getRepository('Encuesta')
            ->where([
                'rolUsuario' => 'gerente',
                'equipoId' => $equiposAccesibles
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

        // Retorna la vista principal de reportes, que mostrará los enlaces
        // a los reportes de gerentes y asesores.
        return [
            'view' => 'competencias:reportes'
        ];
    }

    public function actionReporteGerentes($params, $data, $request)
    {
        if (!$this->checkAccess()) {
            throw new \Espo\Core\Exceptions\Forbidden();
        }

        // Retorna la vista específica para el reporte de gerentes.
        return [
            'view' => 'competencias:reporteGerentes'
        ];
    }

    public function actionReporteAsesores($params, $data, $request)
    {
        if (!$this->checkAccess()) {
            throw new \Espo\Core\Exceptions\Forbidden();
        }

        // Retorna la vista específica para el reporte de asesores.
        return [
            'view' => 'competencias:reporteAsesores'
        ];
    }

    /**
     * Método adicional para obtener estadísticas (futuro dashboard)
     */
    public function getActionEstadisticas($params, $data, $request)
    {
        if (!$this->checkAccess()) {
            throw new \Espo\Core\Exceptions\Forbidden();
        }

        try {
            $entityManager = $this->getEntityManager();
            
            $totalEncuestas = $entityManager->getRepository('Encuesta')->count();
            $encuestasGerente = $entityManager->getRepository('Encuesta')
                ->where(['rolUsuario' => 'gerente'])
                ->count();
            $encuestasAsesor = $entityManager->getRepository('Encuesta')
                ->where(['rolUsuario' => 'asesor'])
                ->count();
            
            return [
                'success' => true,
                'totalEncuestas' => $totalEncuestas,
                'encuestasGerente' => $encuestasGerente,
                'encuestasAsesor' => $encuestasAsesor,
                'ultimasEncuestas' => $entityManager->getRepository('Encuesta')
                    ->select(['id', 'name', 'rolUsuario', 'fechaEncuesta', 'porcentajeCompletado'])
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