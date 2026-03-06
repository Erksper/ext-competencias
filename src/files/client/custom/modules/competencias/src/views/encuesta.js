// client/custom/modules/competencias/src/views/encuesta.js
define(['view'], function (View) {

    if (!Handlebars.helpers.eq) {
        Handlebars.registerHelper('eq', function (a, b) {
            return a === b;
        });
    }
    
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
                this.guardarEncuesta(false);
            },
            'click [data-action="completeSurvey"]': function () {
                this.guardarEncuesta(true);
            },
            'click [data-action="showInfo"]': function (e) {
                e.preventDefault();
                e.stopPropagation();
                this.mostrarInfoModal(e);
            },
            'click [data-action="back"]': function () {
                if (this.fromListaEdicion && this.retornoUrl) {
                    var url = this.retornoUrl;
                    if (url.startsWith('#')) {
                        this.getRouter().navigate(url.substring(1), {trigger: true});
                    } else {
                        this.getRouter().navigate(url, {trigger: true});
                    }
                } 
                else if (this.from === 'seleccion' && this.retornoUrl) {
                    var url = this.retornoUrl;
                    if (url.startsWith('#')) {
                        this.getRouter().navigate(url.substring(1), {trigger: true});
                    } else {
                        this.getRouter().navigate(url, {trigger: true});
                    }
                }
                else {
                    var backUrl = '#Competencias/userSelection?teamId=' + this.teamId + 
                                  '&teamName=' + encodeURIComponent(this.teamName || '') + 
                                  '&role=' + this.role;
                    this.getRouter().navigate(backUrl, {trigger: true});
                }
            },
            'click [data-action="backToHome"]': function () {
                this.getRouter().navigate('#', {trigger: true});
            }
        },
        
        setup: function () {
            this.respuestas = {};
            this.encuestaId = null;
            this.guardandoEncuesta = false;
            this.totalPreguntasDisponibles = 0;
            this.preguntas = {};
            this.datosCargados = false;
            
            this.fechaInicio = null;
            this.fechaCierre = null;
            this.evaluadorRoles = [];
            this.esCasaNacional = false;

            this.accesoDenegado = false;
            this.encuestaInactiva = false;
            
            this.teamId = null;
            this.teamName = null;
            this.userId = null;
            this.userName = null;
            this.role = null;
            this.fromListaEdicion = false;
            this.encuestaIdUrl = null;
            this.retornoUrl = null;
            
            this.parseURLParams();

            this.wait(true);
            this.cargarDatosIniciales();
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
            
            this.from = params.from || 'normal';
            this.fromListaEdicion = params.from === 'listaEdicion';
            this.retornoUrl = params.retorno ? decodeURIComponent(params.retorno) : null;
            
            if (params.data) {
                var dataString = decodeURIComponent(params.data);
                var dataPairs = dataString.split('|');
                
                dataPairs.forEach(function(pair) {
                    var parts = pair.split(':');
                    if (parts.length === 2) {
                        var key = parts[0];
                        var value = parts[1];
                        
                        switch(key) {
                            case 'encuestaId':
                                this.encuestaIdUrl = value;
                                break;
                            case 'userId':
                                this.userId = value || null;
                                break;
                            case 'userName':
                                this.userName = value || null;
                                break;
                            case 'teamId':
                                this.teamId = value || null;
                                break;
                            case 'teamName':
                                this.teamName = value || null;
                                break;
                            case 'role':
                                this.role = value || null;
                                break;
                        }
                    }
                }, this);
            }
            
            if (!params.data) {
                this.teamId = params.teamId || null;
                this.teamName = params.teamName || null;
                this.userId = params.userId || null;
                this.userName = params.userName || null;
                this.role = params.role || null;
                this.encuestaIdUrl = params.encuestaId || null;
            }
        },

        cargarDatosIniciales: function() {
            if (this.fromListaEdicion && this.encuestaIdUrl) {
                this.encuestaId = this.encuestaIdUrl;
                this._cargarEncuestaExistente();
                return;
            }
            
            this.getModelFactory().create('User', function (userModel) {
                userModel.id = this.getUser().id;
                userModel.fetch({ relations: { roles: true } }).then(function () {
                    this.getCollectionFactory().create('Competencias', function (competenciaCollection) {
                        competenciaCollection.fetch({ 
                            data: { 
                                maxSize: 1,
                                orderBy: 'fechaCierre',
                                order: 'desc'
                            } 
                        }).then(function () {
                            this.evaluadorRoles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                            this.esCasaNacional = this.evaluadorRoles.includes('casa nacional');
                            const puedeAcceder = this.esCasaNacional || 
                                this.evaluadorRoles.includes('gerente') || 
                                this.evaluadorRoles.includes('director') || 
                                this.evaluadorRoles.includes('coordinador');
                            
                            if (!puedeAcceder) {
                                this.accesoDenegado = true;
                                this.reRender();
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
                                this.reRender();
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
        
        _cargarEncuestaExistente: function() {
            this.getModelFactory().create('Encuesta', function (encuestaModel) {
                encuestaModel.id = this.encuestaId;
                encuestaModel.fetch().then(function () {
                    this.teamId = this.teamId || encuestaModel.get('equipoId');
                    this.teamName = this.teamName || encuestaModel.get('equipoName');
                    this.userId = this.userId || encuestaModel.get('usuarioEvaluadoId');
                    this.userName = this.userName || encuestaModel.get('usuarioEvaluadoName');
                    this.role = this.role || encuestaModel.get('rolUsuario');
                    
                    this.getModelFactory().create('User', function (userModel) {
                        userModel.id = this.getUser().id;
                        userModel.fetch({ relations: { roles: true } }).then(function () {
                            this.evaluadorRoles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                            this.esCasaNacional = this.evaluadorRoles.includes('casa nacional');
                            
                            this.cargarPreguntas();
                        }.bind(this));
                    }.bind(this));
                    
                }.bind(this)).catch(function (error) {
                    Espo.Ui.error('No se pudo cargar la encuesta solicitada.');
                    this.wait(false);
                }.bind(this));
            }.bind(this));
        },

        afterRender: function () {
            this.inicializarTooltips();
            
            if (this.datosCargados) {
                this._renderizarPreguntas();
                this._actualizarRespuestasUI();
            }
            
            if (this.fromListaEdicion) {
                this.$el.find('[data-action="saveSurvey"]').hide();
                
                var $completeBtn = this.$el.find('[data-action="completeSurvey"]');
                $completeBtn.html('<i class="fas fa-save"></i> Guardar Cambios');
                $completeBtn.removeClass('encuesta-btn-success').addClass('encuesta-btn-primary');
            }
        },

        inicializarTooltips: function() {
            if (this.$el && this.$el.find) {
                this.$el.find('[data-toggle="tooltip"]').tooltip({
                    placement: 'top',
                    html: true,
                    container: 'body',
                    trigger: 'hover'
                });
            }
        },

        mostrarInfoModal: function(e) {
            var infoTexto = $(e.currentTarget).data('info');
            var preguntaTexto = $(e.currentTarget).data('pregunta-texto');
            
            if (!infoTexto) return;

            var modalId = 'infoModal';
            var $modal = $('#' + modalId);
            
            if ($modal.length === 0) {
                var modalHtml = 
                    '<div class="modal fade" id="' + modalId + '" tabindex="-1" role="dialog">' +
                    '  <div class="modal-dialog modal-lg" role="document">' +
                    '    <div class="modal-content">' +
                    '      <div class="modal-header">' +
                    '        <button type="button" class="close" data-dismiss="modal" aria-label="Close">' +
                    '          <span aria-hidden="true">&times;</span>' +
                    '        </button>' +
                    '        <h4 class="modal-title"><i class="fas fa-info-circle"></i> Información de la Pregunta</h4>' +
                    '      </div>' +
                    '      <div class="modal-body">' +
                    '        <div class="info-pregunta-container">' +
                    '          <h5 class="info-pregunta-titulo">Pregunta:</h5>' +
                    '          <p class="info-pregunta-texto"></p>' +
                    '        </div>' +
                    '        <div class="info-contenido-container">' +
                    '          <h5 class="info-contenido-titulo">Información adicional:</h5>' +
                    '          <div class="info-contenido-texto"></div>' +
                    '        </div>' +
                    '      </div>' +
                    '      <div class="modal-footer">' +
                    '        <button type="button" class="btn btn-default" data-dismiss="modal">Cerrar</button>' +
                    '      </div>' +
                    '    </div>' +
                    '  </div>' +
                    '</div>';
                
                $('body').append(modalHtml);
                $modal = $('#' + modalId);
            }
            
            $modal.find('.info-pregunta-texto').text(preguntaTexto);
            $modal.find('.info-contenido-texto').html(infoTexto.replace(/\n/g, '<br>'));
            
            $modal.modal('show');
         },
        
        cargarPreguntas: function () {
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
                        this.preguntas = this.procesarPreguntasAPI(preguntasFiltradas);
                        
                        this.datosCargados = true;
                        
                        if (this.isRendered()) {
                            this._renderizarPreguntas();
                        }
                        
                        if (this.encuestaId) {
                            this.cargarRespuestasGuardadas();
                        } else {
                            this.buscarEncuestaExistente();
                        }
                    } else {
                        this.preguntas = {};
                        this.datosCargados = true;
                        if (this.isRendered()) {
                            this._renderizarPreguntas();
                        }
                        this.wait(false);
                    }
                }.bind(this),
                error: function (xhr, status, error) {
                    Espo.Ui.error('Error al cargar las preguntas.');
                    this.wait(false);
                }.bind(this)
            });
        },

        _renderizarPreguntas: function() {
            var $container = this.$el.find('.encuesta-preguntas-container');
            if (!$container.length) {
                return;
            }
            
            if (!this.preguntas || Object.keys(this.preguntas).length === 0) {
                $container.html('<div class="alert alert-info">No hay preguntas disponibles</div>');
                return;
            }
            
            var html = '';
            var self = this;
            
            Object.keys(this.preguntas).forEach(function(categoriaNombre) {
                var subcategorias = self.preguntas[categoriaNombre];
                var categoriaId = 'cat-' + self._slugify(categoriaNombre);
                
                html += '<div class="encuesta-categoria">';
                html += '<div class="encuesta-categoria-header" data-action="toggleCategoria" data-categoria-nombre="' + self.escapeHtml(categoriaNombre) + '">';
                html += '<div class="encuesta-categoria-titulo">';
                html += '<i class="fas fa-folder"></i>';
                html += '<span>' + self.escapeHtml(categoriaNombre) + '</span>';
                html += '</div>';
                html += '<div class="encuesta-categoria-estado">';
                html += '<span class="estado-completitud" id="' + categoriaId + '"></span>';
                html += '<i class="fas fa-chevron-down encuesta-categoria-chevron"></i>';
                html += '</div>';
                html += '</div>';
                
                html += '<div class="encuesta-categoria-content" data-categoria-nombre="' + self.escapeHtml(categoriaNombre) + '">';
                
                Object.keys(subcategorias).forEach(function(subcategoriaNombre) {
                    var preguntas = subcategorias[subcategoriaNombre];
                    var subcategoriaId = 'sub-' + self._slugify(subcategoriaNombre);
                    
                    html += '<div class="encuesta-subcategoria">';
                    html += '<div class="encuesta-subcategoria-header" data-action="toggleSubcategoria" data-subcategoria-nombre="' + self.escapeHtml(subcategoriaNombre) + '">';
                    html += '<div class="encuesta-subcategoria-titulo">';
                    html += '<i class="fas fa-folder-open"></i>';
                    html += '<span>' + self.escapeHtml(subcategoriaNombre) + '</span>';
                    html += '</div>';
                    html += '<div class="encuesta-subcategoria-estado">';
                    html += '<span class="estado-completitud" id="' + subcategoriaId + '"></span>';
                    html += '<i class="fas fa-chevron-down encuesta-subcategoria-chevron"></i>';
                    html += '</div>';
                    html += '</div>';
                    
                    html += '<div class="encuesta-subcategoria-content" data-subcategoria-nombre="' + self.escapeHtml(subcategoriaNombre) + '">';
                    html += '<div class="encuesta-tabla-container">';
                    html += '<table class="encuesta-tabla">';
                    html += '<thead><tr>';
                    html += '<th>Competencia</th>';
                    html += '<th><span class="encuesta-color-badge verde">Verde</span></th>';
                    html += '<th><span class="encuesta-color-badge amarillo">Amarillo</span></th>';
                    html += '<th><span class="encuesta-color-badge rojo">Rojo</span></th>';
                    html += '</tr></thead>';
                    html += '<tbody>';
                    
                    preguntas.forEach(function(pregunta) {
                        var textoPregunta = (pregunta.orden || '') + '. ' + (pregunta.texto || '');
                        
                        html += '<tr class="encuesta-pregunta-row">';
                        html += '<td>';
                        html += '<div class="encuesta-pregunta-container">';
                        
                        if (pregunta.info) {
                            html += '<i class="fas fa-info-circle encuesta-info-icon" ';
                            html += 'data-action="showInfo" ';
                            html += 'data-info="' + self.escapeHtml(pregunta.info) + '" ';
                            html += 'data-pregunta-texto="' + self.escapeHtml(textoPregunta) + '" ';
                            html += 'title="Ver información adicional"></i>';
                        }
                        
                        html += '<span class="encuesta-pregunta-texto">' + self.escapeHtml(textoPregunta) + '</span>';
                        html += '</div>';
                        html += '</td>';
                        html += '<td>';
                        html += '<div class="encuesta-color-opcion color-verde" ';
                        html += 'data-action="selectColor" ';
                        html += 'data-pregunta-id="' + pregunta.id + '" ';
                        html += 'data-color="verde" ';
                        html += 'title="Verde - Competente"></div>';
                        html += '</td>';
                        html += '<td>';
                        html += '<div class="encuesta-color-opcion color-amarillo" ';
                        html += 'data-action="selectColor" ';
                        html += 'data-pregunta-id="' + pregunta.id + '" ';
                        html += 'data-color="amarillo" ';
                        html += 'title="Amarillo - En desarrollo"></div>';
                        html += '</td>';
                        html += '<td>';
                        html += '<div class="encuesta-color-opcion color-rojo" ';
                        html += 'data-action="selectColor" ';
                        html += 'data-pregunta-id="' + pregunta.id + '" ';
                        html += 'data-color="rojo" ';
                        html += 'title="Rojo - Requiere mejora"></div>';
                        html += '</td>';
                        html += '</tr>';
                    });
                    
                    html += '</tbody></table>';
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                });
                
                html += '</div>';
                html += '</div>';
            });
            
            $container.html(html);
            
            this._bindToggleEvents();
            
            this.actualizarIndicadoresDeProgreso();
            
            var $firstCategoriaHeader = this.$el.find('.encuesta-categoria-header').first();
            if ($firstCategoriaHeader.length) {
                $firstCategoriaHeader.addClass('active');
                $firstCategoriaHeader.next('.encuesta-categoria-content').show();
                $firstCategoriaHeader.find('.encuesta-categoria-chevron')
                    .removeClass('fa-chevron-down')
                    .addClass('fa-chevron-up');
                
                var $firstSubcategoriaHeader = $firstCategoriaHeader.next('.encuesta-categoria-content')
                    .find('.encuesta-subcategoria-header').first();
                if ($firstSubcategoriaHeader.length) {
                    $firstSubcategoriaHeader.addClass('active');
                    $firstSubcategoriaHeader.next('.encuesta-subcategoria-content').show();
                    $firstSubcategoriaHeader.find('.encuesta-subcategoria-chevron')
                        .removeClass('fa-chevron-down')
                        .addClass('fa-chevron-up');
                }
            }
        },

        _slugify: function(text) {
            if (!text) return '';
            
            var map = {
                'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
                'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u',
                'ñ': 'n', 'Ñ': 'n',
                'ü': 'u', 'Ü': 'u'
            };
            
            return text.toString()
                .replace(/[áéíóúñü]/gi, function(matched) {
                    return map[matched] || matched;
                })
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^\w\-]+/g, '')
                .replace(/\-\-+/g, '-')
                .replace(/^-+/, '')
                .replace(/-+$/, '');
        },

        buscarEncuestaExistente: function() {
            if (!this.userId || !this.fechaInicio || !this.fechaCierre) {
                this.wait(false);
                return;
            }
            
            var fechaCierreMax = this.fechaCierre + ' 23:59:59';
            
            this.getCollectionFactory().create('Encuesta', function (encuestaCollection) {
                encuestaCollection.fetch({
                    data: {
                        where: [
                            { type: 'equals', attribute: 'usuarioEvaluadoId', value: this.userId },
                            { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: this.fechaInicio },
                            { type: 'lessThanOrEquals', attribute: 'fechaCreacion', value: fechaCierreMax }
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
                }.bind(this)).catch(function(error) {
                    this.wait(false);
                }.bind(this));
            }.bind(this));
        },

        cargarRespuestasGuardadas: function() {
            var preguntasActivasIds = new Set();
            Object.values(this.preguntas).forEach(categorias => {
                Object.values(categorias).forEach(preguntas => {
                    preguntas.forEach(pregunta => preguntasActivasIds.add(pregunta.id));
                });
            });

            this.getCollectionFactory().create('RespuestaEncuesta', function (respuestasGuardadasCollection) {
                respuestasGuardadasCollection.maxSize = 200;
                respuestasGuardadasCollection.fetch({
                    data: {
                        where: [{ type: 'equals', attribute: 'encuestaId', value: this.encuestaId }]
                    }
                }).then(function () {
                    this.respuestas = {};
                    
                    if (respuestasGuardadasCollection && Array.isArray(respuestasGuardadasCollection.models)) {
                        respuestasGuardadasCollection.models.forEach(function (respuesta) {
                            var preguntaId = respuesta.get('preguntaId');
                            var color = respuesta.get('respuesta');
                            if (preguntasActivasIds.has(preguntaId)) {
                                this.respuestas[preguntaId] = color;
                            }
                        }, this);
                    }
                    
                    this._actualizarRespuestasUI();
                    
                    this.wait(false);
                }.bind(this)).catch(function(xhr) {
                    this.wait(false);
                }.bind(this));
            }.bind(this));
        },

        _actualizarRespuestasUI: function() {
            if (!this.isRendered()) {
                return;
            }
            
            this.$el.find('.encuesta-color-opcion').removeClass('selected');
            
            Object.keys(this.respuestas).forEach(function(preguntaId) {
                var color = this.respuestas[preguntaId];
                this.$el.find('[data-pregunta-id="' + preguntaId + '"][data-color="' + color + '"]').addClass('selected');
            }, this);
            
            this.actualizarIndicadoresDeProgreso();
        },

        _bindToggleEvents: function() {
            this.$el.find('[data-action="toggleCategoria"]').off('click').on('click', function(e) {
                this.toggleCategoria(e);
            }.bind(this));
            
            this.$el.find('[data-action="toggleSubcategoria"]').off('click').on('click', function(e) {
                this.toggleSubcategoria(e);
            }.bind(this));
        },

        filtrarPreguntasPorRol: function (todasLasPreguntas) {
            var preguntasFiltradas = [];
            
            var rolBusqueda = this.role === 'asesor' ? 'asesor' : 'gerente';
            
            todasLasPreguntas.forEach(function(pregunta) {
                var rolObjetivo = pregunta.rolObjetivo || [];
                var incluir = false;
                
                if (Array.isArray(rolObjetivo)) {
                    if (rolObjetivo.includes(rolBusqueda)) {
                        incluir = true;
                    }
                }
                
                if (incluir) {
                    preguntasFiltradas.push({
                        id: pregunta.id,
                        texto: pregunta.textoPregunta || pregunta.name,
                        categoria: pregunta.categoria || 'Sin Categoría',
                        subcategoria: pregunta.subCategoria || 'General',
                        orden: pregunta.orden || 0,
                        info: pregunta.info || null
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
                    orden: pregunta.orden || 0,
                    info: pregunta.info || null
                });
            });
            
            Object.keys(preguntasAgrupadas).forEach(function(categoria) {
                Object.keys(preguntasAgrupadas[categoria]).forEach(function(subcategoria) {
                    preguntasAgrupadas[categoria][subcategoria].sort(function(a, b) {
                        return (a.orden || 0) - (b.orden || 0);
                    });
                });
            });
            
            return preguntasAgrupadas;
        },
        
        seleccionarColor: function (preguntaId, color) {
            this.respuestas[preguntaId] = color;
            
            this.$el.find('[data-pregunta-id="' + preguntaId + '"]').removeClass('selected');
            this.$el.find('[data-pregunta-id="' + preguntaId + '"][data-color="' + color + '"]').addClass('selected');
            
            this.actualizarIndicadoresDeProgreso();
        },

        actualizarIndicadoresDeProgreso: function () {
            var respuestas = this.respuestas;
            var preguntasAgrupadas = this.preguntas;

            if (!preguntasAgrupadas || Object.keys(preguntasAgrupadas).length === 0) {
                return;
            }

            Object.keys(preguntasAgrupadas).forEach(function (categoriaNombre) {
                var categoriaData = preguntasAgrupadas[categoriaNombre];
                var totalPreguntasCategoria = 0;
                var respondidasCategoria = 0;
                var categoriaId = 'cat-' + this._slugify(categoriaNombre);

                Object.keys(categoriaData).forEach(function (subcategoriaNombre) {
                    var preguntasSubcat = categoriaData[subcategoriaNombre];
                    var totalPreguntasSubcat = preguntasSubcat.length;
                    var respondidasSubcat = 0;
                    var subcategoriaId = 'sub-' + this._slugify(subcategoriaNombre);

                    preguntasSubcat.forEach(function (pregunta) {
                        if (respuestas.hasOwnProperty(pregunta.id)) {
                            respondidasSubcat++;
                        }
                    });

                    var $indicadorSubcat = this.$el.find('#' + subcategoriaId);
                    
                    if ($indicadorSubcat.length) {
                        if (totalPreguntasSubcat > 0) {
                            if (respondidasSubcat === totalPreguntasSubcat) {
                                $indicadorSubcat.text('Completo').removeClass('incompleto').addClass('completo');
                            } else {
                                $indicadorSubcat.text('Incompleto').removeClass('completo').addClass('incompleto');
                            }
                        }
                    }

                    totalPreguntasCategoria += totalPreguntasSubcat;
                    respondidasCategoria += respondidasSubcat;
                }.bind(this));

                var $indicadorCat = this.$el.find('#' + categoriaId);
                
                if ($indicadorCat.length) {
                    if (totalPreguntasCategoria > 0) {
                        if (respondidasCategoria === totalPreguntasCategoria) {
                            $indicadorCat.text('Completo').removeClass('incompleto').addClass('completo');
                        } else {
                            $indicadorCat.text('Incompleto').removeClass('completo').addClass('incompleto');
                        }
                    }
                }
            }.bind(this));
        },

        toggleCategoria: function (e) {
            e.preventDefault();
            e.stopPropagation();
            
            var $header = $(e.currentTarget);
            var $content = $header.next('.encuesta-categoria-content');
            var wasActive = $header.hasClass('active');

            if ($content.is(':animated')) {
                return;
            }

            if (wasActive) {
                $header.removeClass('active');
                $content.slideUp(300, function() {
                    $header.find('.encuesta-categoria-chevron')
                        .removeClass('fa-chevron-up')
                        .addClass('fa-chevron-down');
                });
            } else {
                this.$el.find('.encuesta-categoria-header').removeClass('active');
                this.$el.find('.encuesta-categoria-content').slideUp(300);
                this.$el.find('.encuesta-categoria-chevron')
                    .removeClass('fa-chevron-up')
                    .addClass('fa-chevron-down');
                
                $header.addClass('active');
                $content.slideDown(300, function() {
                    $header.find('.encuesta-categoria-chevron')
                        .removeClass('fa-chevron-down')
                        .addClass('fa-chevron-up');
                    
                    var $firstSub = $content.find('.encuesta-subcategoria-header').first();
                    if ($firstSub.length && !$firstSub.hasClass('active')) {
                        $firstSub.addClass('active');
                        $firstSub.next('.encuesta-subcategoria-content').slideDown(300);
                        $firstSub.find('.encuesta-subcategoria-chevron')
                            .removeClass('fa-chevron-down')
                            .addClass('fa-chevron-up');
                    }
                });
            }
        },

        toggleSubcategoria: function (e) {
            e.preventDefault();
            e.stopPropagation();
            
            var $header = $(e.currentTarget);
            var $content = $header.next('.encuesta-subcategoria-content');
            var wasActive = $header.hasClass('active');

            if ($content.is(':animated')) {
                return;
            }

            if (wasActive) {
                $header.removeClass('active');
                $content.slideUp(300, function() {
                    $header.find('.encuesta-subcategoria-chevron')
                        .removeClass('fa-chevron-up')
                        .addClass('fa-chevron-down');
                });
            } else {
                var $parentCategoria = $header.closest('.encuesta-categoria-content');
                $parentCategoria.find('.encuesta-subcategoria-header').removeClass('active');
                $parentCategoria.find('.encuesta-subcategoria-content').slideUp(300);
                $parentCategoria.find('.encuesta-subcategoria-chevron')
                    .removeClass('fa-chevron-up')
                    .addClass('fa-chevron-down');

                $header.addClass('active');
                $content.slideDown(300, function() {
                    $header.find('.encuesta-subcategoria-chevron')
                        .removeClass('fa-chevron-down')
                        .addClass('fa-chevron-up');
                });
            }
        },

        guardarEncuesta: function (completar) {
            completar = completar || false;
            const preguntasRespondidasCount = Object.keys(this.respuestas).length;
            const totalPreguntasDisponibles = this.totalPreguntasDisponibles || 0;
            const estaCompleta = (totalPreguntasDisponibles > 0) && (preguntasRespondidasCount === totalPreguntasDisponibles);

            if (completar && !estaCompleta && !this.esCasaNacional && !this.fromListaEdicion) {
                Espo.Ui.warning('Debe responder todas las preguntas para completar la evaluación.');
                return;
            }
            
            if (!this.encuestaId && preguntasRespondidasCount === 0) {
                Espo.Ui.warning('Debes responder al menos una pregunta para guardar.');
                return;
            }

            if (this.guardandoEncuesta) return;
            this.guardandoEncuesta = true;
            
            const $saveButton = this.$el.find('[data-action="saveSurvey"]');
            const $completeButton = this.$el.find('[data-action="completeSurvey"]');
            $saveButton.prop('disabled', true).text('Guardando...');
            if ($completeButton.length) {
                $completeButton.prop('disabled', true).text('Guardando...');
            }
            Espo.Ui.notify('Guardando encuesta...', 'info');

            this.getModelFactory().create('Encuesta', (encuestaModel) => {
                const isUpdate = !!this.encuestaId;

                const setupAndSave = (model) => {
                    let estadoActual = isUpdate ? model.get('estado') : null;
                    let estadoEncuesta = estadoActual;

                    if (this.fromListaEdicion && completar) {
                        estadoEncuesta = 'completada';
                    } else if (estadoActual !== 'completada') {
                        if (completar && estaCompleta) {
                            estadoEncuesta = this.esCasaNacional ? 'completada' : 'revision';
                        } else if (completar && this.esCasaNacional) {
                            estadoEncuesta = 'completada';
                        } else if (estaCompleta && !completar) {
                            estadoEncuesta = 'revision';
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
                        var rolParaBD = this.role === 'asesor' ? 'asesor' : 'gerente';
                        
                        Object.assign(dataToSet, {
                            name: 'Evaluación ' + this.userName + ' - ' + new Date().toLocaleString(),
                            rolUsuario: rolParaBD,
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
                        if ($completeButton.length) {
                            $completeButton.prop('disabled', false).html('<i class="fas fa-check-circle"></i> Completar Encuesta');
                        }
                    });
                };

                if (isUpdate) {
                    encuestaModel.id = this.encuestaId;
                    encuestaModel.fetch().then(() => setupAndSave(encuestaModel))
                        .catch(() => {
                            Espo.Ui.error('Error al cargar la encuesta existente para actualizar.');
                            this.guardandoEncuesta = false;
                            $saveButton.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar Encuesta');
                            if ($completeButton.length) {
                                $completeButton.prop('disabled', false).html('<i class="fas fa-check-circle"></i> Completar Encuesta');
                            }
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
                    Espo.Ui.error('No se pudo sincronizar con las respuestas guardadas.');
                    var $saveButton = this.$el.find('[data-action="saveSurvey"]');
                    var $completeButton = this.$el.find('[data-action="completeSurvey"]');
                    this.guardandoEncuesta = false;
                    $saveButton.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar Encuesta');
                    if ($completeButton.length) {
                        $completeButton.prop('disabled', false).html('<i class="fas fa-check-circle"></i> Completar Encuesta');
                    }
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
            var $completeButton = this.$el.find('[data-action="completeSurvey"]');
            
            if (this.fromListaEdicion) {
                $saveButton.hide();
                $completeButton.html('<i class="fas fa-save"></i> Guardar Cambios').prop('disabled', false);
            } else {
                $saveButton.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar Encuesta');
                if ($completeButton.length) {
                    $completeButton.prop('disabled', false).html('<i class="fas fa-check-circle"></i> Completar Encuesta');
                }
            }

            setTimeout(function() {
                if (this.fromListaEdicion && this.retornoUrl) {
                    var url = this.retornoUrl;
                    if (url.startsWith('#')) {
                        this.getRouter().navigate(url.substring(1), {trigger: true});
                    } else {
                        this.getRouter().navigate(url, {trigger: true});
                    }
                } else if (this.from === 'seleccion' && this.retornoUrl) {
                    var url = this.retornoUrl;
                    if (url.startsWith('#')) {
                        this.getRouter().navigate(url.substring(1), {trigger: true});
                    } else {
                        this.getRouter().navigate(url, {trigger: true});
                    }
                } else {
                    var backUrl = '#Competencias/userSelection?teamId=' + this.teamId + 
                                  '&teamName=' + encodeURIComponent(this.teamName || '') + 
                                  '&role=' + this.role;
                    this.getRouter().navigate(backUrl, {trigger: true});
                }
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

        escapeHtml: function (text) {
            if (!text) return '';
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        data: function () {
            return {
                teamName: this.teamName,
                userName: this.userName, 
                role: this.role,
                preguntas: this.preguntas || {},
                accesoDenegado: this.accesoDenegado,
                encuestaInactiva: this.encuestaInactiva,
                esCasaNacional: this.esCasaNacional,
                fromListaEdicion: this.fromListaEdicion
            };
        }
    });
});