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

            $resultado = [];

            if ($this->getEntityManager()->hasRepository('Pregunta')) {
                // Buscar preguntas agrupadas por categoría y subcategoría
                $preguntas = $this->getEntityManager()
                    ->getRepository('Pregunta')
                    ->where([
                        'estaActiva' => true,
                        'rolObjetivo*' => '%"' . $rol . '"%'
                    ])
                    ->order(['categoria', 'subCategoria', 'orden'], 'ASC')
                    ->find();

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
            }

            $response->writeBody(json_encode($resultado));
            $response->setHeader('Content-Type', 'application/json');

        } catch (\Exception $e) {
            error_log("Error en obtenerPreguntasPorRol: " . $e->getMessage());
            $response->setStatus(500);
            $response->writeBody(json_encode([
                'error' => 'Error del servidor al obtener las preguntas.',
                'message' => $e->getMessage()
            ]));
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
            // ==============================
            // PREGUNTAS COMPARTIDAS (AMBOS ROLES)
            // ==============================

            // COMPETENCIAS TÉCNICAS - Conocimiento importante para la actividad inmobiliaria (COMPARTIDAS)
            [
                'texto' => 'Paso a paso de la realización de un negocio inmobiliario',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Conocimiento importante para la actividad inmobiliaria',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 1
            ],
            [
                'texto' => 'Manejo de las Leyes inmobiliarias básicas para atender un cliente',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Conocimiento importante para la actividad inmobiliaria',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 2
            ],
            [
                'texto' => 'Conocimiento básicos para la realización de un AMC',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Conocimiento importante para la actividad inmobiliaria',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 3
            ],
            [
                'texto' => 'Conocimiento del Manual interno de operaciones de la Oficina (MIO)',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Conocimiento importante para la actividad inmobiliaria',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 4
            ],

            // COMPETENCIAS TÉCNICAS - Marketing (COMPARTIDAS)
            [
                'texto' => 'Tiene activo digital disponible en Meta',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Marketing',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 5
            ],
            [
                'texto' => 'Utiliza lenguaje cliente en sus publicaciones',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Marketing',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 6
            ],
            [
                'texto' => 'Sabe como utilizar las herramientas tecnológicas para crear Post - Videos',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Marketing',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 7
            ],
            [
                'texto' => 'Sabe como segmentar en Meta con base de datos y con video',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Marketing',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 8
            ],
            [
                'texto' => 'Sabe como automatizar su mercadeo en meta',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Marketing',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 9
            ],
            [
                'texto' => 'Sabe hacer publicidad en Google',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Marketing',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 10
            ],

            // COMPETENCIAS FUNCIONALES (COMPARTIDAS)
            [
                'texto' => 'Orientación a la Mejora continua Personal',
                'categoria' => 'Competencias Funcionales',
                'subCategoria' => 'Competencias Esenciales',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 11
            ],
            [
                'texto' => 'Autoconfianza',
                'categoria' => 'Competencias Funcionales',
                'subCategoria' => 'Competencias Esenciales',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 12
            ],
            [
                'texto' => 'Sentido del Negocio',
                'categoria' => 'Competencias Funcionales',
                'subCategoria' => 'Competencias Esenciales',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 13
            ],
            [
                'texto' => 'Capacidad de asumir la Necesidad del cliente',
                'categoria' => 'Competencias Funcionales',
                'subCategoria' => 'Competencias Esenciales',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 14
            ],
            [
                'texto' => 'Efectividad interpersonal',
                'categoria' => 'Competencias Funcionales',
                'subCategoria' => 'Competencias Esenciales',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 15
            ],
            [
                'texto' => 'Gestión de la Información',
                'categoria' => 'Competencias Funcionales',
                'subCategoria' => 'Competencias Esenciales',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 16
            ],
            [
                'texto' => 'Capacidad de respuesta',
                'categoria' => 'Competencias Funcionales',
                'subCategoria' => 'Competencias Esenciales',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 17
            ],
            [
                'texto' => 'Planificación semanal',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Planificación',
                'rolObjetivo' => ['gerente', 'asesor'],
                'orden' => 18
            ],

            // ==============================
            // PREGUNTAS EXCLUSIVAS DE GERENTES/DIRECTORES
            // ==============================

            // COMPETENCIAS TÉCNICAS - Transformación de Información a Aprendizaje
            [
                'texto' => 'Elige capacitaciones con metodología',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Transformación de Información a Aprendizaje',
                'rolObjetivo' => ['gerente'],
                'orden' => 19
            ],
            [
                'texto' => 'Metodología de práctica en equipo en la oficina',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Transformación de Información a Aprendizaje',
                'rolObjetivo' => ['gerente'],
                'orden' => 20
            ],
            [
                'texto' => 'Metodología de sombra con el cliente',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Transformación de Información a Aprendizaje',
                'rolObjetivo' => ['gerente'],
                'orden' => 21
            ],

            // COMPETENCIAS TÉCNICAS - Negociación (GERENTES)
            [
                'texto' => 'Manejo de estructura comunicacional para las objeciones',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Negociación',
                'rolObjetivo' => ['gerente'],
                'orden' => 22
            ],

            // COMPETENCIAS TÉCNICAS - Aspectos Técnicos Generales
            [
                'texto' => 'Manejo del sistema Tecnológico de la Oficina (21 Online)',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Aspectos Técnicos Generales',
                'rolObjetivo' => ['gerente'],
                'orden' => 23
            ],
            [
                'texto' => 'Control de expedientes',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Aspectos Técnicos Generales',
                'rolObjetivo' => ['gerente'],
                'orden' => 24
            ],
            [
                'texto' => 'Metodología para evitar problemas en las negociaciones',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Aspectos Técnicos Generales',
                'rolObjetivo' => ['gerente'],
                'orden' => 25
            ],
            [
                'texto' => 'Manejo metodológico de las reuniones 1 a 1 con el asesor',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Aspectos Técnicos Generales',
                'rolObjetivo' => ['gerente'],
                'orden' => 26
            ],
            [
                'texto' => 'Aplicación de encuesta de calidad de servicio',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Aspectos Técnicos Generales',
                'rolObjetivo' => ['gerente'],
                'orden' => 27
            ],
            [
                'texto' => 'Manejo metodológico del inventario',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Aspectos Técnicos Generales',
                'rolObjetivo' => ['gerente'],
                'orden' => 28
            ],
            [
                'texto' => 'Reclutamiento y selección: Manejo metodológico - 60% del equipo hace 1 lado por mes por asesor',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Aspectos Técnicos Generales',
                'rolObjetivo' => ['gerente'],
                'orden' => 29
            ],
            [
                'texto' => 'Tiene la Planificación Anual de todo el equipo de asesores',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Aspectos Técnicos Generales',
                'rolObjetivo' => ['gerente'],
                'orden' => 30
            ],
            [
                'texto' => 'Realizó el análisis de competencias del equipo',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Aspectos Técnicos Generales',
                'rolObjetivo' => ['gerente'],
                'orden' => 31
            ],
            [
                'texto' => 'Tiene el Plan de formación anual',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Aspectos Técnicos Generales',
                'rolObjetivo' => ['gerente'],
                'orden' => 32
            ],

            // COMPETENCIAS TÉCNICAS - Marketing (EXCLUSIVAS GERENTES)
            [
                'texto' => 'Tiene un Plan de mercadeo digital para la oficina',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Marketing',
                'rolObjetivo' => ['gerente'],
                'orden' => 33
            ],
            [
                'texto' => 'Tiene un Plan de mercadeo digital para los asesores',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Marketing',
                'rolObjetivo' => ['gerente'],
                'orden' => 34
            ],

            // ==============================
            // PREGUNTAS EXCLUSIVAS DE ASESORES
            // ==============================

            // PERSONALIDAD - Competencias de la Personalidad
            [
                'texto' => 'Competencias Intelectual',
                'categoria' => 'Personalidad',
                'subCategoria' => 'Competencias de la Personalidad',
                'rolObjetivo' => ['asesor'],
                'orden' => 35
            ],
            [
                'texto' => 'Competencias Emocionales',
                'categoria' => 'Personalidad',
                'subCategoria' => 'Competencias de la Personalidad',
                'rolObjetivo' => ['asesor'],
                'orden' => 36
            ],
            [
                'texto' => 'Competencias Éticas',
                'categoria' => 'Personalidad',
                'subCategoria' => 'Competencias de la Personalidad',
                'rolObjetivo' => ['asesor'],
                'orden' => 37
            ],
            [
                'texto' => 'Competencias Sociales',
                'categoria' => 'Personalidad',
                'subCategoria' => 'Competencias de la Personalidad',
                'rolObjetivo' => ['asesor'],
                'orden' => 38
            ],

            // COMPETENCIAS TÉCNICAS - Planificación (EXCLUSIVAS ASESORES)
            [
                'texto' => 'Agenda',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Planificación',
                'rolObjetivo' => ['asesor'],
                'orden' => 39
            ],

            // COMPETENCIAS TÉCNICAS - Comunicación de ventas
            [
                'texto' => 'Primer contacto',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Comunicación de ventas',
                'rolObjetivo' => ['asesor'],
                'orden' => 40
            ],
            [
                'texto' => 'Primera reunión',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Comunicación de ventas',
                'rolObjetivo' => ['asesor'],
                'orden' => 41
            ],
            [
                'texto' => 'Presentación de la propiedad',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Comunicación de ventas',
                'rolObjetivo' => ['asesor'],
                'orden' => 42
            ],

            // COMPETENCIAS TÉCNICAS - Negociación (ASESORES)
            [
                'texto' => 'Manejo del sistema Tecnológico de la Oficina (21 Online)',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Negociación',
                'rolObjetivo' => ['asesor'],
                'orden' => 44
            ],
            [
                'texto' => 'Fotografía',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Negociación',
                'rolObjetivo' => ['asesor'],
                'orden' => 45
            ],
            [
                'texto' => 'Herramientas de Office',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Negociación',
                'rolObjetivo' => ['asesor'],
                'orden' => 46
            ],
            [
                'texto' => 'Atención al Cliente: Satisfacción de clientes mayor a 90%',
                'categoria' => 'Competencias Técnicas',
                'subCategoria' => 'Negociación',
                'rolObjetivo' => ['asesor'],
                'orden' => 47
            ],

            // COMPETENCIAS FUNCIONALES - Competencias Profesionales (EXCLUSIVAS ASESORES)
            [
                'texto' => 'Organización',
                'categoria' => 'Competencias Funcionales',
                'subCategoria' => 'Competencias Profesionales',
                'rolObjetivo' => ['asesor'],
                'orden' => 48
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

    private function generarNombrePregunta($datoPregunta)
    {
        $categoria = substr($datoPregunta['categoria'], 0, 3); // Primeras 3 letras
        $subcategoria = isset($datoPregunta['subCategoria']) ? 
            ' - ' . substr($datoPregunta['subCategoria'], 0, 20) : '';
        $texto = substr($datoPregunta['texto'], 0, 40);
        
        return $categoria . $subcategoria . ' - ' . $texto . '...';
    }

    // Agregar este método al controlador PHP
    public function postActionVerificarEntidades(Request $request, Response $response): void
    {
        try {
            $entityManager = $this->getEntityManager();
            
            // Verificar si la entidad Pregunta existe
            $entidadExiste = $entityManager->hasRepository('Pregunta');
            $totalPreguntas = 0;
            
            if ($entidadExiste) {
                try {
                    // Intentar contar preguntas activas
                    $totalPreguntas = $entityManager
                        ->getRepository('Pregunta')
                        ->where(['estaActiva' => true])
                        ->count();
                } catch (\Exception $e) {
                    // Si falla el conteo, verificar si hay algún registro
                    try {
                        $totalPreguntas = $entityManager
                            ->getRepository('Pregunta')
                            ->count();
                    } catch (\Exception $e2) {
                        error_log("Error contando preguntas: " . $e2->getMessage());
                        $totalPreguntas = 0;
                    }
                }
            }
            
            $resultado = [
                'entidadExiste' => $entidadExiste,
                'totalPreguntas' => $totalPreguntas,
                'mensaje' => $entidadExiste ? 
                    "Entidad existe con {$totalPreguntas} preguntas" : 
                    "La entidad Pregunta no existe"
            ];
            
            $response->writeBody(json_encode($resultado));
            $response->setHeader('Content-Type', 'application/json');
            
        } catch (\Exception $e) {
            error_log("Error verificando entidades: " . $e->getMessage());
            
            $resultado = [
                'entidadExiste' => false,
                'totalPreguntas' => -1,
                'error' => $e->getMessage()
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