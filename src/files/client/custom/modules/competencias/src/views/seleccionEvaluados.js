// client/custom/modules/competencias/src/views/seleccionEvaluados.js
define(['view'], function (View) {

    return View.extend({

        template: 'competencias:seleccionEvaluados',

        events: {
            'click [data-action="volver"]': function () {
                this.getRouter().navigate('#Competencias', { trigger: true });
            },
            'click [data-action="aplicar-filtros"]': function () {
                this.paginacion.pagina = 1;
                this._aplicarFiltros();
            },
            'click [data-action="limpiar-filtros"]': function () {
                this._limpiarFiltros();
            },
            'change #filtro-cla': function (e) {
                if (this.permisos.esCasaNacional) {
                    this._onCLAChange($(e.currentTarget).val());
                }
            }
        },

        setup: function () {
            console.log('=== SETUP SELECCION EVALUADOS INICIADO ===');
            
            this.permisos = null;
            this.periodoInfo = {
                activo: false,
                fechaInicio: null,
                fechaCierre: null,
                id: null
            };
            
            // Filtros desde URL
            this.filtrosDesdeUrl = this._parseQueryParams();
            
            this.filtros = {
                cla: this.filtrosDesdeUrl.cla || null,
                oficina: this.filtrosDesdeUrl.oficina || null,
                tipo: this.filtrosDesdeUrl.tipo || null,
                estado: this.filtrosDesdeUrl.estado || null
            };
            
            this.paginacion = {
                pagina: parseInt(this.filtrosDesdeUrl.pagina || 1),
                porPagina: 25,
                total: 0,
                totalPaginas: 0
            };
            
            this.usuarios = [];
            this.cargando = false;
            
            this.wait(true);
            this._cargarDatosIniciales();
        },

        _parseQueryParams: function () {
            var result = { cla: null, oficina: null, tipo: null, estado: null, pagina: 1 };
            var hash = window.location.hash;
            if (hash && hash.includes('?')) {
                var qs = hash.split('?')[1];
                var params = new URLSearchParams(qs);
                result.cla = params.get('cla') || null;
                result.oficina = params.get('oficina') || null;
                result.tipo = params.get('tipo') || null;
                result.estado = params.get('estado') || null;
                result.pagina = params.get('pagina') ? parseInt(params.get('pagina'), 10) : 1;
            }
            console.log('URL parseada:', result);
            return result;
        },

        _actualizarUrlConFiltros: function () {
            var qp = [];
            if (this.permisos.esCasaNacional && this.filtros.cla) qp.push('cla=' + encodeURIComponent(this.filtros.cla));
            if (this.filtros.oficina) qp.push('oficina=' + encodeURIComponent(this.filtros.oficina));
            if (this.filtros.tipo) qp.push('tipo=' + encodeURIComponent(this.filtros.tipo));
            if (this.filtros.estado) qp.push('estado=' + encodeURIComponent(this.filtros.estado));
            if (this.paginacion.pagina > 1) qp.push('pagina=' + this.paginacion.pagina);
            
            var qs = qp.length > 0 ? '?' + qp.join('&') : '';
            console.log('Actualizando URL con filtros:', this.filtros, 'QS:', qs);
            this.getRouter().navigate('#Competencias/seleccionEvaluados' + qs, { trigger: false });
        },

        _cargarDatosIniciales: function () {
            var self = this;
            
            // Cargar usuario actual y sus permisos
            Espo.Ajax.getRequest('Competencias/action/getUserInfo')
                .then(function (response) {
                    if (response.success) {
                        self.permisos = response.data;
                        console.log('Permisos cargados:', self.permisos);
                        
                        // Si es asesor, no tiene acceso
                        if (self.permisos.esAsesor && !self.permisos.esGerente && !self.permisos.esCasaNacional) {
                            Espo.Ui.warning('No tiene permisos para acceder a esta página');
                            self.getRouter().navigate('#Competencias', { trigger: true });
                            return;
                        }
                        
                        // Si es gerente, fijar su oficina
                        if (self.permisos.esGerente && !self.permisos.esCasaNacional && self.permisos.oficinaId) {
                            self.filtros.oficina = self.permisos.oficinaId;
                        }
                        
                        // Cargar período activo
                        return self._cargarPeriodoActivo();
                    } else {
                        throw new Error('Error al cargar permisos');
                    }
                })
                .then(function (periodo) {
                    self.periodoInfo = periodo;
                    console.log('Período cargado:', self.periodoInfo);
                    
                    if (!periodo.activo) {
                        self.wait(false);
                        self.reRender();
                        return;
                    }
                    
                    self.wait(false);
                })
                .catch(function (error) {
                    console.error('Error:', error);
                    Espo.Ui.error('Error al cargar datos iniciales');
                    self.wait(false);
                });
        },

        _cargarPeriodoActivo: function () {
            var self = this;
            return new Promise(function (resolve) {
                self.getCollectionFactory().create('Competencias', function (col) {
                    col.fetch({
                        data: {
                            maxSize: 1,
                            orderBy: 'fechaCierre',
                            order: 'desc',
                            where: [
                                { type: 'lessThanOrEquals', attribute: 'fechaInicio', value: new Date().toISOString().split('T')[0] },
                                { type: 'greaterThanOrEquals', attribute: 'fechaCierre', value: new Date().toISOString().split('T')[0] }
                            ]
                        }
                    }).then(function () {
                        if (col.total > 0) {
                            var p = col.at(0);
                            resolve({
                                activo: true,
                                id: p.id,
                                fechaInicio: self._formatearFecha(p.get('fechaInicio')),
                                fechaCierre: self._formatearFecha(p.get('fechaCierre')),
                                fechaInicioRaw: p.get('fechaInicio'),
                                fechaCierreRaw: p.get('fechaCierre')
                            });
                        } else {
                            resolve({ activo: false });
                        }
                    }).catch(function () {
                        resolve({ activo: false });
                    });
                });
            });
        },

        afterRender: function () {
            console.log('afterRender ejecutado');
            
            if (!this.permisos) return;
            
            // Configurar visibilidad de filtros según permisos
            this._configurarVisibilidadFiltros();
            
            if (!this.periodoInfo || !this.periodoInfo.activo) {
                return;
            }
            
            this._setupEventListeners();
            
            // Cargar filtros iniciales según permisos
            if (this.permisos.esCasaNacional) {
                this._cargarCLAs();
            }
            
            // Restaurar filtros desde URL y buscar
            this._restaurarFiltrosDesdeUrl();
        },

        _configurarVisibilidadFiltros: function () {
            // Solo Casa Nacional ve CLA y Oficina
            if (!this.permisos.esCasaNacional) {
                // Ocultar fila de CLA y Oficina
                this.$el.find('.filtro-cla-row, .filtro-oficina-row').hide();
                
                // Si es gerente, mostrar solo Tipo y Estado
                if (this.permisos.esGerente) {
                    this.$el.find('.filtro-tipo-row, .filtro-estado-row').show();
                }
            } else {
                // Casa Nacional ve todos los filtros
                this.$el.find('.filtro-cla-row, .filtro-oficina-row, .filtro-tipo-row, .filtro-estado-row').show();
            }
        },

        _setupEventListeners: function () {
            var self = this;
            if (this.permisos.esCasaNacional) {
                this.$el.find('#filtro-cla').off('change').on('change', function (e) {
                    self._onCLAChange($(e.currentTarget).val());
                });
            }
        },

        _cargarCLAs: function () {
            var self = this;
            Espo.Ajax.getRequest('Competencias/action/getCLAs')
                .then(function (response) {
                    if (response.success) {
                        var $cla = self.$el.find('#filtro-cla');
                        $cla.empty().append('<option value="">Todos los CLAs</option>');
                        response.data.forEach(function (cla) {
                            $cla.append('<option value="' + cla.id + '">' + cla.name + '</option>');
                        });
                    }
                });
        },

        _onCLAChange: function (claId) {
            var self = this;
            var $oficina = this.$el.find('#filtro-oficina');
            
            return new Promise(function (resolve) {
                if (!claId) {
                    $oficina.empty().append('<option value="">Todas las oficinas</option>').prop('disabled', false);
                    resolve();
                    return;
                }
                
                $oficina.empty().append('<option value="">Cargando...</option>').prop('disabled', true);
                
                Espo.Ajax.getRequest('Competencias/action/getOficinasByCLA', { claId: claId })
                    .then(function (response) {
                        if (response.success && response.data.length > 0) {
                            $oficina.empty().append('<option value="">Todas las oficinas</option>');
                            response.data.forEach(function (o) {
                                $oficina.append('<option value="' + o.id + '">' + o.name + '</option>');
                            });
                            $oficina.prop('disabled', false);
                        } else {
                            $oficina.empty().append('<option value="">No hay oficinas en este CLA</option>').prop('disabled', true);
                        }
                        resolve();
                    })
                    .catch(function () {
                        $oficina.empty().append('<option value="">Error al cargar</option>').prop('disabled', true);
                        resolve();
                    });
            });
        },

        _restaurarFiltrosDesdeUrl: function () {
            var self = this;
            
            // Para Casa Nacional, restaurar CLA y oficina
            if (this.permisos.esCasaNacional && this.filtros.cla) {
                var $cla = this.$el.find('#filtro-cla');
                var checkCLA = function () {
                    if ($cla.find('option[value="' + self.filtros.cla + '"]').length) {
                        $cla.val(self.filtros.cla);
                        self._onCLAChange(self.filtros.cla).then(function () {
                            // Después de cargar oficinas, restaurar la oficina seleccionada
                            if (self.filtros.oficina) {
                                self._restaurarOficinaYBuscar();
                            } else {
                                self._cargarUsuariosIniciales();
                            }
                        });
                    } else {
                        setTimeout(checkCLA, 100);
                    }
                };
                checkCLA();
            } else if (this.filtros.oficina) {
                this._restaurarOficinaYBuscar();
            } else {
                // Carga inicial: mostrar usuarios según permisos
                this._cargarUsuariosIniciales();
            }
        },

        _restaurarOficinaYBuscar: function () {
            var self = this;
            
            if (!this.filtros.oficina) {
                this._cargarUsuariosIniciales();
                return;
            }
            
            // Si es gerente y no hay select de oficina visible, buscar directamente
            if (!this.permisos.esCasaNacional) {
                if (self.filtros.tipo) self.$el.find('#filtro-tipo').val(self.filtros.tipo);
                if (self.filtros.estado) self.$el.find('#filtro-estado').val(self.filtros.estado);
                this._fetchUsuarios();
                return;
            }
            
            // Para Casa Nacional, esperar a que el select de oficina tenga la opción
            var $oficina = this.$el.find('#filtro-oficina');
            var checkOficina = function () {
                if ($oficina.find('option[value="' + self.filtros.oficina + '"]').length) {
                    $oficina.val(self.filtros.oficina);
                    if (self.filtros.tipo) self.$el.find('#filtro-tipo').val(self.filtros.tipo);
                    if (self.filtros.estado) self.$el.find('#filtro-estado').val(self.filtros.estado);
                    self._fetchUsuarios();
                } else {
                    setTimeout(checkOficina, 100);
                }
            };
            checkOficina();
        },

        _cargarUsuariosIniciales: function () {
            console.log('Cargando usuarios iniciales según permisos');
            
            // Si es Casa Nacional, mostrar todos (sin filtro de oficina)
            if (this.permisos.esCasaNacional) {
                // Por ahora, no cargamos nada hasta que seleccione filtros
                this.$el.find('#lista-usuarios-container').html(
                    '<div class="no-data-card">' +
                    '<div class="no-data-icon"><i class="fas fa-filter"></i></div>' +
                    '<h3 class="no-data-title">Seleccione filtros</h3>' +
                    '<p class="no-data-text">Utilice los filtros para buscar usuarios</p>' +
                    '</div>'
                );
                return;
            }
            
            // Si es gerente, mostrar usuarios de su oficina
            if (this.permisos.esGerente && this.permisos.oficinaId) {
                this.filtros.oficina = this.permisos.oficinaId;
                this._fetchUsuarios();
            }
        },

        _aplicarFiltros: function () {
            this.filtros = {
                cla: this.permisos.esCasaNacional ? (this.$el.find('#filtro-cla').val() || null) : null,
                oficina: this.$el.find('#filtro-oficina').val() || null,
                tipo: this.$el.find('#filtro-tipo').val() || null,
                estado: this.$el.find('#filtro-estado').val() || null
            };
            
            console.log('Aplicando filtros:', this.filtros);
            
            // Si es gerente, forzar su oficina
            if (this.permisos.esGerente && !this.permisos.esCasaNacional && this.permisos.oficinaId) {
                this.filtros.oficina = this.permisos.oficinaId;
            }
            
            // Validar que haya al menos una oficina seleccionada para no-Casa Nacional
            if (!this.permisos.esCasaNacional && !this.filtros.oficina) {
                Espo.Ui.warning('No se pudo determinar su oficina');
                return;
            }
            
            this.paginacion.pagina = 1;
            this._actualizarUrlConFiltros();
            this._fetchUsuarios();
        },

        _limpiarFiltros: function () {
            console.log('Limpiando filtros');
            
            if (this.permisos.esCasaNacional) {
                this.$el.find('#filtro-cla').val('');
                this.$el.find('#filtro-oficina').empty()
                    .append('<option value="">Todas las oficinas</option>')
                    .prop('disabled', false);
            } else if (this.permisos.esGerente && this.permisos.oficinaId) {
                this.$el.find('#filtro-oficina').val(this.permisos.oficinaId);
            }
            
            this.$el.find('#filtro-tipo').val('');
            this.$el.find('#filtro-estado').val('');
            
            this.filtros = {
                cla: null,
                oficina: this.permisos.esGerente && !this.permisos.esCasaNacional && this.permisos.oficinaId ? this.permisos.oficinaId : null,
                tipo: null,
                estado: null
            };
            
            this.paginacion.pagina = 1;
            this._actualizarUrlConFiltros();
            
            // Recargar usuarios iniciales según permisos
            this._cargarUsuariosIniciales();
        },

        _fetchUsuarios: function () {
            console.log('=== INICIO _fetchUsuarios ===');
            console.log('Filtros actuales:', this.filtros);
            
            if (this.cargando) return;
            
            // Para Casa Nacional, si no hay oficina seleccionada, no buscar
            if (this.permisos.esCasaNacional && !this.filtros.oficina) {
                this.$el.find('#lista-usuarios-container').html(
                    '<div class="no-data-card">' +
                    '<div class="no-data-icon"><i class="fas fa-building"></i></div>' +
                    '<h3 class="no-data-title">Seleccione una oficina</h3>' +
                    '<p class="no-data-text">Utilice los filtros para seleccionar una oficina</p>' +
                    '</div>'
                );
                return;
            }
            
            // Para gerentes, asegurar que tienen oficina
            if (!this.permisos.esCasaNacional && !this.filtros.oficina) {
                Espo.Ui.warning('No se pudo determinar su oficina');
                return;
            }
            
            this.cargando = true;
            
            var container = this.$el.find('#lista-usuarios-container');
            container.html(
                '<div class="text-center" style="padding:80px 20px;">' +
                '<div class="spinner-large"></div>' +
                '<h4 class="loading-title">Cargando usuarios...</h4>' +
                '<p class="loading-subtitle">Obteniendo datos del servidor</p>' +
                '</div>'
            );
            
            var self = this;
            
            // Obtener usuarios de la oficina
            Espo.Ajax.getRequest('Competencias/action/getAsesoresByOficina', {
                oficinaId: this.filtros.oficina
            }).then(function (response) {
                if (response.success) {
                    var usuarios = response.data || [];
                    console.log('Usuarios encontrados:', usuarios.length);
                    
                    // Obtener encuestas del período
                    return self._cargarEncuestas(usuarios);
                } else {
                    throw new Error(response.error || 'Error al cargar usuarios');
                }
            }).then(function (usuariosEnriquecidos) {
                console.log('Usuarios enriquecidos:', usuariosEnriquecidos.length);
                self._procesarResultados(usuariosEnriquecidos);
            }).catch(function (error) {
                console.error('Error:', error);
                self.cargando = false;
                container.html('<div class="alert alert-danger">Error al cargar usuarios: ' + (error.message || 'desconocido') + '</div>');
            });
        },

        _cargarEncuestas: function (usuarios) {
            var self = this;
            
            return new Promise(function (resolve) {
                if (!self.periodoInfo.activo) {
                    var usuariosSinEncuesta = usuarios.map(function (u) {
                        return {
                            id: u.id,
                            name: u.name,
                            userName: u.userName,
                            roles: u.roles || [],
                            tieneEncuesta: false,
                            encuestaId: null,
                            estado: 'sin_evaluacion',
                            fechaEncuesta: null,
                            porcentaje: 0
                        };
                    });
                    resolve(usuariosSinEncuesta);
                    return;
                }
                
                Espo.Ajax.getRequest('Competencias/action/getEncuestasByPeriodo', {
                    periodoId: self.periodoInfo.id,
                    oficinaId: self.filtros.oficina
                }).then(function (response) {
                    if (response.success) {
                        var encuestas = response.data || [];
                        console.log('Encuestas encontradas:', encuestas.length);
                        
                        // Crear mapa de encuestas por usuario
                        var encuestasPorUsuario = {};
                        encuestas.forEach(function (e) {
                            if (!encuestasPorUsuario[e.usuarioEvaluadoId] ||
                                new Date(e.fechaEncuesta) > new Date(encuestasPorUsuario[e.usuarioEvaluadoId].fechaEncuesta)) {
                                encuestasPorUsuario[e.usuarioEvaluadoId] = e;
                            }
                        });
                        
                        // Enriquecer usuarios
                        var usuariosEnriquecidos = usuarios.map(function (u) {
                            var encuesta = encuestasPorUsuario[u.id];
                            return {
                                id: u.id,
                                name: u.name,
                                userName: u.userName,
                                roles: u.roles || [],
                                tieneEncuesta: !!encuesta,
                                encuestaId: encuesta ? encuesta.id : null,
                                estado: encuesta ? encuesta.estado : 'sin_evaluacion',
                                fechaEncuesta: encuesta ? self._formatearFecha(encuesta.fechaEncuesta.split(' ')[0]) : null,
                                porcentaje: encuesta ? encuesta.porcentajeCompletado : 0
                            };
                        });
                        
                        resolve(usuariosEnriquecidos);
                    } else {
                        resolve(usuarios.map(function (u) {
                            return {
                                id: u.id,
                                name: u.name,
                                userName: u.userName,
                                roles: u.roles || [],
                                tieneEncuesta: false,
                                encuestaId: null,
                                estado: 'sin_evaluacion',
                                fechaEncuesta: null,
                                porcentaje: 0
                            };
                        }));
                    }
                }).catch(function () {
                    resolve(usuarios.map(function (u) {
                        return {
                            id: u.id,
                            name: u.name,
                            userName: u.userName,
                            roles: u.roles || [],
                            tieneEncuesta: false,
                            encuestaId: null,
                            estado: 'sin_evaluacion',
                            fechaEncuesta: null,
                            porcentaje: 0
                        };
                    }));
                });
            });
        },

        _procesarResultados: function (usuarios) {
            var self = this;
            
            // Aplicar filtros de tipo y estado
            var filtrados = usuarios;
            
            // Para gerentes, filtrar usuarios que NO tienen encuesta o tienen encuesta incompleta
            if (this.permisos.esGerente && !this.permisos.esCasaNacional) {
                console.log('Filtrando para gerente - mostrando solo usuarios sin evaluación o con evaluación incompleta');
                filtrados = filtrados.filter(function (u) {
                    return u.estado === 'sin_evaluacion' || u.estado === 'incompleta';
                });
            }
            
            if (this.filtros.tipo) {
                var tipoBusqueda = this.filtros.tipo === 'gerente'
                    ? ['gerente', 'director', 'coordinador']
                    : [this.filtros.tipo];
                
                filtrados = filtrados.filter(function (u) {
                    return u.roles.some(function (r) {
                        return tipoBusqueda.includes(r.toLowerCase());
                    });
                });
            }
            
            if (this.filtros.estado) {
                filtrados = filtrados.filter(function (u) {
                    return u.estado === self.filtros.estado;
                });
            }
            
            this.usuarios = filtrados;
            this.paginacion.total = filtrados.length;
            this.paginacion.totalPaginas = Math.ceil(filtrados.length / this.paginacion.porPagina);
            
            this.cargando = false;
            this._renderizarTabla();
        },

        _renderizarTabla: function () {
            var container = this.$el.find('#lista-usuarios-container');
            var pag = this.paginacion;
            var self = this;
            
            var inicio = (pag.pagina - 1) * pag.porPagina;
            var datos = this.usuarios.slice(inicio, inicio + pag.porPagina);
            
            var ini = pag.total === 0 ? 0 : inicio + 1;
            var fin = Math.min(pag.pagina * pag.porPagina, pag.total);
            this.$el.find('#total-usuarios-mostradas')
                .text(pag.total === 0 ? '0' : ini + '–' + fin + ' de ' + pag.total);
            
            if (datos.length === 0) {
                container.html(
                    '<div class="no-data-card">' +
                    '<div class="no-data-icon"><i class="fas fa-users-slash"></i></div>' +
                    '<h3 class="no-data-title">No hay usuarios</h3>' +
                    '<p class="no-data-text">No se encontraron usuarios con los filtros aplicados</p>' +
                    '</div>'
                );
                return;
            }
            
            var html = '';
            var inicioGlobal = inicio;
            
            // Grupos de 25
            var grupos = [];
            for (var g = 0; g < datos.length; g += 25) {
                grupos.push(datos.slice(g, g + 25));
            }
            
            grupos.forEach(function (grupo, gi) {
                var numGrupoGlobal = inicioGlobal + gi * 25 + 1;
                var numGrupoFin = Math.min(numGrupoGlobal + 24, pag.total);
                
                html += '<div class="grupo-encuestas">';
                html += '<div class="grupo-header">';
                html += '<i class="fas fa-layer-group" style="margin-right:8px;"></i>';
                html += 'Registros ' + numGrupoGlobal + ' – ' + numGrupoFin;
                html += '</div>';
                html += '<div class="tabla-encuestas"><table><thead><tr>';
                html += '<th style="width:50px;text-align:center;">N°</th>';
                html += '<th>Usuario</th>';
                html += '<th>Tipo</th>';
                html += '<th>Fecha última evaluación</th>';
                html += '<th>Estado</th>';
                html += '</tr></thead><tbody>';
                
                grupo.forEach(function (usuario, idx) {
                    var numItem = inicioGlobal + gi * 25 + idx + 1;
                    
                    // Determinar tipo a mostrar
                    var tipoTexto = '';
                    if (usuario.roles.includes('asesor')) {
                        tipoTexto = 'Asesor';
                    } else if (usuario.roles.includes('gerente') || usuario.roles.includes('director') || usuario.roles.includes('coordinador')) {
                        tipoTexto = 'Gerente/Director/Coord';
                    } else {
                        tipoTexto = 'Otro';
                    }
                    
                    var estadoMap = {
                        'sin_evaluacion': { texto: 'Sin evaluación', color: '#6c757d' },
                        'incompleta': { texto: 'Incompleta', color: '#e74c3c' },
                        'revision': { texto: 'En revisión', color: '#f39c12' },
                        'completada': { texto: 'Completada', color: '#27ae60' }
                    };
                    var estado = estadoMap[usuario.estado] || estadoMap.sin_evaluacion;
                    
                    html += '<tr data-usuario-id="' + usuario.id + '" data-tiene-encuesta="' + usuario.tieneEncuesta + '" data-encuesta-id="' + (usuario.encuestaId || '') + '" style="cursor:pointer;">';
                    html += '<td style="text-align:center;font-weight:600;">' + numItem + '</td>';
                    html += '<td>' + (usuario.name || usuario.userName) + '</td>';
                    html += '<td>' + tipoTexto + '</td>';
                    html += '<td>' + (usuario.fechaEncuesta || '-') + '</td>';
                    html += '<td><span class="badge" style="background:' + estado.color + ';color:white;padding:4px 8px;border-radius:4px;">' + estado.texto + '</span></td>';
                    html += '</tr>';
                });
                
                html += '</tbody></table></div></div>';
            });
            
            html += self._renderPaginacion();
            container.html(html);
            
            // Eventos click en filas
            container.find('tr[data-usuario-id]').on('click', function () {
                var usuarioId = $(this).data('usuario-id');
                var tieneEncuesta = $(this).data('tiene-encuesta') === 'true';
                var encuestaId = $(this).data('encuesta-id');
                
                self._irAEncuesta(usuarioId, tieneEncuesta, encuestaId);
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
            var total = pag.totalPaginas;
            var pages = [];
            var rango = 2;
            var ini = Math.max(2, actual - rango);
            var fin = Math.min(total - 1, actual + rango);
            
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

        _irAPagina: function (pagina) {
            if (pagina < 1 || pagina > this.paginacion.totalPaginas || this.cargando) return;
            this.paginacion.pagina = pagina;
            this._actualizarUrlConFiltros();
            this._renderizarTabla();
        },

        _irAEncuesta: function (usuarioId, tieneEncuesta, encuestaId) {
            console.log('Navegando a usuario:', usuarioId, 'tieneEncuesta:', tieneEncuesta);
            
            var usuario = this.usuarios.find(function (u) { return u.id == usuarioId; }); // Usar == para comparar string con número
            if (!usuario) {
                console.error('Usuario no encontrado en lista:', usuarioId);
                console.log('Usuarios disponibles:', this.usuarios.map(u => ({ id: u.id, name: u.name })));
                Espo.Ui.error('Error al obtener datos del usuario');
                return;
            }
            
            console.log('Usuario encontrado:', usuario);
            
            var dataParts = [
                'userId:' + usuarioId,
                'userName:' + encodeURIComponent(usuario.name || usuario.userName),
                'role:' + (usuario.roles && usuario.roles.includes('asesor') ? 'asesor' : 'gerente')
            ];
            
            if (this.filtros.oficina) {
                dataParts.push('teamId:' + this.filtros.oficina);
                var oficinaName = this.$el.find('#filtro-oficina option:selected').text() || 'Oficina';
                dataParts.push('teamName:' + encodeURIComponent(oficinaName));
            }
            
            var dataString = encodeURIComponent(dataParts.join('|'));
            
            // Construir retorno
            var retornoParts = [];
            if (this.permisos.esCasaNacional && this.filtros.cla) retornoParts.push('cla=' + this.filtros.cla);
            if (this.filtros.oficina) retornoParts.push('oficina=' + this.filtros.oficina);
            if (this.filtros.tipo) retornoParts.push('tipo=' + this.filtros.tipo);
            if (this.filtros.estado) retornoParts.push('estado=' + this.filtros.estado);
            if (this.paginacion.pagina > 1) retornoParts.push('pagina=' + this.paginacion.pagina);
            
            var retornoString = encodeURIComponent('#Competencias/seleccionEvaluados?' + retornoParts.join('&'));
            
            var url;
            if (tieneEncuesta && encuestaId) {
                url = '#Competencias/survey?data=' + dataString + '&encuestaId=' + encuestaId + '&from=seleccion&retorno=' + retornoString;
            } else {
                url = '#Competencias/survey?data=' + dataString + '&from=seleccion&retorno=' + retornoString;
            }
            
            console.log('Navegando a URL:', url);
            this.getRouter().navigate(url, { trigger: true });
        },

        _formatearFecha: function (fechaStr) {
            if (!fechaStr) return '';
            var d = new Date(fechaStr + 'T00:00:00');
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        },

        data: function () {
            return {
                periodoActivo: this.periodoInfo ? this.periodoInfo.activo : false,
                fechaInicio: this.periodoInfo ? this.periodoInfo.fechaInicio : '',
                fechaCierre: this.periodoInfo ? this.periodoInfo.fechaCierre : '',
                esCasaNacional: this.permisos ? this.permisos.esCasaNacional : false,
                esGerente: this.permisos ? this.permisos.esGerente : false,
                oficinaUsuario: this.permisos && this.permisos.esGerente ? this.permisos.oficinaId : null
            };
        }
    });
});