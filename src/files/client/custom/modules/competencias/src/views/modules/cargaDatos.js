/**
 * Módulo reutilizable: Carga de Datos de Reporte
 * ─────────────────────────────────────────────────
 * Maneja toda la lógica de fetching de encuestas, preguntas y respuestas.
 *
 * Requiere que la view host tenga:
 *   this.rolObjetivo, this.fechaInicio, this.fechaCierre,
 *   this.oficinaIdParaFiltrar, this.usuarioId,
 *   this.esReporteGeneralCasaNacional
 */
define([], function () {

    return {

        // ════════════════════════════════════════════════════════
        //  DESPACHAR CARGA SEGÚN TIPO
        // ════════════════════════════════════════════════════════
        cargarDatosReporte: function () {
            if (this.esReporteGeneralCasaNacional) {
                this.tituloReporte = 'Reporte General de ' + (this.rolObjetivo === 'gerente' ? 'Gerentes y Directores' : 'Asesores');
                this.cargarDatosReporteGeneral();
            } else {
                this.cargarDatosReporteDetallado();
            }
        },

        // ════════════════════════════════════════════════════════
        //  REPORTE GENERAL (Casa Nacional — todas las oficinas)
        // ════════════════════════════════════════════════════════
        cargarDatosReporteGeneral: function () {
            var self = this;
            var wherePeriodo = [
                { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: this.fechaInicio },
                { type: 'lessThanOrEquals',    attribute: 'fechaCreacion', value: this.fechaCierre + ' 23:59:59' }
            ];
            var whereEncuestas = [{ type: 'equals', attribute: 'rolUsuario', value: this.rolObjetivo }].concat(wherePeriodo);

            var cargarPreguntas = $.ajax({
                url: 'api/v1/Pregunta',
                data: {
                    where: [{ type: 'and', value: [
                        { type: 'or', value: [
                            { type: 'equals', attribute: 'rolObjetivo', value: this.rolObjetivo },
                            { type: 'contains', attribute: 'rolObjetivo', value: this.rolObjetivo }
                        ]},
                        { type: 'equals', attribute: 'estaActiva', value: 1 }
                    ]}],
                    orderBy: 'orden'
                }
            });

            var cargarOficinas = function () {
                return new Promise(function (resolve, reject) {
                    var maxSize = 200, allTeams = [];
                    var fetchPage = function (offset) {
                        self.getCollectionFactory().create('Team', function (col) {
                            col.fetch({ data: { maxSize: maxSize, offset: offset } }).then(function () {
                                allTeams = allTeams.concat(col.models);
                                if (col.models.length < maxSize) resolve(allTeams);
                                else fetchPage(offset + maxSize);
                            }).catch(reject);
                        });
                    };
                    fetchPage(0);
                });
            };

            var cargarEncuestas = $.ajax({
                url: 'api/v1/Encuesta',
                data: { where: whereEncuestas, select: 'id,equipoId,equipoName' }
            });

            Promise.all([cargarPreguntas, cargarOficinas(), cargarEncuestas]).then(function (results) {
                var preguntas      = results[0].list || [];
                var allTeamsModels = results[1];
                var encuestas      = results[2].list || [];

                self.procesarPreguntas(preguntas);

                var claPattern = /^CLA\d+$/i;
                var todasLasOficinas = allTeamsModels
                    .filter(function(team) {
                        return !claPattern.test(team.id) && (team.get('name') || '').toLowerCase() !== 'venezuela';
                    })
                    .map(function(team) { return { id: team.id, name: team.get('name') }; });

                if (encuestas.length === 0) {
                    self.oficinas = [];
                    self.procesarRespuestasGenerales([]);
                    self.wait(false);
                    self.reRender();
                    return;
                }

                var oficinasConEncuestas = new Set();
                var encuestasConOficina  = [];
                encuestas.forEach(function(e) {
                    if (e.id && e.equipoId) {
                        encuestasConOficina.push({ id: e.id, oficinaId: e.equipoId, oficinaName: e.equipoName || 'Sin nombre' });
                        oficinasConEncuestas.add(e.equipoId);
                    }
                });

                self.oficinas = todasLasOficinas
                    .filter(function(o) { return oficinasConEncuestas.has(o.id); })
                    .sort(function(a, b) { return a.name.localeCompare(b.name); });

                if (encuestasConOficina.length === 0) {
                    self.procesarRespuestasGenerales([]);
                    self.wait(false);
                    self.reRender();
                    return;
                }

                self.cargarRespuestasParaEncuestasGeneral(encuestasConOficina);
            }).catch(function () {
                Espo.Ui.error('Error al cargar los datos del reporte general.');
                self.wait(false);
            });
        },

        cargarRespuestasParaEncuestasGeneral: function (encuestasConEquipo) {
            var self = this;
            var promesas = encuestasConEquipo.map(function(encuesta) {
                return $.ajax({
                    url: 'api/v1/RespuestaEncuesta',
                    data: {
                        where: [{ type: 'equals', attribute: 'encuestaId', value: encuesta.id }],
                        select: 'preguntaId,preguntaName,respuesta'
                    }
                }).then(function(resp) {
                    return (resp.list || []).map(function(r) {
                        return { preguntaId: r.preguntaId, respuesta: r.respuesta, 'encuesta.equipoId': encuesta.oficinaId };
                    });
                }).catch(function() { return []; });
            });

            Promise.all(promesas).then(function (respuestasPorEncuesta) {
                var todas = [];
                respuestasPorEncuesta.forEach(function(r) { todas = todas.concat(r); });
                self.procesarRespuestasGenerales(todas);
                self.wait(false);
                self.reRender();
                self.cargarPlanesAccion();
            }).catch(function () {
                Espo.Ui.error('Error al cargar las respuestas del reporte general.');
                self.wait(false);
            });
        },

        procesarRespuestasGenerales: function (respuestas) {
            var self = this;
            if (!respuestas || respuestas.length === 0) { this.usuariosData = []; return; }

            var totalesPorOficina  = {};
            var totalesGenerales   = { verdes: 0, total: 0 };
            var totalesPorPregunta = {};

            this.oficinas.forEach(function(o) {
                totalesPorOficina[o.id] = { name: o.name, totalesPorPregunta: {}, totalesOficina: { verdes: 0, total: 0 } };
            });

            Object.values(this.preguntasAgrupadas).forEach(function(cat) {
                Object.values(cat).forEach(function(subcat) {
                    subcat.forEach(function(p) {
                        totalesPorPregunta[p.id] = { verdes: 0, total: 0 };
                        self.oficinas.forEach(function(o) {
                            totalesPorOficina[o.id].totalesPorPregunta[p.id] = { verdes: 0, total: 0 };
                        });
                    });
                });
            });

            respuestas.forEach(function(resp) {
                var oid = resp['encuesta.equipoId'];
                var pid = resp.preguntaId;
                if (oid && totalesPorOficina[oid] && totalesPorPregunta[pid]) {
                    totalesPorOficina[oid].totalesPorPregunta[pid].total++;
                    totalesPorOficina[oid].totalesOficina.total++;
                    totalesPorPregunta[pid].total++;
                    totalesGenerales.total++;
                    if (resp.respuesta === 'verde') {
                        totalesPorOficina[oid].totalesPorPregunta[pid].verdes++;
                        totalesPorOficina[oid].totalesOficina.verdes++;
                        totalesPorPregunta[pid].verdes++;
                        totalesGenerales.verdes++;
                    }
                }
            });

            self.oficinas.forEach(function(o) {
                var od = totalesPorOficina[o.id];
                Object.keys(od.totalesPorPregunta).forEach(function(pid) {
                    var pd = od.totalesPorPregunta[pid];
                    pd.porcentaje = pd.total > 0 ? (pd.verdes / pd.total) * 100 : 0;
                    pd.color = self.obtenerColorPorPorcentaje(pd.porcentaje);
                });
                var otd = od.totalesOficina;
                otd.porcentaje = otd.total > 0 ? (otd.verdes / otd.total) * 100 : 0;
                otd.color = self.obtenerColorPorPorcentaje(otd.porcentaje);
                o.totalesPorPregunta = od.totalesPorPregunta;
                o.totalesOficina     = od.totalesOficina;
            });

            Object.keys(totalesPorPregunta).forEach(function(pid) {
                var pd = totalesPorPregunta[pid];
                pd.porcentaje = pd.total > 0 ? (pd.verdes / pd.total) * 100 : 0;
                pd.color = self.obtenerColorPorPorcentaje(pd.porcentaje);
            });

            var pg = totalesGenerales.total > 0 ? (totalesGenerales.verdes / totalesGenerales.total) * 100 : 0;
            totalesGenerales.porcentaje = pg;
            totalesGenerales.color      = self.obtenerColorPorPorcentaje(pg);

            this.totalesPorPregunta = totalesPorPregunta;
            this.totalesGenerales   = totalesGenerales;
            this.usuariosData       = [{}];
        },

        // ════════════════════════════════════════════════════════
        //  REPORTE DETALLADO (por oficina o usuario)
        // ════════════════════════════════════════════════════════
        cargarDatosReporteDetallado: function () {
            var self = this;
            var cargarPreguntas = $.ajax({
                url: 'api/v1/Pregunta',
                data: { where: [{ type: 'and', value: [
                    { type: 'or', value: [
                        { type: 'equals', attribute: 'rolObjetivo', value: this.rolObjetivo },
                        { type: 'contains', attribute: 'rolObjetivo', value: this.rolObjetivo }
                    ]},
                    { type: 'equals', attribute: 'estaActiva', value: 1 }
                ]}], orderBy: 'orden' }
            });

            var whereEncuestas = [{ type: 'equals', attribute: 'rolUsuario', value: this.rolObjetivo }];
            if (this.oficinaIdParaFiltrar) whereEncuestas.push({ type: 'equals', attribute: 'equipoId', value: this.oficinaIdParaFiltrar });
            if (this.usuarioId)           whereEncuestas.push({ type: 'equals', attribute: 'usuarioEvaluadoId', value: this.usuarioId });
            if (this.fechaInicio && this.fechaCierre) {
                whereEncuestas.push({ type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: this.fechaInicio });
                whereEncuestas.push({ type: 'lessThanOrEquals',    attribute: 'fechaCreacion', value: this.fechaCierre + ' 23:59:59' });
            }

            var cargarEncuestas = $.ajax({
                url: 'api/v1/Encuesta',
                data: { where: whereEncuestas, select: 'id,name,usuarioEvaluadoId,usuarioEvaluadoName,fechaEncuesta,porcentajeCompletado,equipoName' }
            });

            Promise.all([cargarPreguntas, cargarEncuestas]).then(function(results) {
                self.procesarPreguntas(results[0].list || []);
                self.procesarEncuestas(results[1].list || []);
            }).catch(function() {
                Espo.Ui.error('Error al cargar los datos del reporte');
                self.wait(false);
            });
        },

        procesarPreguntas: function (preguntas) {
            var agrupadas = {};
            preguntas.forEach(function(p) {
                var cat = p.categoria    || 'Sin Categoría';
                var sub = p.subCategoria || 'General';
                if (!agrupadas[cat])      agrupadas[cat]      = {};
                if (!agrupadas[cat][sub]) agrupadas[cat][sub] = [];
                agrupadas[cat][sub].push({ id: p.id, texto: p.textoPregunta || p.name, orden: p.orden || 0 });
            });
            Object.keys(agrupadas).forEach(function(cat) {
                Object.keys(agrupadas[cat]).forEach(function(sub) {
                    agrupadas[cat][sub].sort(function(a, b) { return (a.orden || 0) - (b.orden || 0); });
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
            var promesas = encuestas.map(function(encuesta) {
                return $.ajax({
                    url: 'api/v1/RespuestaEncuesta',
                    data: {
                        where: [{ type: 'equals', attribute: 'encuestaId', value: encuesta.id }],
                        select: 'preguntaId,preguntaName,respuesta'
                    }
                }).then(function(resp) {
                    encuesta.respuestas = {};
                    (resp.list || []).forEach(function(r) { encuesta.respuestas[r.preguntaId] = r.respuesta; });
                    return encuesta;
                });
            });

            Promise.all(promesas).then(function(encuestasConRespuestas) {
                self.usuariosData = encuestasConRespuestas;
                self.usuariosMap  = {};
                self.usuariosData.forEach(function(u) { self.usuariosMap[u.userId] = u; });
                self.calcularTotales();
                self.wait(false);
                self.reRender();
                self.cargarPlanesAccion();
            }).catch(function() {
                self.usuariosData = [];
                self.wait(false);
                self.reRender();
            });
        },

        calcularTotales: function () {
            var self = this;
            var todasLasPreguntas = [];
            var totalPorPregunta  = {};

            Object.keys(this.preguntasAgrupadas).forEach(function(cat) {
                Object.keys(self.preguntasAgrupadas[cat]).forEach(function(sub) {
                    self.preguntasAgrupadas[cat][sub].forEach(function(p) { todasLasPreguntas.push(p.id); });
                });
            });

            todasLasPreguntas.forEach(function(pid) {
                var verdes = 0, total = 0;
                self.usuariosData.forEach(function(u) {
                    if (u.respuestas[pid]) {
                        total++;
                        if (u.respuestas[pid] === 'verde') verdes++;
                    }
                });
                var pct = total > 0 ? (verdes / total) * 100 : 0;
                totalPorPregunta[pid] = { verdes: verdes, total: total, porcentaje: pct, color: self.obtenerColorPorPorcentaje(pct) };
            });

            this.usuariosData.forEach(function(u) {
                var verdes = 0, total = 0;
                todasLasPreguntas.forEach(function(pid) {
                    if (u.respuestas[pid]) {
                        total++;
                        if (u.respuestas[pid] === 'verde') verdes++;
                    }
                });
                var pct = total > 0 ? (verdes / total) * 100 : 0;
                u.totales = { verdes: verdes, total: total, porcentaje: pct, color: self.obtenerColorPorPorcentaje(pct) };
            });

            this.totalesPorPregunta = totalPorPregunta;
        },

        obtenerColorPorPorcentaje: function (porcentaje) {
            if (porcentaje >= 80) return 'verde';
            if (porcentaje >= 60) return 'amarillo';
            return 'rojo';
        },

        obtenerColorCelda: function (usuarioId, preguntaId) {
            var u = this.usuariosMap[usuarioId];
            if (!u || !u.respuestas[preguntaId]) return 'gris';
            return u.respuestas[preguntaId];
        }
    };
});
