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
                            this.reRender();
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
                { texto: 'Paso a paso de la realización de un negocio inmobiliario', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento Inmobiliario', rolObjetivo: ['gerente', 'asesor'], orden: 1 },
                { texto: 'Manejo de las Leyes inmobiliarias básicas para atender un cliente', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento Inmobiliario', rolObjetivo: ['gerente', 'asesor'], orden: 2 },
                { texto: 'Conocimiento básicos para la realización de un AMC', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento Inmobiliario', rolObjetivo: ['gerente', 'asesor'], orden: 3 },
                { texto: 'Conocimiento del Manual interno de operaciones de la Oficina (MIO)', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento Inmobiliario', rolObjetivo: ['gerente', 'asesor'], orden: 4 },
                { texto: 'Tiene activo digital disponible en Meta', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'asesor'], orden: 5 },
                { texto: 'Utiliza lenguaje cliente en sus publicaciones', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'asesor'], orden: 6 },
                { texto: 'Sabe como utilizar las herramientas tecnológicas para crear Post - Videos', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'asesor'], orden: 7 },
                { texto: 'Sabe como segmentar en Meta con base de datos y con video', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'asesor'], orden: 8 },
                { texto: 'Sabe como automatizar su mercadeo en meta', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'asesor'], orden: 9 },
                { texto: 'Sabe hacer publicidad en Google', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente', 'asesor'], orden: 10 },
                { texto: 'Orientación a la Mejora continua Personal', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Esenciales', rolObjetivo: ['gerente', 'asesor'], orden: 11 },
                { texto: 'Autoconfianza', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Esenciales', rolObjetivo: ['gerente', 'asesor'], orden: 12 },
                { texto: 'Sentido del Negocio', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Esenciales', rolObjetivo: ['gerente', 'asesor'], orden: 13 },
                { texto: 'Capacidad de asumir la Necesidad del cliente', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Esenciales', rolObjetivo: ['gerente', 'asesor'], orden: 14 },
                { texto: 'Efectividad interpersonal', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Esenciales', rolObjetivo: ['gerente', 'asesor'], orden: 15 },
                { texto: 'Gestión de la Información', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Esenciales', rolObjetivo: ['gerente', 'asesor'], orden: 16 },
                { texto: 'Capacidad de respuesta', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Esenciales', rolObjetivo: ['gerente', 'asesor'], orden: 17 },

                { texto: 'Elige capacitaciones con metodología', categoria: 'Competencias Técnicas', subCategoria: 'Gestión de Aprendizaje', rolObjetivo: ['gerente'], orden: 18 },
                { texto: 'Metodología de práctica en equipo en la oficina', categoria: 'Competencias Técnicas', subCategoria: 'Gestión de Aprendizaje', rolObjetivo: ['gerente'], orden: 19 },
                { texto: 'Metodología de sombra con el cliente', categoria: 'Competencias Técnicas', subCategoria: 'Gestión de Aprendizaje', rolObjetivo: ['gerente'], orden: 20 },
                { texto: 'Manejo de estructura comunicacional para las objeciones', categoria: 'Competencias Técnicas', subCategoria: 'Negociación', rolObjetivo: ['gerente'], orden: 21 },
                { texto: 'Manejo del sistema Tecnológico de la Oficina (21 Online)', categoria: 'Competencias Técnicas', subCategoria: 'Gestión Operativa', rolObjetivo: ['gerente'], orden: 22 },
                { texto: 'Control de expedientes', categoria: 'Competencias Técnicas', subCategoria: 'Gestión Operativa', rolObjetivo: ['gerente'], orden: 23 },
                { texto: 'Metodología para evitar problemas en las negociaciones', categoria: 'Competencias Técnicas', subCategoria: 'Gestión Operativa', rolObjetivo: ['gerente'], orden: 24 },
                { texto: 'Manejo metodológico de las reuniones 1 a 1 con el asesor', categoria: 'Competencias Técnicas', subCategoria: 'Gestión Operativa', rolObjetivo: ['gerente'], orden: 25 },
                { texto: 'Aplicación de encuesta de calidad de servicio', categoria: 'Competencias Técnicas', subCategoria: 'Gestión Operativa', rolObjetivo: ['gerente'], orden: 26 },
                { texto: 'Manejo metodológico del inventario', categoria: 'Competencias Técnicas', subCategoria: 'Gestión Operativa', rolObjetivo: ['gerente'], orden: 27 },
                { texto: 'Reclutamiento y selección: Manejo metodológico', categoria: 'Competencias Técnicas', subCategoria: 'Gestión Operativa', rolObjetivo: ['gerente'], orden: 28 },
                { texto: 'Tiene la Planificación Anual de todo el equipo de asesores', categoria: 'Competencias Técnicas', subCategoria: 'Gestión Operativa', rolObjetivo: ['gerente'], orden: 29 },
                { texto: 'Realizó el análisis de competencias del equipo', categoria: 'Competencias Técnicas', subCategoria: 'Gestión Operativa', rolObjetivo: ['gerente'], orden: 30 },
                { texto: 'Tiene el Plan de formación anual', categoria: 'Competencias Técnicas', subCategoria: 'Gestión Operativa', rolObjetivo: ['gerente'], orden: 31 },
                { texto: 'Tiene un Plan de mercadeo digital para la oficina', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], orden: 32 },
                { texto: 'Tiene un Plan de mercadeo digital para los asesores', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], orden: 33 },
                { texto: 'Planificación estratégica del equipo', categoria: 'Competencias Técnicas', subCategoria: 'Planificación', rolObjetivo: ['gerente'], orden: 34 },
                { texto: 'Gestión de métricas y KPIs del equipo', categoria: 'Competencias Técnicas', subCategoria: 'Análisis', rolObjetivo: ['gerente'], orden: 35 },

                { texto: 'Competencias Intelectual', categoria: 'Personalidad', subCategoria: 'Competencias de Personalidad', rolObjetivo: ['asesor'], orden: 36 },
                { texto: 'Competencias Emocionales', categoria: 'Personalidad', subCategoria: 'Competencias de Personalidad', rolObjetivo: ['asesor'], orden: 37 },
                { texto: 'Competencias Éticas', categoria: 'Personalidad', subCategoria: 'Competencias de Personalidad', rolObjetivo: ['asesor'], orden: 38 },
                { texto: 'Competencias Sociales', categoria: 'Personalidad', subCategoria: 'Competencias de Personalidad', rolObjetivo: ['asesor'], orden: 39 },
                { texto: 'Manejo de agenda personal', categoria: 'Competencias Técnicas', subCategoria: 'Planificación', rolObjetivo: ['asesor'], orden: 40 },
                { texto: 'Primer contacto con el cliente', categoria: 'Competencias Técnicas', subCategoria: 'Comunicación de Ventas', rolObjetivo: ['asesor'], orden: 41 },
                { texto: 'Primera reunión con el cliente', categoria: 'Competencias Técnicas', subCategoria: 'Comunicación de Ventas', rolObjetivo: ['asesor'], orden: 42 },
                { texto: 'Presentación de la propiedad', categoria: 'Competencias Técnicas', subCategoria: 'Comunicación de Ventas', rolObjetivo: ['asesor'], orden: 43 },
                { texto: 'Técnicas de fotografía inmobiliaria', categoria: 'Competencias Técnicas', subCategoria: 'Herramientas Técnicas', rolObjetivo: ['asesor'], orden: 44 },
                { texto: 'Manejo de herramientas de Office', categoria: 'Competencias Técnicas', subCategoria: 'Herramientas Técnicas', rolObjetivo: ['asesor'], orden: 45 },
                { texto: 'Atención al Cliente: Satisfacción mayor a 90%', categoria: 'Competencias Técnicas', subCategoria: 'Servicio al Cliente', rolObjetivo: ['asesor'], orden: 46 },
                { texto: 'Organización personal y profesional', categoria: 'Competencias Funcionales', subCategoria: 'Competencias Profesionales', rolObjetivo: ['asesor'], orden: 47 },
                { texto: 'Seguimiento post-venta', categoria: 'Competencias Técnicas', subCategoria: 'Servicio al Cliente', rolObjetivo: ['asesor'], orden: 48 }
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