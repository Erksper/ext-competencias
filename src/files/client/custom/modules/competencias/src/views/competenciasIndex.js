define(['view'], function (View) {
    return View.extend({
        template: 'competencias:competenciasIndex',
        
        events: {
            'click [data-action="startSurvey"]': function (e) {
                if (this.totalPreguntas === 0) {
                    e.preventDefault();
                    Espo.Ui.warning('⚠️ Primero debes crear las preguntas del sistema antes de iniciar evaluaciones.');
                    return false;
                }
                this.getRouter().navigate('#Competencias/teamSelection', {trigger: true});
            },
            'click [data-action="viewReports"]': function (e) {
                if (this.totalPreguntas === 0) {
                    e.preventDefault();
                    Espo.Ui.warning('⚠️ No hay datos para mostrar. Primero crea las preguntas e inicia algunas evaluaciones.');
                    return false;
                }
                this.getRouter().navigate('#Competencias/reports', {trigger: true});
            },
            'click [data-action="crearPreguntas"]': function () {
                this.crearPreguntas();
            },
            'click [data-action="activarEncuestas"]': function () {
                this.activarEncuestas();
            },
            'click [data-action="borrarPreguntas"]': function () {
                this.borrarTodasLasPreguntas();
            },
            'click [data-action="cambiarPeriodos"]': function () {
                this.cambiarPeriodos();
            },
            'change #fecha-cierre-input': function (e) {
                this.handleFechaCierreChange(e);
            }
        },

        setup: function () {
            var user = this.getUser();

            this.esAdmin = this.getUser().isAdmin();
            this.esSuperAdmin = this.getUser().get('emailAddress') === 'erksper@gmail.com' || this.getUser().get('userName') === 'erksper@gmail.com';
            this.esCasaNacional = false;
            this.puedeIniciarEncuesta = false;
            this.tieneAccesoAlModulo = false;

            this.encuestaActiva = false;
            this.fechaInicio = null;
            this.fechaCierre = null;

            this.mostrarBotonActivar = false;
            this.mostrarBotonIniciar = false;

            this.mostrarBotonCrear = false;
            this.totalPreguntas = 0;
            this.entidadExiste = false;
            this.preguntasRecienCreadas = false; 
            
            this.wait(true);

            this.getModelFactory().create('User', function (userModel) {
                userModel.id = user.id;
                userModel.fetch({ relations: { roles: true } }).then(function() {
                    var roles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                    
                    this.esCasaNacional = roles.includes('casa nacional');
                    this.puedeIniciarEncuesta = this.esCasaNacional || roles.includes('gerente') || roles.includes('director');
                    this.tieneAccesoAlModulo = this.puedeIniciarEncuesta || roles.includes('asesor');

                    this.verificarEstadoGeneral();
                }.bind(this));
            }.bind(this));
        },

        verificarEstadoGeneral: function() {
            this.getCollectionFactory().create("Competencias", function (collection) {
                collection.fetch({
                    data: {
                        maxSize: 1,
                        orderBy: 'fechaCierre',
                        order: 'desc'
                    }
                }).then(function () {
                    if (collection.total > 0) {
                        var competencia = collection.at(0);
                        var fechaInicio = competencia.get('fechaInicio');
                        var fechaCierre = competencia.get('fechaCierre');

                        if (fechaInicio && fechaCierre) {
                            var hoy = new Date().toISOString().split('T')[0];
                            this.encuestaActiva = (hoy >= fechaInicio && hoy <= fechaCierre);
                            this.fechaInicio = fechaInicio;
                            this.fechaCierre = this.getDateTime().toDisplayDate(fechaCierre);
                        }
                    }
                    this.verificarPreguntas();
                }.bind(this));
            }.bind(this));
        },

        verificarPreguntas: function () {
            this.getModelFactory().create('Pregunta', function(model) {
                this.entidadExiste = true;
                
                this.getCollectionFactory().create('Pregunta', function(collection) {
                    collection.fetch({
                        data: {
                            maxSize: 1,
                            where: [
                                {
                                    type: 'equals',
                                    attribute: 'estaActiva',
                                    value: 1
                                }
                            ]
                        },
                        success: function() {
                            this.totalPreguntas = collection.total || 0;
                            this.mostrarBotonCrear = (this.totalPreguntas === 0 && this.esAdmin);
                            this.actualizarVisibilidadBotones();
                            this.wait(false);
                        }.bind(this),
                        error: function(collection, response) {
                            this.totalPreguntas = 0;
                            this.mostrarBotonCrear = this.esAdmin;
                            this.actualizarVisibilidadBotones();
                            this.wait(false);
                        }.bind(this)
                    });
                }.bind(this), function(error) {
                    this.entidadExiste = false;
                    this.totalPreguntas = -1;
                    this.mostrarBotonCrear = false;
                    if (this.esAdmin) {
                        Espo.Ui.error('❌ Error accediendo a la entidad Pregunta. Verifica los permisos.');
                    }
                    this.actualizarVisibilidadBotones();
                    this.wait(false);
                }.bind(this));
                
            }.bind(this), function(error) {
                this.entidadExiste = false;
                this.totalPreguntas = -1;
                this.mostrarBotonCrear = false;
                if (this.esAdmin) {
                    Espo.Ui.error('❌ La entidad Pregunta no está disponible. Ejecuta un Rebuild.');
                }
                this.actualizarVisibilidadBotones();
                this.wait(false);
            }.bind(this));
        },

        afterRender: function () {
            this.actualizarEstadoBotones();
        },

        actualizarVisibilidadBotones: function() {
            this.mostrarBotonActivar = this.esCasaNacional && !this.encuestaActiva && this.totalPreguntas > 0;
            this.mostrarBotonIniciar = this.puedeIniciarEncuesta && this.encuestaActiva && this.totalPreguntas > 0;
        },

        actualizarEstadoBotones: function () {
            var $startButton = this.$el.find('[data-action="startSurvey"]');
            var $reportsButton = this.$el.find('[data-action="viewReports"]');
            
            if (this.totalPreguntas === 0 || !this.entidadExiste || !this.encuestaActiva) {
                $startButton.addClass('btn-disabled disabled').prop('disabled', true);
            } else {
                $startButton.removeClass('btn-disabled disabled').prop('disabled', false);
            }
        },

        crearPreguntas: function () {
            if (!this.entidadExiste) {
                Espo.Ui.error('❌ La entidad Pregunta no existe. Ve a Admin Panel → Rebuild.');
                return;
            }

            var mensaje = '¿Crear las preguntas por defecto del sistema?\n\n' +
                         '✅ Se crearán 65 preguntas\n' +
                         '📝 Organizadas por categorías\n' +
                         '👥 Para roles: Asesor y Gerente\n\n' +
                         '⚠️ Esta acción solo se puede hacer una vez.';

            if (!confirm(mensaje)) {
                return;
            }

            var $boton = this.$el.find('[data-action="crearPreguntas"]');
            $boton.prop('disabled', true).addClass('disabled').text('Creando...');
            
            Espo.Ui.notify('Creando preguntas...', 'info');
            
            this.crearPreguntasDirectamente();
        },
        
        handleFechaCierreChange: function(e) {
            var fechaCierre = $(e.currentTarget).val();
            var $button = this.$el.find('[data-action="activarEncuestas"]');
            var hoy = new Date().toISOString().split('T')[0];

            if (fechaCierre && fechaCierre > hoy) {
                $button.prop('disabled', false).removeClass('disabled');
            } else {
                $button.prop('disabled', true).addClass('disabled');
                if (fechaCierre && fechaCierre <= hoy) {
                    Espo.Ui.warning('La fecha de cierre debe ser posterior a la fecha actual.');
                }
            }
        },

        activarEncuestas: function() {
            const fechaCierre = this.$el.find("#fecha-cierre-input").val();
            const fechaInicio = new Date().toISOString().split('T')[0];

            if (!confirm("¿Estás seguro de que deseas activar un nuevo período de encuestas hasta el " + this.getDateTime().toDisplayDate(fechaCierre) + "?")) {
                return;
            }

            this.wait(true);
            
            this.getModelFactory().create("Competencias", (newModel) => {
                const nombrePeriodo = "Período de Evaluación " + this.getDateTime().toDisplayDate(fechaInicio) + " - " + this.getDateTime().toDisplayDate(fechaCierre);
                
                newModel.set({
                    name: nombrePeriodo,
                    fechaInicio: fechaInicio,
                    fechaCierre: fechaCierre
                });
                
                newModel.save().then(() => {
                    Espo.Ui.success("Nuevo período de encuestas creado y activado correctamente.");
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                }).catch(() => {
                    Espo.Ui.error("Error al crear el nuevo período de encuestas.");
                    this.wait(false);
                });
            });
        },

       borrarTodasLasPreguntas: function () {
           if (!confirm('🚨 ¡ADVERTENCIA MÁXIMA! 🚨\n\nEstás a punto de borrar TODAS las preguntas del sistema. Esta acción es IRREVERSIBLE.')) {
               return;
           }
           if (!confirm('CONFIRMACIÓN FINAL: ¿Estás absolutamente seguro de que quieres proceder? No habrá vuelta atrás.')) {
               return;
           }

           this.wait(true);
           Espo.Ui.notify('Iniciando borrado de todas las preguntas...', 'warning');
           let totalBorradas = 0;

           const borrarLote = () => {
               this.getCollectionFactory().create('Pregunta', (collection) => {
                   collection.fetch({ data: { maxSize: 500 } }).then(() => {
                       if (collection.models.length === 0) {
                           Espo.Ui.success(`Proceso completado. Se han borrado ${totalBorradas} preguntas. La página se recargará.`);
                           setTimeout(() => window.location.reload(), 2000);
                           return;
                       }

                       const promises = collection.models.map(model => model.destroy());

                       Promise.all(promises).then(() => {
                           totalBorradas += promises.length;
                           Espo.Ui.notify(`Borradas ${totalBorradas} preguntas...`, 'info');
                           setTimeout(borrarLote, 100);
                       }).catch(() => {
                           Espo.Ui.error('Ocurrió un error al borrar un lote de preguntas. El proceso se ha detenido.');
                           this.wait(false);
                       });
                   }).catch(() => {
                       Espo.Ui.error('Error al obtener la lista de preguntas para borrar.');
                       this.wait(false);
                   });
               });
           };

           borrarLote();
       },

        cambiarPeriodos: function () {
            if (!confirm('¿Estás seguro de que deseas restar una semana a las fechas de inicio y cierre de TODOS los períodos de evaluación?')) {
                return;
            }

            this.wait(true);
            Espo.Ui.notify('Modificando períodos...', 'info');

            this.getCollectionFactory().create('Competencias', (collection) => {
                collection.fetch({data: {maxSize: 200}}).then(() => {
                    if (collection.total === 0) {
                        Espo.Ui.success('No hay períodos para modificar.');
                        this.wait(false);
                        return;
                    }

                    const promises = collection.models.map(model => {
                        let fechaInicio = new Date(model.get('fechaInicio') + 'T00:00:00');
                        let fechaCierre = new Date(model.get('fechaCierre') + 'T00:00:00');

                        fechaInicio.setDate(fechaInicio.getDate() - 7);
                        fechaCierre.setDate(fechaCierre.getDate() - 7);

                        model.set({
                            fechaInicio: fechaInicio.toISOString().split('T')[0],
                            fechaCierre: fechaCierre.toISOString().split('T')[0]
                        });
                        return model.save();
                    });

                    Promise.all(promises).then(() => {
                        Espo.Ui.success(`Se han modificado ${promises.length} períodos. La página se recargará.`);
                        setTimeout(() => window.location.reload(), 2000);
                    }).catch(() => {
                        Espo.Ui.error('Ocurrió un error al modificar los períodos.');
                        this.wait(false);
                    });
                });
            });
        },

        crearPreguntasDirectamente: function () {
            var preguntas = this.obtenerPreguntasPorDefecto();
            var creadas = 0;
            var errores = [];
            var total = preguntas.length;
            
            var procesarPreguntas = function(index) {
                if (index >= preguntas.length) {
                    this.finalizarCreacion(creadas, errores, total);
                    return;
                }
                
                var datoPregunta = preguntas[index];
                
                this.getModelFactory().create('Pregunta', function(model) {
                    model.set({
                        name: this.generarNombrePregunta(datoPregunta),
                        textoPregunta: datoPregunta.texto,
                        categoria: datoPregunta.categoria,
                        subCategoria: datoPregunta.subCategoria || null,
                        rolObjetivo: datoPregunta.rolObjetivo,
                        estaActiva: true,
                        orden: datoPregunta.orden,
                        info: datoPregunta.info || ''
                    });
                    
                    model.save({}, {
                        success: function() {
                            creadas++;
                            setTimeout(function() {
                                procesarPreguntas.call(this, index + 1);
                            }.bind(this), 50); 
                        }.bind(this),
                        error: function(model, xhr) {
                            errores.push('Error creando pregunta ' + (index + 1));
                            setTimeout(function() {
                                procesarPreguntas.call(this, index + 1);
                            }.bind(this), 50);
                        }.bind(this)
                    });
                }.bind(this));
                
            }.bind(this);
            
            procesarPreguntas(0);
        },

        finalizarCreacion: function(creadas, errores, total) {
            var $boton = this.$el.find('[data-action="crearPreguntas"]');
            
            if (creadas > 0) {
                var mensajeExito = `🎉 Sistema inicializado!\n📝 Preguntas creadas: ${creadas}/${total}`;
                
                if (errores.length > 0) {
                    mensajeExito += `\n⚠️ Con ${errores.length} errores`;
                }
                
                Espo.Ui.success(mensajeExito);
                
                this.mostrarBotonCrear = false;
                this.totalPreguntas = creadas;
                this.preguntasRecienCreadas = true;
                Espo.Ui.notify('La página se recargará para reflejar los cambios.', 'info');
                setTimeout(function() {
                    window.location.reload();
                }, 3000);
                
            } else {
                Espo.Ui.error('❌ No se pudieron crear las preguntas.');
                $boton.prop('disabled', false).removeClass('disabled').text('Inicializar Sistema');
            }
        },

        generarNombrePregunta: function(datoPregunta) {
            var categoria = datoPregunta.categoria.substring(0, 10);
            var texto = datoPregunta.texto.substring(0, 30);
            return categoria + ' - ' + texto + '...';
        },

        obtenerPreguntasPorDefecto: function() {
            return [
                { texto: 'Paso a paso de la realización de un negocio inmobiliario', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['gerente'], info: '', orden: 1 },
                { texto: 'Manejo de las leyes inmobiliarias básicas para atender un cliente', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['gerente'], info: '', orden: 2 },
                { texto: 'Conocimientos básicos para la realización de un AMC', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['gerente'], info: '', orden: 3 },
                { texto: 'Conocimiento del manual interno de operaciones de la oficina (MIO)', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['gerente'], info: '', orden: 4 },
                { texto: 'Elije capacitaciones con metodología', categoria: 'Competencias Técnicas', subCategoria: 'Transformacion de Información a Aprendizaje', rolObjetivo: ['gerente'], info: '', orden: 5 },
                { texto: 'Metodología de práctica en equipo en la oficina', categoria: 'Competencias Técnicas', subCategoria: 'Transformacion de Información a Aprendizaje', rolObjetivo: ['gerente'], info: '', orden: 6 },
                { texto: 'Metodología de sombra con el cliente', categoria: 'Competencias Técnicas', subCategoria: 'Transformacion de Información a Aprendizaje', rolObjetivo: ['gerente'], info: '', orden: 7 },
                { texto: 'Manejo de estructura comunicacional para las objeciones', categoria: 'Competencias Técnicas', subCategoria: 'Negociación', rolObjetivo: ['gerente'], info: '', orden: 8 },
                { texto: 'Manejo del sistema tecnológico de la oficina (21 Online)', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], info: '', orden: 9 },
                { texto: 'Control de expedientes', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], info: '', orden: 10 },
                { texto: 'Metodología para evitar problemas en las negociaciones', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], info: '', orden: 11 },
                { texto: 'Manejo metodológico de las reuniones 1 a 1 con el asesor', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], info: '', orden: 12 },
                { texto: 'Aplicación de encuesta de calidad de servicio', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], info: '', orden: 13 },
                { texto: 'Manejo metodológico del inventario', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], info: '', orden: 14 },
                { texto: 'Reclutamiento y selección: Manejo metodológico - 60% del equipo hace 1 lado por mes por asesor', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], info: '', orden: 15 },
                { texto: 'Tiene la planificación anual de todo el equipo de asesores', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], info: '', orden: 16 },
                { texto: 'Realizó el análisis de competencias del equipo', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], info: '', orden: 17 },
                { texto: 'Tiene el plan de formación anual', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], info: '', orden: 18 },
                { texto: 'Tiene activo digital disponible en Meta', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], info: '', orden: 19 },
                { texto: 'Utiliza lenguaje cliente en sus publicaciones', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], info: '', orden: 20 },
                { texto: 'Sabe cómo utilizar las herramientas tecnológicas para crear post - videos', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], info: '', orden: 21 },
                { texto: 'Sabe cómo segmentar en Meta con base de datos y con video', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], info: '', orden: 22 },
                { texto: 'Sabe cómo automatizar su mercadeo en Meta', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], info: '', orden: 23 },
                { texto: 'Sabe hacer publicidad en Google', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], info: '', orden: 24 },
                { texto: 'Tiene un plan de mercadeo digital para la oficina', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], info: '', orden: 25 },
                { texto: 'Tiene un plan de mercadeo digital para los asesores', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], info: '', orden: 26 },
                { texto: 'Orientación a la mejora continua personal', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['gerente'], info: 'La mejora continua requiere que hagamos parte de nosotros el proceso PHVA. Planear investigar, determinar las necesidades, diagnosticar, revisar las prácticas actuales, puntos de referencia (benchmarking) resumir y comparar las mejores prácticas.  Hacer es ejecutar la tarea, educar y entrenar, instruir e implementar, definir responsabilidades, por qué, qué y cómo; reconocimiento: reconocer el aporte de otras personas. Verificar los resultados de la tarea ejecutada, evaluar y validar. Actuar correctivamente, corregir y estandarizar, revisar la retroalimentación y hacer correcciones, estandarizarlas.', orden: 27 },
                { texto: 'Autoconfianza', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['gerente'], info: 'Es el convencimiento íntimo de que uno es capaz de realizar con éxito una determinada tarea o misión, o bien elegir la mejor alternativa cuando se presenta un problema, es decir tomar la mejor decisión. Es confiar en que, en general, uno va a salir airoso de una situación, por difícil que parezca.', orden: 28 },
                { texto: 'Sentido del negocio', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['gerente'], info: 'Foco en lo esencial sin descuidar lo accesorio, Visión Global, pensamiento conceptual, Enfoque, Observador, Pasión, Compromiso, Constancia.', orden: 29 },
                { texto: 'Capacidad de asumir la necesidad del cliente', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['gerente'], info: 'Capacidad de tomar como propias y buscar soluciones a las necesidades y expectativas del cliente, para lo cual será necesario desplegar un conjunto de habilidades de comunicación que permitan obtener la información oportuna de forma ordenada. Esto resultará en una mayor precisión en la identificación de necesidades y expectativas y en un menor tiempo de respuesta.', orden: 30 },
                { texto: 'Efectividad interpersonal', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['gerente'], info: 'Conjunto de comportamientos y hábitos necesarios para garantizar una adecuada interacción, mejorar las relaciones personales y alcanzar los objetivos de la comunicación, es decir, transmitir o recibir correctamente un mensaje, una información o una orden. Importante para construir equipos de trabajo eficientes y mejorar las bases de la comunicación interna y las buenas relaciones.', orden: 31 },
                { texto: 'Gestión de la información', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['gerente'], info: 'Disciplina que se encargaría de todo lo relacionado con la obtención de la información adecuada, en la forma correcta, para la persona indicada, al coste adecuado, en el momento oportuno, en el lugar apropiado y articulando todas estas operaciones para el desarrollo de una acción correcta.', orden: 32 },
                { texto: 'Capacidad de respuesta', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['gerente'], info: 'Probabilidad media de producir, frente a una demanda, una respuesta de calidad aceptable, dentro de un margen de tiempo aceptable y a un costo aceptable. Disposición de ayudar a los clientes y proveerlos de un servicio rápido, oportuno y con la calidad esperada.', orden: 33 },
                { texto: 'Planificación semanal', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['gerente'], info: 'Estructura que nos permita alcanzar nuestras metas y conseguir nuestros objetivos, de manera sistemática, aprovechando al máximo los recursos que tenemos para ello, con el fin de mantenerse al día con sus tareas y evitar la sensación de falta de tiempo.', orden: 34 },
                { texto: 'Competencias intelectuales', categoria: 'Personalidad', subCategoria: 'Competencias de Personalidad', rolObjetivo: ['asesor'], info: `Competencias Intelectuales:
            Son las herramientas de la mente. Definen cómo procesamos 
            el mundo, resolvemos problemas y creamos futuro. Son el 
            "qué" y el "cómo" de nuestro pensamiento estratégico.

            • Capacidad de Análisis y Síntesis:
                Análisis es la habilidad de desarmar un problema complejo, 
                como si fuera un motor, para entender cada una de sus piezas. 
                Es ver los detalles, las causas, las consecuencias y las 
                variables que otros no ven.
                Síntesis es la magia de volver a armar ese motor, pero de 
                una forma más eficiente o con un propósito nuevo. Es conectar 
                las piezas (los datos, las ideas) para crear una conclusión 
                clara, un plan coherente, una visión unificada.
                En esencia: Es la capacidad de ver tanto el árbol como el 
                bosque. Un líder con esta competencia no se ahoga en los 
                detalles ni se pierde en generalidades; navega con fluidez 
                entre ambos para tomar decisiones robustas.

            • Creatividad:
                Más allá del arte, la creatividad en el negocio es la 
                habilidad de generar "rutas nuevas en un mapa viejo". 
                Es conectar ideas que aparentemente no tienen relación 
                para encontrar soluciones originales a problemas recurrentes. 
                No es inventar desde cero, sino recombinar lo que ya existe 
                de una manera novedosa y, sobre todo, útil.
                Añadido: La creatividad se alimenta de la curiosidad. 
                Una persona creativa pregunta constantemente "¿Y si...?" 
                y no teme explorar respuestas poco convencionales. Es el 
                motor de la adaptabilidad en un entorno tan cambiante.

            • Velocidad en la toma de decisiones:
                No se trata de ser impulsivo, sino de tener una mente 
                ágil que procesa la información disponible, evalúa 
                riesgos y beneficios, y elige un camino con confianza 
                y sin parálisis por análisis. Es una combinación de 
                intuición (basada en la experiencia) y lógica rápida.
                En nuestro contexto: En entornos cambiantes, esta 
                competencia es vital. Es saber cuándo "pedir más datos" 
                y cuándo "actuar con lo que se tiene". La velocidad sin 
                dirección es imprudencia; la lentitud por exceso de 
                análisis es obsolescencia.

            • Foco:
                Es la capacidad de dirigir la energía mental y los 
                recursos hacia un objetivo específico, como un rayo láser. 
                Implica no solo concentrarse en la tarea presente, sino 
                también saber decir "no" a las distracciones y a las 
                oportunidades secundarias que desvían del objetivo principal.
                Añadido: El foco es claridad de propósito. Una persona 
                con foco sabe cuál es su norte y alinea sus acciones 
                diarias con esa visión a largo plazo. Es la disciplina 
                mental que convierte los planes en realidades.

            • Pragmático:
                Una persona pragmática es aquella que tiene los pies 
                firmemente plantados en la tierra. Su pensamiento está 
                orientado a la acción y a los resultados tangibles. 
                No se enamora de las ideas, sino de su ejecución y de 
                su impacto real. Busca la solución más simple y efectiva, 
                no la más elegante o teóricamente perfecta.
                En esencia: Es el que pregunta: "Muy bien, la idea es 
                excelente, pero... ¿cómo la implementamos mañana con 
                los recursos que tenemos?".

            • Innovación:
                Si la creatividad es la chispa, la innovación es el 
                fuego. Es la disciplina de convertir una idea creativa 
                en un producto, servicio o proceso que genera valor 
                medible. La innovación no es solo tener la idea, es 
                llevarla al mercado, implementarla en la organización 
                y lograr que sea sostenible.
                Añadido: La innovación implica gestionar el riesgo y 
                la incertidumbre. Requiere persistencia para superar 
                los obstáculos que inevitablemente surgen al intentar 
                hacer algo nuevo.`, orden: 1 },
                { texto: 'Competencias emocionales', categoria: 'Personalidad', subCategoria: 'Competencias de Personalidad', rolObjetivo: ['asesor'], info: `Competencias Emocionales
            Son el corazón de nuestra interacción con el mundo y con 
            nosotros mismos. Determinan nuestra resiliencia, nuestra 
            capacidad de conectar y nuestra habilidad para liderar 
            bajo presión.

            • Estabilidad Emocional:
                Es la capacidad de ser el ancla en medio de la tormenta. 
                Una persona emocionalmente estable puede experimentar 
                frustración, estrés o decepción, pero no se deja 
                secuestrar por esas emociones. Mantiene la calma, 
                piensa con claridad y responde de manera ponderada 
                en lugar de reaccionar impulsivamente.
                Añadido: No es ser frío o apático. Es tener un 
                profundo autoconocimiento que permite gestionar las 
                propias emociones para que no distorsionen la 
                percepción de la realidad ni las decisiones que se toman.

            • Sensibilidad:
                Es la capacidad de sintonizar con las corrientes 
                emocionales propias y ajenas. Implica tener empatía: 
                poder "leer" el estado de ánimo de una persona o de 
                un equipo, comprender sus preocupaciones y alegrías, 
                y actuar en consecuencia.
                En esencia: Una persona sensible no es una persona 
                débil. Al contrario, su sensibilidad es una herramienta 
                poderosa para negociar, motivar, resolver conflictos 
                y construir relaciones profundas y leales.

            • Dolor Psicológico:
                Más que una competencia, es una experiencia humana 
                universal (fracaso, rechazo, pérdida). La verdadera 
                competencia aquí es la Resiliencia: la capacidad de 
                procesar ese dolor, aprender de él y salir fortalecido. 
                Es la habilidad de no permitir que una herida 
                psicológica se infecte y paralice el futuro.
                Añadido: Un líder que ha gestionado su propio dolor 
                psicológico desarrolla una mayor empatía y humildad. 
                Entiende las luchas de los demás y sabe cómo ofrecer 
                apoyo genuino, convirtiendo las crisis en oportunidades.

            • Miedo:
                El miedo es un instinto de supervivencia, una señal 
                de alerta ante una amenaza real o percibida. La 
                competencia no es la ausencia de miedo (eso sería 
                temeridad), sino el Coraje: la capacidad de actuar 
                a pesar del miedo. Es reconocerlo, escucharlo 
                (¿qué me está diciendo esta señal?), y tomar una 
                decisión consciente para avanzar hacia el objetivo.
                En nuestro contexto: Emprender y liderar requiere 
                una gestión magistral del miedo a la incertidumbre, 
                al fracaso, a la pérdida. El coraje es el motor que 
                nos impulsa a seguir invirtiendo, contratando y 
                construyendo futuro.`, orden: 2 },
                { texto: 'Competencias éticas', categoria: 'Personalidad', subCategoria: 'Competencias de Personalidad', rolObjetivo: ['asesor'], info: `Competencias Éticas
            Son la brújula moral que guía nuestras decisiones. No son 
            un departamento separado de nuestra personalidad, sino 
            la base que sostiene a todas las demás competencias.

            • Normativo:
                Se refiere a la adhesión a un código de conducta 
                basado en principios, valores y reglas. Una persona 
                con un fuerte sentido normativo actúa con integridad, 
                coherencia y justicia. Hace lo correcto, incluso 
                cuando nadie está mirando.
                Añadido: En un entorno donde las "zonas grises" 
                pueden ser tentadoras, esta competencia es el pilar 
                de la sostenibilidad a largo plazo. La confianza 
                del mercado, de los clientes y del equipo se construye 
                sobre la base de un comportamiento predeciblemente ético.

            • Estabilidad Emocional (en el contexto ético):
                Las decisiones éticas más difíciles suelen tomarse 
                bajo presión. La estabilidad emocional es el guardián 
                que impide que el pánico, la codicia o la ira nos 
                lleven a tomar atajos inmorales. Permite mantener 
                la cabeza fría para aplicar nuestros principios 
                éticos de manera consistente.

            • Dolor Psicológico (en el contexto ético):
                La capacidad de anticipar el dolor psicológico del 
                arrepentimiento o la culpa es un poderoso motivador 
                ético. Además, a veces, la decisión correcta duele 
                (ej. despedir a alguien que no cumple sus funciones). 
                La fortaleza para soportar ese dolor sin quebrantar 
                los principios es una marca de liderazgo ético superior.

            • Miedo (en el contexto ético):
                El miedo a las consecuencias (perder la reputación, 
                enfrentar sanciones legales, dañar a otros) es un 
                freno natural contra la conducta no ética. Un líder 
                ético canaliza este miedo no para paralizarse, sino 
                para ser más diligente, transparente y responsable 
                en sus acciones.`, orden: 3 },
                { texto: 'Competencias sociales', categoria: 'Personalidad', subCategoria: 'Competencias de Personalidad', rolObjetivo: ['asesor'], info: `Competencias Sociales
            Definen nuestra capacidad para navegar el complejo mundo 
            de las relaciones humanas. Son la base de la influencia, 
            la colaboración y el liderazgo efectivo.

            • Afectividad:
                Es la capacidad de crear y mantener lazos emocionales 
                positivos con los demás. Se manifiesta en la calidez, 
                la genuina preocupación por el bienestar del otro y 
                la habilidad para expresar aprecio y reconocimiento. 
                Genera un clima de confianza y pertenencia.
                Añadido: Un líder con alta afectividad no solo es 
                respetado por su capacidad, sino también querido por 
                su humanidad. Esto crea una lealtad que va más allá 
                del contrato laboral, inspirando un compromiso 
                extraordinario en su equipo.

            • Dominancia:
                Lejos de ser autoritarismo, la dominancia sana es 
                Asertividad e Influencia. Es la tendencia natural a 
                tomar la iniciativa, a expresar las propias ideas 
                con convicción y a guiar al grupo hacia un objetivo. 
                Una persona con esta competencia se siente cómoda 
                liderando y asumiendo responsabilidades.
                En esencia: Es la capacidad de ocupar un espacio de 
                liderazgo de forma natural, sin necesidad de imponerse 
                por la fuerza, sino a través de la seguridad en sí 
                mismo y la claridad de su visión.

            • Diplomacia:
                Es el arte de la comunicación estratégica y el tacto. 
                Una persona diplomática sabe cómo transmitir mensajes 
                difíciles sin generar conflictos innecesarios, cómo 
                negociar para encontrar puntos en común y cómo 
                preservar las relaciones incluso en momentos de 
                desacuerdo.
                Añadido: La diplomacia es inteligencia social en 
                acción. Implica escuchar activamente, elegir las 
                palabras correctas y entender que "cómo" se dice 
                algo es tan importante como "qué" se dice.

            • Imagen:
                Es la gestión consciente de la percepción que los 
                demás tienen de nosotros. La competencia no es crear 
                una máscara falsa, sino proyectar una imagen 
                auténtica y coherente con nuestros valores y objetivos. 
                Implica cuidar la comunicación verbal y no verbal, 
                la reputación y la marca personal.
                En esencia: Es ser el autor de tu propia narrativa 
                profesional. Un líder con esta competencia entiende 
                que cada acción, cada palabra y cada decisión 
                contribuyen a construir (o destruir) la confianza 
                y el respeto que inspira.`, orden: 4 },
                { texto: 'Paso a paso de la realización de un negocio inmobiliario', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['asesor'], info: '', orden: 5 },
                { texto: 'Manejo de las leyes inmobiliarias básicas para atender un cliente', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['asesor'], info: '', orden: 6 },
                { texto: 'Conocimientos básicos para la realización de un AMC', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['asesor'], info: '', orden: 7 },
                { texto: 'Conocimiento del manual interno de operaciones de la oficina', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['asesor'], info: '', orden: 8 },
                { texto: 'Agenda', categoria: 'Competencias Técnicas', subCategoria: 'Planificación', rolObjetivo: ['asesor'], info: '', orden: 9 },
                { texto: 'Planificación semanal', categoria: 'Competencias Técnicas', subCategoria: 'Planificación', rolObjetivo: ['asesor'], info: '', orden: 10 },
                { texto: 'Primer contacto', categoria: 'Competencias Técnicas', subCategoria: 'Comunicación de ventas', rolObjetivo: ['asesor'], info: '', orden: 11 },
                { texto: 'Primera reunión', categoria: 'Competencias Técnicas', subCategoria: 'Comunicación de ventas', rolObjetivo: ['asesor'], info: '', orden: 12 },
                { texto: 'Presentación de la propiedad', categoria: 'Competencias Técnicas', subCategoria: 'Comunicación de ventas', rolObjetivo: ['asesor'], info: '', orden: 13 },
                { texto: 'Manejo del sistema tecnológico de la oficina (21 Online)', categoria: 'Competencias Técnicas', subCategoria: 'Negociación', rolObjetivo: ['asesor'], info: '', orden: 14 },
                { texto: 'Fotografía', categoria: 'Competencias Técnicas', subCategoria: 'Negociación', rolObjetivo: ['asesor'], info: '', orden: 15 },
                { texto: 'Herramientas de Office', categoria: 'Competencias Técnicas', subCategoria: 'Negociación', rolObjetivo: ['asesor'], info: '', orden: 16 },
                { texto: 'Atención al cliente: Satisfacción de clientes mayor a 90%', categoria: 'Competencias Técnicas', subCategoria: 'Negociación', rolObjetivo: ['asesor'], info: '', orden: 17 },
                { texto: 'Tiene activo digital disponible en Meta', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], info: '', orden: 18 },
                { texto: 'Utiliza lenguaje cliente en sus publicaciones', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], info: '', orden: 19 },
                { texto: 'Sabe cómo utilizar las herramientas tecnológicas para crear post - videos', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], info: '', orden: 20 },
                { texto: 'Sabe cómo segmentar en Meta con base de datos y con video', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], info: '', orden: 21 },
                { texto: 'Sabe cómo automatizar su mercadeo en Meta', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], info: '', orden: 22 },
                { texto: 'Sabe hacer publicidad en Google', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], info: '', orden: 23 },
                { texto: 'Orientación a la mejora continua personal', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['asesor'], info: 'La mejora continua requiere que hagamos parte de nosotros el proceso PHVA. Planear investigar, determinar las necesidades, diagnosticar, revisar las prácticas actuales, puntos de referencia (benchmarking) resumir y comparar las mejores prácticas.  Hacer es ejecutar la tarea, educar y entrenar, instruir e implementar, definir responsabilidades, por qué, qué y cómo; reconocimiento: reconocer el aporte de otras personas. Verificar los resultados de la tarea ejecutada, evaluar y validar. Actuar correctivamente, corregir y estandarizar, revisar la retroalimentación y hacer correcciones, estandarizarlas.', orden: 24 },
                { texto: 'Autoconfianza', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['asesor'], info: 'Es el convencimiento íntimo de que uno es capaz de realizar con éxito una determinada tarea o misión, o bien elegir la mejor alternativa cuando se presenta un problema, es decir tomar la mejor decisión. Es confiar en que, en general, uno va a salir airoso de una situación, por difícil que parezca.', orden: 25 },
                { texto: 'Sentido del negocio', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['asesor'], info: 'Foco en lo esencial sin descuidar lo accesorio, Visión Global, pensamiento conceptual, Enfoque, Observador, Pasión, Compromiso, Constancia.', orden: 26 },
                { texto: 'Capacidad de asumir la necesidad del cliente', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['asesor'], info: 'Capacidad de tomar como propias y buscar soluciones a las necesidades y expectativas del cliente, para lo cual será necesario desplegar un conjunto de habilidades de comunicación que permitan obtener la información oportuna de forma ordenada. Esto resultará en una mayor precisión en la identificación de necesidades y expectativas y en un menor tiempo de respuesta.', orden: 27 },
                { texto: 'Efectividad interpersonal', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['asesor'], info: 'Conjunto de comportamientos y hábitos necesarios para garantizar una adecuada interacción, mejorar las relaciones personales y alcanzar los objetivos de la comunicación, es decir, transmitir o recibir correctamente un mensaje, una información o una orden. Importante para construir equipos de trabajo eficientes y mejorar las bases de la comunicación interna y las buenas relaciones.', orden: 28 },
                { texto: 'Gestión de la información', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['asesor'], info: 'Disciplina que se encargaría de todo lo relacionado con la obtención de la información adecuada, en la forma correcta, para la persona indicada, al coste adecuado, en el momento oportuno, en el lugar apropiado y articulando todas estas operaciones para el desarrollo de una acción correcta.', orden: 29 },
                { texto: 'Capacidad de respuesta', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['asesor'], info: 'Probabilidad media de producir, frente a una demanda, una respuesta de calidad aceptable, dentro de un margen de tiempo aceptable y a un costo aceptable. Disposición de ayudar a los clientes y proveerlos de un servicio rápido, oportuno y con la calidad esperada.', orden: 30 },
                { texto: 'Organización', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Funcionales', rolObjetivo: ['asesor'], info: 'Estructura que nos permita alcanzar nuestras metas y conseguir nuestros objetivos, de manera sistemática, aprovechando al máximo los recursos que tenemos para ello, con el fin de mantenerse al día con sus tareas y evitar la sensación de falta de tiempo.', orden: 31 }
            ];
        },

        data: function () {
            return {
                esAdmin: this.esAdmin,
                esSuperAdmin: this.esSuperAdmin,
                mostrarBotonCrear: this.mostrarBotonCrear,
                totalPreguntas: this.totalPreguntas,
                sinPreguntas: (this.totalPreguntas === 0),
                errorEntidad: (this.totalPreguntas === -1),
                preguntasRecienCreadas: this.preguntasRecienCreadas,
                entidadExiste: this.entidadExiste,
                esCasaNacional: this.esCasaNacional,
                puedeIniciarEncuesta: this.puedeIniciarEncuesta,
                encuestaActiva: this.encuestaActiva,
                mostrarBotonActivar: this.mostrarBotonActivar,
                mostrarBotonIniciar: this.mostrarBotonIniciar,
                fechaCierre: this.fechaCierre,
                tieneAccesoAlModulo: this.tieneAccesoAlModulo
            };
        }
    });
});