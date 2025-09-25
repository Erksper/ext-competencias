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
            'change #fecha-cierre-input': function (e) {
                this.handleFechaCierreChange(e);
            }
        },

        setup: function () {
            var user = this.getUser();

            this.esAdmin = this.getUser().isAdmin();
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
            this.getCollectionFactory().create('Competencias', function(competenciaCollection) {
                competenciaCollection.fetch({ data: { maxSize: 1 } }).then(function() {
                    if (competenciaCollection.total > 0) {
                        var competencia = competenciaCollection.at(0);
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
                         '✅ Se crearán 48 preguntas\n' +
                         '📝 Organizadas por categorías\n' +
                         '👥 Para roles: Asesor y Gerente/Director\n\n' +
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
            var fechaCierre = this.$el.find('#fecha-cierre-input').val();
            var hoy = new Date().toISOString().split('T')[0];

            if (!confirm('¿Estás seguro de que deseas activar el período de encuestas hasta el ' + this.getDateTime().toDisplayDate(fechaCierre) + '?')) {
                return;
            }

            this.wait(true);

            this.getCollectionFactory().create('Competencias', function(competenciaCollection) {
                competenciaCollection.fetch({ data: { maxSize: 1 } }).then(function() {
                    var saveCompetencia = function(competencia) {
                        competencia.set({
                            name: 'Configuración General', 
                            fechaInicio: hoy,
                            fechaCierre: fechaCierre
                        });
                        competencia.save().then(function() {
                            Espo.Ui.success('Período de encuestas activado correctamente.');
                            window.location.reload();
                        }.bind(this));
                    }.bind(this);

                    if (competenciaCollection.total > 0) {
                        saveCompetencia(competenciaCollection.at(0));
                    } else {
                        this.getModelFactory().create('Competencias', function (newCompetencia) {
                            saveCompetencia(newCompetencia);
                        }.bind(this));
                    }
                }.bind(this));
            }.bind(this));
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
                        orden: datoPregunta.orden
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
                this.reRender();
                
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

                { texto: 'Paso a paso de la realización de un negocio inmobiliairio', categoria: 'Competencias Tecnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliairia', rolObjetivo: ['gerente', 'director'], orden: 1 },
                { texto: 'Manejo de las Leyes inmobiliarias  basicas para atender un cliente', categoria: 'Competencias Tecnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliairia', rolObjetivo: ['gerente', 'director'], orden: 2 },
                { texto: 'Conocimiento basicos para la realización de un AMC', categoria: 'Competencias Tecnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliairia', rolObjetivo: ['gerente', 'director'], orden: 3 },
                { texto: 'Conocimiento del Manual interno de operaciones de la Oficina (MIO)', categoria: 'Competencias Tecnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliairia', rolObjetivo: ['gerente', 'director'], orden: 4 },
                { texto: 'Elije capacitaciones con metodologia', categoria: 'Competencias Tecnicas', subCategoria: 'Transformacion de Información a Aprendizaje', rolObjetivo: ['gerente', 'director'], orden: 5 },
                { texto: 'Metodologia de practica en equipo en la oficina', categoria: 'Competencias Tecnicas', subCategoria: 'Transformacion de Información a Aprendizaje', rolObjetivo: ['gerente', 'director'], orden: 6 },
                { texto: 'Metodologia de sombra con el cliente', categoria: 'Competencias Tecnicas', subCategoria: 'Transformacion de Información a Aprendizaje', rolObjetivo: ['gerente', 'director'], orden: 7 },
                { texto: 'Manejo de estructura comunicacional para las objeciones', categoria: 'Competencias Tecnicas', subCategoria: 'Negociación', rolObjetivo: ['gerente', 'director'], orden: 8 },
                { texto: 'Manejo del sistema Tecnologico de la Oficina( 21 Online)', categoria: 'Competencias Tecnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente', 'director'], orden: 9 },
                { texto: 'Control de expedientes', categoria: 'Competencias Tecnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente', 'director'], orden: 10 },
                { texto: 'Metodologia para evitar problemas en las negociaciones', categoria: 'Competencias Tecnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente', 'director'], orden: 11 },
                { texto: 'Manejo metodologico de las reuniones 1 a 1 con el asesor', categoria: 'Competencias Tecnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente', 'director'], orden: 12 },
                { texto: 'Aplicación de encuesta de calidad de servicio', categoria: 'Competencias Tecnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente', 'director'], orden: 13 },
                { texto: 'Manejo metodologico del inventario', categoria: 'Competencias Tecnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente', 'director'], orden: 14 },
                { texto: 'Reclutamiento y selección: Manejo metodologico - 60% del equipo hace 1 lado por mes por asesor', categoria: 'Competencias Tecnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente', 'director'], orden: 15 },
                { texto: 'Tiene la Planificación Anual de todo el equipo de asesores', categoria: 'Competencias Tecnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente', 'director'], orden: 16 },
                { texto: 'Realizo el analisis de competencias del equipo', categoria: 'Competencias Tecnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente', 'director'], orden: 17 },
                { texto: 'Tiene el Plan de formación anual', categoria: 'Competencias Tecnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente', 'director'], orden: 18 },
                { texto: 'Tiene activo digital disponible en Meta', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'director'], orden: 19 },
                { texto: 'Utiliza lenguaje cliente en sus publicaciones', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'director'], orden: 20 },
                { texto: 'Sabe como utilizar las herramientas tecnologicas para crear Post - Videos', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'director'], orden: 21 },
                { texto: 'Sabe como segmentar en Meta con base de datos y con video', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'director'], orden: 22 },
                { texto: 'Sabe como automatizar su mercadeo en meta', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'director'], orden: 23 },
                { texto: 'Sabe hacer publicidad en Google', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'director'], orden: 24 },
                { texto: 'Tiene un Plan de mercadeo digital para la oficina', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'director'], orden: 25 },
                { texto: 'Tiene un Plan de mercadeo digital para los asesores', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'director'], orden: 26 },
                { texto: 'Orientación a la Mejora continua Personal', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente', 'director'], orden: 27 },
                { texto: 'Autoconfianza', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente', 'director'], orden: 28 },
                { texto: 'Sentido del Negocio', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente', 'director'], orden: 29 },
                { texto: 'Capacidad de asumir la Necesidad del cliente', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente', 'director'], orden: 30 },
                { texto: 'Efectividad interpersonal', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente', 'director'], orden: 31 },
                { texto: 'Gestión de la Información', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente', 'director'], orden: 32 },
                { texto: 'Capacidad de respuesta', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente', 'director'], orden: 33 },
                { texto: 'Planificación semanal', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente', 'director'], orden: 34 },

                { texto: 'Competencias Intelectual', categoria: 'Competencias Tecnicas', subCategoria: 'Personalidad', rolObjetivo: ['asesor'], orden: 35 },
                { texto: 'Competencias Emocionales', categoria: 'Competencias Tecnicas', subCategoria: 'Personalidad', rolObjetivo: ['asesor'], orden: 36 },
                { texto: 'Competencias Eticas', categoria: 'Competencias Tecnicas', subCategoria: 'Personalidad', rolObjetivo: ['asesor'], orden: 37 },
                { texto: 'Competencias Sociales', categoria: 'Competencias Tecnicas', subCategoria: 'Personalidad', rolObjetivo: ['asesor'], orden: 38 },
                { texto: 'Paso a paso de la realización de un negocio inmobiliairio', categoria: 'Competencias Tecnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliairia', rolObjetivo: ['asesor'], orden: 39 },
                { texto: 'Manejo de las Leyes inmobiliarias  basicas para atender un cliente', categoria: 'Competencias Tecnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliairia', rolObjetivo: ['asesor'], orden: 40 },
                { texto: 'Conocimiento basicos para la realización de un AMC', categoria: 'Competencias Tecnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliairia', rolObjetivo: ['asesor'], orden: 41 },
                { texto: 'Conocimiento del Manual interno de operaciones de la Oficina', categoria: 'Competencias Tecnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliairia', rolObjetivo: ['asesor'], orden: 42 },
                { texto: 'Agenda', categoria: 'Competencias Tecnicas', subCategoria: 'Planificación', rolObjetivo: ['asesor'], orden: 43 },
                { texto: 'Planificación semanal', categoria: 'Competencias Tecnicas', subCategoria: 'Planificación', rolObjetivo: ['asesor'], orden: 44 },
                { texto: 'Primer contacto', categoria: 'Competencias Tecnicas', subCategoria: 'Comunicación de ventas', rolObjetivo: ['asesor'], orden: 45 },
                { texto: 'Primera reunión', categoria: 'Competencias Tecnicas', subCategoria: 'Comunicación de ventas', rolObjetivo: ['asesor'], orden: 46 },
                { texto: 'Presentación de la propiedad', categoria: 'Competencias Tecnicas', subCategoria: 'Comunicación de ventas', rolObjetivo: ['asesor'], orden: 47 },
                { texto: 'Manejo del sistema Tecnologico de la Oficina ( 21 Online)', categoria: 'Competencias Tecnicas', subCategoria: 'Negociación', rolObjetivo: ['asesor'], orden: 48 },
                { texto: 'Fotografia', categoria: 'Competencias Tecnicas', subCategoria: 'Negociación', rolObjetivo: ['asesor'], orden: 49 },
                { texto: 'Herramientas de Office', categoria: 'Competencias Tecnicas', subCategoria: 'Negociación', rolObjetivo: ['asesor'], orden: 50 },
                { texto: 'Atención al Cliente: Satisfaccion de clientes mayor a 90%', categoria: 'Competencias Tecnicas', subCategoria: 'Negociación', rolObjetivo: ['asesor'], orden: 51 },
                { texto: 'Tiene activo digital disponible en Meta', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], orden: 52 },
                { texto: 'Utiliza lenguaje cliente en sus publicaciones', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], orden: 53 },
                { texto: 'Sabe como utilizar las herramientas tecnologicas para crear Post - Videos', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], orden: 54 },
                { texto: 'Sabe como segmentar en Meta con base de datos y con video', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], orden: 55 },
                { texto: 'Sabe como automatizar su mercadeo en meta', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], orden: 56 },
                { texto: 'Sabe hacer publicidad en Google', categoria: 'Competencias Tecnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], orden: 57 },
                { texto: 'Orientación a la Mejora continua Personal', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 58 },
                { texto: 'Autoconfianza', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 59 },
                { texto: 'Sentido del Negocio', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 60 },
                { texto: 'Capacidad de asumir la Necesidad del cliente', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 61 },
                { texto: 'Efectividad interpersonal', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 62 },
                { texto: 'Gestión de la Información', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 63 },
                { texto: 'Capacidad de respuesta', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 64 },
                { texto: 'Organización', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 65 }
            ];
        },

        data: function () {
            return {
                esAdmin: this.esAdmin,
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