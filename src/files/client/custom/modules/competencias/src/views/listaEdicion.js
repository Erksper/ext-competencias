// client/custom/modules/competencias/src/views/listaEdicion.js
define(['view'], function (View) {

    return View.extend({

        template: 'competencias:listaEdicion',

        setup: function () {
            this.periodoId   = this.options.periodoId || null;
            this.periodoInfo = null;

            this.filtrosDesdeUrl = this._parseQueryParams();

            this.filtros = {
                cla:     this.filtrosDesdeUrl.cla     || null,
                oficina: this.filtrosDesdeUrl.oficina || null,
                usuario: this.filtrosDesdeUrl.usuario || null,
                tipo:    this.filtrosDesdeUrl.tipo    || null,
                estado:  this.filtrosDesdeUrl.estado  || null
            };

            this.paginacion = {
                pagina:       parseInt(this.filtrosDesdeUrl.pagina || 1),
                porPagina:    25,
                total:        0,
                totalPaginas: 0
            };

            this.encuestasFiltradas = [];
            this.cargandoPagina     = false;
            this.permisos           = null;
            
            this.oficinasDelCLA = [];
            this.filtroClaEnProceso = false;
            
            this.cacheUsuarios = {};

            this.wait(true);
            this._cargarPermisos();
        },

        _parseQueryParams: function () {
            var result = { cla: null, oficina: null, usuario: null, tipo: null, estado: null, pagina: 1, periodoId: null };
            var hash = window.location.hash;
            if (hash && hash.includes('?')) {
                var qs     = hash.split('?')[1];
                var params = new URLSearchParams(qs);
                result.cla      = params.get('cla')      || null;
                result.oficina  = params.get('oficina')  || null;
                result.usuario  = params.get('usuario')  || null;
                result.tipo     = params.get('tipo')     || null;
                result.estado   = params.get('estado')   || null;
                result.pagina   = params.get('pagina')   ? parseInt(params.get('pagina'), 10) : 1;
                result.periodoId = params.get('periodoId') || null;
            }
            if (!this.periodoId && result.periodoId) {
                this.periodoId = result.periodoId;
            }
            return result;
        },

        _actualizarUrlConFiltros: function () {
            var qp = [];
            if (this.periodoId)      qp.push('periodoId=' + encodeURIComponent(this.periodoId));
            if (this.filtros.cla)    qp.push('cla='       + encodeURIComponent(this.filtros.cla));
            if (this.filtros.oficina) qp.push('oficina='  + encodeURIComponent(this.filtros.oficina));
            if (this.filtros.usuario) qp.push('usuario='  + encodeURIComponent(this.filtros.usuario));
            if (this.filtros.tipo)   qp.push('tipo='      + encodeURIComponent(this.filtros.tipo));
            if (this.filtros.estado) qp.push('estado='    + encodeURIComponent(this.filtros.estado));
            if (this.paginacion.pagina > 1) qp.push('pagina=' + this.paginacion.pagina);
            var qs = qp.length > 0 ? '?' + qp.join('&') : '';
            this.getRouter().navigate('#Competencias/listaEdicion' + qs, { trigger: false });
        },

        _cargarPermisos: function () {
            var self = this;
            var user = this.getUser();

            this.getModelFactory().create('User', function (userModel) {
                userModel.id = user.id;
                userModel.fetch({ relations: { roles: true, teams: true } }).then(function () {
                    var roles = Object.values(userModel.get('rolesNames') || {}).map(function (r) { return r.toLowerCase(); });

                    self.permisos = {
                        esCasaNacional:        roles.includes('casa nacional'),
                        esGerenteDirectorCoord: roles.includes('gerente') || roles.includes('director') || roles.includes('coordinador'),
                        esAsesor:              roles.includes('asesor'),
                        usuarioId:             user.id,
                        teamIds:               userModel.get('teamsIds')   || [],
                        teamNames:             userModel.get('teamsNames') || {}
                    };

                    if (self.permisos.esGerenteDirectorCoord && !self.permisos.esCasaNacional) {
                        var teamIds   = self.permisos.teamIds;
                        var teamNames = self.permisos.teamNames;
                        var claPattern = /^CLA\d+$/i;

                        var claTeams = teamIds.filter(function (id) { return claPattern.test(id); });
                        var oficTeams = teamIds.filter(function (id) {
                            return !claPattern.test(id) && (teamNames[id] || '').toLowerCase() !== 'venezuela';
                        });

                        self.permisos.claUsuario    = claTeams.length > 0 ? claTeams[0] : null;
                        self.permisos.claNombre     = self.permisos.claUsuario ? (teamNames[self.permisos.claUsuario] || self.permisos.claUsuario) : null;
                        self.permisos.oficinaUsuario = oficTeams.length > 0 ? oficTeams[0] : null;
                    }

                    self._cargarPeriodo();

                }.bind(self));
            });
        },

        _cargarPeriodo: function () {
            var self = this;

            if (!this.periodoId) {
                Espo.Ui.warning('No se seleccionó un período.');
                this.getRouter().navigate('#Competencias', { trigger: true });
                return;
            }

            this.getModelFactory().create('Competencias', function (model) {
                model.id = self.periodoId;
                model.fetch().then(function () {
                    var fi = model.get('fechaInicio') || '';
                    var fc = model.get('fechaCierre') || '';
                    self.periodoInfo = {
                        fechaInicio: fi,
                        fechaCierre: fc,
                        label: self._formatearFecha(fi) + ' – ' + self._formatearFecha(fc)
                    };
                    self.wait(false);
                }).catch(function () {
                    Espo.Ui.error('Error al cargar el período.');
                    self.wait(false);
                });
            });
        },

        _formatearFecha: function (fechaStr) {
            if (!fechaStr) return '';
            var d = new Date(fechaStr + 'T00:00:00');
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        },

        afterRender: function () {
            if (this.periodoInfo) {
                this.$el.find('#periodo-subtitulo').text('Período: ' + this.periodoInfo.label);
            }

            this._setupEventListeners();
            this._cargarFiltros()
                .then(this._aplicarValoresFiltrosDesdeUrl.bind(this))
                .then(() => {
                    this._fetchEncuestas();
                });
        },

        _setupEventListeners: function () {
            var self = this;

            this.$el.find('[data-action="volver"]').on('click', function () {
                self.getRouter().navigate('#Competencias', { trigger: true });
            });

            this.$el.find('[data-action="aplicar-filtros"]').on('click', function () {
                self._aplicarFiltros();
            });

            this.$el.find('[data-action="limpiar-filtros"]').on('click', function () {
                self._limpiarFiltros();
            });

            this.$el.find('#filtro-cla').on('change', function (e) {
                var claId = $(e.currentTarget).val();
                self._cargarOficinasPorCLA(claId);
            });

            this.$el.find('#filtro-oficina').on('change', function (e) {
                var oficinaId = $(e.currentTarget).val();
                var tipo = self.$el.find('#filtro-tipo').val();
                self._cargarUsuariosPorOficinaYTipo(oficinaId, tipo);
            });

            this.$el.find('#filtro-tipo').on('change', function (e) {
                var tipo = $(e.currentTarget).val();
                var oficinaId = self.$el.find('#filtro-oficina').val();
                if (oficinaId) {
                    self._cargarUsuariosPorOficinaYTipo(oficinaId, tipo);
                }
            });
        },

        _cargarFiltros: function () {
            var self     = this;
            var permisos = this.permisos;

            return new Promise(function (resolve) {
                if (!permisos) { 
                    resolve(); 
                    return; 
                }

                if (permisos.esCasaNacional) {
                    self._cargarTodosCLAs().then(resolve);

                } else if (permisos.esGerenteDirectorCoord) {
                    if (permisos.claUsuario) {
                        self.$el.find('#filtro-cla')
                            .html('<option value="' + permisos.claUsuario + '">' + (permisos.claNombre || permisos.claUsuario) + '</option>')
                            .prop('disabled', true);
                    }
                    if (permisos.oficinaUsuario) {
                        var teamNames = permisos.teamNames;
                        var oName = teamNames[permisos.oficinaUsuario] || permisos.oficinaUsuario;
                        self.$el.find('#filtro-oficina')
                            .html('<option value="' + permisos.oficinaUsuario + '">' + oName + '</option>')
                            .prop('disabled', true);

                        self.filtros.oficina = permisos.oficinaUsuario;
                        var tipoActual = self.$el.find('#filtro-tipo').val();
                        self._cargarUsuariosPorOficinaYTipo(permisos.oficinaUsuario, tipoActual).then(resolve);
                    } else {
                        resolve();
                    }

                } else {
                    resolve();
                }
            });
        },

        _cargarTodosCLAs: function () {
            var self = this;
            return new Promise(function (resolve) {
                Espo.Ajax.getRequest('Competencias/action/getCLAs')
                    .then(function (response) {
                        if (response.success) self._poblarSelectCLAs(response.data);
                        resolve();
                    })
                    .catch(function (err) {
                        resolve();
                    });
            });
        },

        _poblarSelectCLAs: function (clas) {
            var select = this.$el.find('#filtro-cla');
            select.empty().append('<option value="">Todos los CLAs</option>');
            clas.forEach(function (cla) {
                select.append('<option value="' + cla.id + '">' + cla.name + '</option>');
            });
        },

        _cargarOficinasPorCLA: function (claId) {
            var self = this;
            
            return new Promise(function (resolve) {
                var $of = self.$el.find('#filtro-oficina');
                var $us = self.$el.find('#filtro-usuario');

                if (!claId) {
                    $of.html('<option value="">Seleccione un CLA primero</option>').prop('disabled', true);
                    $us.html('<option value="">Seleccione una oficina primero</option>').prop('disabled', true);
                    resolve();
                    return;
                }

                $of.html('<option value="">Cargando oficinas...</option>').prop('disabled', true);
                $us.html('<option value="">Seleccione una oficina primero</option>').prop('disabled', true);

                Espo.Ajax.getRequest('Competencias/action/getOficinasByCLA', { claId: claId })
                    .then(function (response) {
                        if (response.success && response.data && response.data.length > 0) {
                            self._poblarSelectOficinas(response.data);
                        } else {
                            $of.html('<option value="">No hay oficinas en este CLA</option>').prop('disabled', true);
                        }
                        resolve();
                    })
                    .catch(function (err) {
                        $of.html('<option value="">Error al cargar oficinas</option>').prop('disabled', true);
                        resolve();
                    });
            });
        },

        _poblarSelectOficinas: function (oficinas) {
            var select = this.$el.find('#filtro-oficina');
            select.empty().append('<option value="">Todas las oficinas</option>');
            
            if (oficinas && oficinas.length > 0) {
                oficinas.forEach(function (o) {
                    select.append('<option value="' + o.id + '">' + o.name + '</option>');
                });
                select.prop('disabled', false);
            } else {
                select.html('<option value="">No hay oficinas disponibles</option>').prop('disabled', true);
            }
        },

        _cargarUsuariosPorOficinaYTipo: function (oficinaId, tipo) {
            var self = this;
            
            var $us = this.$el.find('#filtro-usuario');
            
            if (!oficinaId) {
                $us.html('<option value="">Seleccione una oficina primero</option>').prop('disabled', true);
                return Promise.resolve();
            }

            $us.html('<option value="">Cargando usuarios...</option>').prop('disabled', true);
            
            return new Promise(function (resolve) {
                var pi = self.periodoInfo;
                if (!pi) {
                    self._poblarSelectUsuarios([]);
                    resolve();
                    return;
                }
                
                var fechaCierreMax = pi.fechaCierre ? pi.fechaCierre + ' 23:59:59' : null;
                var maxSize = 200;
                var offset = 0;
                var todasLasEncuestas = [];
                
                var fetchEncuestasPage = function() {
                    Espo.Ajax.getRequest('Encuesta', {
                        where: [
                            { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: pi.fechaInicio },
                            { type: 'lessThanOrEquals',    attribute: 'fechaCreacion', value: fechaCierreMax },
                            { attribute: 'equipoId', type: 'equals', value: oficinaId }
                        ],
                        select: ['usuarioEvaluadoId', 'usuarioEvaluadoName', 'rolUsuario'],
                        maxSize: maxSize,
                        offset: offset
                    }).then(function(response) {
                        var encuestas = response.list || [];
                        todasLasEncuestas = todasLasEncuestas.concat(encuestas);
                        
                        if (encuestas.length < maxSize) {
                            var usuariosMap = {};
                            
                            todasLasEncuestas.forEach(function(e) {
                                if (e.usuarioEvaluadoId && e.usuarioEvaluadoName) {
                                    if (tipo && tipo !== '') {
                                        var tipoEncuesta = e.rolUsuario || '';
                                        var tipoBuscado = tipo === 'gerente-director-coordinador' ? 'gerente' : tipo;
                                        
                                        if (tipoEncuesta !== tipoBuscado) {
                                            return;
                                        }
                                    }
                                    
                                    usuariosMap[e.usuarioEvaluadoId] = {
                                        id: e.usuarioEvaluadoId,
                                        name: e.usuarioEvaluadoName,
                                        userName: e.usuarioEvaluadoName
                                    };
                                }
                            });
                            
                            var usuarios = Object.values(usuariosMap);
                            
                            usuarios.sort(function(a, b) {
                                return (a.name || '').localeCompare(b.name || '');
                            });
                            
                            self._poblarSelectUsuarios(usuarios);
                            resolve();
                            
                        } else {
                            offset += maxSize;
                            fetchEncuestasPage();
                        }
                    }).catch(function(error) {
                        self._poblarSelectUsuarios([]);
                        resolve();
                    });
                };
                
                fetchEncuestasPage();
            });
        },

        _poblarSelectUsuarios: function (usuarios) {
            var self = this;
            var select = this.$el.find('#filtro-usuario');
            select.empty().append('<option value="">Todos los usuarios</option>');
            
            if (usuarios && usuarios.length > 0) {
                usuarios.forEach(function (u) {
                    var nombre = self._titleCase(u.name || u.userName || 'Usuario sin nombre');
                    select.append('<option value="' + u.id + '">' + nombre + '</option>');
                });
                select.prop('disabled', false);
            } else {
                select.html('<option value="">No hay usuarios disponibles</option>').prop('disabled', true);
            }
        },

        _aplicarValoresFiltrosDesdeUrl: function () {
            var self = this;
            
            return new Promise(function (resolve) {
                if (self.filtros.cla || self.filtros.oficina || self.filtros.usuario || self.filtros.tipo || self.filtros.estado) {
                    
                    if (self.filtros.cla && !self.$el.find('#filtro-cla').prop('disabled')) {
                        var $cla = self.$el.find('#filtro-cla');
                        
                        var esperarCLA = function() {
                            if ($cla.find('option[value="' + self.filtros.cla + '"]').length) {
                                $cla.val(self.filtros.cla);
                                
                                self._cargarOficinasPorCLA(self.filtros.cla).then(function() {
                                    self._restaurarOficinaDesdeUrl().then(resolve);
                                });
                            } else {
                                setTimeout(esperarCLA, 100);
                            }
                        };
                        esperarCLA();
                    } else if (self.filtros.oficina && !self.$el.find('#filtro-oficina').prop('disabled')) {
                        self._restaurarOficinaDesdeUrl().then(resolve);
                    } else {
                        if (self.filtros.tipo) {
                            self.$el.find('#filtro-tipo').val(self.filtros.tipo);
                        }
                        if (self.filtros.estado) {
                            self.$el.find('#filtro-estado').val(self.filtros.estado);
                        }
                        resolve();
                    }
                } else {
                    resolve();
                }
            });
        },

        _restaurarOficinaDesdeUrl: function () {
            var self = this;
            return new Promise(function (resolve) {
                if (!self.filtros.oficina) { 
                    resolve(); 
                    return; 
                }
                
                var $of = self.$el.find('#filtro-oficina');
                
                var esperarOficina = function() {
                    if ($of.find('option[value="' + self.filtros.oficina + '"]').length) {
                        $of.val(self.filtros.oficina);
                        
                        if (self.filtros.tipo) {
                            self.$el.find('#filtro-tipo').val(self.filtros.tipo);
                        }
                        
                        var tipoActual = self.filtros.tipo || '';
                        self._cargarUsuariosPorOficinaYTipo(self.filtros.oficina, tipoActual).then(function() {
                            if (self.filtros.usuario) {
                                self._restaurarUsuarioDesdeUrl();
                            }
                            resolve();
                        });
                    } else {
                        setTimeout(esperarOficina, 100);
                    }
                };
                esperarOficina();
            });
        },

        _restaurarUsuarioDesdeUrl: function () {
            var self = this;
            if (!self.filtros.usuario) return;
            
            var $us = self.$el.find('#filtro-usuario');
            var esperarUsuario = function() {
                if ($us.find('option[value="' + self.filtros.usuario + '"]').length) {
                    $us.val(self.filtros.usuario);
                } else {
                    setTimeout(esperarUsuario, 100);
                }
            };
            esperarUsuario();
        },

        _aplicarFiltros: function () {
            this.filtros = {
                cla:     this.$el.find('#filtro-cla').val()     || null,
                oficina: this.$el.find('#filtro-oficina').val() || null,
                usuario: this.$el.find('#filtro-usuario').val() || null,
                tipo:    this.$el.find('#filtro-tipo').val()    || null,
                estado:  this.$el.find('#filtro-estado').val()  || null
            };

            var p = this.permisos;
            if (p && p.esGerenteDirectorCoord && !p.esCasaNacional) {
                this.filtros.oficina = p.oficinaUsuario;
                this.filtros.cla     = null;
            }

            if (this.filtros.cla && !this.filtros.oficina && this.permisos && this.permisos.esCasaNacional) {
                this.wait(true);
                
                var self = this;
                Espo.Ajax.getRequest('Competencias/action/getOficinasByCLA', { claId: this.filtros.cla })
                    .then(function (response) {
                        if (response.success && response.data && response.data.length > 0) {
                            self.oficinasDelCLA = response.data.map(function(o) { return o.id; });
                        } else {
                            self.oficinasDelCLA = ['NO_OFC'];
                        }
                        self.paginacion.pagina = 1;
                        self._actualizarUrlConFiltros();
                        self._fetchEncuestas();
                        self.wait(false);
                    })
                    .catch(function (err) {
                        self.oficinasDelCLA = [];
                        self.paginacion.pagina = 1;
                        self._actualizarUrlConFiltros();
                        self._fetchEncuestas();
                        self.wait(false);
                    });
            } else {
                this.oficinasDelCLA = [];
                this.paginacion.pagina = 1;
                this._actualizarUrlConFiltros();
                this._fetchEncuestas();
            }
        },

        _limpiarFiltros: function () {
            var p = this.permisos;

            if (!this.$el.find('#filtro-cla').prop('disabled')) {
                this.$el.find('#filtro-cla').val('');
                this.$el.find('#filtro-oficina')
                    .html('<option value="">Seleccione un CLA primero</option>')
                    .prop('disabled', true);
                this.$el.find('#filtro-usuario')
                    .html('<option value="">Seleccione una oficina primero</option>')
                    .prop('disabled', true);
            } else if (!this.$el.find('#filtro-usuario').prop('disabled')) {
                this.$el.find('#filtro-usuario').val('');
            }

            this.$el.find('#filtro-tipo').val('');

            this.filtros = {
                cla:     null,
                oficina: (p && p.esGerenteDirectorCoord && !p.esCasaNacional) ? p.oficinaUsuario : null,
                usuario: null,
                tipo:    null,
                estado:  'completada'
            };

            this.oficinasDelCLA = [];
            this.paginacion.pagina = 1;
            this._actualizarUrlConFiltros();
            this._fetchEncuestas();
            Espo.Ui.info('Filtros limpiados');
        },

        _fetchEncuestas: function () {
            if (this.cargandoPagina) {
                return;
            }
            this.cargandoPagina = true;

            var container = this.$el.find('#lista-edicion-container');
            container.html(
                '<div class="text-center" style="padding:80px 20px;">'
                + '<div class="spinner-large"></div>'
                + '<h4 class="mt-4">Cargando encuestas...</h4></div>'
            );

            var self     = this;
            var permisos = this.permisos;
            var pi       = this.periodoInfo;

            if (!pi) {
                this.cargandoPagina = false;
                return;
            }

            var fechaCierreMax = pi.fechaCierre ? pi.fechaCierre + ' 23:59:59' : null;

            var where = [
                { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: pi.fechaInicio },
                { type: 'lessThanOrEquals',    attribute: 'fechaCreacion', value: fechaCierreMax },
                { type: 'equals', attribute: 'estado', value: 'completada' }
            ];

            if (this.oficinasDelCLA && this.oficinasDelCLA.length > 0) {
                where.push({ 
                    type: 'in', 
                    attribute: 'equipoId', 
                    value: this.oficinasDelCLA 
                });
            } else {
                var oficinaFiltro = this.filtros.oficina;
                if (!oficinaFiltro && permisos && permisos.esGerenteDirectorCoord && !permisos.esCasaNacional) {
                    oficinaFiltro = permisos.oficinaUsuario;
                }
                if (oficinaFiltro) {
                    where.push({ attribute: 'equipoId', type: 'equals', value: oficinaFiltro });
                }
            }

            if (this.filtros.usuario) {
                where.push({ attribute: 'usuarioEvaluadoId', type: 'equals', value: this.filtros.usuario });
            }

            if (this.filtros.tipo) {
                var tipoValue = this.filtros.tipo === 'gerente-director-coordinador' ? 'gerente' : this.filtros.tipo;
                where.push({ attribute: 'rolUsuario', type: 'equals', value: tipoValue });
            }

            var maxSize = 200;
            var offset = 0;
            var todasLasEncuestas = [];

            var fetchNextPage = function() {
                Espo.Ajax.getRequest('Encuesta', {
                    where: where,
                    select: [
                        'id',
                        'fechaCreacion',
                        'createdAt',
                        'usuarioEvaluadoId',
                        'usuarioEvaluadoName',
                        'equipoId',
                        'equipoName',
                        'rolUsuario',
                        'estado'
                    ],
                    maxSize: maxSize,
                    offset: offset,
                    orderBy: 'fechaCreacion',
                    order: 'desc'
                }).then(function(response) {
                    var encuestas = response.list || [];
                    todasLasEncuestas = todasLasEncuestas.concat(encuestas);

                    if (encuestas.length < maxSize) {
                        self.cargandoPagina = false;
                        self.encuestasFiltradas = todasLasEncuestas;
                        self.paginacion.total = todasLasEncuestas.length;
                        self.paginacion.totalPaginas = Math.ceil(self.paginacion.total / self.paginacion.porPagina);
                        
                        if (self.paginacion.pagina > self.paginacion.totalPaginas && self.paginacion.totalPaginas > 0) {
                            self.paginacion.pagina = self.paginacion.totalPaginas;
                        }
                        
                        self._renderizarTabla();
                    } else {
                        offset += maxSize;
                        fetchNextPage();
                    }
                }).catch(function(error) {
                    self.cargandoPagina = false;
                    container.html('<div class="alert alert-danger">Error al cargar encuestas: ' + (error.message || 'desconocido') + '</div>');
                });
            };

            fetchNextPage();
        },

        _irAPagina: function (pagina) {
            if (pagina < 1 || pagina > this.paginacion.totalPaginas || this.cargandoPagina) return;
            this.paginacion.pagina = pagina;
            this._actualizarUrlConFiltros();
            this._renderizarTabla();
        },

        _renderizarTabla: function () {
            var container = this.$el.find('#lista-edicion-container');
            var pag       = this.paginacion;
            var self      = this;

            var inicio = (pag.pagina - 1) * pag.porPagina;
            var datos  = this.encuestasFiltradas.slice(inicio, inicio + pag.porPagina);

            var ini = pag.total === 0 ? 0 : inicio + 1;
            var fin = Math.min(pag.pagina * pag.porPagina, pag.total);
            this.$el.find('#total-encuestas-mostradas')
                .text(pag.total === 0 ? '0' : ini + '–' + fin + ' de ' + pag.total);

            if (datos.length === 0) {
                container.html(
                    '<div class="no-data-card">'
                    + '<div class="no-data-icon"><i class="fas fa-inbox"></i></div>'
                    + '<h3 class="no-data-title">No hay encuestas</h3>'
                    + '<p class="no-data-text">No se encontraron encuestas con los filtros aplicados</p>'
                    + '</div>'
                );
                return;
            }

            var html         = '';
            var inicioGlobal = inicio;

            var grupos = [];
            for (var g = 0; g < datos.length; g += 25) {
                grupos.push(datos.slice(g, g + 25));
            }

            grupos.forEach(function (grupo, gi) {
                var numGrupoGlobal = inicioGlobal + gi * 25 + 1;
                var numGrupoFin   = Math.min(numGrupoGlobal + 24, pag.total);

                html += '<div class="grupo-encuestas">';
                html += '<div class="grupo-header">';
                html += '<i class="fas fa-layer-group" style="margin-right:8px;"></i>';
                html += 'Registros ' + numGrupoGlobal + ' – ' + numGrupoFin;
                html += '</div>';
                html += '<div class="tabla-encuestas"><table><thead><tr>';
                html += '<th style="width:50px;text-align:center;">N°</th>';
                html += '<th style="width:90px;">Fecha</th>';
                html += '<th style="width:180px;">Usuario Evaluado</th>';
                html += '<th style="width:130px;">Oficina</th>';
                html += '<th style="width:120px;">Tipo</th>';
                html += '<th style="width:110px;">Estado</th>';
                html += '<th style="width:80px;">Acciones</th>';
                html += '</tr></thead><tbody>';

                grupo.forEach(function (encuesta, idx) {
                    var numItem = inicioGlobal + gi * 25 + idx + 1;

                    var fecha = encuesta.fechaCreacion || encuesta.createdAt || '';
                    if (fecha) {
                        fecha = new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
                    } else {
                        fecha = '-';
                    }

                    var usuarioNombre = self._titleCase(encuesta.usuarioEvaluadoName || encuesta.userName || '-');
                    var oficinaNombre = encuesta.equipoName || '-';
                    var tipoRol       = encuesta.rolUsuario || '-';
                    
                    var estado        = encuesta.estado || 'incompleta';

                    var usuarioCorto = usuarioNombre.length > 25 ? usuarioNombre.substring(0, 22) + '...' : usuarioNombre;

                    var estadoMap = {
                        'incompleta': { texto: 'Incompleta',   color: '#e74c3c' },
                        'revision':   { texto: 'En revisión',  color: '#f39c12' },
                        'completada': { texto: 'Completada',   color: '#27ae60' }
                    };
                    var ei = estadoMap[estado] || { texto: estado, color: '#95a5a6' };

                    var tipoTexto = tipoRol === 'asesor' ? 'Asesor'
                        : (tipoRol === 'gerente' ? 'Gerente/Director' : tipoRol);

                    html += '<tr data-id="' + encuesta.id + '">';
                    html += '<td style="text-align:center;font-weight:600;font-size:13px;">' + numItem + '</td>';
                    html += '<td style="font-size:13px;">' + fecha + '</td>';
                    html += '<td title="' + usuarioNombre + '" style="font-size:13px;">' + usuarioCorto + '</td>';
                    html += '<td style="font-size:13px;">' + oficinaNombre + '</td>';
                    html += '<td style="font-size:13px;">' + tipoTexto + '</td>';
                    html += '<td><span class="badge" style="background:' + ei.color + ';color:white;font-size:11px;padding:4px 8px;">' + ei.texto + '</span></td>';
                    html += '<td style="text-align:center;"><button class="btn-editar-enc" data-id="' + encuesta.id + '" title="Editar encuesta"><i class="fas fa-pencil-alt"></i></button></td>';
                    html += '</tr>';
                });

                html += '</tbody></table></div></div>';
            });

            html += self._renderPaginacion();
            container.html(html);

            container.find('tr[data-id]').on('click', function (e) {
                if (!$(e.target).closest('button').length) {
                    self._irAEncuesta($(this).data('id'));
                }
            });
            container.find('.btn-editar-enc').on('click', function (e) {
                e.stopPropagation();
                self._irAEncuesta($(this).data('id'));
            });
            container.find('.pag-btn').on('click', function () {
                var p = parseInt($(this).data('pagina'), 10);
                if (!isNaN(p)) self._irAPagina(p);
            });
        },

        _renderPaginacion: function () {
            var pag = this.paginacion;
            if (pag.totalPaginas <= 1) return '';

            var actual = pag.pagina;
            var total  = pag.totalPaginas;
            var pages  = [];
            var rango  = 2;
            var ini    = Math.max(2, actual - rango);
            var fin    = Math.min(total - 1, actual + rango);

            pages.push(1);
            if (ini > 2) pages.push('...');
            for (var i = ini; i <= fin; i++) pages.push(i);
            if (fin < total - 1) pages.push('...');
            if (total > 1) pages.push(total);

            var html = '<div class="paginacion-container">';
            html += '<div class="paginacion-info">Página ' + actual + ' de ' + total + '</div>';
            html += '<div class="paginacion-controles">';

            html += '<button class="pag-btn pag-nav' + (actual <= 1 ? ' disabled' : '') + '" data-pagina="' + (actual - 1) + '"' + (actual <= 1 ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';

            pages.forEach(function (p) {
                if (p === '...') {
                    html += '<span class="pag-ellipsis">…</span>';
                } else {
                    html += '<button class="pag-btn' + (p === actual ? ' pag-activo' : '') + '" data-pagina="' + p + '">' + p + '</button>';
                }
            });

            html += '<button class="pag-btn pag-nav' + (actual >= total ? ' disabled' : '') + '" data-pagina="' + (actual + 1) + '"' + (actual >= total ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
            html += '</div></div>';
            return html;
        },
        
        _irAEncuesta: function (encuestaId) {
            var encuesta = this.encuestasFiltradas.find(function(e) {
                return e.id === encuestaId;
            });
            
            if (!encuesta) {
                Espo.Ui.error('Error al cargar los datos de la encuesta');
                return;
            }
            
            var dataParts = [
                'encuestaId:' + encuestaId,
                'userId:' + (encuesta.usuarioEvaluadoId || ''),
                'userName:' + (encuesta.usuarioEvaluadoName || ''),
                'teamId:' + (encuesta.equipoId || ''),
                'teamName:' + (encuesta.equipoName || ''),
                'role:' + (encuesta.rolUsuario || '')
            ];
            
            var dataString = encodeURIComponent(dataParts.join('|'));
            
            var retornoParts = ['periodoId=' + this.periodoId];
            if (this.filtros.cla) retornoParts.push('cla=' + this.filtros.cla);
            if (this.filtros.oficina) retornoParts.push('oficina=' + this.filtros.oficina);
            if (this.filtros.usuario) retornoParts.push('usuario=' + this.filtros.usuario);
            if (this.filtros.tipo) retornoParts.push('tipo=' + this.filtros.tipo);
            if (this.filtros.estado) retornoParts.push('estado=' + this.filtros.estado);
            if (this.paginacion.pagina > 1) retornoParts.push('pagina=' + this.paginacion.pagina);
            
            var retornoString = encodeURIComponent('#Competencias/listaEdicion?' + retornoParts.join('&'));
            
            var url = '#Competencias/survey?data=' + dataString + 
                    '&from=listaEdicion' + 
                    '&retorno=' + retornoString;
            
            this.getRouter().navigate(url, { trigger: true });
        },

        _titleCase: function (str) {
            if (!str) return '';
            return str.toLowerCase().split(' ').map(function (p) {
                return p ? p.charAt(0).toUpperCase() + p.slice(1) : '';
            }).join(' ');
        }
    });
});