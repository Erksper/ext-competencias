// client/custom/modules/competencias/src/views/listaEdicion.js
define(['view'], function (View) {

    return View.extend({

        template: 'competencias:listaEdicion',

        setup: function () {
            console.log('=== SETUP LISTA EDICION INICIADO ===');
            
            // Leer params de opciones (controller los pasa) y también de URL
            this.periodoId   = this.options.periodoId || null;
            this.periodoInfo = null; // { fechaInicio, fechaCierre, label }

            this.filtrosDesdeUrl = this._parseQueryParams();

            this.filtros = {
                cla:     this.filtrosDesdeUrl.cla     || null,
                oficina: this.filtrosDesdeUrl.oficina || null,
                usuario: this.filtrosDesdeUrl.usuario || null,
                tipo:    this.filtrosDesdeUrl.tipo    || null,
                estado:  this.filtrosDesdeUrl.estado  || null
            };
            
            console.log('Filtros iniciales desde URL:', this.filtros);

            this.paginacion = {
                pagina:       parseInt(this.filtrosDesdeUrl.pagina || 1),
                porPagina:    25,
                total:        0,
                totalPaginas: 0
            };

            this.encuestasFiltradas = [];
            this.cargandoPagina     = false;
            this.permisos           = null;
            
            // Para manejar el filtro por CLA
            this.oficinasDelCLA = [];
            this.filtroClaEnProceso = false;
            
            // Cache de usuarios por oficina
            this.cacheUsuarios = {};

            this.wait(true);
            this._cargarPermisos();
        },

        // ── Parseo de URL ────────────────────────────────────────
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
            // periodoId puede venir por options O por URL
            if (!this.periodoId && result.periodoId) {
                this.periodoId = result.periodoId;
            }
            console.log('URL parseada:', result);
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
            console.log('Actualizando URL con filtros:', this.filtros, 'QS:', qs);
            this.getRouter().navigate('#Competencias/listaEdicion' + qs, { trigger: false });
        },

        // ── Permisos ─────────────────────────────────────────────
        _cargarPermisos: function () {
            console.log('Cargando permisos...');
            var self = this;
            var user = this.getUser();

            this.getModelFactory().create('User', function (userModel) {
                userModel.id = user.id;
                userModel.fetch({ relations: { roles: true, teams: true } }).then(function () {
                    var roles = Object.values(userModel.get('rolesNames') || {}).map(function (r) { return r.toLowerCase(); });
                    console.log('Roles del usuario:', roles);

                    self.permisos = {
                        esCasaNacional:        roles.includes('casa nacional'),
                        esGerenteDirectorCoord: roles.includes('gerente') || roles.includes('director') || roles.includes('coordinador'),
                        esAsesor:              roles.includes('asesor'),
                        usuarioId:             user.id,
                        teamIds:               userModel.get('teamsIds')   || [],
                        teamNames:             userModel.get('teamsNames') || {}
                    };
                    
                    console.log('Permisos calculados:', self.permisos);

                    // Resolver claUsuario y oficinaUsuario para Gerente/Director/Coord
                    if (self.permisos.esGerenteDirectorCoord && !self.permisos.esCasaNacional) {
                        var teamIds   = self.permisos.teamIds;
                        var teamNames = self.permisos.teamNames;
                        var claPattern = /^CLA\d+$/i;

                        // CLA = teams cuyo id empieza con CLA
                        var claTeams = teamIds.filter(function (id) { return claPattern.test(id); });
                        // Oficina = teams que NO son CLA y NO son "Venezuela"
                        var oficTeams = teamIds.filter(function (id) {
                            return !claPattern.test(id) && (teamNames[id] || '').toLowerCase() !== 'venezuela';
                        });

                        self.permisos.claUsuario    = claTeams.length > 0 ? claTeams[0] : null;
                        self.permisos.claNombre     = self.permisos.claUsuario ? (teamNames[self.permisos.claUsuario] || self.permisos.claUsuario) : null;
                        self.permisos.oficinaUsuario = oficTeams.length > 0 ? oficTeams[0] : null;
                        
                        console.log('Para GDC - CLA:', self.permisos.claUsuario, 'Oficina:', self.permisos.oficinaUsuario);
                    }

                    // Cargar período
                    self._cargarPeriodo();

                }.bind(self));
            });
        },

        // ── Período ──────────────────────────────────────────────
        _cargarPeriodo: function () {
            console.log('Cargando período:', this.periodoId);
            var self = this;

            if (!this.periodoId) {
                // Si no hay periodoId, redirigir al index
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
                    console.log('Período cargado:', self.periodoInfo);
                    self.wait(false);
                }).catch(function () {
                    console.error('Error al cargar período');
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

        // ── Render ───────────────────────────────────────────────
        afterRender: function () {
            console.log('afterRender ejecutado');
            // Mostrar subtítulo con el período
            if (this.periodoInfo) {
                this.$el.find('#periodo-subtitulo').text('Período: ' + this.periodoInfo.label);
            }

            this._setupEventListeners();
            this._cargarFiltros()
                .then(this._aplicarValoresFiltrosDesdeUrl.bind(this))
                .then(() => {
                    console.log('Filtros restaurados desde URL, ejecutando búsqueda...');
                    // SIEMPRE ejecutar la búsqueda después de restaurar filtros
                    this._fetchEncuestas();
                });
        },

        _setupEventListeners: function () {
            console.log('Configurando event listeners');
            var self = this;

            this.$el.find('[data-action="volver"]').on('click', function () {
                self.getRouter().navigate('#Competencias', { trigger: true });
            });

            this.$el.find('[data-action="aplicar-filtros"]').on('click', function () {
                console.log('Click en aplicar filtros');
                self._aplicarFiltros();
            });

            this.$el.find('[data-action="limpiar-filtros"]').on('click', function () {
                console.log('Click en limpiar filtros');
                self._limpiarFiltros();
            });

            // Estos eventos SOLO cargan las opciones de los selects, NO aplican filtros
            this.$el.find('#filtro-cla').on('change', function (e) {
                var claId = $(e.currentTarget).val();
                console.log('Cambio en filtro CLA:', claId);
                self._cargarOficinasPorCLA(claId);
            });

            this.$el.find('#filtro-oficina').on('change', function (e) {
                var oficinaId = $(e.currentTarget).val();
                var tipo = self.$el.find('#filtro-tipo').val();
                console.log('Cambio en filtro oficina:', oficinaId, 'tipo actual:', tipo);
                self._cargarUsuariosPorOficinaYTipo(oficinaId, tipo);
            });

            this.$el.find('#filtro-tipo').on('change', function (e) {
                var tipo = $(e.currentTarget).val();
                var oficinaId = self.$el.find('#filtro-oficina').val();
                console.log('Cambio en filtro tipo:', tipo, 'oficina actual:', oficinaId);
                if (oficinaId) {
                    self._cargarUsuariosPorOficinaYTipo(oficinaId, tipo);
                }
            });
        },

        // ── Filtros en cascada ──
        _cargarFiltros: function () {
            console.log('Cargando filtros iniciales...');
            var self     = this;
            var permisos = this.permisos;

            return new Promise(function (resolve) {
                if (!permisos) { 
                    console.log('No hay permisos aún');
                    resolve(); 
                    return; 
                }

                if (permisos.esCasaNacional) {
                    console.log('Usuario es Casa Nacional - cargando CLAs');
                    // Casa Nacional: ve todos los CLAs
                    self._cargarTodosCLAs().then(resolve);

                } else if (permisos.esGerenteDirectorCoord) {
                    console.log('Usuario es Gerente/Director/Coordinador');
                    // Bloquear CLA y oficina, cargar usuarios de su oficina
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
                        // Cargar usuarios según tipo actual
                        var tipoActual = self.$el.find('#filtro-tipo').val();
                        self._cargarUsuariosPorOficinaYTipo(permisos.oficinaUsuario, tipoActual).then(resolve);
                    } else {
                        resolve();
                    }

                } else {
                    console.log('Usuario sin permisos especiales');
                    resolve();
                }
            });
        },

        _cargarTodosCLAs: function () {
            console.log('Cargando todos los CLAs...');
            var self = this;
            return new Promise(function (resolve) {
                Espo.Ajax.getRequest('Competencias/action/getCLAs')
                    .then(function (response) {
                        console.log('CLAs recibidos:', response);
                        if (response.success) self._poblarSelectCLAs(response.data);
                        resolve();
                    })
                    .catch(function (err) {
                        console.error('Error cargando CLAs:', err);
                        resolve();
                    });
            });
        },

        _poblarSelectCLAs: function (clas) {
            console.log('Poblando select de CLAs con:', clas);
            var select = this.$el.find('#filtro-cla');
            select.empty().append('<option value="">Todos los CLAs</option>');
            clas.forEach(function (cla) {
                select.append('<option value="' + cla.id + '">' + cla.name + '</option>');
            });
        },

        // ── CORREGIDO: Cargar oficinas por CLA (AHORA RETORNA PROMESA) ──
        _cargarOficinasPorCLA: function (claId) {
            console.log('Cargando oficinas para CLA:', claId);
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

                // Obtener oficinas del CLA
                Espo.Ajax.getRequest('Competencias/action/getOficinasByCLA', { claId: claId })
                    .then(function (response) {
                        console.log('Oficinas del CLA recibidas:', response);
                        
                        if (response.success && response.data && response.data.length > 0) {
                            self._poblarSelectOficinas(response.data);
                        } else {
                            console.log('No hay oficinas en este CLA');
                            $of.html('<option value="">No hay oficinas en este CLA</option>').prop('disabled', true);
                        }
                        resolve();
                    })
                    .catch(function (err) {
                        console.error('Error cargando oficinas del CLA:', err);
                        $of.html('<option value="">Error al cargar oficinas</option>').prop('disabled', true);
                        resolve();
                    });
            });
        },

        _poblarSelectOficinas: function (oficinas) {
            console.log('Poblando select de oficinas con:', oficinas);
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

        // ── CORREGIDO: Cargar usuarios con paginación (maxSize=200) ──
        _cargarUsuariosPorOficinaYTipo: function (oficinaId, tipo) {
            console.log('Cargando usuarios para oficina:', oficinaId, 'tipo:', tipo);
            var self = this;
            
            var $us = this.$el.find('#filtro-usuario');
            
            if (!oficinaId) {
                $us.html('<option value="">Seleccione una oficina primero</option>').prop('disabled', true);
                return Promise.resolve();
            }

            // Mostrar loading
            $us.html('<option value="">Cargando usuarios...</option>').prop('disabled', true);
            
            return new Promise(function (resolve) {
                var pi = self.periodoInfo;
                if (!pi) {
                    console.log('No hay info de período');
                    self._poblarSelectUsuarios([]);
                    resolve();
                    return;
                }
                
                var fechaCierreMax = pi.fechaCierre ? pi.fechaCierre + ' 23:59:59' : null;
                var maxSize = 200;
                var offset = 0;
                var todasLasEncuestas = [];
                
                // Función recursiva para paginar encuestas
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
                        console.log(`Página ${offset/maxSize + 1}: ${encuestas.length} encuestas recibidas`);
                        
                        todasLasEncuestas = todasLasEncuestas.concat(encuestas);
                        
                        if (encuestas.length < maxSize) {
                            // No hay más páginas - procesar resultados
                            console.log('Total encuestas procesadas:', todasLasEncuestas.length);
                            
                            // Crear un mapa de usuarios únicos
                            var usuariosMap = {};
                            
                            todasLasEncuestas.forEach(function(e) {
                                if (e.usuarioEvaluadoId && e.usuarioEvaluadoName) {
                                    // Si hay filtro de tipo, verificar que coincida
                                    if (tipo && tipo !== '') {
                                        var tipoEncuesta = e.rolUsuario || '';
                                        var tipoBuscado = tipo === 'gerente-director-coordinador' ? 'gerente' : tipo;
                                        
                                        if (tipoEncuesta !== tipoBuscado) {
                                            return; // No coincide el tipo, saltar
                                        }
                                    }
                                    
                                    // Guardar usuario en el mapa (para evitar duplicados)
                                    usuariosMap[e.usuarioEvaluadoId] = {
                                        id: e.usuarioEvaluadoId,
                                        name: e.usuarioEvaluadoName,
                                        userName: e.usuarioEvaluadoName
                                    };
                                }
                            });
                            
                            // Convertir mapa a array
                            var usuarios = Object.values(usuariosMap);
                            console.log('Usuarios únicos encontrados:', usuarios.length);
                            
                            // Ordenar alfabéticamente
                            usuarios.sort(function(a, b) {
                                return (a.name || '').localeCompare(b.name || '');
                            });
                            
                            self._poblarSelectUsuarios(usuarios);
                            resolve();
                            
                        } else {
                            // Ir a la siguiente página
                            offset += maxSize;
                            fetchEncuestasPage();
                        }
                    }).catch(function(error) {
                        console.error('Error cargando encuestas:', error);
                        self._poblarSelectUsuarios([]);
                        resolve();
                    });
                };
                
                fetchEncuestasPage();
            });
        },

        _poblarSelectUsuarios: function (usuarios) {
            console.log('Poblando select de usuarios con:', usuarios.length, 'usuarios');
            var self = this;
            var select = this.$el.find('#filtro-usuario');
            select.empty().append('<option value="">Todos los usuarios</option>');
            
            if (usuarios && usuarios.length > 0) {
                usuarios.forEach(function (u) {
                    var nombre = self._titleCase(u.name || u.userName || 'Usuario sin nombre');
                    select.append('<option value="' + u.id + '">' + nombre + '</option>');
                });
                select.prop('disabled', false);
                console.log('Select de usuarios poblado con', usuarios.length, 'opciones');
            } else {
                console.log('No hay usuarios para esta combinación');
                select.html('<option value="">No hay usuarios disponibles</option>').prop('disabled', true);
            }
        },

        // ── Restaurar filtros desde URL ──────────────────────────
        _aplicarValoresFiltrosDesdeUrl: function () {
            console.log('Aplicando valores de filtros desde URL:', this.filtros);
            var self = this;
            
            return new Promise(function (resolve) {
                // Si hay filtros en la URL, aplicarlos
                if (self.filtros.cla || self.filtros.oficina || self.filtros.usuario || self.filtros.tipo || self.filtros.estado) {
                    console.log('Hay filtros en URL, aplicándolos...');
                    
                    // Primero restaurar CLA si existe
                    if (self.filtros.cla && !self.$el.find('#filtro-cla').prop('disabled')) {
                        var $cla = self.$el.find('#filtro-cla');
                        
                        var esperarCLA = function() {
                            if ($cla.find('option[value="' + self.filtros.cla + '"]').length) {
                                console.log('Aplicando CLA desde URL:', self.filtros.cla);
                                $cla.val(self.filtros.cla);
                                
                                // Cargar oficinas para este CLA
                                self._cargarOficinasPorCLA(self.filtros.cla).then(function() {
                                    // Luego restaurar oficina
                                    self._restaurarOficinaDesdeUrl().then(resolve);
                                });
                            } else {
                                setTimeout(esperarCLA, 100);
                            }
                        };
                        esperarCLA();
                    } else if (self.filtros.oficina && !self.$el.find('#filtro-oficina').prop('disabled')) {
                        // Si no hay CLA pero sí oficina
                        self._restaurarOficinaDesdeUrl().then(resolve);
                    } else {
                        // Restaurar tipo y estado (estos no dependen de otros selects)
                        if (self.filtros.tipo) {
                            self.$el.find('#filtro-tipo').val(self.filtros.tipo);
                        }
                        if (self.filtros.estado) {
                            self.$el.find('#filtro-estado').val(self.filtros.estado);
                        }
                        resolve();
                    }
                } else {
                    // No hay filtros en URL, resolver inmediatamente
                    console.log('No hay filtros en URL');
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
                        console.log('Aplicando oficina desde URL:', self.filtros.oficina);
                        $of.val(self.filtros.oficina);
                        
                        // Restaurar tipo
                        if (self.filtros.tipo) {
                            self.$el.find('#filtro-tipo').val(self.filtros.tipo);
                        }
                        
                        // Cargar usuarios con la oficina y tipo actual
                        var tipoActual = self.filtros.tipo || '';
                        self._cargarUsuariosPorOficinaYTipo(self.filtros.oficina, tipoActual).then(function() {
                            // Restaurar usuario si existe
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
                    console.log('Aplicando usuario desde URL:', self.filtros.usuario);
                    $us.val(self.filtros.usuario);
                } else {
                    setTimeout(esperarUsuario, 100);
                }
            };
            esperarUsuario();
        },

        // ── Aplicar filtros (solo aquí se ejecuta la búsqueda) ──
        _aplicarFiltros: function () {
            console.log('Aplicando filtros manualmente');
            
            this.filtros = {
                cla:     this.$el.find('#filtro-cla').val()     || null,
                oficina: this.$el.find('#filtro-oficina').val() || null,
                usuario: this.$el.find('#filtro-usuario').val() || null,
                tipo:    this.$el.find('#filtro-tipo').val()    || null,
                estado:  this.$el.find('#filtro-estado').val()  || null
            };
            
            console.log('Filtros a aplicar:', this.filtros);

            // Forzar restricciones de rol
            var p = this.permisos;
            if (p && p.esGerenteDirectorCoord && !p.esCasaNacional) {
                this.filtros.oficina = p.oficinaUsuario;
                this.filtros.cla     = null;
            }

            // Preparar filtro de oficinas para CLA
            if (this.filtros.cla && !this.filtros.oficina && this.permisos && this.permisos.esCasaNacional) {
                console.log('Preparando filtro por CLA');
                this.wait(true);
                
                var self = this;
                Espo.Ajax.getRequest('Competencias/action/getOficinasByCLA', { claId: this.filtros.cla })
                    .then(function (response) {
                        if (response.success && response.data && response.data.length > 0) {
                            self.oficinasDelCLA = response.data.map(function(o) { return o.id; });
                        } else {
                            // Si no hay oficinas, forzar a que no encuentre nada
                            self.oficinasDelCLA = ['NO_OFC'];
                        }
                        self.paginacion.pagina = 1;
                        self._actualizarUrlConFiltros();
                        self._fetchEncuestas();
                        self.wait(false);
                    })
                    .catch(function (err) {
                        console.error('Error obteniendo oficinas del CLA:', err);
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
            console.log('Limpiando filtros');
            var p = this.permisos;

            // Solo limpiar los que no están bloqueados por rol
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
            // No limpiar estado - mantener filtro de completadas
            // this.$el.find('#filtro-estado').val('');

            this.filtros = {
                cla:     null,
                oficina: (p && p.esGerenteDirectorCoord && !p.esCasaNacional) ? p.oficinaUsuario : null,
                usuario: null,
                tipo:    null,
                estado:  'completada' // Forzar filtro de completadas
            };

            this.oficinasDelCLA = [];
            this.paginacion.pagina = 1;
            this._actualizarUrlConFiltros();
            this._fetchEncuestas();
            Espo.Ui.info('Filtros limpiados');
        },

        // ── Fetch encuestas del período ──
        _fetchEncuestas: function () {
            console.log('=== INICIO _fetchEncuestas ===');
            console.log('Filtros actuales:', this.filtros);
            console.log('oficinasDelCLA:', this.oficinasDelCLA);
            
            if (this.cargandoPagina) {
                console.log('Ya hay una carga en progreso');
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

            // Construir where para la colección de Encuesta
            var where = [
                { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: pi.fechaInicio },
                { type: 'lessThanOrEquals',    attribute: 'fechaCreacion', value: fechaCierreMax },
                { type: 'equals', attribute: 'estado', value: 'completada' } // SOLO COMPLETADAS
            ];

            // --- MODIFICADO: Filtro de oficina / CLA ---
            // Si hay filtro de CLA activo y tenemos oficinasDelCLA, filtrar por esas oficinas
            if (this.oficinasDelCLA && this.oficinasDelCLA.length > 0) {
                where.push({ 
                    type: 'in', 
                    attribute: 'equipoId', 
                    value: this.oficinasDelCLA 
                });
            }
            // Si no, usar el filtro de oficina normal
            else {
                var oficinaFiltro = this.filtros.oficina;
                if (!oficinaFiltro && permisos && permisos.esGerenteDirectorCoord && !permisos.esCasaNacional) {
                    oficinaFiltro = permisos.oficinaUsuario;
                }
                if (oficinaFiltro) {
                    where.push({ attribute: 'equipoId', type: 'equals', value: oficinaFiltro });
                }
            }

            // Filtro de usuario
            if (this.filtros.usuario) {
                where.push({ attribute: 'usuarioEvaluadoId', type: 'equals', value: this.filtros.usuario });
            }

            // Filtro de tipo (rol)
            if (this.filtros.tipo) {
                // Mapear valor del select al valor real en BD
                var tipoValue = this.filtros.tipo === 'gerente-director-coordinador' ? 'gerente' : this.filtros.tipo;
                where.push({ attribute: 'rolUsuario', type: 'equals', value: tipoValue });
            }

            console.log('Where final para la consulta:', JSON.stringify(where, null, 2));

            // --- INICIO: PAGINACIÓN POR LOTES ---
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
                    console.log(`Página ${offset/maxSize + 1}: ${encuestas.length} encuestas recibidas`);
                    
                    todasLasEncuestas = todasLasEncuestas.concat(encuestas);

                    if (encuestas.length < maxSize) {
                        console.log(`Total de encuestas cargadas: ${todasLasEncuestas.length}`);
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
                    console.error('Error cargando página de encuestas:', error);
                    self.cargandoPagina = false;
                    container.html('<div class="alert alert-danger">Error al cargar encuestas: ' + (error.message || 'desconocido') + '</div>');
                });
            };

            fetchNextPage();
            // --- FIN: PAGINACIÓN POR LOTES ---
        },

        _irAPagina: function (pagina) {
            if (pagina < 1 || pagina > this.paginacion.totalPaginas || this.cargandoPagina) return;
            this.paginacion.pagina = pagina;
            this._actualizarUrlConFiltros();
            this._renderizarTabla();
        },

        // ── Render tabla ─────────────────────────────────────────
        _renderizarTabla: function () {
            console.log('Renderizando tabla con', this.encuestasFiltradas.length, 'encuestas');
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
            console.log('Navegando a encuesta:', encuestaId);
            
            // Buscar la encuesta en los datos para obtener sus detalles
            var encuesta = this.encuestasFiltradas.find(function(e) {
                return e.id === encuestaId;
            });
            
            if (!encuesta) {
                console.error('No se encontraron datos de la encuesta');
                Espo.Ui.error('Error al cargar los datos de la encuesta');
                return;
            }
            
            console.log('Datos de encuesta:', encuesta);
            
            // Construir un solo string con todos los datos de la encuesta
            // Formato: key1:value1|key2:value2|key3:value3
            var dataParts = [
                'encuestaId:' + encuestaId,
                'userId:' + (encuesta.usuarioEvaluadoId || ''),
                'userName:' + (encuesta.usuarioEvaluadoName || ''),
                'teamId:' + (encuesta.equipoId || ''),
                'teamName:' + (encuesta.equipoName || ''),
                'role:' + (encuesta.rolUsuario || '')
            ];
            
            var dataString = encodeURIComponent(dataParts.join('|'));
            
            // Construir retorno con los filtros actuales
            var retornoParts = ['periodoId=' + this.periodoId];
            if (this.filtros.cla) retornoParts.push('cla=' + this.filtros.cla);
            if (this.filtros.oficina) retornoParts.push('oficina=' + this.filtros.oficina);
            if (this.filtros.usuario) retornoParts.push('usuario=' + this.filtros.usuario);
            if (this.filtros.tipo) retornoParts.push('tipo=' + this.filtros.tipo);
            if (this.filtros.estado) retornoParts.push('estado=' + this.filtros.estado);
            if (this.paginacion.pagina > 1) retornoParts.push('pagina=' + this.paginacion.pagina);
            
            var retornoString = encodeURIComponent('#Competencias/listaEdicion?' + retornoParts.join('&'));
            
            // Construir URL final con solo 3 parámetros
            var url = '#Competencias/survey?data=' + dataString + 
                    '&from=listaEdicion' + 
                    '&retorno=' + retornoString;
            
            console.log('Navegando a:', url);
            
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