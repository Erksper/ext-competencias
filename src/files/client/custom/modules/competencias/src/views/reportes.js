/**
 * reportes.js — Vista de selección de reportes de Competencias
 * ─────────────────────────────────────────────────────────────
 * FIX: gerentes/directores ahora ven correctamente los botones
 * de reporte para su propia oficina.
 */
define(['view', 'jquery', 'lib!selectize'], function (View, $) {

    // ── Patrón para equipos internos CLA (no son "oficinas reales") ──
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
            'change select[name="oficina"]':         function (e) { this.actualizarDisponibilidadReportesOficina(e); },
            'change select[name="periodo"]':         function (e) {
                this.periodoSeleccionadoId = $(e.currentTarget).val();
                this.actualizarPeriodoSeleccionado();
            },
            'click [data-action="back"]':            function () { this.getRouter().navigate('#Competencias', {trigger: true}); }
        },

        setup: function () {
            this.reportesDisponibles  = [];
            this.oficinas             = [];
            this.usuarioActual        = this.getUser();
            this.esCasaNacional       = false;
            this.esGerenteODirector   = false;
            this.esAsesor             = false;
            this.sinReporteAsesor     = false;
            this.sinReporteGerente    = false;
            this.noHayPeriodos        = false;
            this.periodoMostrado      = 'Cargando...';
            this.idOficinaUsuario     = null;
            this.nombreOficinaUsuario = null;
            this.periodos             = [];
            this.fechaInicioPeriodo   = null;
            this.fechaCierrePeriodo   = null;
            this.periodoSeleccionadoId = null;
            this.estadisticasGenerales = {
                totalEncuestas: '(Cargando...)',
                encuestasCompletas: 0,
                encuestasRevision: 0,
                encuestasIncompletas: 0
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
                self.getModelFactory().create('User', function (userModel) {
                    userModel.id = self.usuarioActual.id;
                    userModel.fetch({ relations: { roles: true, teams: true } })
                        .then(function() { resolve(userModel); }).catch(reject);
                });
            });

            var periodosPromise = new Promise(function (resolve, reject) {
                self.getCollectionFactory().create('Competencias', function (col) {
                    col.fetch({ data: { orderBy: 'fechaCierre', order: 'desc', maxSize: 500 } })
                        .then(function() { resolve(col); }).catch(reject);
                });
            });

            Promise.all([userPromise, periodosPromise]).then(function (results) {
                var userModel         = results[0];
                var periodosCollection = results[1];

                var roles = Object.values(userModel.get('rolesNames') || {}).map(function(r) { return r.toLowerCase(); });
                self.esCasaNacional     = roles.includes('casa nacional');
                self.esGerenteODirector = roles.includes('gerente') || roles.includes('director');
                self.esAsesor           = roles.includes('asesor');

                // ── FIX: capturar la oficina real del gerente/director ──
                // Buscamos el primer team que NO sea de tipo CLA (interno)
                if (self.esGerenteODirector && !self.esCasaNacional) {
                    var teamIds   = userModel.get('teamsIds')   || [];
                    var teamNames = userModel.get('teamsNames') || {};
                    var equipoReal = teamIds.find(function(id) { return !CLA_PATTERN.test(id); });
                    if (!equipoReal && teamIds.length > 0) equipoReal = teamIds[0]; // fallback
                    if (equipoReal) {
                        self.idOficinaUsuario     = equipoReal;
                        self.nombreOficinaUsuario = teamNames[equipoReal] || 'Mi Oficina';
                    }
                }

                // Procesar períodos
                self.periodos = periodosCollection.models
                    .filter(function(m) { return m.get('fechaInicio') && m.get('fechaCierre'); })
                    .map(function(m) {
                        return {
                            id:          m.id,
                            name:        'Evaluaciones ' + self.getDateTime().toDisplayDate(m.get('fechaInicio')) + ' - ' + self.getDateTime().toDisplayDate(m.get('fechaCierre')),
                            fechaInicio: m.get('fechaInicio'),
                            fechaCierre: m.get('fechaCierre')
                        };
                    });

                if (self.periodos.length === 0) {
                    self.noHayPeriodos = true;
                    self.periodoMostrado = 'Ninguno';
                    self.wait(false);
                    self.reRender();
                    return;
                }

                // Elegir período por defecto
                if (self.esAsesor && !self.esCasaNacional && !self.esGerenteODirector) {
                    self.periodoSeleccionadoId = self.periodos[0].id;
                } else {
                    var hoy = new Date().toISOString().split('T')[0];
                    var activo = self.periodos.find(function(p) { return hoy >= p.fechaInicio && hoy <= p.fechaCierre; });
                    self.periodoSeleccionadoId = (activo || self.periodos[0]).id;
                }
                self.actualizarPeriodoSeleccionado();

            }).catch(function () {
                Espo.Ui.error('Error al cargar datos iniciales.');
                self.wait(false);
            });
        },

        actualizarPeriodoSeleccionado: function () {
            var periodo = this.periodos.find(function(p) { return p.id === this.periodoSeleccionadoId; }, this);
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

            // Conteos globales (siempre necesarios para saber si hay datos)
            var fetchGerentes = $.ajax({ url: 'api/v1/Encuesta', data: {
                where: [{ type: 'equals', attribute: 'rolUsuario', value: 'gerente' }].concat(wherePeriodo),
                select: 'id', maxSize: 1
            }});
            var fetchAsesores = $.ajax({ url: 'api/v1/Encuesta', data: {
                where: [{ type: 'equals', attribute: 'rolUsuario', value: 'asesor' }].concat(wherePeriodo),
                select: 'id', maxSize: 1
            }});

            var promesas = [fetchGerentes, fetchAsesores];

            // ── Casa Nacional: estadísticas globales + lista de oficinas ──
            if (this.esCasaNacional) {
                promesas.push(
                    $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'estado', value: 'completada' }].concat(wherePeriodo), select: 'id', maxSize: 1 }}),
                    $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'estado', value: 'revision' }].concat(wherePeriodo), select: 'id', maxSize: 1 }}),
                    $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'estado', value: 'incompleta' }].concat(wherePeriodo), select: 'id', maxSize: 1 }}),
                    this._fetchTodasLasOficinas()
                );
            }

            // ── Gerente/Director: conteos de SU oficina (FIX CLAVE) ──
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

            // ── Asesor: sus propias encuestas ──
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

                // Índices según cuántas promesas extra agregamos
                var idx = self.esCasaNacional ? 6 : 2;
                var encuestasGerenteOficina = results[idx++].total || 0;
                var encuestasAsesorOficina  = results[idx++].total || 0;
                var encuestasEsteAsesor     = results[idx++].total || 0;

                // Estadísticas generales (solo Casa Nacional)
                if (self.esCasaNacional) {
                    var allTeamsModels = results[5];
                    self.estadisticasGenerales = {
                        totalEncuestas:      (results[2].total || 0) + (results[3].total || 0) + (results[4].total || 0),
                        encuestasCompletas:  results[2].total || 0,
                        encuestasRevision:   results[3].total || 0,
                        encuestasIncompletas: results[4].total || 0
                    };
                    self.oficinas = (allTeamsModels || [])
                        .filter(function(team) {
                            return !CLA_PATTERN.test(team.id) && (team.get('name') || '').toLowerCase() !== 'venezuela';
                        })
                        .map(function(team) { return { id: team.id, name: team.get('name') }; })
                        .sort(function(a, b) { return a.name.localeCompare(b.name); });
                }

                self._construirListaReportes(
                    encuestasGerente, encuestasAsesor,
                    encuestasGerenteOficina, encuestasAsesorOficina,
                    encuestasEsteAsesor
                );
                self.reRender();

            }).catch(function () {
                Espo.Ui.error('Error al cargar los datos de los reportes.');
            }).finally(function () {
                self.wait(false);
            });
        },

        _fetchTodasLasOficinas: function () {
            var self = this;
            return new Promise(function (resolve, reject) {
                var maxSize = 200, allTeams = [];
                var fetchPage = function (offset) {
                    self.getCollectionFactory().create('Team', function (col) {
                        col.maxSize = maxSize;
                        col.offset  = offset;
                        col.fetch().then(function() {
                            allTeams = allTeams.concat(col.models);
                            if (col.models.length === maxSize && allTeams.length < col.total) fetchPage(offset + maxSize);
                            else resolve(allTeams);
                        }).catch(reject);
                    });
                };
                fetchPage(0);
            });
        },

        _construirListaReportes: function (encGerente, encAsesor, encGerenteOfi, encAsesorOfi, encEsteAsesor) {
            var self     = this;
            var reportes = [];

            var base = function(tipo, titulo, desc, icono, disp, dinamico) {
                return { tipo: tipo, titulo: titulo, descripcion: desc, icono: icono, disponible: disp, esDinamico: !!dinamico };
            };

            if (this.esCasaNacional) {
                this.sinReporteGerente = encGerente === 0;
                this.sinReporteAsesor  = encAsesor  === 0;
                reportes = [
                    base('generalGerentes', 'Reporte General (Gerentes y Directores)', 'Matriz de competencias de todas las oficinas.', 'fa-globe-americas', encGerente > 0),
                    base('generalAsesores', 'Reporte General (Asesores)',               'Matriz de competencias de todas las oficinas.', 'fa-globe-americas', encAsesor  > 0),
                    base('oficinaGerentes', 'Reporte de Gerentes y Directores (Oficina)', 'Matriz por oficina seleccionada.', 'fa-user-tie', false, true),
                    base('oficinaAsesores', 'Reporte de Asesores (Oficina)',               'Matriz por oficina seleccionada.', 'fa-users',   false, true)
                ];
            }
            else if (this.esGerenteODirector) {
                // FIX: usar conteos de oficina propia, no globales
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
                if (this.oficinas.length > 0) {
                    var $selOfi = this.$el.find('select[name="oficina"]');
                    if ($selOfi.length && !$selOfi[0].selectize) {
                        $selOfi.selectize({ placeholder: 'Seleccione una oficina para filtrar', allowClear: true });
                    }
                    this.$el.find('.report-item-container[data-report-type="oficinaGerentes"]').hide();
                    this.$el.find('.report-item-container[data-report-type="oficinaAsesores"]').hide();
                }
            }

            var $selPeriodo = this.$el.find('select[name="periodo"]');
            if ($selPeriodo.length && !$selPeriodo[0].selectize) {
                $selPeriodo.selectize({ placeholder: 'Seleccione un período', allowClear: false });
                if (this.periodoSeleccionadoId) {
                    $selPeriodo[0].selectize.setValue(this.periodoSeleccionadoId, true);
                }
            }
        },

        // ════════════════════════════════════════════════════════
        //  INTERACCIONES
        // ════════════════════════════════════════════════════════
        actualizarDisponibilidadReportesOficina: function (e) {
            var self      = this;
            var oficinaId = $(e.currentTarget).val();
            var $cG = this.$el.find('.report-item-container[data-report-type="oficinaGerentes"]');
            var $cA = this.$el.find('.report-item-container[data-report-type="oficinaAsesores"]');

            this.$el.find('#no-reports-for-office-msg').remove();

            if (!oficinaId) { $cG.hide(); $cA.hide(); return; }

            this.wait(true);

            var wherePeriodo = [
                { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: this.fechaInicioPeriodo },
                { type: 'lessThanOrEquals',    attribute: 'fechaCreacion', value: this.fechaCierrePeriodo + ' 23:59:59' }
            ];
            var whereOfi = { type: 'equals', attribute: 'equipoId', value: oficinaId };

            Promise.all([
                $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'rolUsuario', value: 'gerente' }, whereOfi].concat(wherePeriodo), select: 'id', maxSize: 1 }}),
                $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'rolUsuario', value: 'asesor' },  whereOfi].concat(wherePeriodo), select: 'id', maxSize: 1 }})
            ]).then(function (res) {
                var gDis = (res[0].total || 0) > 0;
                var aDis = (res[1].total || 0) > 0;
                var nombre = $(e.currentTarget).find('option:selected').text();

                if (gDis) $cG.find('h4').text('Reporte de Gerentes y Directores (' + nombre + ')');
                $cG.toggle(gDis);
                if (aDis) $cA.find('h4').text('Reporte de Asesores (' + nombre + ')');
                $cA.toggle(aDis);

                if (!gDis && !aDis) {
                    self.$el.find('.reports-container').prepend(
                        '<div id="no-reports-for-office-msg" class="col-md-12">' +
                        '<div class="alert alert-info text-center">No hay evaluaciones para esta oficina en el período seleccionado.</div></div>'
                    );
                }
                self.wait(false);
            }).catch(function () {
                Espo.Ui.error('Error al verificar los reportes de la oficina.');
                self.wait(false);
            });
        },

        verReportePorOficina: function (tipo) {
            var oficinaId = this.$el.find('select[name="oficina"]').val();
            if (!oficinaId) { Espo.Ui.warning('Por favor, seleccione una oficina para generar el reporte.'); return; }
            var periodoId = this.periodoSeleccionadoId || this.periodos[0].id;
            this.getRouter().navigate('#Competencias/reporteBase?tipo=' + tipo + '&oficinaId=' + oficinaId + '&periodoId=' + periodoId, { trigger: true });
        },

        verReporteGeneral: function (tipo) {
            var periodoId = this.periodoSeleccionadoId || this.periodos[0].id;
            this.getRouter().navigate('#Competencias/reporteBase?tipo=' + tipo + '&periodoId=' + periodoId, { trigger: true });
        },

        data: function () {
            return {
                reportes:         this.reportesDisponibles,
                estadisticas:     this.estadisticasGenerales,
                usuario:          { name: this.usuarioActual.get('name'), type: this.usuarioActual.get('type') },
                tieneReportes:    this.reportesDisponibles.some(function(r) { return r.disponible || r.esDinamico; }),
                esCasaNacional:   this.esCasaNacional,
                esGerenteODirector: this.esGerenteODirector,
                esAsesor:         this.esAsesor,
                noHayPeriodos:    this.noHayPeriodos,
                periodos:         this.periodos,
                oficinas:         this.oficinas,
                periodoMostrado:  this.periodoMostrado,
                sinReporteAsesor: this.sinReporteAsesor,
                sinReporteGerente: this.sinReporteGerente
            };
        }
    });
});
