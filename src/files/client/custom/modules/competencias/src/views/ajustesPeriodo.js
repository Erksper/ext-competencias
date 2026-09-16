// client/custom/modules/competencias/src/views/ajustesPeriodo.js
define(['view'], function (View) {

    return View.extend({

        template: 'competencias:ajustesPeriodo',

        events: {
            'click [data-action="volver"]': function () {
                this.getRouter().navigate('#Competencias', { trigger: true });
            },

            'change #fecha-cierre-ajuste-input': function (e) {
                this._validarNuevaFechaCierre($(e.currentTarget).val());
            },

            'click [data-action="guardarFechaCierre"]': function () {
                this._guardarFechaCierre();
            },

            'change #periodo-anterior-select': function (e) {
                this.periodoAnteriorId = $(e.currentTarget).val() || null;
                this._actualizarBotonCrear();
            },

            'change #cla-anterior-select': function (e) {
                this.claAnteriorId = $(e.currentTarget).val() || null;
                this.oficinaAnteriorId = null;
                this.usuarioAnteriorId = null;
                this._actualizarBotonCrear();
                this._cargarOficinasAnterior(this.claAnteriorId);
            },

            'change #oficina-anterior-select': function (e) {
                this.oficinaAnteriorId = $(e.currentTarget).val() || null;
                this.usuarioAnteriorId = null;
                this._actualizarBotonCrear();
                this._cargarUsuariosAnterior(this.oficinaAnteriorId);
            },

            'change #usuario-anterior-select': function (e) {
                this.usuarioAnteriorId = $(e.currentTarget).val() || null;
                this._actualizarBotonCrear();
            },

            'click [data-action="crearEvaluacionAnterior"]': function () {
                this._crearEvaluacionAnterior();
            }
        },

        setup: function () {
            this.esCasaNacional = false;
            this.esAdmin        = this.getUser().isAdmin();
            this.accesoDenegado = false;

            this.periodos       = [];
            this.periodoActivo  = null;

            this.periodoAnteriorId = null;
            this.claAnteriorId     = null;
            this.oficinaAnteriorId = null;
            this.usuarioAnteriorId = null;

            this.wait(true);
            this._cargarPermisosYPeriodos();
        },

        _cargarPermisosYPeriodos: function () {
            var self = this;
            var user = this.getUser();

            this.getModelFactory().create('User', function (userModel) {
                userModel.id = user.id;
                userModel.fetch({ relations: { roles: true } }).then(function () {
                    var roles = Object.values(userModel.get('rolesNames') || {}).map(function (r) { return r.toLowerCase(); });
                    self.esCasaNacional = roles.includes('casa nacional');

                    if (!self.esCasaNacional && !self.esAdmin) {
                        self.accesoDenegado = true;
                        self.reRender();
                        self.wait(false);
                        return;
                    }

                    self._cargarPeriodos();
                }).catch(function () {
                    Espo.Ui.error('Error al verificar permisos.');
                    self.wait(false);
                });
            });
        },

        _cargarPeriodos: function () {
            var self = this;

            this.getCollectionFactory().create('Competencias', function (collection) {
                collection.fetch({
                    data: { maxSize: 500, orderBy: 'fechaCierre', order: 'desc' }
                }).then(function () {
                    var hoy = new Date().toISOString().split('T')[0];

                    self.periodos = (collection.models || []).map(function (m) {
                        return {
                            id: m.id,
                            fechaInicio: m.get('fechaInicio') || '',
                            fechaCierre: m.get('fechaCierre') || '',
                            label: self._formatearFecha(m.get('fechaInicio')) + ' – ' + self._formatearFecha(m.get('fechaCierre'))
                        };
                    });

                    self.periodoActivo = self.periodos.find(function (p) {
                        return p.fechaInicio && p.fechaCierre && hoy >= p.fechaInicio && hoy <= p.fechaCierre;
                    }) || null;

                    self.periodosAnteriores = self.periodos.filter(function (p) {
                        return !self.periodoActivo || p.id !== self.periodoActivo.id;
                    });

                    self.reRender();
                    self.wait(false);
                }).catch(function () {
                    Espo.Ui.error('Error al cargar los períodos.');
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
            if (this.periodosAnteriores && this.periodosAnteriores.length) {
                var $selPeriodo = this.$el.find('#periodo-anterior-select');
                $selPeriodo.empty().append('<option value="">— Seleccione un período —</option>');
                this.periodosAnteriores.forEach(function (p) {
                    $selPeriodo.append('<option value="' + p.id + '">' + p.label + '</option>');
                });
            }

            if (this.periodoActivo) {
                var manana = new Date();
                manana.setDate(manana.getDate() + 1);
                this.$el.find('#fecha-cierre-ajuste-input').attr('min', manana.toISOString().split('T')[0]);
            }

            this._cargarClas();
            this._actualizarBotonCrear();
        },

        _cargarClas: function () {
            var $selCla = this.$el.find('#cla-anterior-select');
            if (!$selCla.length) return;

            $selCla.prop('disabled', true).html('<option value="">— Cargando CLAs... —</option>');

            Espo.Ajax.getRequest('Competencias/action/getCLAs').then(function (response) {
                $selCla.empty().append('<option value="">— Seleccione un CLA —</option>');
                if (response.success && response.data && response.data.length > 0) {
                    response.data.forEach(function (cla) {
                        $selCla.append('<option value="' + cla.id + '">' + cla.name + '</option>');
                    });
                    $selCla.prop('disabled', false);
                } else {
                    $selCla.append('<option value="">— Sin CLAs disponibles —</option>');
                }
            }).catch(function () {
                $selCla.empty().append('<option value="">— Error al cargar CLAs —</option>');
            });
        },

        _validarNuevaFechaCierre: function (nuevaFecha) {
            var $btn = this.$el.find('[data-action="guardarFechaCierre"]');

            if (!this.periodoActivo || !nuevaFecha) {
                $btn.prop('disabled', true);
                return;
            }

            var hoy    = new Date().toISOString().split('T')[0];
            var manana = new Date();
            manana.setDate(manana.getDate() + 1);
            var mananaStr  = manana.toISOString().split('T')[0];
            var anioInicio = this.periodoActivo.fechaInicio.substring(0, 4);
            var anioNueva  = nuevaFecha.substring(0, 4);

            if (nuevaFecha < mananaStr) {
                Espo.Ui.warning('La nueva fecha de cierre debe ser posterior al día de hoy.');
                $btn.prop('disabled', true);
                return;
            }

            if (anioNueva !== anioInicio) {
                Espo.Ui.warning('La nueva fecha de cierre debe estar dentro del año ' + anioInicio + '.');
                $btn.prop('disabled', true);
                return;
            }

            $btn.prop('disabled', false);
        },

        _guardarFechaCierre: function () {
            var self = this;
            var nuevaFecha = this.$el.find('#fecha-cierre-ajuste-input').val();

            if (!this.periodoActivo || !nuevaFecha) return;

            if (!confirm('¿Confirma que desea cambiar la fecha de cierre del período activo al ' +
                this._formatearFecha(nuevaFecha) + '?')) {
                return;
            }

            var $btn = this.$el.find('[data-action="guardarFechaCierre"]');
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Guardando...');

            Espo.Ajax.getRequest('Competencias/action/actualizarFechaCierre', {
                periodoId: this.periodoActivo.id,
                nuevaFechaCierre: nuevaFecha
            }).then(function (response) {
                if (response.success) {
                    Espo.Ui.success('Fecha de cierre actualizada correctamente.');
                    self._cargarPeriodos();
                } else {
                    Espo.Ui.error(response.error || 'No se pudo actualizar la fecha de cierre.');
                    $btn.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar nueva fecha de cierre');
                }
            }).catch(function () {
                Espo.Ui.error('Error al actualizar la fecha de cierre.');
                $btn.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar nueva fecha de cierre');
            });
        },

        _cargarOficinasAnterior: function (claId) {
            var self = this;
            var $selOficina = this.$el.find('#oficina-anterior-select');
            var $selUsuario = this.$el.find('#usuario-anterior-select');

            $selUsuario.prop('disabled', true).html('<option value="">— Seleccione una oficina primero —</option>');

            if (!claId) {
                $selOficina.prop('disabled', true).html('<option value="">— Seleccione un CLA primero —</option>');
                return;
            }

            $selOficina.prop('disabled', true).html('<option value="">— Cargando oficinas... —</option>');

            Espo.Ajax.getRequest('Competencias/action/getOficinasByCLA', { claId: claId }).then(function (response) {
                $selOficina.empty().append('<option value="">— Seleccione una oficina —</option>');
                if (response.success && response.data && response.data.length > 0) {
                    response.data.forEach(function (o) {
                        $selOficina.append('<option value="' + o.id + '">' + o.name + '</option>');
                    });
                    $selOficina.prop('disabled', false);
                } else {
                    $selOficina.append('<option value="">— Sin oficinas en este CLA —</option>');
                }
            }).catch(function () {
                $selOficina.empty().append('<option value="">— Error al cargar oficinas —</option>');
            });
        },

        _cargarUsuariosAnterior: function (oficinaId) {
            var self = this;
            var $selUsuario = this.$el.find('#usuario-anterior-select');

            if (!oficinaId) {
                $selUsuario.prop('disabled', true).html('<option value="">— Seleccione una oficina primero —</option>');
                return;
            }

            $selUsuario.prop('disabled', true).html('<option value="">— Cargando usuarios... —</option>');

            Espo.Ajax.getRequest('Competencias/action/getAsesoresByOficina', { oficinaId: oficinaId }).then(function (response) {
                $selUsuario.empty().append('<option value="">— Seleccione un usuario —</option>');
                if (response.success && response.data && response.data.length > 0) {
                    self.usuariosAnterior = response.data;
                    response.data.forEach(function (u) {
                        $selUsuario.append('<option value="' + u.id + '">' + u.name + '</option>');
                    });
                    $selUsuario.prop('disabled', false);
                } else {
                    $selUsuario.append('<option value="">— Sin usuarios en esta oficina —</option>');
                }
            }).catch(function () {
                $selUsuario.empty().append('<option value="">— Error al cargar usuarios —</option>');
            });
        },

        _actualizarBotonCrear: function () {
            var listo = this.periodoAnteriorId && this.claAnteriorId && this.oficinaAnteriorId && this.usuarioAnteriorId;
            this.$el.find('[data-action="crearEvaluacionAnterior"]').prop('disabled', !listo);
        },

        _crearEvaluacionAnterior: function () {
            if (!this.periodoAnteriorId || !this.oficinaAnteriorId || !this.usuarioAnteriorId) return;

            var usuario = (this.usuariosAnterior || []).find(function (u) { return u.id === this.usuarioAnteriorId; }, this);
            if (!usuario) {
                Espo.Ui.error('Error al obtener datos del usuario seleccionado.');
                return;
            }

            var oficinaName = this.$el.find('#oficina-anterior-select option:selected').text() || 'Oficina';
            var rol = (usuario.roles && usuario.roles.includes('asesor')) ? 'asesor' : 'gerente';

            var dataParts = [
                'userId:' + usuario.id,
                'userName:' + encodeURIComponent(usuario.name),
                'role:' + rol,
                'teamId:' + this.oficinaAnteriorId,
                'teamName:' + encodeURIComponent(oficinaName)
            ];

            var dataString = encodeURIComponent(dataParts.join('|'));
            var retornoString = encodeURIComponent('#Competencias/ajustesPeriodo');

            var url = '#Competencias/survey?data=' + dataString +
                '&periodoId=' + this.periodoAnteriorId +
                '&from=ajustePeriodo&retorno=' + retornoString;

            this.getRouter().navigate(url, { trigger: true });
        },

        data: function () {
            return {
                accesoDenegado: this.accesoDenegado,
                periodoActivo: this.periodoActivo,
                hayPeriodoActivo: !!this.periodoActivo,
                periodosAnteriores: this.periodosAnteriores || []
            };
        }
    });
});
