/**
 * reportes.js — Vista de selección de reportes de Competencias
 * ─────────────────────────────────────────────────────────────
 * Filtro CLA → Oficina via endpoints PHP dedicados
 * (mismo patrón que lista.js / CCustomerSurvey)
 */
define(['view', 'jquery', 'lib!selectize'], function (View, $) {

    var CLA_PATTERN = /^CLA\d+$/i;

    return View.extend({

        template: 'competencias:reportes',

        events: {
            'click [data-action="generalGerentes"]': function () { this.verReporteGeneral('generalGerentes'); },
            'click [data-action="generalAsesores"]': function () { this.verReporteGeneral('generalAsesores'); },
            'click [data-action="gerentes"]':        function () { this.verReporteGeneral('gerentes'); },
            'click [data-action="asesores"]':        function () { this.verReporteGeneral('asesores'); },
            'click [data-action="asesor"]':          function () { this.verReporteGeneral('asesor'); },
            'click [data-action="oficinaGerentes"]': function () { this.verReportePorOficina('oficinaGerentes'); },
            'click [data-action="oficinaAsesores"]': function () { this.verReportePorOficina('oficinaAsesores'); },
            'change select[name="periodo"]': function (e) {
                var val = $(e.currentTarget).val();
                if (val && val !== this.periodoSeleccionadoId) {
                    this.periodoSeleccionadoId = val;
                    this.actualizarPeriodoSeleccionado();
                }
            },
            'click [data-action="back"]': function () { this.getRouter().navigate('#Competencias', {trigger: true}); }
        },

        setup: function () {
            this.reportesDisponibles   = [];
            this.usuarioActual         = this.getUser();
            this.esCasaNacional        = false;
            this.esGerenteODirector    = false;
            this.esAsesor              = false;
            this.sinReporteAsesor      = false;
            this.sinReporteGerente     = false;
            this.noHayPeriodos         = false;
            this.periodoMostrado       = 'Cargando...';
            this.idOficinaUsuario      = null;
            this.nombreOficinaUsuario  = null;
            this.periodos              = [];
            this.fechaInicioPeriodo    = null;
            this.fechaCierrePeriodo    = null;
            this.periodoSeleccionadoId = null;
            this.estadisticasGenerales = {
                totalEncuestas: '(Cargando...)',
                encuestasCompletas: 0, encuestasRevision: 0, encuestasIncompletas: 0
            };

            this.wait(true);
            this.cargarDatosIniciales();
        },

        // ════════════════════════════════════════════════════════
        //  CARGA INICIAL
        // ════════════════════════════════════════════════════════
        cargarDatosIniciales: function () {
            var self = this;

            var userPromise = new Promise(function (resolve, reject) {
                self.getModelFactory().create('User', function (m) {
                    m.id = self.usuarioActual.id;
                    m.fetch({ relations: { roles: true, teams: true } })
                        .then(function () { resolve(m); }).catch(reject);
                });
            });

            var periodosPromise = new Promise(function (resolve, reject) {
                self.getCollectionFactory().create('Competencias', function (col) {
                    col.fetch({ data: { orderBy: 'fechaCierre', order: 'desc', maxSize: 500 } })
                        .then(function () { resolve(col); }).catch(reject);
                });
            });

            Promise.all([userPromise, periodosPromise]).then(function (results) {
                var userModel          = results[0];
                var periodosCollection = results[1];

                var roles = Object.values(userModel.get('rolesNames') || {}).map(function (r) { return r.toLowerCase(); });
                self.esCasaNacional     = roles.includes('casa nacional');
                self.esGerenteODirector = roles.includes('gerente') || roles.includes('director') || roles.includes('coordinador');
                self.esAsesor           = roles.includes('asesor');
                self.rolUsuario         = self._determinarRolFormateado(roles);

                // Capturar la oficina real del gerente/director (ignorar equipos CLA)
                if (self.esGerenteODirector && !self.esCasaNacional) {
                    var teamIds   = userModel.get('teamsIds')   || [];
                    var teamNames = userModel.get('teamsNames') || {};
                    var equipoReal = teamIds.find(function (id) { return !CLA_PATTERN.test(id); });
                    if (!equipoReal && teamIds.length > 0) equipoReal = teamIds[0];
                    if (equipoReal) {
                        self.idOficinaUsuario     = equipoReal;
                        self.nombreOficinaUsuario = teamNames[equipoReal] || 'Mi Oficina';
                    }
                }

                self.periodos = periodosCollection.models
                    .filter(function (m) { return m.get('fechaInicio') && m.get('fechaCierre'); })
                    .map(function (m) {
                        return {
                            id:          m.id,
                            name:        'Evaluaciones ' + self.getDateTime().toDisplayDate(m.get('fechaInicio')) + ' - ' + self.getDateTime().toDisplayDate(m.get('fechaCierre')),
                            fechaInicio: m.get('fechaInicio'),
                            fechaCierre: m.get('fechaCierre')
                        };
                    });

                if (self.periodos.length === 0) {
                    self.noHayPeriodos   = true;
                    self.periodoMostrado = 'Ninguno';
                    self.wait(false);
                    self.reRender();
                    return;
                }

                if (self.esAsesor && !self.esCasaNacional && !self.esGerenteODirector) {
                    self.periodoSeleccionadoId = self.periodos[0].id;
                } else {
                    var hoy    = new Date().toISOString().split('T')[0];
                    var activo = self.periodos.find(function (p) { return hoy >= p.fechaInicio && hoy <= p.fechaCierre; });
                    self.periodoSeleccionadoId = (activo || self.periodos[0]).id;
                }
                self.actualizarPeriodoSeleccionado();

            }).catch(function (err) {
                console.error('Error en cargarDatosIniciales:', err);
                Espo.Ui.error('Error al cargar datos iniciales.');
                self.wait(false);
            });
        },

        _determinarRolFormateado: function (roles) {
            if (roles.includes('casa nacional'))  return 'Casa Nacional';
            if (roles.includes('director'))       return 'Director';
            if (roles.includes('gerente'))        return 'Gerente';
            if (roles.includes('coordinador'))    return 'Coordinador';
            if (roles.includes('asesor'))         return 'Asesor';
            return 'Usuario';
        },

        actualizarPeriodoSeleccionado: function () {
            var periodo = this.periodos.find(function (p) { return p.id === this.periodoSeleccionadoId; }, this);
            if (!periodo) return;
            this.periodoMostrado    = this.getDateTime().toDisplayDate(periodo.fechaInicio) + ' al ' + this.getDateTime().toDisplayDate(periodo.fechaCierre);
            this.fechaInicioPeriodo = periodo.fechaInicio;
            this.fechaCierrePeriodo = periodo.fechaCierre;
            this.cargarDatosReportes(periodo.fechaInicio, periodo.fechaCierre);
        },

        // ════════════════════════════════════════════════════════
        //  CARGAR DATOS DE REPORTES
        // ════════════════════════════════════════════════════════
        cargarDatosReportes: function (fechaInicio, fechaCierre) {
            var self = this;
            var fechaCierreCompleta = fechaCierre + ' 23:59:59';
            var wherePeriodo = [
                { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: fechaInicio },
                { type: 'lessThanOrEquals',    attribute: 'fechaCreacion', value: fechaCierreCompleta }
            ];

            var fetchGerentes = $.ajax({ url: 'api/v1/Encuesta', data: {
                where: [{ type: 'equals', attribute: 'rolUsuario', value: 'gerente' }].concat(wherePeriodo),
                select: 'id', maxSize: 1
            }});
            var fetchAsesores = $.ajax({ url: 'api/v1/Encuesta', data: {
                where: [{ type: 'equals', attribute: 'rolUsuario', value: 'asesor' }].concat(wherePeriodo),
                select: 'id', maxSize: 1
            }});

            // Promesas base (índices 0 y 1)
            var promesas = [fetchGerentes, fetchAsesores];

            // Casa Nacional: estadísticas de estado (índices 2, 3, 4)
            // CLAs y oficinas se cargan APARTE en afterRender via _inicializarFiltroClasOficina
            if (this.esCasaNacional) {
                promesas.push(
                    $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'estado', value: 'completada' }].concat(wherePeriodo), select: 'id', maxSize: 1 }}),
                    $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'estado', value: 'revision'   }].concat(wherePeriodo), select: 'id', maxSize: 1 }}),
                    $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'estado', value: 'incompleta' }].concat(wherePeriodo), select: 'id', maxSize: 1 }})
                );
            }

            // Gerente/Director: encuestas de su oficina
            var fetchGerentesOficina, fetchAsesoresOficina;
            if (this.esGerenteODirector && !this.esCasaNacional && this.idOficinaUsuario) {
                var whereOficina = { type: 'equals', attribute: 'equipoId', value: this.idOficinaUsuario };
                fetchGerentesOficina = $.ajax({ url: 'api/v1/Encuesta', data: {
                    where: [{ type: 'equals', attribute: 'rolUsuario', value: 'gerente' }, whereOficina].concat(wherePeriodo),
                    select: 'id', maxSize: 1
                }});
                fetchAsesoresOficina = $.ajax({ url: 'api/v1/Encuesta', data: {
                    where: [{ type: 'equals', attribute: 'rolUsuario', value: 'asesor' }, whereOficina].concat(wherePeriodo),
                    select: 'id', maxSize: 1
                }});
            } else {
                fetchGerentesOficina = Promise.resolve({ total: 0 });
                fetchAsesoresOficina = Promise.resolve({ total: 0 });
            }

            var fetchEsteAsesor = this.esAsesor
                ? $.ajax({ url: 'api/v1/Encuesta', data: {
                    where: [{ type: 'equals', attribute: 'usuarioEvaluadoId', value: this.usuarioActual.id }].concat(wherePeriodo),
                    select: 'id', maxSize: 1
                  }})
                : Promise.resolve({ total: 0 });

            promesas.push(fetchGerentesOficina, fetchAsesoresOficina, fetchEsteAsesor);

            Promise.all(promesas).then(function (results) {
                var encuestasGerente = results[0].total || 0;
                var encuestasAsesor  = results[1].total || 0;

                // Casa Nacional: índices 2,3,4 son estadísticas → oficina empieza en 5
                // Otros roles: no hay extras → oficina empieza en 2
                var idx = self.esCasaNacional ? 5 : 2;
                var encuestasGerenteOficina = results[idx++].total || 0;
                var encuestasAsesorOficina  = results[idx++].total || 0;
                var encuestasEsteAsesor     = results[idx++].total || 0;

                if (self.esCasaNacional) {
                    self.estadisticasGenerales = {
                        totalEncuestas:       (results[2].total || 0) + (results[3].total || 0) + (results[4].total || 0),
                        encuestasCompletas:   results[2].total || 0,
                        encuestasRevision:    results[3].total || 0,
                        encuestasIncompletas: results[4].total || 0
                    };
                }

                self._construirListaReportes(
                    encuestasGerente, encuestasAsesor,
                    encuestasGerenteOficina, encuestasAsesorOficina,
                    encuestasEsteAsesor
                );
                self.reRender();

            }).catch(function (err) {
                console.error('Error en cargarDatosReportes:', err);
                Espo.Ui.error('Error al cargar los datos de los reportes.');
            }).finally(function () {
                self.wait(false);
            });
        },

        _construirListaReportes: function (encGerente, encAsesor, encGerenteOfi, encAsesorOfi, encEsteAsesor) {
            var reportes = [];

            var base = function (tipo, titulo, desc, icono, disp, dinamico) {
                return { tipo: tipo, titulo: titulo, descripcion: desc, icono: icono, disponible: disp, esDinamico: !!dinamico };
            };

            if (this.esCasaNacional) {
                this.sinReporteGerente = encGerente === 0;
                this.sinReporteAsesor  = encAsesor  === 0;
                reportes = [
                    base('generalGerentes', 'Reporte General (Gerentes y Directores)', 'Matriz de competencias de todas las oficinas.',    'fa-globe-americas', encGerente > 0),
                    base('generalAsesores', 'Reporte General (Asesores)',               'Matriz de competencias de todas las oficinas.',    'fa-globe-americas', encAsesor  > 0),
                    base('oficinaGerentes', 'Reporte de Gerentes y Directores (Oficina)', 'Seleccione una oficina para ver este reporte.', 'fa-user-tie', false, true),
                    base('oficinaAsesores', 'Reporte de Asesores (Oficina)',               'Seleccione una oficina para ver este reporte.', 'fa-users',   false, true)
                ];
            }
            else if (this.esGerenteODirector) {
                this.sinReporteGerente = encGerenteOfi === 0;
                this.sinReporteAsesor  = encAsesorOfi  === 0;
                var nombre = this.nombreOficinaUsuario || 'Mi Oficina';
                reportes = [
                    base('gerentes', 'Reporte de Gerentes y Directores (' + nombre + ')', 'Matriz de competencias de su oficina.', 'fa-user-tie', encGerenteOfi > 0),
                    base('asesores', 'Reporte de Asesores (' + nombre + ')',               'Matriz de competencias de su oficina.', 'fa-users',   encAsesorOfi  > 0)
                ];
            }
            else if (this.esAsesor) {
                this.sinReporteAsesor = encEsteAsesor === 0;
                reportes = [
                    base('asesor', 'Mi Reporte de Asesor (' + this.usuarioActual.get('name') + ')', 'Mi matriz de competencias evaluadas.', 'fa-user', encEsteAsesor > 0)
                ];
            }

            this.reportesDisponibles = reportes;
        },

        // ════════════════════════════════════════════════════════
        //  AFTER RENDER
        // ════════════════════════════════════════════════════════
        afterRender: function () {
            var self = this;

            if (this.esCasaNacional) {
                this.$el.find('.rep-card[data-report-type="oficinaGerentes"]').hide();
                this.$el.find('.rep-card[data-report-type="oficinaAsesores"]').hide();
                this._inicializarFiltroClasOficina();
            }

            var $selPeriodo = this.$el.find('select[name="periodo"]');
            if ($selPeriodo.length && !$selPeriodo[0].selectize) {
                $selPeriodo.selectize({
                    placeholder: 'Seleccione un período',
                    allowClear: false,
                    onChange: function (value) {
                        if (!value || value === self.periodoSeleccionadoId) return;
                        self.periodoSeleccionadoId = value;
                        self.actualizarPeriodoSeleccionado();
                    }
                });
                if (this.periodoSeleccionadoId) {
                    $selPeriodo[0].selectize.setValue(this.periodoSeleccionadoId, true);
                }
            }
        },

        // ════════════════════════════════════════════════════════
        //  FILTRO CLA → OFICINA (solo Casa Nacional)
        //  Mismo patrón que lista.js:
        //    getCLAs          → Competencias/action/getCLAs
        //    getOficinasByCLA → Competencias/action/getOficinasByCLA
        // ════════════════════════════════════════════════════════
        _inicializarFiltroClasOficina: function () {
            var self       = this;
            var $filtroCla = this.$el.find('#filtro-cla-reportes');
            var $filtroOfi = this.$el.find('#filtro-oficina-reportes');

            if (!$filtroCla.length || !$filtroOfi.length) return;

            $filtroCla.empty().append('<option value="">— Cargando CLAs... —</option>').prop('disabled', true);
            $filtroOfi.prop('disabled', true).html('<option value="">— Seleccionar CLA primero —</option>');

            Espo.Ajax.getRequest('Competencias/action/getCLAs')
                .then(function (response) {
                    $filtroCla.empty().append('<option value="">— Seleccionar CLA —</option>');
                    if (response.success && response.data && response.data.length > 0) {
                        response.data.forEach(function (cla) {
                            $filtroCla.append('<option value="' + cla.id + '">' + cla.name + '</option>');
                        });
                        $filtroCla.prop('disabled', false);
                    } else {
                        $filtroCla.append('<option value="">— Sin CLAs disponibles —</option>');
                    }
                })
                .catch(function (err) {
                    console.error('Error cargando CLAs:', err);
                    $filtroCla.empty().append('<option value="">— Error al cargar CLAs —</option>');
                });

            $filtroCla.on('change', function () {
                self._onClaChange($(this).val());
            });
            $filtroOfi.on('change', function () {
                self.actualizarReportesOficinaById($(this).val());
            });
        },

        _onClaChange: function (claId) {
            var self       = this;
            var $filtroOfi = this.$el.find('#filtro-oficina-reportes');

            this.$el.find('.rep-card[data-report-type="oficinaGerentes"]').hide();
            this.$el.find('.rep-card[data-report-type="oficinaAsesores"]').hide();
            this.$el.find('#no-reports-for-office-msg').remove();

            if (!claId) {
                $filtroOfi.prop('disabled', true).html('<option value="">— Seleccionar CLA primero —</option>');
                return;
            }

            $filtroOfi.prop('disabled', true).html('<option value="">— Cargando oficinas... —</option>');

            Espo.Ajax.getRequest('Competencias/action/getOficinasByCLA', { claId: claId })
                .then(function (response) {
                    $filtroOfi.empty().append('<option value="">— Seleccionar oficina —</option>');
                    if (response.success && response.data && response.data.length > 0) {
                        response.data.forEach(function (o) {
                            $filtroOfi.append('<option value="' + o.id + '">' + o.name + '</option>');
                        });
                        $filtroOfi.prop('disabled', false);
                    } else {
                        $filtroOfi.append('<option value="">— Sin oficinas en este CLA —</option>');
                        $filtroOfi.prop('disabled', true);
                    }
                })
                .catch(function (err) {
                    console.error('Error cargando oficinas:', err);
                    $filtroOfi.empty().append('<option value="">— Error al cargar oficinas —</option>');
                    $filtroOfi.prop('disabled', true);
                });
        },

        // ════════════════════════════════════════════════════════
        //  ACTUALIZAR REPORTES AL SELECCIONAR OFICINA
        // ════════════════════════════════════════════════════════
        actualizarReportesOficinaById: function (oficinaId) {
            var self = this;
            var $cG = this.$el.find('.rep-card[data-report-type="oficinaGerentes"]');
            var $cA = this.$el.find('.rep-card[data-report-type="oficinaAsesores"]');

            this.$el.find('#no-reports-for-office-msg').remove();

            if (!oficinaId) { $cG.hide(); $cA.hide(); return; }

            this.wait(true);

            var wherePeriodo = [
                { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: this.fechaInicioPeriodo },
                { type: 'lessThanOrEquals',    attribute: 'fechaCreacion', value: this.fechaCierrePeriodo + ' 23:59:59' }
            ];
            var whereOfi = { type: 'equals', attribute: 'equipoId', value: oficinaId };

            Promise.all([
                $.ajax({ url: 'api/v1/Encuesta', data: {
                    where: [{ type: 'equals', attribute: 'rolUsuario', value: 'gerente' }, whereOfi].concat(wherePeriodo),
                    select: 'id', maxSize: 1
                }}),
                $.ajax({ url: 'api/v1/Encuesta', data: {
                    where: [{ type: 'equals', attribute: 'rolUsuario', value: 'asesor' }, whereOfi].concat(wherePeriodo),
                    select: 'id', maxSize: 1
                }})
            ]).then(function (res) {
                var gDis = (res[0].total || 0) > 0;
                var aDis = (res[1].total || 0) > 0;

                var nombre = self.$el.find('#filtro-oficina-reportes option:selected').text() || 'Oficina seleccionada';

                if (gDis) {
                    $cG.find('h4').text('Reporte de Gerentes y Directores (' + nombre + ')');
                    $cG.show();
                } else {
                    $cG.hide();
                }

                if (aDis) {
                    $cA.find('h4').text('Reporte de Asesores (' + nombre + ')');
                    $cA.show();
                } else {
                    $cA.hide();
                }

                if (!gDis && !aDis) {
                    self.$el.find('.rep-grid').prepend(
                        '<div id="no-reports-for-office-msg" class="rep-aviso" style="grid-column:1/-1;">' +
                        '<i class="fas fa-info-circle"></i> ' +
                        'No hay evaluaciones para <strong>' + nombre + '</strong> en el período seleccionado.' +
                        '</div>'
                    );
                }
                self.wait(false);
            }).catch(function (err) {
                console.error('Error verificando reportes de oficina:', err);
                Espo.Ui.error('Error al verificar los reportes de la oficina.');
                self.wait(false);
            });
        },

        // ════════════════════════════════════════════════════════
        //  NAVEGACIÓN
        // ════════════════════════════════════════════════════════
        verReportePorOficina: function (tipo) {
            var oficina = this.$el.find('#filtro-oficina-reportes').val();
            if (!oficina) {
                Espo.Ui.warning('Por favor, seleccione una oficina para generar el reporte.');
                return;
            }
            var periodoId = this.periodoSeleccionadoId || this.periodos[0].id;
            this.getRouter().navigate(
                '#Competencias/reporteBase?tipo=' + tipo + '&oficinaId=' + oficina + '&periodoId=' + periodoId,
                { trigger: true }
            );
        },

        verReporteGeneral: function (tipo) {
            var periodoId = this.periodoSeleccionadoId || this.periodos[0].id;
            this.getRouter().navigate(
                '#Competencias/reporteBase?tipo=' + tipo + '&periodoId=' + periodoId,
                { trigger: true }
            );
        },

        data: function () {
            return {
                reportes:           this.reportesDisponibles,
                estadisticas:       this.estadisticasGenerales,
                usuario:            { name: this.usuarioActual.get('name'), type: this.usuarioActual.get('type') },
                tieneReportes:      this.reportesDisponibles.some(function (r) { return r.disponible || r.esDinamico; }),
                esCasaNacional:     this.esCasaNacional,
                esGerenteODirector: this.esGerenteODirector,
                esAsesor:           this.esAsesor,
                noHayPeriodos:      this.noHayPeriodos,
                periodos:           this.periodos,
                periodoMostrado:    this.periodoMostrado,
                sinReporteAsesor:   this.sinReporteAsesor,
                sinReporteGerente:  this.sinReporteGerente
            };
        }
    });
});