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
        try {
            $datos = $request->getParsedBody();
            $rol = $datos['rol'] ?? 'asesor';

            // Verificar si la entidad Pregunta existe
            if (!$this->getEntityManager()->hasRepository('Pregunta')) {
                $resultado = $this->getPreguntasPrueba($rol);
            } else {
                // Buscar preguntas agrupadas por categoría y subcategoría
                $preguntas = $this->getEntityManager()
                    ->getRepository('Pregunta')
                    ->where([
                        'estaActiva' => true,
                        'rolObjetivo*' => '%"' . $rol . '"%'
                    ])
                    ->order(['categoria', 'subCategoria', 'orden'], 'ASC')
                    ->find();

                $resultado = [];
                foreach ($preguntas as $pregunta) {
                    $categoria = $pregunta->get('categoria');
                    $subCategoria = $pregunta->get('subCategoria') ?: 'General';
                    
                    // Estructura: Categoria > SubCategoria > Preguntas
                    if (!isset($resultado[$categoria])) {
                        $resultado[$categoria] = [];
                    }
                    if (!isset($resultado[$categoria][$subCategoria])) {
                        $resultado[$categoria][$subCategoria] = [];
                    }
                    
                    $resultado[$categoria][$subCategoria][] = [
                        'id' => $pregunta->get('id'),
                        'texto' => $pregunta->get('textoPregunta'),
                        'orden' => $pregunta->get('orden'),
                        'categoria' => $categoria,
                        'subCategoria' => $subCategoria
                    ];
                }

                // Si no hay preguntas en DB, usar las de prueba
                if (empty($resultado)) {
                    $resultado = $this->getPreguntasPrueba($rol);
                }
            }

            $response->writeBody(json_encode($resultado));
            $response->setHeader('Content-Type', 'application/json');

        } catch (\Exception $e) {
            error_log("Error en obtenerPreguntasPorRol: " . $e->getMessage());
            
            // Fallback a preguntas de prueba
            $rol = $request->getParsedBody()['rol'] ?? 'asesor';
            $resultado = $this->getPreguntasPrueba($rol);
            
            $response->writeBody(json_encode($resultado));
            $response->setHeader('Content-Type', 'application/json');
        }
    }

    // Método actualizado con subcategorías
    private function getPreguntasPrueba($rol)
    {
        if ($rol === 'gerente') {
            return [
                'Personalidad' => [
                    'Liderazgo' => [
                        ['id' => 'test-g1', 'texto' => 'Competencia de Liderazgo - Capacidad para dirigir equipos', 'orden' => 1],
                        ['id' => 'test-g2', 'texto' => 'Motivación de Equipos - Inspirar y energizar al equipo', 'orden' => 2]
                    ],
                    'Inteligencia Emocional' => [
                        ['id' => 'test-g3', 'texto' => 'Competencia Emocional - Manejo del estrés y emociones', 'orden' => 3],
                        ['id' => 'test-g4', 'texto' => 'Toma de Decisiones - Análisis y decisión bajo presión', 'orden' => 4]
                    ]
                ],
                'Competencias Técnicas' => [
                    'Planificación' => [
                        ['id' => 'test-g5', 'texto' => 'Planificación comercial - Estrategias de ventas', 'orden' => 5],
                        ['id' => 'test-g6', 'texto' => 'Gestión de presupuestos - Manejo financiero', 'orden' => 6]
                    ],
                    'Análisis' => [
                        ['id' => 'test-g7', 'texto' => 'Análisis de métricas y KPIs - Interpretación de datos', 'orden' => 7]
                    ]
                ]
            ];
        } else {
            return [
                'Personalidad' => [
                    'Competencias Individuales' => [
                        ['id' => 'test-a1', 'texto' => 'Competencia Individual - Automotivación', 'orden' => 1],
                        ['id' => 'test-a2', 'texto' => 'Competencia de Adaptabilidad - Flexibilidad', 'orden' => 2]
                    ],
                    'Competencias Sociales' => [
                        ['id' => 'test-a3', 'texto' => 'Competencia Social - Relacionamiento con clientes', 'orden' => 3],
                        ['id' => 'test-a4', 'texto' => 'Competencia de Comunicación - Claridad y efectividad', 'orden' => 4]
                    ]
                ],
                'Competencias Técnicas' => [
                    'Conocimiento del Sector' => [
                        ['id' => 'test-a5', 'texto' => 'Conocimiento industria inmobiliaria', 'orden' => 5],
                        ['id' => 'test-a6', 'texto' => 'Ley de Inversiones del mercado inmobiliario', 'orden' => 6]
                    ],
                    'Herramientas y Procesos' => [
                        ['id' => 'test-a7', 'texto' => 'Procedimiento de compraventa en Oficina', 'orden' => 7],
                        ['id' => 'test-a8', 'texto' => 'Manejo de herramientas tecnológicas', 'orden' => 8]
                    ]
                ]
            ];
        }
    }

    // Método actualizado para crear preguntas con subcategorías
    private function obtenerPreguntasPorDefecto()
    {
        return [
            // ASESORES - PERSONALIDAD
            [
                'texto' => 'Capacidad de automotivación y autodisciplina',
                'categoria' => 'Personalidad',
                'subCategoria' => 'Competencias Individuales',
                'rolObjetivo' => ['asesor'],
                'orden' => 1
            ],
            [
                'texto' => 'Flexibilidad ante cambios del mercado',
                'categoria' => 'Personalidad', 
                'subCategoria' => 'Competencias Individuales',
                'rolObjetivo' => ['asesor'],
                'orden' => 2
            ],
            [
                'texto' => 'Habilidades de relacionamiento con clientes',
                'categoria' => 'Personalidad',
                'subCategoria' => 'Competencias Sociales',
                'rolObjetivo' => ['asesor'],
                'orden' => 3
            ],
            [
                'texto' => 'Claridad y efectividad en la comunicación',
                'categoria' => 'Personalidad',
                'subCategoria' => 'Competencias Sociales',
                'rolObjetivo' => ['asesor'],
                'orden' => 4
            ],

            // ASESORES - COMPETENCIAS TÉCNICAS
            [
                'texto' => 'Conocimiento importante para la industria inmobiliaria',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Conocimiento del Sector',
                'rolObjetivo' => ['asesor'],
                'orden' => 5
            ],
            [
                'texto' => 'Manejo de la Ley de Inversiones de un mercado inmobiliario',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Conocimiento del Sector',
                'rolObjetivo' => ['asesor'],
                'orden' => 6
            ],
            [
                'texto' => 'Conocimiento del Procedimiento de compraventa en Oficina',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Herramientas y Procesos',
                'rolObjetivo' => ['asesor'],
                'orden' => 7
            ],
            [
                'texto' => 'Manejo de herramientas tecnológicas',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Herramientas y Procesos',
                'rolObjetivo' => ['asesor'],
                'orden' => 8
            ],

            // GERENTES - PERSONALIDAD
            [
                'texto' => 'Capacidad para dirigir y motivar equipos',
                'categoria' => 'Personalidad',
                'subCategoria' => 'Liderazgo',
                'rolObjetivo' => ['gerente'],
                'orden' => 1
            ],
            [
                'texto' => 'Inspirar y energizar al equipo',
                'categoria' => 'Personalidad',
                'subCategoria' => 'Liderazgo', 
                'rolObjetivo' => ['gerente'],
                'orden' => 2
            ],
            [
                'texto' => 'Inteligencia emocional y manejo del estrés',
                'categoria' => 'Personalidad',
                'subCategoria' => 'Inteligencia Emocional',
                'rolObjetivo' => ['gerente'],
                'orden' => 3
            ],
            [
                'texto' => 'Capacidad de análisis y decisión bajo presión',
                'categoria' => 'Personalidad',
                'subCategoria' => 'Inteligencia Emocional',
                'rolObjetivo' => ['gerente'],
                'orden' => 4
            ],

            // GERENTES - COMPETENCIAS TÉCNICAS  
            [
                'texto' => 'Conocimiento avanzado de la industria inmobiliaria',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Conocimiento del Sector',
                'rolObjetivo' => ['gerente'],
                'orden' => 5
            ],
            [
                'texto' => 'Estrategias de ventas y marketing',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Planificación',
                'rolObjetivo' => ['gerente'],
                'orden' => 6
            ],
            [
                'texto' => 'Manejo financiero del área',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Planificación',
                'rolObjetivo' => ['gerente'],
                'orden' => 7
            ],
            [
                'texto' => 'Interpretación de indicadores y métricas',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Análisis',
                'rolObjetivo' => ['gerente'],
                'orden' => 8
            ],

            // AMBOS ROLES - PLANIFICACIÓN
            [
                'texto' => 'Gestión eficiente de horarios y prioridades',
                'categoria' => 'Planificación',
                'subCategoria' => 'Organización',
                'rolObjetivo' => ['asesor', 'gerente'],
                'orden' => 9
            ],
            [
                'texto' => 'Definición de metas claras y alcanzables',
                'categoria' => 'Planificación',
                'subCategoria' => 'Objetivos',
                'rolObjetivo' => ['asesor', 'gerente'],
                'orden' => 10
            ]
        ];
    }

    // Actualizar método de creación para incluir subcategoría
    public function postActionInicializarPreguntas(Request $request, Response $response): void
    {
        try {
            $preguntas = $this->obtenerPreguntasPorDefecto();
            
            $entityManager = $this->getEntityManager();
            $usuarioActual = $this->getUser();
            
            if (!$entityManager->hasRepository('Pregunta')) {
                $resultado = [
                    'exito' => false,
                    'mensaje' => 'Las entidades no han sido creadas. Ejecuta un Rebuild primero.'
                ];
            } else {
                $creadas = 0;
                $errores = [];
                
                $preguntasExistentes = $entityManager
                    ->getRepository('Pregunta')
                    ->where(['estaActiva' => true])
                    ->count();
                    
                if ($preguntasExistentes > 0) {
                    $resultado = [
                        'exito' => false,
                        'mensaje' => "Ya existen {$preguntasExistentes} preguntas en el sistema."
                    ];
                } else {
                    foreach ($preguntas as $datoPregunta) {
                        try {
                            $pregunta = $entityManager->createEntity('Pregunta', [
                                'name' => $this->generarNombrePregunta($datoPregunta),
                                'textoPregunta' => $datoPregunta['texto'],
                                'categoria' => $datoPregunta['categoria'],
                                'subCategoria' => $datoPregunta['subCategoria'] ?? null,
                                'rolObjetivo' => $datoPregunta['rolObjetivo'],
                                'estaActiva' => true,
                                'orden' => $datoPregunta['orden'],
                                'creadoPorId' => $usuarioActual->get('id')
                            ]);
                            
                            if ($pregunta) {
                                $creadas++;
                            }
                        } catch (\Exception $e) {
                            $errores[] = "Error: " . $e->getMessage();
                            error_log("Error creando pregunta: " . $e->getMessage());
                        }
                    }
                    
                    $resultado = [
                        'exito' => true,
                        'mensaje' => "Se crearon {$creadas} preguntas correctamente",
                        'creadas' => $creadas,
                        'errores' => $errores
                    ];
                }
            }

            $response->writeBody(json_encode($resultado));
            $response->setHeader('Content-Type', 'application/json');

        } catch (\Exception $e) {
            error_log("Error general en inicializarPreguntas: " . $e->getMessage());
            
            $resultado = [
                'exito' => false,
                'mensaje' => 'Error del sistema: ' . $e->getMessage()
            ];
            
            $response->writeBody(json_encode($resultado));
            $response->setHeader('Content-Type', 'application/json');
        }
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
}