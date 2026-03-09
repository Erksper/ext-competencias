/**
 * reporteBase.js — Vista principal del reporte de Competencias
 */
define([
    'view',
    'competencias:views/modules/planesAccionManager',
    'competencias:views/modules/exportaciones'
], function (Dep, PlanesAccionManager, Exportaciones) {

    return Dep.extend(

        _.extend({}, Exportaciones, {

        template: 'competencias:reporteBase',

        events: {
            'click [data-action="back"]':          function () { this.getRouter().navigate('#Competencias/reports', {trigger: true}); },
            'click [data-action="exportarExcel"]': function () { this.exportarExcel(); },
            'click [data-action="exportarCSV"]':   function () { this.exportarCSV(); }
        },

        setup: function () {
            Dep.prototype.setup.call(this);

            var urlParams    = new URLSearchParams(window.location.hash.split('?')[1]);
            this.tipoReporte = urlParams.get('tipo')      || this.options.tipo      || 'desconocido';
            this.oficinaId   = urlParams.get('oficinaId') || this.options.oficinaId || null;
            this.periodoId   = urlParams.get('periodoId') || this.options.periodoId || null;

            this.fechaInicio = null;
            this.fechaCierre = null;
            this.usuarioId   = null;
            this.oficinaIdParaFiltrar = this.oficinaId;

            this.rolObjetivo     = this.tipoReporte.toLowerCase().includes('gerente') ? 'gerente' : 'asesor';
            this.textoEncabezado = this.rolObjetivo === 'gerente' ? 'Gerentes, Directores y/o Coordinadores' : 'Asesores';
            this.tituloReporte   = 'Reporte de ' + (this.rolObjetivo === 'gerente' ? 'Gerentes, Directores y Coordinadores' : 'Asesores');

            this.esCasaNacional              = false;
            this.esGerenteODirector          = false;
            this.esAsesor                    = false;
            this.esReporteGeneralCasaNacional = false;
            this.esReporteOficinaAsesores     = false;
            this.esReporteAsesorUnico         = false;
            this.oficinas                    = [];
            this.totalesPorOficina           = {};
            this.totalesGenerales            = { verde: 0, amarillo: 0, rojo: 0, total: 0, porcentaje: 0, color: 'gris' };
            this.preguntasAgrupadas          = {};
            this.usuariosData                = [];
            this.usuariosMap                 = {};
            this.totalesPorPregunta          = {};
            this.logoOficina                 = null;
            this.nombreOficina               = null;

            this.planesManager = new PlanesAccionManager(this, {
                modulo:  'Competencias',
                items:   {},
                oficina: null
            });

            this.registrarHandlebarsHelpers();
            this.wait(true);
            this.cargarDatosIniciales();
        },

        cargarDatosIniciales: function () {
            var self = this;

            var fetchUser = new Promise(function (resolve, reject) {
                self.getModelFactory().create('User', function (m) {
                    m.id = self.getUser().id;
                    m.fetch({ relations: { roles: true, teams: true } })
                        .then(function () { resolve(m); }).catch(reject);
                });
            });

            var fetchPeriodo = this.periodoId
                ? new Promise(function (resolve, reject) {
                    self.getModelFactory().create('Competencias', function (m) {
                        m.id = self.periodoId;
                        m.fetch()
                            .then(function () { m.id ? resolve(m) : self._ultimoPeriodo().then(resolve).catch(reject); })
                            .catch(function () { self._ultimoPeriodo().then(resolve).catch(reject); });
                    });
                })
                : this._ultimoPeriodo();

            Promise.all([fetchUser, fetchPeriodo]).then(function (res) {
                var userModel   = res[0];
                var periodoModel = res[1];

                var roles = Object.values(userModel.get('rolesNames') || {}).map(function (r) { return r.toLowerCase(); });
                self.esCasaNacional     = roles.includes('casa nacional');
                self.esGerenteODirector = roles.includes('gerente') || roles.includes('director') || roles.includes('coordinador');
                self.esAsesor           = roles.includes('asesor');
                
                if      (roles.includes('casa nacional'))  self.rolUsuario = 'Casa Nacional';
                else if (roles.includes('director'))       self.rolUsuario = 'Director';
                else if (roles.includes('gerente'))        self.rolUsuario = 'Gerente';
                else if (roles.includes('coordinador'))    self.rolUsuario = 'Coordinador';
                else if (roles.includes('asesor'))         self.rolUsuario = 'Asesor';
                else                                       self.rolUsuario = 'Usuario';

                self.usuarioActualId     = self.getUser().id;
                self.usuarioActualNombre = self.getUser().get('name');

                self.periodoId   = periodoModel.id;
                self.fechaInicio = periodoModel.get('fechaInicio');
                self.fechaCierre = periodoModel.get('fechaCierre');

                if (!self.fechaInicio || !self.fechaCierre) {
                    Espo.Ui.error('El período de evaluación está mal configurado (faltan fechas).');
                    self.wait(false);
                    self.reRender();
                    return;
                }

                self.configurarLogoYTitulo(userModel);
                self.planesManager.actualizarConfig({ modulo: 'Competencias', oficina: null });

                if (self.tipoReporte === 'generalGerentes' || self.tipoReporte === 'generalAsesores') {
                    self.esReporteGeneralCasaNacional = true;
                    self.cargarDatosReporteGeneral();
                } else if (self.tipoReporte === 'asesor') {
                    self.esReporteAsesorUnico = true;
                    self.cargarDatosReporteDetallado();
                } else if (self.tipoReporte === 'oficinaAsesores') {
                    self.esReporteOficinaAsesores = true;
                    self.cargarDatosReporteDetallado();
                } else {
                    self.cargarDatosReporteDetallado();
                }

            }).catch(function () {
                Espo.Ui.error('Error al cargar el período de evaluación.');
                self.wait(false);
            });
        },

        _ultimoPeriodo: function () {
            var self = this;
            return new Promise(function (resolve, reject) {
                self.getCollectionFactory().create('Competencias', function (col) {
                    col.fetch({ data: { maxSize: 1, orderBy: 'fechaCierre', order: 'desc' } })
                        .then(function () {
                            var u = col.at(0);
                            u ? resolve(u) : reject(new Error('Sin períodos configurados.'));
                        }).catch(reject);
                });
            });
        },

        cargarDatosReporteGeneral: function () {
            var self = this;
            
            Espo.Ajax.getRequest('Competencias/action/getReporteGeneral', {
                periodoId: this.periodoId,
                rolObjetivo: this.rolObjetivo
            }).then(function (response) {
                if (response.success) {
                    self.preguntasAgrupadas = response.preguntas || {};
                    self.oficinas = response.oficinas || [];
                    self.totalesPorPregunta = response.totalesPorPregunta || {};
                    self.totalesGenerales = response.totalesGenerales || {
                        verde: 0, amarillo: 0, rojo: 0, total: 0, porcentaje: 0, color: 'gris'
                    };
                    
                    self.wait(false);
                    
                    if (self.isRendered()) {
                        self._renderizarTablaGeneral();
                    }
                    
                    self.cargarPlanesAccion();
                } else {
                    Espo.Ui.error(response.error || 'Error al cargar reporte general');
                    self.wait(false);
                }
            }).catch(function (error) {
                Espo.Ui.error('Error al cargar los datos del reporte general');
                self.wait(false);
            });
        },

        _renderizarTablaGeneral: function() {
            if (!this.isRendered()) {
                setTimeout(this._renderizarTablaGeneral.bind(this), 100);
                return;
            }
            
            var $container = this.$el.find('.reporte-matrix-scroll');
            if (!$container.length) {
                $container = this.$el.find('.reporte-matrix-wrapper .reporte-matrix-scroll');
                if (!$container.length) {
                    return;
                }
            }
            
            if (!this.preguntasAgrupadas || !this.oficinas || this.oficinas.length === 0) {
                $container.html('<div class="alert alert-info">No hay datos para mostrar</div>');
                return;
            }
            
            var html = '';
            var self = this;
            
            var categoriaRow = '<tr class="categoria-row">';
            categoriaRow += '<th class="th-main-header" rowspan="3">';
            categoriaRow += '<div class="header-content">';
            if (this.logoOficina) {
                categoriaRow += '<div class="logo-expanded"><img src="' + this.logoOficina + '" alt="Logo" onerror="this.style.display=\'none\'"></div>';
            }
            categoriaRow += '<div class="header-text"><strong>' + this.textoEncabezado + '</strong></div>';
            categoriaRow += '</div></th>';
            
            Object.keys(this.preguntasAgrupadas).forEach(function(categoria) {
                var count = 0;
                Object.keys(self.preguntasAgrupadas[categoria]).forEach(function(sub) {
                    count += self.preguntasAgrupadas[categoria][sub].length;
                });
                categoriaRow += '<th colspan="' + count + '"><strong>' + self.escapeHtml(categoria) + '</strong></th>';
            });
            
            categoriaRow += '<th class="th-sumatoria" rowspan="3">';
            categoriaRow += '<div class="sumatoria-content"><strong>Sumatoria<br>del equipo</strong></div>';
            categoriaRow += '</th>';
            categoriaRow += '</tr>';
            
            var subcategoriaRow = '<tr class="subcategoria-row">';
            Object.keys(this.preguntasAgrupadas).forEach(function(categoria) {
                Object.keys(self.preguntasAgrupadas[categoria]).forEach(function(sub) {
                    var count = self.preguntasAgrupadas[categoria][sub].length;
                    subcategoriaRow += '<th colspan="' + count + '">' + self.escapeHtml(sub) + '</th>';
                });
            });
            subcategoriaRow += '</tr>';
            
            var preguntasRow = '<tr class="preguntas-row">';
            Object.keys(this.preguntasAgrupadas).forEach(function(categoria) {
                Object.keys(self.preguntasAgrupadas[categoria]).forEach(function(sub) {
                    self.preguntasAgrupadas[categoria][sub].forEach(function(pregunta) {
                        preguntasRow += '<th><div>' + self.escapeHtml(pregunta.texto) + '</div></th>';
                    });
                });
            });
            preguntasRow += '</tr>';
            
            var tbody = '<tbody>';
            
            this.oficinas.forEach(function(oficina) {
                tbody += '<tr class="usuario-row">';
                tbody += '<td class="td-user-name"><strong>' + self.escapeHtml(oficina.name) + '</strong></td>';
                
                Object.keys(self.preguntasAgrupadas).forEach(function(categoria) {
                    Object.keys(self.preguntasAgrupadas[categoria]).forEach(function(sub) {
                        self.preguntasAgrupadas[categoria][sub].forEach(function(pregunta) {
                            var color = 'gris';
                            if (oficina.totalesPorPregunta && oficina.totalesPorPregunta[pregunta.id]) {
                                color = oficina.totalesPorPregunta[pregunta.id].color || 'gris';
                            }
                            tbody += '<td class="celda-respuesta color-' + color + '"></td>';
                        });
                    });
                });
                
                tbody += '<td class="celda-total color-' + oficina.totalesOficina.color + '">';
                tbody += oficina.totalesOficina.verde + '/' + oficina.totalesOficina.total + '<br>';
                tbody += '<small>' + Math.round(oficina.totalesOficina.porcentaje) + '%</small>';
                tbody += '</td>';
                tbody += '</tr>';
            });
            
            tbody += '</tbody>';
            
            var tfoot = '<tfoot><tr class="totales-row">';
            tfoot += '<td><strong>Totales</strong></td>';
            
            Object.keys(this.preguntasAgrupadas).forEach(function(categoria) {
                Object.keys(self.preguntasAgrupadas[categoria]).forEach(function(sub) {
                    self.preguntasAgrupadas[categoria][sub].forEach(function(pregunta) {
                        var total = self.totalesPorPregunta[pregunta.id] || { verdes: 0, total: 0, porcentaje: 0, color: 'gris' };
                        tfoot += '<td class="celda-total color-' + total.color + '">';
                        tfoot += (total.verdes || 0) + '/' + (total.total || 0) + '<br>';
                        tfoot += '<small>' + Math.round(total.porcentaje || 0) + '%</small>';
                        tfoot += '</td>';
                    });
                });
            });
            
            tfoot += '<td class="celda-total color-' + this.totalesGenerales.color + '">';
            tfoot += (this.totalesGenerales.verde || 0) + '/' + (this.totalesGenerales.total || 0) + '<br>';
            tfoot += '<small>' + Math.round(this.totalesGenerales.porcentaje || 0) + '%</small>';
            tfoot += '</td>';
            tfoot += '</tr></tfoot>';
            
            html = '<table class="report-matrix">';
            html += '<thead>' + categoriaRow + subcategoriaRow + preguntasRow + '</thead>';
            html += tbody;
            html += tfoot;
            html += '</table>';
            
            $container.html(html);
        },

        cargarDatosReporteDetallado: function () {
            var self = this;
            
            this.esReporteGeneralCasaNacional = false;
            
            var cargarPreguntas = Espo.Ajax.getRequest('Pregunta', {
                where: [
                    {
                        type: 'and',
                        value: [
                            {
                                type: 'or',
                                value: [
                                    { type: 'equals', attribute: 'rolObjetivo', value: this.rolObjetivo },
                                    { type: 'contains', attribute: 'rolObjetivo', value: this.rolObjetivo }
                                ]
                            },
                            { type: 'equals', attribute: 'estaActiva', value: 1 }
                        ]
                    }
                ],
                orderBy: 'orden',
                maxSize: 200
            });

            var whereEncuestas = [{ type: 'equals', attribute: 'rolUsuario', value: this.rolObjetivo }];
            if (this.oficinaIdParaFiltrar) {
                whereEncuestas.push({ type: 'equals', attribute: 'equipoId', value: this.oficinaIdParaFiltrar });
            }
            if (this.usuarioId) {
                whereEncuestas.push({ type: 'equals', attribute: 'usuarioEvaluadoId', value: this.usuarioId });
            }
            if (this.fechaInicio && this.fechaCierre) {
                whereEncuestas.push({ type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: this.fechaInicio });
                whereEncuestas.push({ type: 'lessThanOrEquals', attribute: 'fechaCreacion', value: this.fechaCierre + ' 23:59:59' });
            }

            var cargarTodasLasEncuestas = function() {
                return new Promise(function(resolve, reject) {
                    var maxSize = 200;
                    var offset = 0;
                    var todasLasEncuestas = [];
                    
                    function fetchNextPage() {
                        Espo.Ajax.getRequest('Encuesta', {
                            where: whereEncuestas,
                            select: 'id,name,usuarioEvaluadoId,usuarioEvaluadoName,fechaEncuesta,porcentajeCompletado,equipoName',
                            maxSize: maxSize,
                            offset: offset
                        }).then(function(response) {
                            var encuestas = response.list || [];
                            todasLasEncuestas = todasLasEncuestas.concat(encuestas);
                            
                            if (encuestas.length < maxSize) {
                                resolve(todasLasEncuestas);
                            } else {
                                offset += maxSize;
                                fetchNextPage();
                            }
                        }).catch(function(error) {
                            reject(error);
                        });
                    }
                    
                    fetchNextPage();
                });
            };

            Promise.all([cargarPreguntas, cargarTodasLasEncuestas()]).then(function(results) {
                var preguntas = results[0] && results[0].list ? results[0].list : [];
                var encuestas = results[1] || [];

                self.procesarPreguntas(preguntas);
                self.procesarEncuestas(encuestas);
            }).catch(function(error) {
                Espo.Ui.error('Error al cargar los datos del reporte');
                self.wait(false);
            });
        },

        procesarPreguntas: function (preguntas) {
            var agrupadas = {};
            
            preguntas.forEach(function(p) {
                var cat = p.categoria || 'Sin Categoría';
                var sub = p.subCategoria || 'General';
                
                if (!agrupadas[cat]) agrupadas[cat] = {};
                if (!agrupadas[cat][sub]) agrupadas[cat][sub] = [];
                
                agrupadas[cat][sub].push({ 
                    id: p.id, 
                    texto: p.textoPregunta || p.name, 
                    orden: p.orden || 0 
                });
            });

            Object.keys(agrupadas).forEach(function(cat) {
                Object.keys(agrupadas[cat]).forEach(function(sub) {
                    agrupadas[cat][sub].sort(function(a, b) { 
                        return (a.orden || 0) - (b.orden || 0); 
                    });
                });
            });

            this.preguntasAgrupadas = agrupadas;
        },

        procesarEncuestas: function (encuestas) {
            var self = this;
            
            if (encuestas.length === 0) {
                this.usuariosData = [];
                this.wait(false);
                this.reRender();
                this.cargarPlanesAccion();
                return;
            }

            var encuestasUnicas = encuestas.map(function(e) {
                return {
                    id:                  e.id,
                    userId:              e.usuarioEvaluadoId,
                    userName:            e.usuarioEvaluadoName || 'Usuario sin nombre',
                    fechaEncuesta:       e.fechaEncuesta,
                    porcentajeCompletado: e.porcentajeCompletado || 0,
                    oficinaName:         e.equipoName || ''
                };
            });

            this.cargarRespuestasParaEncuestas(encuestasUnicas);
        },

        cargarRespuestasParaEncuestas: function (encuestas) {
            var self = this;
            
            var encuestasIds = encuestas.map(function(e) { return e.id; });
            
            if (encuestasIds.length === 0) {
                self.usuariosData = [];
                self.wait(false);
                self.reRender();
                return;
            }

            var lotesEncuestas = [];
            var tamanoLoteEncuestas = 200;
            for (var i = 0; i < encuestasIds.length; i += tamanoLoteEncuestas) {
                lotesEncuestas.push(encuestasIds.slice(i, i + tamanoLoteEncuestas));
            }

            var promesasTotales = [];

            lotesEncuestas.forEach(function(loteEncuestasIds) {
                var promesaLote = new Promise(function(resolve, reject) {
                    var maxSize = 200;
                    var offset = 0;
                    var todasLasRespuestasDelLote = [];
                    
                    function fetchNextPage() {
                        Espo.Ajax.getRequest('RespuestaEncuesta', {
                            where: [
                                { 
                                    type: 'in', 
                                    attribute: 'encuestaId', 
                                    value: loteEncuestasIds 
                                }
                            ],
                            select: 'preguntaId,respuesta,encuestaId',
                            maxSize: maxSize,
                            offset: offset
                        }).then(function(response) {
                            var respuestas = response.list || [];
                            todasLasRespuestasDelLote = todasLasRespuestasDelLote.concat(respuestas);
                            
                            if (respuestas.length < maxSize) {
                                resolve(todasLasRespuestasDelLote);
                            } else {
                                offset += maxSize;
                                fetchNextPage();
                            }
                        }).catch(function(error) {
                            reject(error);
                        });
                    }
                    
                    fetchNextPage();
                });
                
                promesasTotales.push(promesaLote);
            });

            Promise.all(promesasTotales).then(function(resultadosLotes) {
                var todasLasRespuestas = [];
                resultadosLotes.forEach(function(lote) {
                    todasLasRespuestas = todasLasRespuestas.concat(lote);
                });

                var respuestasPorEncuesta = {};
                
                todasLasRespuestas.forEach(function(r) {
                    if (!respuestasPorEncuesta[r.encuestaId]) {
                        respuestasPorEncuesta[r.encuestaId] = {};
                    }
                    respuestasPorEncuesta[r.encuestaId][r.preguntaId] = r.respuesta;
                });

                encuestas.forEach(function(e) {
                    e.respuestas = respuestasPorEncuesta[e.id] || {};
                });

                self.usuariosData = encuestas;
                self.usuariosMap = {};
                self.usuariosData.forEach(function(u) { 
                    self.usuariosMap[u.userId] = u; 
                });

                self.calcularTotales();
                self.wait(false);
                self.reRender();
                self.cargarPlanesAccion();

            }).catch(function(error) {
                self.usuariosData = [];
                self.wait(false);
                self.reRender();
            });
        },

        _renderizarTablaDetallada: function() {
            if (!this.isRendered()) {
                setTimeout(this._renderizarTablaDetallada.bind(this), 100);
                return;
            }
            
            var $container = this.$el.find('.reporte-matrix-scroll');
            if (!$container.length) {
                return;
            }
            
            if (!this.preguntasAgrupadas || !this.usuariosData || this.usuariosData.length === 0) {
                $container.html('<div class="alert alert-info">No hay datos para mostrar</div>');
                return;
            }
            
            var html = '';
            var self = this;
            
            var categoriaRow = '<tr class="categoria-row">';
            categoriaRow += '<th class="th-main-header" rowspan="3">';
            categoriaRow += '<div class="header-content">';
            if (this.logoOficina) {
                categoriaRow += '<div class="logo-expanded"><img src="' + this.logoOficina + '" alt="Logo" onerror="this.style.display=\'none\'"></div>';
            }
            categoriaRow += '<div class="header-text"><strong>' + this.textoEncabezado + '</strong></div>';
            categoriaRow += '</div></th>';
            
            Object.keys(this.preguntasAgrupadas).forEach(function(categoria) {
                var count = 0;
                Object.keys(self.preguntasAgrupadas[categoria]).forEach(function(sub) {
                    count += self.preguntasAgrupadas[categoria][sub].length;
                });
                categoriaRow += '<th colspan="' + count + '"><strong>' + self.escapeHtml(categoria) + '</strong></th>';
            });
            
            categoriaRow += '<th class="th-sumatoria" rowspan="3">';
            categoriaRow += '<div class="sumatoria-content"><strong>Sumatoria<br>del usuario</strong></div>';
            categoriaRow += '</th>';
            categoriaRow += '</tr>';
            
            var subcategoriaRow = '<tr class="subcategoria-row">';
            Object.keys(this.preguntasAgrupadas).forEach(function(categoria) {
                Object.keys(self.preguntasAgrupadas[categoria]).forEach(function(sub) {
                    var count = self.preguntasAgrupadas[categoria][sub].length;
                    subcategoriaRow += '<th colspan="' + count + '">' + self.escapeHtml(sub) + '</th>';
                });
            });
            subcategoriaRow += '</tr>';
            
            var preguntasRow = '<tr class="preguntas-row">';
            Object.keys(this.preguntasAgrupadas).forEach(function(categoria) {
                Object.keys(self.preguntasAgrupadas[categoria]).forEach(function(sub) {
                    self.preguntasAgrupadas[categoria][sub].forEach(function(pregunta) {
                        preguntasRow += '<th><div>' + self.escapeHtml(pregunta.texto) + '</div></th>';
                    });
                });
            });
            preguntasRow += '</tr>';
            
            var tbody = '<tbody>';
            
            this.usuariosData.forEach(function(usuario) {
                tbody += '<tr class="usuario-row">';
                tbody += '<td class="td-user-name"><strong>' + self.escapeHtml(usuario.userName) + '</strong></td>';
                
                Object.keys(self.preguntasAgrupadas).forEach(function(categoria) {
                    Object.keys(self.preguntasAgrupadas[categoria]).forEach(function(sub) {
                        self.preguntasAgrupadas[categoria][sub].forEach(function(pregunta) {
                            var color = 'gris';
                            if (usuario.respuestas && usuario.respuestas[pregunta.id]) {
                                var respuesta = usuario.respuestas[pregunta.id];
                                color = respuesta;
                            }
                            tbody += '<td class="celda-respuesta color-' + color + '"></td>';
                        });
                    });
                });
                
                tbody += '<td class="celda-total color-' + usuario.totales.color + '">';
                tbody += usuario.totales.verdes + '/' + usuario.totales.total + '<br>';
                tbody += '<small>' + Math.round(usuario.totales.porcentaje) + '%</small>';
                tbody += '</td>';
                tbody += '</tr>';
            });
            
            tbody += '</tbody>';
            
            var mostrarTotales = false;
            
            if (this.tipoReporte === 'oficinaAsesores' || this.tipoReporte === 'asesores') {
                mostrarTotales = true;
            } else if (this.tipoReporte === 'oficinaGerentes' || this.tipoReporte === 'gerentes') {
                mostrarTotales = false;
            } else if (this.tipoReporte === 'asesor') {
                mostrarTotales = false;
            }
            
            var tfoot;
            if (mostrarTotales) {
                tfoot = '<tfoot><tr class="totales-row">';
                tfoot += '<td><strong>Totales</strong></td>';

                Object.keys(this.preguntasAgrupadas).forEach(function(categoria) {
                    Object.keys(self.preguntasAgrupadas[categoria]).forEach(function(sub) {
                        self.preguntasAgrupadas[categoria][sub].forEach(function(pregunta) {
                            var total = self.totalesPorPregunta[pregunta.id] || { verdes: 0, total: 0, porcentaje: 0, color: 'gris' };
                            tfoot += '<td class="celda-total color-' + total.color + '">';
                            tfoot += (total.verdes || 0) + '/' + (total.total || 0) + '<br>';
                            tfoot += '<small>' + Math.round(total.porcentaje || 0) + '%</small>';
                            tfoot += '</td>';
                        });
                    });
                });

                tfoot += '<td></td>';
                tfoot += '</tr></tfoot>';
            } else {
                tfoot = '<tfoot><tr class="totales-row">';
                tfoot += '<td></td>';

                Object.keys(this.preguntasAgrupadas).forEach(function(categoria) {
                    Object.keys(self.preguntasAgrupadas[categoria]).forEach(function(sub) {
                        self.preguntasAgrupadas[categoria][sub].forEach(function(pregunta) {
                            tfoot += '<td></td>';
                        });
                    });
                });

                tfoot += '<td></td>';
                tfoot += '</tr></tfoot>';
            }
            
            html = '<table class="report-matrix">';
            html += '<thead>' + categoriaRow + subcategoriaRow + preguntasRow + '</thead>';
            html += tbody;
            html += tfoot;
            html += '</table>';
            
            $container.html(html);
        },

        calcularTotales: function () {
            var self = this;
            var todasLasPreguntas = [];
            var totalPorPregunta = {};

            Object.keys(this.preguntasAgrupadas || {}).forEach(function(cat) {
                Object.keys(self.preguntasAgrupadas[cat]).forEach(function(sub) {
                    self.preguntasAgrupadas[cat][sub].forEach(function(p) { 
                        todasLasPreguntas.push(p.id); 
                    });
                });
            });

            todasLasPreguntas.forEach(function(pid) {
                var verdes = 0, amarillos = 0, rojos = 0, total = 0;
                
                self.usuariosData.forEach(function(u) {
                    var r = u.respuestas[pid];
                    if (r) {
                        total++;
                        if (r === 'verde') verdes++;
                        else if (r === 'amarillo') amarillos++;
                        else if (r === 'rojo') rojos++;
                    }
                });

                var pct = total > 0 ? (verdes / total) * 100 : 0;
                totalPorPregunta[pid] = {
                    verdes: verdes, 
                    amarillos: amarillos, 
                    rojos: rojos,
                    total: total, 
                    porcentaje: pct,
                    color: self.obtenerColorDistribucion(verdes, amarillos, rojos, total)
                };
            });

            this.usuariosData.forEach(function(u) {
                var verdes = 0, amarillos = 0, rojos = 0, total = 0;
                
                todasLasPreguntas.forEach(function(pid) {
                    var r = u.respuestas[pid];
                    if (r) {
                        total++;
                        if (r === 'verde') verdes++;
                        else if (r === 'amarillo') amarillos++;
                        else if (r === 'rojo') rojos++;
                    }
                });

                var pct = total > 0 ? (verdes / total) * 100 : 0;
                u.totales = {
                    verdes: verdes, 
                    amarillos: amarillos, 
                    rojos: rojos,
                    total: total, 
                    porcentaje: pct,
                    color: self.obtenerColorDistribucion(verdes, amarillos, rojos, total)
                };
            });

            this.totalesPorPregunta = totalPorPregunta;
        },

        obtenerColorDistribucion: function (verdes, amarillos, rojos, total) {
            if (total === 0) return 'gris';

            var pV = (verdes   / total) * 100;
            var pA = (amarillos / total) * 100;
            var pR = (rojos    / total) * 100;

            if (pV >= 80) return 'verde';
            if (pV >= 60) return 'amarillo';

            if (pV >= 40) {
                if (pR === 0) return 'amarillo';
                if (pA >= pR) return 'amarillo';
                return 'rojo';
            }

            return 'rojo';
        },

        obtenerColorCelda: function (usuarioId, preguntaId) {
            var u = this.usuariosMap[usuarioId];
            if (!u || !u.respuestas[preguntaId]) return 'gris';
            return u.respuestas[preguntaId];
        },

        configurarLogoYTitulo: function (userModel) {
            var self       = this;
            var claPattern = /^CLA\d+$/i;

            if (this.tipoReporte === 'asesor') {
                this.usuarioId     = this.getUser().id;
                this.tituloReporte = 'Mi Reporte de Asesor (' + this.getUser().get('name') + ')';
                this.buscarLogoUsuarioCasaNacional();
            }
            else if (this.tipoReporte === 'gerentes' || this.tipoReporte === 'asesores') {
                var teamIds   = userModel.get('teamsIds')   || [];
                var teamNames = userModel.get('teamsNames') || {};
                var equipoReal = teamIds.find(function (id) { return !claPattern.test(id); }) || teamIds[0];
                if (equipoReal) {
                    this.oficinaIdParaFiltrar = equipoReal;
                    this.nombreOficina        = teamNames[equipoReal] || 'Mi Oficina';
                    this.tituloReporte        = 'Reporte de ' + (this.rolObjetivo === 'gerente' ? 'Gerentes, Directores y Coordinadores' : 'Asesores') +
                                               ' (' + this.nombreOficina + ')';
                    this.planesManager.actualizarConfig({ oficina: equipoReal });
                    this.buscarLogoPorOficina(equipoReal);
                } else {
                    this.buscarLogoUsuarioCasaNacional();
                }
            }
            else if (this.tipoReporte === 'oficinaGerentes' || this.tipoReporte === 'oficinaAsesores') {
                this.getModelFactory().create('Team', function (teamModel) {
                    teamModel.id = self.oficinaId;
                    teamModel.fetch().then(function () {
                        self.nombreOficina = teamModel.get('name');
                        self.tituloReporte = 'Reporte de ' + (self.rolObjetivo === 'gerente' ? 'Gerentes, Directores y Coordinadores' : 'Asesores') +
                                             ' - ' + self.nombreOficina;
                        self.planesManager.actualizarConfig({ oficina: self.oficinaId });
                        self.buscarLogoPorOficina(self.oficinaId);
                        self.reRender();
                    }).catch(function () { self.buscarLogoUsuarioCasaNacional(); self.reRender(); });
                });
            }
            else if (this.tipoReporte === 'generalGerentes' || this.tipoReporte === 'generalAsesores') {
                this.esReporteGeneralCasaNacional = true;
                this.buscarLogoUsuarioCasaNacional();
            }
        },

        buscarLogoPorOficina: function (teamId) {
            var self = this;
            $.ajax({ url: 'api/v1/Team/' + teamId + '/users', type: 'GET', data: { select: 'id,name,cImagenId', maxSize: 50 },
                success: function (r) {
                    var us = r.list || [];
                    var c  = us.find(function (u) { return u.name && u.name.toLowerCase().includes('por la casa') && u.cImagenId; });
                    if (c) { self.establecerLogo(self._basePath() + '?entryPoint=attachment&id=' + c.cImagenId); return; }
                    var q = us.find(function (u) { return u.cImagenId; });
                    q ? self.establecerLogo(self._basePath() + '?entryPoint=attachment&id=' + q.cImagenId) : self.buscarLogoUsuarioCasaNacional();
                },
                error: function () { self.buscarLogoUsuarioCasaNacional(); }
            });
        },

        buscarLogoUsuarioCasaNacional: function () {
            var self = this;
            $.ajax({ url: 'api/v1/User/68e0a532c9a03099b', data: { select: 'id,name,cImagenId' } })
                .then(function (r) { self.establecerLogo(r && r.cImagenId ? self._basePath() + '?entryPoint=attachment&id=' + r.cImagenId : null); })
                .catch(function () { self.establecerLogo(null); });
        },

        establecerLogo: function (url) { this.logoOficina = url; if (this.isRendered()) this.reRender(); },

        _basePath: function () {
            var b = document.querySelector('base');
            if (b && b.href) return b.href;
            var h = window.location.href.indexOf('/#');
            return h !== -1 ? window.location.href.substring(0, h + 1) : window.location.origin + '/';
        },

        registrarHandlebarsHelpers: function () {
            var self = this;
            
            Handlebars.registerHelper('getColumnCount', function (cat) {
                var c = 0; if (!cat) return 0;
                Object.keys(cat).forEach(function (s) { c += cat[s].length; }); return c;
            });
            
            Handlebars.registerHelper('getCeldaColor',    function (uid, pid) { return self.obtenerColorCelda(uid, pid); });
            
            Handlebars.registerHelper('withLookup',       function (o, k, opts) { return opts.fn((o && o[k]) || {}); });
            Handlebars.registerHelper('formatPorcentaje', function (p) { return Math.round(p || 0); });
            Handlebars.registerHelper('truncateText',     function (t, l) { return (!t) ? '' : (t.length > l ? t.substring(0, l) + '...' : t); });
            Handlebars.registerHelper('lookup',           function (o, k) { return o && o[k]; });
            Handlebars.registerHelper('eq',               function (a, b) { return a === b; });
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);
            
            if (this.esReporteGeneralCasaNacional && this.oficinas && this.oficinas.length > 0) {
                this._renderizarTablaGeneral();
            }
            else if (!this.esReporteGeneralCasaNacional && this.usuariosData && this.usuariosData.length > 0) {
                this._renderizarTablaDetallada();
            }
            
            if (!this.esAsesor && !this.esReporteGeneralCasaNacional && this.usuariosData && this.usuariosData.length > 0) {
                this.planesManager.render();
            }
        },

        cargarPlanesAccion: function () {
            if (this.esReporteGeneralCasaNacional) return;
            if (this.esAsesor) return;

            var items = {};
            var pg = this.preguntasAgrupadas || {};
            Object.keys(pg).forEach(function (cat) {
                items[cat] = Object.keys(pg[cat] || {});
            });

            // La oficina ya fue asignada en configurarLogoYTitulo() vía actualizarConfig({ oficina: ... })
            // Aquí solo actualizamos los items y disparamos la carga
            this.planesManager.actualizarConfig({ items: items });
            this.planesManager.cargar();
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
                tituloReporte:               this.tituloReporte,
                tipoReporte:                 this.tipoReporte,
                rolObjetivo:                 this.rolObjetivo,
                textoEncabezado:             this.textoEncabezado,
                preguntas:                   this.preguntasAgrupadas,
                usuarios:                    this.usuariosData,
                totalesPorPregunta:          this.totalesPorPregunta,
                tienedatos:                  (this.usuariosData && this.usuariosData.length > 0) ||
                                             (this.esReporteGeneralCasaNacional && this.oficinas.length > 0),
                mostrarSoloGerentes:         this.rolObjetivo === 'gerente' && !this.esReporteGeneralCasaNacional,
                totalUsuarios:               this.usuariosData ? this.usuariosData.length : 0,
                esReporteGeneralCasaNacional: this.esReporteGeneralCasaNacional,
                oficinas:                    this.oficinas,
                totalesPorOficina:           this.totalesPorOficina,
                totalesGenerales:            this.totalesGenerales,
                logoOficina:                 this.logoOficina,
                nombreOficina:               this.nombreOficina,
                fechaInicio:                 this.fechaInicio,
                fechaCierre:                 this.fechaCierre
            };
        }

    })
    );
});