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
                { texto: 'Paso a paso de la realización de un negocio inmobiliario', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['gerente'], orden: 1 },
                { texto: 'Manejo de las leyes inmobiliarias básicas para atender un cliente', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['gerente'], orden: 2 },
                { texto: 'Conocimientos básicos para la realización de un AMC', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['gerente'], orden: 3 },
                { texto: 'Conocimiento del manual interno de operaciones de la oficina (MIO)', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['gerente'], orden: 4 },
                { texto: 'Elije capacitaciones con metodología', categoria: 'Competencias Técnicas', subCategoria: 'Transformacion de Información a Aprendizaje', rolObjetivo: ['gerente'], orden: 5 },
                { texto: 'Metodología de práctica en equipo en la oficina', categoria: 'Competencias Técnicas', subCategoria: 'Transformacion de Información a Aprendizaje', rolObjetivo: ['gerente'], orden: 6 },
                { texto: 'Metodología de sombra con el cliente', categoria: 'Competencias Técnicas', subCategoria: 'Transformacion de Información a Aprendizaje', rolObjetivo: ['gerente'], orden: 7 },
                { texto: 'Manejo de estructura comunicacional para las objeciones', categoria: 'Competencias Técnicas', subCategoria: 'Negociación', rolObjetivo: ['gerente'], orden: 8 },
                { texto: 'Manejo del sistema tecnológico de la oficina (21 Online)', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], orden: 9 },
                { texto: 'Control de expedientes', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], orden: 10 },
                { texto: 'Metodología para evitar problemas en las negociaciones', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], orden: 11 },
                { texto: 'Manejo metodológico de las reuniones 1 a 1 con el asesor', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], orden: 12 },
                { texto: 'Aplicación de encuesta de calidad de servicio', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], orden: 13 },
                { texto: 'Manejo metodológico del inventario', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], orden: 14 },
                { texto: 'Reclutamiento y selección: Manejo metodológico - 60% del equipo hace 1 lado por mes por asesor', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], orden: 15 },
                { texto: 'Tiene la planificación anual de todo el equipo de asesores', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], orden: 16 },
                { texto: 'Realizó el análisis de competencias del equipo', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], orden: 17 },
                { texto: 'Tiene el plan de formación anual', categoria: 'Competencias Técnicas', subCategoria: 'Aspectos Técnicos Generales', rolObjetivo: ['gerente'], orden: 18 },
                { texto: 'Tiene activo digital disponible en Meta', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], orden: 19 },
                { texto: 'Utiliza lenguaje cliente en sus publicaciones', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], orden: 20 },
                { texto: 'Sabe cómo utilizar las herramientas tecnológicas para crear post - videos', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], orden: 21 },
                { texto: 'Sabe cómo segmentar en Meta con base de datos y con video', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], orden: 22 },
                { texto: 'Sabe cómo automatizar su mercadeo en Meta', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], orden: 23 },
                { texto: 'Sabe hacer publicidad en Google', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], orden: 24 },
                { texto: 'Tiene un plan de mercadeo digital para la oficina', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], orden: 25 },
                { texto: 'Tiene un plan de mercadeo digital para los asesores', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['gerente'], orden: 26 },
                { texto: 'Orientación a la mejora continua personal', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente'], orden: 27 },
                { texto: 'Autoconfianza', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente'], orden: 28 },
                { texto: 'Sentido del negocio', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente'], orden: 29 },
                { texto: 'Capacidad de asumir la necesidad del cliente', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente'], orden: 30 },
                { texto: 'Efectividad interpersonal', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente'], orden: 31 },
                { texto: 'Gestión de la información', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente'], orden: 32 },
                { texto: 'Capacidad de respuesta', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente'], orden: 33 },
                { texto: 'Planificación semanal', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['gerente'], orden: 34 },

                { texto: 'Competencias intelectual', categoria: 'Personalidad', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 1 },
                { texto: 'Competencias emocionales', categoria: 'Personalidad', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 2 },
                { texto: 'Competencias éticas', categoria: 'Personalidad', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 3 },
                { texto: 'Competencias sociales', categoria: 'Personalidad', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 4 },
                { texto: 'Paso a paso de la realización de un negocio inmobiliario', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['asesor'], orden: 5 },
                { texto: 'Manejo de las leyes inmobiliarias básicas para atender un cliente', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['asesor'], orden: 6 },
                { texto: 'Conocimientos básicos para la realización de un AMC', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['asesor'], orden: 7 },
                { texto: 'Conocimiento del manual interno de operaciones de la oficina', categoria: 'Competencias Técnicas', subCategoria: 'Conocimiento importante para la actividad inmobiliaria', rolObjetivo: ['asesor'], orden: 8 },
                { texto: 'Agenda', categoria: 'Competencias Técnicas', subCategoria: 'Planificación', rolObjetivo: ['asesor'], orden: 9 },
                { texto: 'Planificación semanal', categoria: 'Competencias Técnicas', subCategoria: 'Planificación', rolObjetivo: ['asesor'], orden: 10 },
                { texto: 'Primer contacto', categoria: 'Competencias Técnicas', subCategoria: 'Comunicación de ventas', rolObjetivo: ['asesor'], orden: 11 },
                { texto: 'Primera reunión', categoria: 'Competencias Técnicas', subCategoria: 'Comunicación de ventas', rolObjetivo: ['asesor'], orden: 12 },
                { texto: 'Presentación de la propiedad', categoria: 'Competencias Técnicas', subCategoria: 'Comunicación de ventas', rolObjetivo: ['asesor'], orden: 13 },
                { texto: 'Manejo del sistema tecnológico de la oficina (21 Online)', categoria: 'Competencias Técnicas', subCategoria: 'Negociación', rolObjetivo: ['asesor'], orden: 14 },
                { texto: 'Fotografía', categoria: 'Competencias Técnicas', subCategoria: 'Negociación', rolObjetivo: ['asesor'], orden: 15 },
                { texto: 'Herramientas de Office', categoria: 'Competencias Técnicas', subCategoria: 'Negociación', rolObjetivo: ['asesor'], orden: 16 },
                { texto: 'Atención al cliente: Satisfacción de clientes mayor a 90%', categoria: 'Competencias Técnicas', subCategoria: 'Negociación', rolObjetivo: ['asesor'], orden: 17 },
                { texto: 'Tiene activo digital disponible en Meta', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], orden: 18 },
                { texto: 'Utiliza lenguaje cliente en sus publicaciones', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], orden: 19 },
                { texto: 'Sabe cómo utilizar las herramientas tecnológicas para crear post - videos', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], orden: 20 },
                { texto: 'Sabe cómo segmentar en Meta con base de datos y con video', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], orden: 21 },
                { texto: 'Sabe cómo automatizar su mercadeo en Meta', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], orden: 22 },
                { texto: 'Sabe hacer publicidad en Google', categoria: 'Competencias Técnicas', subCategoria: 'Marketing', rolObjetivo: ['asesor'], orden: 23 },
                { texto: 'Orientación a la mejora continua personal', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 24 },
                { texto: 'Autoconfianza', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 25 },
                { texto: 'Sentido del negocio', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 26 },
                { texto: 'Capacidad de asumir la necesidad del cliente', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 27 },
                { texto: 'Efectividad interpersonal', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 28 },
                { texto: 'Gestión de la información', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 29 },
                { texto: 'Capacidad de respuesta', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 30 },
                { texto: 'Organización', categoria: 'Competencias Funcionales', subCategoria: 'General', rolObjetivo: ['asesor'], orden: 31 }
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