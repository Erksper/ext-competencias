<?php

namespace Espo\Modules\Competencias\Controllers;

use Espo\Core\Controllers\Base;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;

class Competencias extends Base
{
    public function actionIndex()
    {
        return [
            'view' => 'CompetenciasIndex'
        ];
    }

    public function actionObtenerEquipos()
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

        return $resultado;
    }

    public function actionObtenerUsuariosEquipo()
    {
        $datos = $this->getRequestData();
        
        if (!isset($datos['equipoId']) || !isset($datos['rol'])) {
            throw new BadRequest('equipoId y rol son requeridos');
        }

        $equipoId = $datos['equipoId'];
        $rol = $datos['rol'];

        $usuarios = $this->getEntityManager()
            ->getRepository('User')
            ->where([
                'teamsIds' => [$equipoId],
                'rol' => $rol,
                'isActive' => true
            ])
            ->find();

        $resultado = [];
        foreach ($usuarios as $usuario) {
            $resultado[] = [
                'id' => $usuario->get('id'),
                'name' => $usuario->get('name'),
                'rol' => $usuario->get('rol')
            ];
        }

        return $resultado;
    }

    public function actionObtenerPreguntasPorRol()
    {
        $datos = $this->getRequestData();
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

        return $resultado;
    }

    public function actionGuardarEncuesta()
    {
        $datos = $this->getRequestData();

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

        return [
            'exito' => true,
            'encuestaId' => $encuesta->get('id'),
            'mensaje' => 'Encuesta guardada exitosamente'
        ];
    }

    public function actionInicializarPreguntas()
    {
        $preguntas = $this->obtenerPreguntasPorDefecto();
        
        $entityManager = $this->getEntityManager();
        $usuarioActual = $this->getUser();
        
        foreach ($preguntas as $datoPregunta) {
            $entityManager->createEntity('Pregunta', [
                'name' => substr($datoPregunta['texto'], 0, 100),
                'textoPregunta' => $datoPregunta['texto'],
                'categoria' => $datoPregunta['categoria'],
                'rolObjetivo' => $datoPregunta['rolObjetivo'],
                'estaActiva' => true,
                'orden' => $datoPregunta['orden'],
                'creadoPorId' => $usuarioActual->get('id')
            ]);
        }
        
        return ['exito' => true, 'mensaje' => 'Preguntas inicializadas correctamente'];
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