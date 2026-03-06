// client/custom/modules/competencias/src/views/competenciasIndex.js
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
                this.getRouter().navigate('#Competencias/seleccionEvaluados', {trigger: true});
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
            },
            'change #periodo-lista-input': function (e) {
                var val = $(e.currentTarget).val();
                this.$el.find('#btn-lista-edicion').prop('disabled', !val);
            },
            'click [data-action="irListaEdicion"]': function () {
                var periodoId = this.$el.find('#periodo-lista-input').val();
                if (!periodoId) return;
                this.getRouter().navigate(
                    '#Competencias/listaEdicion?periodoId=' + encodeURIComponent(periodoId),
                    { trigger: true }
                );
            }
        },

        setup: function () {
            var user = this.getUser();

            this.esAdmin    = this.getUser().isAdmin();
            this.esCasaNacional       = false;
            this.puedeIniciarEncuesta = false;
            this.tieneAccesoAlModulo  = false;

            this.encuestaActiva = false;
            this.fechaInicio    = null;
            this.fechaCierre    = null;

            this.mostrarBotonActivar = false;
            this.mostrarBotonIniciar = false;

            this.mostrarBotonCrear      = false;
            this.totalPreguntas         = 0;
            this.entidadExiste          = false;
            this.preguntasRecienCreadas = false;

            this.periodos                 = [];
            this.periodosInactivos         = [];
            this.mostrarBotonListaEdicion = false;

            this.wait(true);

            this.getModelFactory().create('User', function (userModel) {
                userModel.id = user.id;
                userModel.fetch({ relations: { roles: true } }).then(function () {
                    var roles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());

                    this.esCasaNacional = roles.includes('casa nacional');
                    this.puedeIniciarEncuesta = this.esCasaNacional
                        || roles.includes('gerente')
                        || roles.includes('director')
                        || roles.includes('coordinador');
                    this.tieneAccesoAlModulo = this.puedeIniciarEncuesta || roles.includes('asesor');

                    this.verificarEstadoGeneral();
                }.bind(this));
            }.bind(this));
        },

        verificarEstadoGeneral: function () {
            this.getCollectionFactory().create('Competencias', function (collection) {
                collection.fetch({
                    data: {
                        maxSize: 500,
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
                            this.fechaInicio    = fechaInicio;
                            this.fechaCierre    = this.getDateTime().toDisplayDate(fechaCierre);
                        }

                        var self = this;
                        var hoy = new Date().toISOString().split('T')[0];
                        
                        this.periodos = (collection.models || []).map(function (m) {
                            var fi = m.get('fechaInicio') || '';
                            var fc = m.get('fechaCierre') || '';
                            return {
                                id:    m.id,
                                label: self._formatearFecha(fi) + ' – ' + self._formatearFecha(fc),
                                fechaInicio: fi,
                                fechaCierre: fc
                            };
                        });
                        
                        this.periodosInactivos = this.periodos.filter(function(p) {
                            return p.fechaCierre < hoy;
                        });
                    }

                    this.mostrarBotonListaEdicion = this.periodosInactivos.length > 0
                        && (this.esCasaNacional || this.puedeIniciarEncuesta);

                    this.verificarPreguntas();
                }.bind(this));
            }.bind(this));
        },

        _formatearFecha: function (fechaStr) {
            if (!fechaStr) return '';
            var d = new Date(fechaStr + 'T00:00:00');
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        },

        verificarPreguntas: function () {
            this.getModelFactory().create('Pregunta', function (model) {
                this.entidadExiste = true;

                this.getCollectionFactory().create('Pregunta', function (collection) {
                    collection.fetch({
                        data: {
                            maxSize: 1,
                            where: [{ type: 'equals', attribute: 'estaActiva', value: 1 }]
                        },
                        success: function () {
                            this.totalPreguntas    = collection.total || 0;
                            this.mostrarBotonCrear = (this.totalPreguntas === 0 && this.esAdmin);
                            this.actualizarVisibilidadBotones();
                            this.wait(false);
                        }.bind(this),
                        error: function () {
                            this.totalPreguntas    = 0;
                            this.mostrarBotonCrear = this.esAdmin;
                            this.actualizarVisibilidadBotones();
                            this.wait(false);
                        }.bind(this)
                    });
                }.bind(this), function () {
                    this.entidadExiste    = false;
                    this.totalPreguntas   = -1;
                    this.mostrarBotonCrear = false;
                    if (this.esAdmin) {
                        Espo.Ui.error('❌ Error accediendo a la entidad Pregunta. Verifica los permisos.');
                    }
                    this.actualizarVisibilidadBotones();
                    this.wait(false);
                }.bind(this));

            }.bind(this), function () {
                this.entidadExiste    = false;
                this.totalPreguntas   = -1;
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
            
            if (this.mostrarBotonListaEdicion && this.periodosInactivos.length > 0) {
                var $select = this.$el.find('#periodo-lista-input');
                $select.empty().append('<option value="">— Selecciona un período —</option>');
                
                this.periodosInactivos.forEach(function(p) {
                    $select.append('<option value="' + p.id + '">' + p.label + '</option>');
                });
            }
        },

        actualizarVisibilidadBotones: function () {
            this.mostrarBotonActivar = this.esCasaNacional && !this.encuestaActiva && this.totalPreguntas > 0;
            this.mostrarBotonIniciar = this.puedeIniciarEncuesta && this.encuestaActiva && this.totalPreguntas > 0;
        },

        actualizarEstadoBotones: function () {
            var $startButton = this.$el.find('[data-action="startSurvey"]');

            if (this.totalPreguntas === 0 || !this.entidadExiste || !this.encuestaActiva) {
                $startButton.addClass('ci-btn-disabled disabled').prop('disabled', true);
            } else {
                $startButton.removeClass('ci-btn-disabled disabled').prop('disabled', false);
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

            if (!confirm(mensaje)) return;

            var $boton = this.$el.find('[data-action="crearPreguntas"]');
            $boton.prop('disabled', true).addClass('disabled').text('Creando...');

            Espo.Ui.notify('Creando preguntas...', 'info');

            // Llamar al endpoint del backend
            Espo.Ajax.postRequest('Pregunta/action/crearPreguntasPorDefecto').then(function (response) {
                if (response.success) {
                    Espo.Ui.success(response.message || '✅ Preguntas creadas exitosamente');
                    this.totalPreguntas = response.totalCreadas || 65;
                    this.mostrarBotonCrear = false;
                    this.preguntasRecienCreadas = true;
                    setTimeout(function () { window.location.reload(); }, 3000);
                } else {
                    Espo.Ui.error(response.error || '❌ Error al crear las preguntas');
                    $boton.prop('disabled', false).removeClass('disabled').text('Inicializar Sistema');
                }
            }.bind(this)).catch(function (error) {
                console.error('Error:', error);
                Espo.Ui.error('❌ Error al crear las preguntas');
                $boton.prop('disabled', false).removeClass('disabled').text('Inicializar Sistema');
            });
        },

        handleFechaCierreChange: function (e) {
            var fechaCierre = $(e.currentTarget).val();
            var $button     = this.$el.find('[data-action="activarEncuestas"]');
            var hoy         = new Date().toISOString().split('T')[0];

            if (fechaCierre && fechaCierre > hoy) {
                $button.prop('disabled', false).removeClass('disabled');
            } else {
                $button.prop('disabled', true).addClass('disabled');
                if (fechaCierre && fechaCierre <= hoy) {
                    Espo.Ui.warning('La fecha de cierre debe ser posterior a la fecha actual.');
                }
            }
        },

        activarEncuestas: function () {
            var fechaCierre = this.$el.find('#fecha-cierre-input').val();
            var fechaInicio = new Date().toISOString().split('T')[0];
            var $boton = this.$el.find('[data-action="activarEncuestas"]');

            if (!confirm('¿Estás seguro de que deseas activar un nuevo período de encuestas hasta el ' + this.getDateTime().toDisplayDate(fechaCierre) + '?')) {
                return;
            }

            $boton.prop('disabled', true).addClass('disabled').html('<i class="fas fa-spinner fa-spin"></i> Creando...');

            this.wait(true);

            this.getModelFactory().create('Competencias', (newModel) => {
                var nombrePeriodo = 'Período de Evaluación ' + this.getDateTime().toDisplayDate(fechaInicio) + ' - ' + this.getDateTime().toDisplayDate(fechaCierre);

                newModel.set({
                    name:        nombrePeriodo,
                    fechaInicio: fechaInicio,
                    fechaCierre: fechaCierre
                });

                newModel.save().then(() => {
                    Espo.Ui.success('Nuevo período de encuestas creado y activado correctamente.');
                    setTimeout(() => window.location.reload(), 3000);
                }).catch(() => {
                    Espo.Ui.error('Error al crear el nuevo período de encuestas.');
                    $boton.prop('disabled', false).removeClass('disabled').html('<i class="fas fa-play-circle"></i> Activar Período');
                    this.wait(false);
                });
            });
        },

        data: function () {
            return {
                esAdmin:               this.esAdmin,
                esCasaNacional:        this.esCasaNacional,
                mostrarBotonCrear:     this.mostrarBotonCrear,
                totalPreguntas:        this.totalPreguntas,
                sinPreguntas:          (this.totalPreguntas === 0),
                errorEntidad:          (this.totalPreguntas === -1),
                preguntasRecienCreadas: this.preguntasRecienCreadas,
                entidadExiste:         this.entidadExiste,
                puedeIniciarEncuesta:  this.puedeIniciarEncuesta,
                encuestaActiva:        this.encuestaActiva,
                mostrarBotonActivar:   this.mostrarBotonActivar,
                mostrarBotonIniciar:   this.mostrarBotonIniciar,
                fechaCierre:           this.fechaCierre,
                tieneAccesoAlModulo:   this.tieneAccesoAlModulo,
                periodos:              this.periodosInactivos, // Usamos los inactivos para el select
                mostrarBotonListaEdicion: this.mostrarBotonListaEdicion
            };
        }
    });
});