/**
 * reporteBase.js — Vista principal del reporte de Competencias
 * Usa PlanesAccionManager siguiendo el patrón de list.js / PermisosManager
 */
define([
    'view',
    'competencias:views/modules/planesAccionManager',
    'competencias:views/modules/cargaDatos',
    'competencias:views/modules/exportaciones'
], function (Dep, PlanesAccionManager, CargaDatos, Exportaciones) {

    return Dep.extend(

        _.extend({}, CargaDatos, Exportaciones, {

        template: 'competencias:reporteBase',

        events: {
            'click [data-action="back"]':          function () { this.getRouter().navigate('#Competencias/reports', {trigger: true}); },
            'click [data-action="exportarExcel"]': function () { this.exportarExcel(); },
            'click [data-action="exportarCSV"]':   function () { this.exportarCSV(); }
            // Los eventos del modal de planes se registran directamente dentro del manager
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
            this.textoEncabezado = this.rolObjetivo === 'gerente' ? 'Directores y/o Gerentes' : 'Asesores';
            this.tituloReporte   = 'Reporte de ' + (this.rolObjetivo === 'gerente' ? 'Gerentes y Directores' : 'Asesores');

            this.esCasaNacional              = false;
            this.esGerenteODirector          = false;
            this.esAsesor                    = false;
            this.esReporteGeneralCasaNacional = false;
            this.oficinas                    = [];
            this.totalesPorOficina           = {};
            this.totalesGenerales            = { verdes: 0, total: 0, porcentaje: 0, color: 'gris' };
            this.preguntasAgrupadas          = {};
            this.usuariosData                = [];
            this.usuariosMap                 = {};
            this.totalesPorPregunta          = {};
            this.logoOficina                 = null;
            this.nombreOficina               = null;

            // Instanciar el manager — config real se pasa en cargarDatosIniciales
            // tras resolver usuarios y categorías del reporte
            this.planesManager = new PlanesAccionManager(this, {
                modulo:   'Competencias',
                usuarios: [],
                items:    {}
            });

            this.registrarHandlebarsHelpers();
            this.wait(true);
            this.cargarDatosIniciales();
        },

        // ════════════════════════════════════════════════════════
        //  CARGA INICIAL (usuario + período)
        // ════════════════════════════════════════════════════════
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
                self.esGerenteODirector = roles.includes('gerente') || roles.includes('director');
                self.esAsesor           = roles.includes('asesor');

                // Exponer datos de usuario para que PlanesAccionManager los lea
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

                // Actualizar el manager con rol resuelto
                // usuarios e items se completan en cargarDatosReporte -> cargarPlanesAccion
                self.planesManager.actualizarConfig({ modulo: 'Competencias' });

                self.cargarDatosReporte();

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

        // ════════════════════════════════════════════════════════
        //  LOGO Y TÍTULO
        // ════════════════════════════════════════════════════════
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
                // FIX: ignorar equipos CLA para encontrar la oficina real
                var equipoReal = teamIds.find(function (id) { return !claPattern.test(id); }) || teamIds[0];
                if (equipoReal) {
                    this.oficinaIdParaFiltrar = equipoReal;
                    this.nombreOficina        = teamNames[equipoReal] || 'Mi Oficina';
                    this.tituloReporte        = 'Reporte de ' + (this.rolObjetivo === 'gerente' ? 'Gerentes y Directores' : 'Asesores') +
                                               ' (' + this.nombreOficina + ')';
                    // Propagar la oficina real al manager
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
                        self.tituloReporte = 'Reporte de ' + (self.rolObjetivo === 'gerente' ? 'Gerentes y Directores' : 'Asesores') +
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

        // ════════════════════════════════════════════════════════
        //  HELPERS HANDLEBARS
        // ════════════════════════════════════════════════════════
        registrarHandlebarsHelpers: function () {
            var self = this;
            Handlebars.registerHelper('getColumnCount', function (cat) {
                var c = 0; if (!cat) return 0;
                Object.keys(cat).forEach(function (s) { c += cat[s].length; }); return c;
            });
            Handlebars.registerHelper('getCeldaColor',    function (uid, pid) { return self.obtenerColorCelda(uid, pid); });
            Handlebars.registerHelper('lookupColor',      function (o, k) { return (o && o[k]) ? o[k].color : 'gris'; });
            Handlebars.registerHelper('withLookup',       function (o, k, opts) { return opts.fn((o && o[k]) || {}); });
            Handlebars.registerHelper('formatPorcentaje', function (p) { return Math.round(p || 0); });
            Handlebars.registerHelper('truncateText',     function (t, l) { return (!t) ? '' : (t.length > l ? t.substring(0, l) + '...' : t); });
            Handlebars.registerHelper('lookup',           function (o, k) { return o && o[k]; });
            Handlebars.registerHelper('eq',               function (a, b) { return a === b; });
        },

        // ════════════════════════════════════════════════════════
        //  LIFECYCLE
        // ════════════════════════════════════════════════════════
        afterRender: function () {
            Dep.prototype.afterRender.call(this);
            if (!this.esReporteGeneralCasaNacional) {
                this.planesManager.render();
            }
        },

        // cargarPlanesAccion es llamado desde cargaDatos al terminar de cargar.
        // Solo aplica en reportes por oficina o por usuario — no en generales.
        cargarPlanesAccion: function () {
            if (this.esReporteGeneralCasaNacional) return;

            // Construir lista de usuarios desde los datos del reporte
            var usuarios = (this.usuariosData || []).map(function (u) {
                return { id: u.userId, name: u.userName };
            });

            // Construir items/subitems desde preguntasAgrupadas
            // { 'Categoria': ['Subcategoria1', 'Subcategoria2', ...] }
            var items = {};
            var pg = this.preguntasAgrupadas || {};
            Object.keys(pg).forEach(function (cat) {
                items[cat] = Object.keys(pg[cat] || {});
            });

            this.planesManager.actualizarConfig({ usuarios: usuarios, items: items });
            this.planesManager.cargar();
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

    }) // fin _.extend
    ); // fin Dep.extend
});