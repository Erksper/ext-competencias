define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:encuesta',
        
        events: {
            'click [data-action="selectColor"]': function (e) {
                var preguntaId = $(e.currentTarget).data('pregunta-id');
                var color = $(e.currentTarget).data('color');
                
                this.seleccionarColor(preguntaId, color);
            },
            'click [data-action="toggleCategoria"]': function (e) {
                this.toggleCategoria(e);
            },
            'click [data-action="toggleSubcategoria"]': function (e) {
                this.toggleSubcategoria(e);
            },
            'click [data-action="saveSurvey"]': function () {
                this.guardarEncuesta();
            },
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias/userSelection?teamId=' + this.teamId + '&teamName=' + encodeURIComponent(this.teamName) + '&role=' + this.role, {trigger: true});
            },
            'click [data-action="backToHome"]': function () {
                this.getRouter().navigate('#', {trigger: true});
            }
        },
        
        setup: function () {
            this.parseURLParams();
            
            this.respuestas = {};
            this.encuestaId = null;
            this.guardandoEncuesta = false;
            this.totalPreguntasDisponibles = 0;
            this.preguntas = {};
            
            this.fechaInicio = null;
            this.fechaCierre = null;
            this.evaluadorRoles = [];

            this.accesoDenegado = false;
            this.encuestaInactiva = false;

            this.wait(true);
            this.cargarDatosIniciales();
        },

        cargarDatosIniciales: function() {
            this.getModelFactory().create('User', function (userModel) {
                userModel.id = this.getUser().id;
                userModel.fetch({ relations: { roles: true } }).then(function () {
                    this.getCollectionFactory().create('Competencias', function (competenciaCollection) {
                        competenciaCollection.fetch({ data: { maxSize: 1 } }).then(function () {
                            this.evaluadorRoles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                            const puedeAcceder = this.evaluadorRoles.includes('casa nacional') || this.evaluadorRoles.includes('gerente') || this.evaluadorRoles.includes('director');

                            if (!puedeAcceder) {
                                this.accesoDenegado = true;
                                this.wait(false);
                                return;
                            }

                            let encuestaActiva = false;
                            if (competenciaCollection.total > 0) {
                                const competencia = competenciaCollection.at(0);
                                this.fechaInicio = competencia.get('fechaInicio');
                                this.fechaCierre = competencia.get('fechaCierre');

                                if (this.fechaInicio && this.fechaCierre) {
                                    const hoy = new Date().toISOString().split('T')[0];
                                    encuestaActiva = (hoy >= this.fechaInicio && hoy <= this.fechaCierre);
                                }
                            }

                            if (!encuestaActiva) {
                                this.encuestaInactiva = true;
                                this.wait(false);
                                return;
                            }

                            this.cargarPreguntas();
                        }.bind(this)).catch(function () {
                            Espo.Ui.error('Error al verificar permisos y período de evaluación.');
                            this.wait(false);
                        }.bind(this));
                    }.bind(this));
                }.bind(this)).catch(function () {
                    Espo.Ui.error('Error al verificar permisos y período de evaluación.');
                    this.wait(false);
                }.bind(this));
            }.bind(this));
        },

        parseURLParams: function () {
            var hash = window.location.hash;
            var params = {};
            
            if (hash.includes('?')) {
                var queryString = hash.split('?')[1];
                var pairs = queryString.split('&');
                
                pairs.forEach(function(pair) {
                    var parts = pair.split('=');
                    if (parts.length === 2) {
                        params[parts[0]] = decodeURIComponent(parts[1]);
                    }
                });
            }
            
            this.teamId = params.teamId || 'unknown';
            this.teamName = params.teamName || 'Equipo Desconocido';
            this.userId = params.userId || 'unknown';
            this.userName = params.userName || 'Usuario Desconocido';
            this.role = params.role || 'unknown';
        },

        afterRender: function () {
            var $firstCategoriaHeader = this.$el.find('.categoria-header').first();
            if ($firstCategoriaHeader.length) {
                $firstCategoriaHeader.addClass('active');
                $firstCategoriaHeader.next('.categoria-content').show();
                
                var $firstSubcategoriaHeader = $firstCategoriaHeader.next('.categoria-content').find('.subcategoria-header').first();
                if ($firstSubcategoriaHeader.length) {
                    $firstSubcategoriaHeader.addClass('active');
                    $firstSubcategoriaHeader.next('.subcategoria-content').show();
                }
            }
            
            this.renderRespuestasEnUI();
            this.actualizarIndicadoresDeProgreso();
        },
        
        cargarPreguntas: function () {
            if (this.fechaCierre) {
                this.fechaCierre = this.fechaCierre + ' 23:59:59';
            }

            $.ajax({
                url: 'api/v1/Pregunta',
                type: 'GET',
                data: {
                    maxSize: 200, 
                    where: [
                        {
                            type: 'equals',
                            attribute: 'estaActiva',
                            value: 1
                        }
                    ]
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                success: function (response) {
                    if (response.list && response.list.length > 0) {
                        var preguntasFiltradas = this.filtrarPreguntasPorRol(response.list);
                        this.totalPreguntasDisponibles = preguntasFiltradas.length;
                        this.procesarPreguntasAPI(preguntasFiltradas);
                        this.buscarEncuestaExistente();
                    } else {
                        this.preguntas = {};
                        this.wait(false);
                    }
                }.bind(this),
                error: function (xhr, status, error) {
                    Espo.Ui.error('Error al cargar las preguntas. Por favor, intente de nuevo.');
                    this.wait(false);
                }.bind(this)
            });
        },

        buscarEncuestaExistente: function() {
            this.getCollectionFactory().create('Encuesta', function (encuestaCollection) {
                encuestaCollection.fetch({
                    data: {
                        where: [
                            {
                                type: 'equals',
                                attribute: 'usuarioEvaluadoId',
                                value: this.userId
                            },
                            { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: this.fechaInicio },
                            { type: 'lessThanOrEquals', attribute: 'fechaCreacion', value: this.fechaCierre }
                        ],
                        maxSize: 1,
                        sortBy: 'fechaCreacion',
                        order: 'desc'
                    }
                }).then(function() {
                    if (encuestaCollection.total > 0) {
                        var encuesta = encuestaCollection.at(0);
                        this.encuestaId = encuesta.id;
                        this.cargarRespuestasGuardadas();
                    } else {
                        this.wait(false);
                    }
                }.bind(this)).catch(function() {
                    Espo.Ui.error('Error buscando encuesta existente.');
                    this.wait(false);
                }.bind(this));
            }.bind(this));
        },

        cargarRespuestasGuardadas: function() {
            var preguntasActivasIds = new Set();
            Object.values(this.preguntas).forEach(subcategorias => {
                Object.values(subcategorias).forEach(preguntas => {
                    preguntas.forEach(pregunta => preguntasActivasIds.add(pregunta.id));
                });
            });

            this.getCollectionFactory().create('RespuestaEncuesta', function (respuestasGuardadasCollection) {
                respuestasGuardadasCollection.maxSize = 200;

                respuestasGuardadasCollection.fetch({
                    data: {
                        where: [
                            { type: 'equals', attribute: 'encuestaId', value: this.encuestaId }
                        ]
                    }
                }).then(function () {
                    if (respuestasGuardadasCollection && Array.isArray(respuestasGuardadasCollection.models)) {
                        respuestasGuardadasCollection.models.forEach(function (respuesta) {
                            var preguntaId = respuesta.get('preguntaId');
                            var color = respuesta.get('respuesta');
                            if (preguntasActivasIds.has(preguntaId)) {
                                this.respuestas[preguntaId] = color;
                            }
                        }, this);
                    }
                    
                    this.renderRespuestasEnUI();
                    this.actualizarIndicadoresDeProgreso();
                    this.wait(false);
                }.bind(this)).catch(function(xhr) {
                    var errorMessage = 'Error cargando las respuestas guardadas.';
                    if (xhr && xhr.responseJSON && xhr.responseJSON.message) {
                        errorMessage += ' Detalle: ' + xhr.responseJSON.message;
                    } else if (xhr && xhr.statusText) {
                        errorMessage += ' Estado: ' + xhr.statusText;
                    }
                    Espo.Ui.error(errorMessage);
                    this.wait(false);
                }.bind(this));
            }.bind(this));
        },

        filtrarPreguntasPorRol: function (todasLasPreguntas) {
            var preguntasFiltradas = [];
            
            todasLasPreguntas.forEach(function(pregunta) {
                var rolObjetivo = pregunta.rolObjetivo || [];
                var incluir = false;
                
                if (Array.isArray(rolObjetivo)) {
                    if (rolObjetivo.includes(this.role)) {
                        incluir = true;
                    }
                }
                
                if (incluir) {
                    preguntasFiltradas.push({
                        id: pregunta.id,
                        texto: pregunta.textoPregunta || pregunta.name,
                        categoria: pregunta.categoria || 'Sin Categoría',
                        subcategoria: pregunta.subCategoria || 'General',
                        orden: pregunta.orden || 0
                    });
                }
            }.bind(this));
            
            preguntasFiltradas.sort(function(a, b) {
                return (a.orden || 0) - (b.orden || 0);
            });
            
            return preguntasFiltradas;
        },

        procesarPreguntasAPI: function (preguntasArray) {
            var preguntasAgrupadas = {};
            
            preguntasArray.forEach(function(pregunta) {
                var categoria = pregunta.categoria || 'Sin Categoría';
                var subcategoria = pregunta.subcategoria || 'General';
                
                if (!preguntasAgrupadas[categoria]) {
                    preguntasAgrupadas[categoria] = {};
                }
                
                if (!preguntasAgrupadas[categoria][subcategoria]) {
                    preguntasAgrupadas[categoria][subcategoria] = [];
                }
                
                preguntasAgrupadas[categoria][subcategoria].push({
                    id: pregunta.id,
                    texto: pregunta.texto,
                    orden: pregunta.orden || 0
                });
            });
            
            Object.keys(preguntasAgrupadas).forEach(function(categoria) {
                Object.keys(preguntasAgrupadas[categoria]).forEach(function(subcategoria) {
                    preguntasAgrupadas[categoria][subcategoria].sort(function(a, b) {
                        return (a.orden || 0) - (b.orden || 0);
                    });
                });
            });
            
            this.preguntas = preguntasAgrupadas;
        },
        
        seleccionarColor: function (preguntaId, color) {
            this.respuestas[preguntaId] = color;
            
            this.$el.find('[data-pregunta-id="' + preguntaId + '"]').removeClass('selected');
            this.$el.find('[data-pregunta-id="' + preguntaId + '"][data-color="' + color + '"]').addClass('selected');
            
            this.actualizarIndicadoresDeProgreso();
        },

        renderRespuestasEnUI: function() {
            if (Object.keys(this.respuestas).length === 0) {
                return;
            }
            Object.keys(this.respuestas).forEach(function(preguntaId) {
                var color = this.respuestas[preguntaId];
                this.$el.find('[data-pregunta-id="' + preguntaId + '"]').removeClass('selected');
                this.$el.find('[data-pregunta-id="' + preguntaId + '"][data-color="' + color + '"]').addClass('selected');
            }.bind(this));
        },

        actualizarIndicadoresDeProgreso: function () {
            var respuestas = this.respuestas;
            var preguntasAgrupadas = this.preguntas;

            var escapeCss = function (str) {
                return (str + '').replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
            };

            Object.keys(preguntasAgrupadas).forEach(function (categoriaNombre) {
                var categoriaData = preguntasAgrupadas[categoriaNombre];
                var totalPreguntasCategoria = 0;
                var respondidasCategoria = 0;

                Object.keys(categoriaData).forEach(function (subcategoriaNombre) {
                    var preguntasSubcat = categoriaData[subcategoriaNombre];
                    var totalPreguntasSubcat = preguntasSubcat.length;
                    var respondidasSubcat = 0;

                    preguntasSubcat.forEach(function (pregunta) {
                        if (respuestas.hasOwnProperty(pregunta.id)) {
                            respondidasSubcat++;
                        }
                    });

                    var selectorSubcat = `.subcategoria-header[data-subcategoria-nombre="${escapeCss(subcategoriaNombre)}"] .estado-completitud`;
                    var $indicadorSubcat = this.$el.find(selectorSubcat);
                    if (totalPreguntasSubcat > 0) {
                        if (respondidasSubcat === totalPreguntasSubcat) {
                            $indicadorSubcat.text('Completo').removeClass('incompleto').addClass('completo');
                        } else {
                            $indicadorSubcat.text('Incompleto').removeClass('completo').addClass('incompleto');
                        }
                    }

                    totalPreguntasCategoria += totalPreguntasSubcat;
                    respondidasCategoria += respondidasSubcat;
                }.bind(this));

                var selectorCat = `.categoria-header[data-categoria-nombre="${escapeCss(categoriaNombre)}"] .estado-completitud`;
                var $indicadorCat = this.$el.find(selectorCat);
                if (totalPreguntasCategoria > 0) {
                    if (respondidasCategoria === totalPreguntasCategoria) {
                        $indicadorCat.text('Completo').removeClass('incompleto').addClass('completo');
                    } else {
                        $indicadorCat.text('Incompleto').removeClass('completo').addClass('incompleto');
                    }
                }
            }.bind(this));
        },

        toggleCategoria: function (e) {
            var $header = $(e.currentTarget);
            var $content = $header.next('.categoria-content');
            var wasActive = $header.hasClass('active');

            this.$el.find('.categoria-header').removeClass('active');
            this.$el.find('.categoria-content').slideUp('fast');

            if (!wasActive) {
                $header.addClass('active');
                $content.slideDown('fast');
            }
        },

        toggleSubcategoria: function (e) {
            var $header = $(e.currentTarget);
            var $content = $header.next('.subcategoria-content');

            if ($header.hasClass('active')) {
                $header.removeClass('active');
                $content.slideUp('fast');
            } else {
                var $parentCategoria = $header.closest('.categoria-content');
                $parentCategoria.find('.subcategoria-header').removeClass('active');
                $parentCategoria.find('.subcategoria-content').slideUp('fast');

                $header.addClass('active');
                $content.slideDown('fast');
            }
        },

        guardarEncuesta: function () {
            const esCasaNacional = this.evaluadorRoles.includes('casa nacional');
            const esGerenteDirector = this.evaluadorRoles.includes('gerente') || this.evaluadorRoles.includes('director');
            const preguntasRespondidasCount = Object.keys(this.respuestas).length;
            const totalPreguntasDisponibles = this.totalPreguntasDisponibles || 0;
            const estaCompleta = (totalPreguntasDisponibles > 0) && (preguntasRespondidasCount === totalPreguntasDisponibles);

            if (esCasaNacional && !estaCompleta) {
                Espo.Ui.warning('Debe responder todas las preguntas para poder guardar la evaluación.');
                return;
            }
            
            if (!this.encuestaId && preguntasRespondidasCount === 0) {
                Espo.Ui.warning('Debes responder al menos una pregunta para guardar.');
                return;
            }

            if (this.guardandoEncuesta) return;
            this.guardandoEncuesta = true;
            
            const $saveButton = this.$el.find('[data-action="saveSurvey"]');
            $saveButton.prop('disabled', true).text('Guardando...');
            Espo.Ui.notify('Guardando encuesta...', 'info');

            this.getModelFactory().create('Encuesta', (encuestaModel) => {
                const isUpdate = !!this.encuestaId;

                const setupAndSave = (model) => {
                    let estadoActual = isUpdate ? model.get('estado') : null;
                    let estadoEncuesta = estadoActual;

                    if (estadoActual !== 'completada') {
                        if (estaCompleta) {
                            estadoEncuesta = esCasaNacional ? 'completada' : 'revision';
                        } else {
                            estadoEncuesta = 'incompleta';
                        }
                    }

                    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    const porcentajeCompletado = totalPreguntasDisponibles > 0 
                        ? Math.round((preguntasRespondidasCount / totalPreguntasDisponibles) * 100) 
                        : 0;

                    const dataToSet = {
                        totalPreguntas: totalPreguntasDisponibles,
                        preguntasRespondidas: preguntasRespondidasCount,
                        porcentajeCompletado: porcentajeCompletado,
                        estado: estadoEncuesta,
                        fechaModificacion: now
                    };

                    if (!isUpdate) {
                        Object.assign(dataToSet, {
                            name: 'Evaluación ' + this.userName + ' - ' + new Date().toLocaleString(),
                            rolUsuario: this.role,
                            fechaEncuesta: now,
                            equipoId: this.teamId,
                            usuarioEvaluadoId: this.userId,
                            usuarioEvaluadorId: this.getUser().id,
                            fechaCreacion: now,
                        });
                    }
                    
                    model.set(dataToSet);

                    model.save().then(() => {
                        if (!this.encuestaId) {
                            this.encuestaId = model.id; 
                        }
                        this.sincronizarRespuestas(model.id, model);
                    }).catch(() => {
                        Espo.Ui.error('Error crítico: No se pudo guardar el registro de la encuesta.');
                        this.guardandoEncuesta = false;
                        $saveButton.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar Encuesta');
                    });
                };

                if (isUpdate) {
                    encuestaModel.id = this.encuestaId;
                    encuestaModel.fetch().then(() => setupAndSave(encuestaModel))
                        .catch(() => {
                            Espo.Ui.error('Error al cargar la encuesta existente para actualizar.');
                            this.guardandoEncuesta = false;
                            $saveButton.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar Encuesta');
                        });
                } else {
                    setupAndSave(encuestaModel);
                }
            });
        },

        sincronizarRespuestas: function(encuestaId, encuestaModel) {
            var respuestasNuevas = this.convertirRespuestasParaAPI();
            
            this.getCollectionFactory().create('RespuestaEncuesta', function (respuestasAntiguasCollection) {
                respuestasAntiguasCollection.maxSize = 200;

                respuestasAntiguasCollection.fetch({
                    data: { where: [{ type: 'equals', attribute: 'encuestaId', value: encuestaId }] }
                }).then(function() {
                    var mapaRespuestasAntiguas = {};
                    respuestasAntiguasCollection.forEach(function(model) {
                        mapaRespuestasAntiguas[model.get('preguntaId')] = model;
                    });

                    var procesadas = 0;
                    var errores = [];
                    var totalAProcesar = respuestasNuevas.length;

                    var procesarSincronizacion = function(index) {
                        if (index >= totalAProcesar) {
                            this.finalizarGuardado(procesadas, errores, totalAProcesar, encuestaModel);
                            return;
                        }

                        var nuevaRespuesta = respuestasNuevas[index];
                        var preguntaId = nuevaRespuesta.pregunta;
                        var modeloExistente = mapaRespuestasAntiguas[preguntaId];

                        var next = function(exito) {
                            if (exito) {
                                procesadas++;
                            } else {
                                errores.push(preguntaId);
                            }
                            setTimeout(function() { procesarSincronizacion.call(this, index + 1); }.bind(this), 0);
                        }.bind(this);

                        if (modeloExistente) {
                            if (modeloExistente.get('respuesta') !== nuevaRespuesta.color) {
                                modeloExistente.set({ respuesta: nuevaRespuesta.color });
                                modeloExistente.save({}, {
                                    success: function() { next(true); },
                                    error: function() { next(false); }
                                });
                            } else {
                                next(true);
                            }
                        } else {
                            this.getModelFactory().create('RespuestaEncuesta', function(respuestaModel) {
                                respuestaModel.set({
                                    name: 'Respuesta - ' + nuevaRespuesta.pregunta,
                                    respuesta: nuevaRespuesta.color,
                                    encuestaId: encuestaId,
                                    preguntaId: nuevaRespuesta.pregunta
                                });
                                respuestaModel.save({}, {
                                    success: function() { next(true); },
                                    error: function() { next(false); }
                                });
                            }.bind(this));
                        }
                    }.bind(this);

                    if (totalAProcesar > 0) {
                        procesarSincronizacion(0);
                    } else {
                        this.finalizarGuardado(0, [], 0, encuestaModel);
                    }

                }.bind(this)).catch(function() {
                    Espo.Ui.error('No se pudo sincronizar con las respuestas guardadas. Intente de nuevo.');
                    var $saveButton = this.$el.find('[data-action="saveSurvey"]');
                    this.guardandoEncuesta = false;
                    $saveButton.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar Encuesta');
                }.bind(this));
            }.bind(this));
        },

        finalizarGuardado: function(creadas, errores, total, encuestaModel) {
            if (errores.length === 0) {
                Espo.Ui.success(`Encuesta guardada exitosamente. ${creadas}/${total} respuestas procesadas.`);
            } else {
                Espo.Ui.warning(`Encuesta guardada con ${errores.length} errores. ${creadas}/${total} respuestas procesadas.`);
            }

            this.guardandoEncuesta = false;
            var $saveButton = this.$el.find('[data-action="saveSurvey"]');
            $saveButton.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar Encuesta');

            setTimeout(function() {
                var backUrl = '#Competencias/userSelection?teamId=' + this.teamId + '&teamName=' + encodeURIComponent(this.teamName) + '&role=' + this.role;
                this.getRouter().navigate(backUrl, {trigger: true});
            }.bind(this), 2000);
        },

        convertirRespuestasParaAPI: function () {
            var respuestasArray = [];
            
            Object.keys(this.respuestas).forEach(function (preguntaId) {
                respuestasArray.push({
                    pregunta: preguntaId,
                    color: this.respuestas[preguntaId]
                });
            }.bind(this));
            
            return respuestasArray;
        },

        data: function () {
            return {
                teamName: this.teamName,
                userName: this.userName, 
                role: this.role,
                preguntas: this.preguntas || {},
                accesoDenegado: this.accesoDenegado,
                encuestaInactiva: this.encuestaInactiva
            };
        }
    });
});
