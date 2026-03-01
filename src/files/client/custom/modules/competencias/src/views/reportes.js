/**
 * reportes.js — Vista de selección de reportes de Competencias
 * ─────────────────────────────────────────────────────────────
 * FIX: gerentes/directores ven correctamente los botones de su oficina.
 * FIX: selectize onchange para filtro de oficina (selector CSS actualizado
 *      a .rep-card[data-report-type] según nuevo template).
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
            // NOTA: el change del select[name="oficina"] lo maneja selectize.onChange
            // para evitar el bug donde el evento jQuery no se dispara en selects nativos ocultos.
            'change select[name="periodo"]': function (e) {
                // Fallback por si selectize no está activo
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
            this.oficinas              = [];
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
                totalEncuestas:       '(Cargando...)',
                encuestasCompletas:   0,
                encuestasRevision:    0,
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
                        .then(function () { resolve(userModel); }).catch(reject);
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
                self.esGerenteODirector = roles.includes('gerente') || roles.includes('director');
                self.esAsesor           = roles.includes('asesor');

                // Capturar la oficina real del gerente/director (ignorar equipos CLA)
                if (self.esGerenteODirector && !self.esCasaNacional) {
                    var teamIds   = userModel.get('teamsIds')   || [];
                    var teamNames = userModel.get('teamsNames') || {};
                    var equipoReal = teamIds.find(function (id) { return !CLA_PATTERN.test(id); });
                    if (!equipoReal && teamIds.length > 0) equipoReal = teamIds[0]; // fallback
                    if (equipoReal) {
                        self.idOficinaUsuario     = equipoReal;
                        self.nombreOficinaUsuario = teamNames[equipoReal] || 'Mi Oficina';
                    }
                }

                // Procesar períodos
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

                // Elegir período por defecto
                if (self.esAsesor && !self.esCasaNacional && !self.esGerenteODirector) {
                    self.periodoSeleccionadoId = self.periodos[0].id;
                } else {
                    var hoy    = new Date().toISOString().split('T')[0];
                    var activo = self.periodos.find(function (p) { return hoy >= p.fechaInicio && hoy <= p.fechaCierre; });
                    self.periodoSeleccionadoId = (activo || self.periodos[0]).id;
                }
                self.actualizarPeriodoSeleccionado();

            }).catch(function () {
                Espo.Ui.error('Error al cargar datos iniciales.');
                self.wait(false);
            });
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

            var promesas = [fetchGerentes, fetchAsesores];

            // Casa Nacional: estadísticas globales + lista de oficinas
            if (this.esCasaNacional) {
                promesas.push(
                    $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'estado', value: 'completada' }].concat(wherePeriodo), select: 'id', maxSize: 1 }}),
                    $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'estado', value: 'revision' }].concat(wherePeriodo), select: 'id', maxSize: 1 }}),
                    $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'estado', value: 'incompleta' }].concat(wherePeriodo), select: 'id', maxSize: 1 }}),
                    this._fetchTodasLasOficinas()
                );
            }

            // Gerente/Director: conteos de SU oficina
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

            // Asesor: sus propias encuestas
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

                var idx = self.esCasaNacional ? 6 : 2;
                var encuestasGerenteOficina = results[idx++].total || 0;
                var encuestasAsesorOficina  = results[idx++].total || 0;
                var encuestasEsteAsesor     = results[idx++].total || 0;

                if (self.esCasaNacional) {
                    var allTeamsModels = results[5];
                    self.estadisticasGenerales = {
                        totalEncuestas:       (results[2].total || 0) + (results[3].total || 0) + (results[4].total || 0),
                        encuestasCompletas:   results[2].total || 0,
                        encuestasRevision:    results[3].total || 0,
                        encuestasIncompletas: results[4].total || 0
                    };
                    self.oficinas = (allTeamsModels || [])
                        .filter(function (team) {
                            return !CLA_PATTERN.test(team.id) && (team.get('name') || '').toLowerCase() !== 'venezuela';
                        })
                        .map(function (team) { return { id: team.id, name: team.get('name') }; })
                        .sort(function (a, b) { return a.name.localeCompare(b.name); });
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
                        col.fetch().then(function () {
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
            var reportes = [];

            var base = function (tipo, titulo, desc, icono, disp, dinamico) {
                return { tipo: tipo, titulo: titulo, descripcion: desc, icono: icono, disponible: disp, esDinamico: !!dinamico };
            };

            if (this.esCasaNacional) {
                this.sinReporteGerente = encGerente === 0;
                this.sinReporteAsesor  = encAsesor  === 0;
                reportes = [
                    base('generalGerentes', 'Reporte General (Gerentes y Directores)', 'Matriz de competencias de todas las oficinas.',  'fa-globe-americas', encGerente > 0),
                    base('generalAsesores', 'Reporte General (Asesores)',               'Matriz de competencias de todas las oficinas.',  'fa-globe-americas', encAsesor  > 0),
                    // Las dos tarjetas de oficina son dinámicas: aparecen al seleccionar oficina
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
                // Las tarjetas de oficina siempre ocultas hasta que el usuario elige una
                // SELECTOR ACTUALIZADO: .rep-card (nuevo template) en vez de .report-item-container
                this.$el.find('.rep-card[data-report-type="oficinaGerentes"]').hide();
                this.$el.find('.rep-card[data-report-type="oficinaAsesores"]').hide();

                if (this.oficinas.length > 0) {
                    var $selOfi = this.$el.find('select[name="oficina"]');
                    if ($selOfi.length && !$selOfi[0].selectize) {
                        $selOfi.selectize({
                            placeholder: 'Seleccione una oficina...',
                            allowEmptyOption: true,
                            // FIX: usar onChange de selectize, no el evento change del <select> nativo
                            // ya que selectize oculta el <select> real y el evento jQuery no llega.
                            onChange: function (value) {
                                self.actualizarReportesOficinaById(value);
                            }
                        });
                    }
                }
            }

            // Select de período
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
        //  FILTRO DE OFICINA — lógica central
        // ════════════════════════════════════════════════════════

        /**
         * Recibe el ID de la oficina directamente (desde selectize.onChange).
         * Consulta si hay encuestas y muestra/oculta las tarjetas de reporte.
         */
        actualizarReportesOficinaById: function (oficinaId) {
            var self = this;

            // SELECTOR ACTUALIZADO: .rep-card (nuevo template)
            var $cG = this.$el.find('.rep-card[data-report-type="oficinaGerentes"]');
            var $cA = this.$el.find('.rep-card[data-report-type="oficinaAsesores"]');

            // Limpiar mensaje anterior
            this.$el.find('#no-reports-for-office-msg').remove();

            if (!oficinaId) {
                $cG.hide();
                $cA.hide();
                return;
            }

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

                // Obtener nombre de la oficina desde la lista ya cargada
                var oficina = self.oficinas.find(function (o) { return o.id === oficinaId; });
                var nombre  = oficina ? oficina.name : 'Oficina seleccionada';

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
            }).catch(function () {
                Espo.Ui.error('Error al verificar los reportes de la oficina.');
                self.wait(false);
            });
        },

        // Mantenido por compatibilidad (el evento change del select nativo ya no se usa con selectize)
        actualizarDisponibilidadReportesOficina: function (e) {
            var oficinaId = $(e.currentTarget).val();
            this.actualizarReportesOficinaById(oficinaId);
        },

        // ════════════════════════════════════════════════════════
        //  NAVEGACIÓN
        // ════════════════════════════════════════════════════════
        verReportePorOficina: function (tipo) {
            // Leer el valor desde selectize si está activo
            var $sel    = this.$el.find('select[name="oficina"]');
            var oficina = ($sel.length && $sel[0].selectize) ? $sel[0].selectize.getValue() : $sel.val();

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

        // ════════════════════════════════════════════════════════
        //  DATA PARA EL TEMPLATE
        // ════════════════════════════════════════════════════════
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
                oficinas:           this.oficinas,
                periodoMostrado:    this.periodoMostrado,
                sinReporteAsesor:   this.sinReporteAsesor,
                sinReporteGerente:  this.sinReporteGerente
            };
        }
    });
});