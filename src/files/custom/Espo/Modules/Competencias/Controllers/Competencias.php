<?php

namespace Espo\Modules\Competencias\Controllers;

use Espo\Core\Controllers\Base;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;

class Competencias extends Base
{
    public function actionIndex()
    {
        return [
            'view' => 'CompetenciasIndex'
        ];
    }

    // Action estándar para obtener equipos
    public function getActionObtenerEquipos(Request $request, Response $response): void
    {
        $equipos = $this->getEntityManager()
            ->getRepository('Team')
            ->find();

        $resultado = [];
        foreach ($equipos as $equipo) {
            $resultado[] = [
                'id' => $equipo->get('id'),
                'name' => $equipo->get('name')
            ];
        }

        $response->writeBody(json_encode($resultado));
        $response->setHeader('Content-Type', 'application/json');
    }

    public function postActionObtenerUsuariosEquipo(Request $request, Response $response): void
    {
        $datos = $request->getParsedBody();
        
        if (!isset($datos['equipoId']) || !isset($datos['rol'])) {
            throw new BadRequest('equipoId y rol son requeridos');
        }

        $equipoId = $datos['equipoId'];
        $rol = $datos['rol'];

        // Buscar usuarios que pertenezcan al equipo
        $usuarios = $this->getEntityManager()
            ->getRepository('User')
            ->distinct()
            ->join('teams')
            ->where([
                'teams.id' => $equipoId,
                'isActive' => true
            ])
            ->find();

        $resultado = [];
        foreach ($usuarios as $usuario) {
            // Filtrar por rol si el usuario tiene ese campo
            $usuarioRol = $usuario->get('type') ?? 'regular';
            
            // Asumimos que gerentes tienen type 'admin' o un campo específico
            $esGerente = ($usuario->get('type') === 'admin') || ($usuario->get('isPortalUser') === false && $usuario->get('type') === 'regular');
            
            if (($rol === 'gerente' && $esGerente) || ($rol === 'asesor' && !$esGerente)) {
                $resultado[] = [
                    'id' => $usuario->get('id'),
                    'name' => $usuario->get('name'),
                    'rol' => $rol
                ];
            }
        }

        $response->writeBody(json_encode($resultado));
        $response->setHeader('Content-Type', 'application/json');
    }

    public function postActionObtenerPreguntasPorRol(Request $request, Response $response): void
    {
        $datos = $request->getParsedBody();
        $rol = $datos['rol'] ?? 'asesor';

        $preguntas = $this->getEntityManager()
            ->getRepository('Pregunta')
            ->where([
                'estaActiva' => true,
                'rolObjetivo*' => '%"' . $rol . '"%'
            ])
            ->order('orden', 'ASC')
            ->find();

        $resultado = [];
        foreach ($preguntas as $pregunta) {
            $categoria = $pregunta->get('categoria');
            if (!isset($resultado[$categoria])) {
                $resultado[$categoria] = [];
            }
            
            $resultado[$categoria][] = [
                'id' => $pregunta->get('id'),
                'texto' => $pregunta->get('textoPregunta'),
                'orden' => $pregunta->get('orden')
            ];
        }

        $response->writeBody(json_encode($resultado));
        $response->setHeader('Content-Type', 'application/json');
    }

    public function postActionGuardarEncuesta(Request $request, Response $response): void
    {
        $datos = $request->getParsedBody();

        if (!isset($datos['equipoId']) || !isset($datos['usuarioEvaluadoId']) || !isset($datos['respuestas'])) {
            throw new BadRequest('Faltan datos requeridos');
        }

        $entityManager = $this->getEntityManager();

        $encuesta = $entityManager->createEntity('Encuesta', [
            'name' => 'Encuesta - ' . $datos['nombreUsuarioEvaluado'] . ' - ' . date('Y-m-d H:i:s'),
            'equipoId' => $datos['equipoId'],
            'usuarioEvaluadoId' => $datos['usuarioEvaluadoId'],
            'usuarioEvaluadorId' => $this->getUser()->get('id'),
            'rolUsuario' => $datos['rolUsuario'],
            'fechaEncuesta' => date('Y-m-d H:i:s'),
            'estado' => 'completada',
            'totalPreguntas' => count($datos['respuestas']),
            'preguntasRespondidas' => count($datos['respuestas']),
            'porcentajeCompletado' => 100
        ]);

        foreach ($datos['respuestas'] as $preguntaId => $respuesta) {
            $pregunta = $entityManager->getEntity('Pregunta', $preguntaId);
            $textoPregunta = $pregunta ? substr($pregunta->get('textoPregunta'), 0, 50) : 'Pregunta';
            
            $entityManager->createEntity('RespuestaEncuesta', [
                'encuestaId' => $encuesta->get('id'),
                'preguntaId' => $preguntaId,
                'respuesta' => $respuesta,
                'name' => 'Respuesta - ' . $textoPregunta . '...'
            ]);
        }

        $resultado = [
            'exito' => true,
            'encuestaId' => $encuesta->get('id'),
            'mensaje' => 'Encuesta guardada exitosamente'
        ];

        $response->writeBody(json_encode($resultado));
        $response->setHeader('Content-Type', 'application/json');
    }

    public function postActionInicializarPreguntas(Request $request, Response $response): void
    {
        $preguntas = $this->obtenerPreguntasPorDefecto();
        
        $entityManager = $this->getEntityManager();
        $usuarioActual = $this->getUser();
        
        $creadas = 0;
        
        foreach ($preguntas as $datoPregunta) {
            try {
                $entityManager->createEntity('Pregunta', [
                    'name' => substr($datoPregunta['texto'], 0, 100),
                    'textoPregunta' => $datoPregunta['texto'],
                    'categoria' => $datoPregunta['categoria'],
                    'rolObjetivo' => $datoPregunta['rolObjetivo'],
                    'estaActiva' => true,
                    'orden' => $datoPregunta['orden'],
                    'creadoPorId' => $usuarioActual->get('id')
                ]);
                $creadas++;
            } catch (\Exception $e) {
                error_log("Error creando pregunta: " . $e->getMessage());
            }
        }
        
        $resultado = [
            'exito' => true, 
            'mensaje' => "Se crearon {$creadas} preguntas correctamente"
        ];

        $response->writeBody(json_encode($resultado));
        $response->setHeader('Content-Type', 'application/json');
    }

    private function obtenerPreguntasPorDefecto()
    {
        return [
            ['texto' => 'Competencia Individual', 'categoria' => 'Personalidad', 'rolObjetivo' => ['asesor'], 'orden' => 1],
            ['texto' => 'Competencia Social', 'categoria' => 'Personalidad', 'rolObjetivo' => ['asesor'], 'orden' => 2],
            ['texto' => 'Competencia de Comunicación', 'categoria' => 'Personalidad', 'rolObjetivo' => ['asesor'], 'orden' => 3],
            ['texto' => 'Competencia de Adaptabilidad', 'categoria' => 'Personalidad', 'rolObjetivo' => ['asesor'], 'orden' => 4],
            
            ['texto' => 'Conocimiento importante para la industria inmobiliaria', 'categoria' => 'Competencias Técnicas', 'rolObjetivo' => ['asesor'], 'orden' => 5],
            ['texto' => 'Manejo de la Ley de Inversiones de un mercado inmobiliario', 'categoria' => 'Competencias Técnicas', 'rolObjetivo' => ['asesor'], 'orden' => 6],
            ['texto' => 'Conocimiento del Procedimiento de compraventa en Oficina', 'categoria' => 'Competencias Técnicas', 'rolObjetivo' => ['asesor'], 'orden' => 7],
            ['texto' => 'Manejo de herramientas tecnológicas', 'categoria' => 'Competencias Técnicas', 'rolObjetivo' => ['asesor'], 'orden' => 8],
            
            ['texto' => 'Competencia de Liderazgo', 'categoria' => 'Personalidad', 'rolObjetivo' => ['gerente'], 'orden' => 1],
            ['texto' => 'Competencia Emocional', 'categoria' => 'Personalidad', 'rolObjetivo' => ['gerente'], 'orden' => 2],
            ['texto' => 'Competencia de Toma de Decisiones', 'categoria' => 'Personalidad', 'rolObjetivo' => ['gerente'], 'orden' => 3],
            ['texto' => 'Competencia de Motivación de Equipos', 'categoria' => 'Personalidad', 'rolObjetivo' => ['gerente'], 'orden' => 4],
            
            ['texto' => 'Conocimiento importante para la industria inmobiliaria', 'categoria' => 'Competencias Técnicas', 'rolObjetivo' => ['gerente'], 'orden' => 5],
            ['texto' => 'Planificación comercial', 'categoria' => 'Competencias Técnicas', 'rolObjetivo' => ['gerente'], 'orden' => 6],
            ['texto' => 'Análisis de métricas y KPIs', 'categoria' => 'Competencias Técnicas', 'rolObjetivo' => ['gerente'], 'orden' => 7],
            ['texto' => 'Gestión de presupuestos', 'categoria' => 'Competencias Técnicas', 'rolObjetivo' => ['gerente'], 'orden' => 8],
            
            ['texto' => 'Organización del tiempo', 'categoria' => 'Planificación', 'rolObjetivo' => ['asesor', 'gerente'], 'orden' => 9],
            ['texto' => 'Establecimiento de objetivos', 'categoria' => 'Planificación', 'rolObjetivo' => ['asesor', 'gerente'], 'orden' => 10]
        ];
    }
}