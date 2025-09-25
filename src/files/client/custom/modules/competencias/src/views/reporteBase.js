define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:reporteBase',
        
        events: {
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias/reports', {trigger: true});
            },
            'click [data-action="exportar"]': function () {
                this.exportarReporte();
            }
        },
        
        setup: function () {
            this.tipoReporte = this.options.tipo || 'desconocido';
            this.oficinaId = this.options.oficinaId || null; 

            this.fechaInicio = null;
            this.fechaCierre = null;
            this.usuarioId = null; 
            this.oficinaIdParaFiltrar = this.oficinaId;
            
            if (this.tipoReporte.includes('gerente') || this.tipoReporte.includes('Gerente')) {
                this.rolObjetivo = 'gerente';
            } else {
                this.rolObjetivo = 'asesor';
            }
            this.tituloReporte = `Reporte de ${this.rolObjetivo === 'gerente' ? 'Gerentes y Directores' : 'Asesores'}`;

            this.esCasaNacional = false;
            this.esGerenteODirector = false;
            this.esAsesor = false;
            this.esReporteGeneralCasaNacional = false;
            this.oficinas = [];
            this.totalesPorOficina = {};
            this.totalesGenerales = { verdes: 0, total: 0, porcentaje: 0, color: 'gris' };

            this.preguntasAgrupadas = {};
            this.usuariosData = [];
            this.usuariosMap = {};
            
            this.registrarHandlebarsHelpers();
            
            this.wait(true);
            this.cargarDatosIniciales();
        },

        cargarDatosIniciales: function () {
            const promesas = [];

            const fetchUser = new Promise((resolve, reject) => {
                this.getModelFactory().create('User', (userModel) => {
                    userModel.id = this.getUser().id;
                    userModel.fetch({ relations: { roles: true, teams: true } }).then(() => resolve(userModel)).catch(reject);
                });
            });
            promesas.push(fetchUser);

            const fetchPeriodo = new Promise((resolve, reject) => {
                this.getCollectionFactory().create('Competencias', (collection) => {
                    collection.fetch({ data: { maxSize: 1, orderBy: 'fechaCierre', order: 'desc' } })
                        .then(() => resolve(collection.at(0)))
                        .catch(reject);
                });
            });
            promesas.push(fetchPeriodo);

            Promise.all(promesas).then(([userModel, periodoModel]) => {
                const roles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                this.esCasaNacional = roles.includes('casa nacional');
                this.esGerenteODirector = roles.includes('gerente') || roles.includes('director');
                this.esAsesor = roles.includes('asesor');

                if (!periodoModel) {
                    Espo.Ui.error('No se encontró un período de evaluación configurado.');
                    this.wait(false);
                    this.reRender();
                    return;
                }
                this.fechaInicio = periodoModel.get('fechaInicio');
                this.fechaCierre = periodoModel.get('fechaCierre');
                if (!this.fechaInicio || !this.fechaCierre) {
                    Espo.Ui.error('El período de evaluación está mal configurado.');
                    this.wait(false);
                    this.reRender();
                    return;
                }

                if (this.tipoReporte === 'asesor') {
                    this.usuarioId = this.getUser().id;
                    this.tituloReporte = `Mi Reporte de Asesor (${this.getUser().get('name')})`;
                } 
                else if (this.tipoReporte === 'gerentes' || this.tipoReporte === 'asesores') {
                    const teamIds = userModel.get('teamsIds') || [];
                    if (teamIds.length > 0) {
                        this.oficinaIdParaFiltrar = teamIds[0];
                        const oficinaName = (userModel.get('teamsNames') || {})[teamIds[0]] || 'Mi Oficina';
                        this.tituloReporte += ` (${oficinaName})`;
                    }
                } 
                else if (this.tipoReporte === 'oficinaGerentes' || this.tipoReporte === 'oficinaAsesores') {
                    this.getModelFactory().create('Team', (teamModel) => {
                        teamModel.id = this.oficinaId;
                        teamModel.fetch().then(() => {
                            this.tituloReporte += ` - Oficina: ${teamModel.get('name')}`;
                            this.reRender();
                        });
                    });
                }
                else if (this.tipoReporte === 'generalGerentes' || this.tipoReporte === 'generalAsesores') {
                    this.esReporteGeneralCasaNacional = true;
                }

                this.cargarDatosReporte();
            }).catch(error => {
                Espo.Ui.error('Error al cargar datos iniciales para el reporte.');
                this.wait(false);
            });
        },

        registrarHandlebarsHelpers: function () {
            var self = this;
            
            Handlebars.registerHelper('getColumnCount', function(categoria) {
                var count = 0;
                if (!categoria) return 0;
                Object.keys(categoria).forEach(function(subcategoria) {
                    count += categoria[subcategoria].length;
                });
                return count;
            });
            
            Handlebars.registerHelper('getCeldaColor', function(usuarioId, preguntaId) {
                return self.obtenerColorCelda(usuarioId, preguntaId);
            });

            Handlebars.registerHelper('lookupColor', function(obj, key) {
                if (obj && obj[key]) {
                    return obj[key].color;
                }
                return 'gris';
            });

            Handlebars.registerHelper('withLookup', function(obj, key, options) {
                const item = obj && obj[key];
                return options.fn(item || {});
            });

            Handlebars.registerHelper('formatPorcentaje', function(porcentaje) {
                return Math.round(porcentaje || 0);
            });
            
            Handlebars.registerHelper('truncateText', function(texto, longitud) {
                if (!texto) return '';
                return texto.length > longitud ? texto.substring(0, longitud) + '...' : texto;
            });
            
            Handlebars.registerHelper('lookup', function(obj, key) {
                return obj && obj[key];
            });

            Handlebars.registerHelper('eq', function(a, b) {
                return a === b;
            });
        },

        cargarDatosReporte: function () {
            if (this.esReporteGeneralCasaNacional) {
                this.tituloReporte = `Reporte General de ${this.rolObjetivo === 'gerente' ? 'Gerentes y Directores' : 'Asesores'}`;
                this.cargarDatosReporteGeneral();
            } else {
                this.cargarDatosReporteDetallado();
            }
        },

        cargarDatosReporteGeneral: function () {
            const wherePeriodo = [
                { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: this.fechaInicio },
                { type: 'lessThanOrEquals', attribute: 'fechaCreacion', value: this.fechaCierre + ' 23:59:59' }
            ];
            const whereEncuestas = [{ type: 'equals', attribute: 'rolUsuario', value: this.rolObjetivo }, ...wherePeriodo];

            const cargarPreguntas = $.ajax({
                url: 'api/v1/Pregunta',
                data: { where: [ { type: 'and', value: [ { type: 'or', value: [ { type: 'equals', attribute: 'rolObjetivo', value: this.rolObjetivo }, { type: 'contains', attribute: 'rolObjetivo', value: this.rolObjetivo } ] }, { type: 'equals', attribute: 'estaActiva', value: 1 } ] } ], orderBy: 'orden' }
            });

            const cargarOficinas = new Promise((resolve, reject) => {
                this.getCollectionFactory().create('Team', (collection) => {
                    collection.fetch({ data: { maxSize: 200 } })
                        .then(() => {                            
                            resolve(collection);
                        })
                        .catch((error) => {
                            reject(error);
                        });
                });
            });
            
            const cargarEncuestas = $.ajax({
                url: 'api/v1/Encuesta',
                data: {
                    where: whereEncuestas,
                    select: 'id,equipoId,equipoName' 
                }
            });

            Promise.all([cargarPreguntas, cargarOficinas, cargarEncuestas]).then((results) => {
                const preguntas = results[0].list || [];
                const oficinaCollection = results[1];
                const encuestas = results[2].list || [];

                if (!oficinaCollection.models) {
                    Espo.Ui.error('Error al cargar las oficinas.');
                    this.wait(false);
                    return;
                }

                this.procesarPreguntas(preguntas);

                const todasLasOficinas = oficinaCollection.models.map(team => ({
                    id: team.id,
                    name: team.get('name')
                }));

                if (encuestas.length === 0) {
                    this.oficinas = [];
                    this.procesarRespuestasGenerales([]);
                    this.wait(false);
                    this.reRender();
                    return;
                }

                const oficinasConEncuestas = new Set();
                const encuestasConOficina = [];
                
                encuestas.forEach(encuesta => {
                    if (encuesta.id && encuesta.equipoId) {
                        encuestasConOficina.push({
                            id: encuesta.id,
                            oficinaId: encuesta.equipoId,
                            oficinaName: encuesta.equipoName || 'Sin nombre'
                        });
                        oficinasConEncuestas.add(encuesta.equipoId);
                    }
                });

                this.oficinas = todasLasOficinas
                    .filter(oficina => {
                        const tieneEncuestas = oficinasConEncuestas.has(oficina.id);
                        return tieneEncuestas;
                    })
                    .sort((a, b) => a.name.localeCompare(b.name));

                if (encuestasConOficina.length === 0) {
                    this.procesarRespuestasGenerales([]);
                    this.wait(false);
                    this.reRender();
                    return;
                }

                this.cargarRespuestasParaEncuestasGeneral(encuestasConOficina);

            }).catch(error => {
                Espo.Ui.error('Error al cargar los datos del reporte general.');
                this.wait(false);
            });
        },

        cargarRespuestasParaEncuestasGeneral: function (encuestasConEquipo) {
            var promesasRespuestas = encuestasConEquipo.map(function(encuesta) {
                return $.ajax({
                    url: 'api/v1/RespuestaEncuesta',
                    data: {
                        where: [{ type: 'equals', attribute: 'encuestaId', value: encuesta.id }],
                        select: 'preguntaId,preguntaName,respuesta'
                    },
                }).then(function(respuestasData) {
                    return (respuestasData.list || []).map(function(resp) {
                        return {
                            preguntaId: resp.preguntaId,
                            respuesta: resp.respuesta,
                            'encuesta.equipoId': encuesta.oficinaId
                        }
                    });
                }).catch(function(error) {
                    return [];
                });
            });
            
           Promise.all(promesasRespuestas).then(function(respuestasPorEncuesta) {
                var todasLasRespuestas = [];
                respuestasPorEncuesta.forEach(function(respuestasEncuesta) {
                    todasLasRespuestas = todasLasRespuestas.concat(respuestasEncuesta);
                });

                this.procesarRespuestasGenerales(todasLasRespuestas);
                this.wait(false);
                this.reRender();
           }.bind(this)).catch(function(error) {
                Espo.Ui.error('Error al cargar las respuestas del reporte general.');
                this.wait(false);
           }.bind(this));
        },

        procesarRespuestasGenerales: function (respuestas) {
            if (!respuestas || respuestas.length === 0) {
                this.usuariosData = [];
                return;
            }
            
            const totalesPorOficina = {};
            const totalesGenerales = { verdes: 0, total: 0 };
            const totalesPorPregunta = {};

            this.oficinas.forEach(oficina => {
                totalesPorOficina[oficina.id] = {
                    name: oficina.name,
                    totalesPorPregunta: {},
                    totalesOficina: { verdes: 0, total: 0 }
                };
            });

            Object.values(this.preguntasAgrupadas).forEach(cat => {
                Object.values(cat).forEach(subcat => {
                    subcat.forEach(pregunta => {
                        totalesPorPregunta[pregunta.id] = { verdes: 0, total: 0 };
                        this.oficinas.forEach(oficina => {
                            totalesPorOficina[oficina.id].totalesPorPregunta[pregunta.id] = { verdes: 0, total: 0 };
                        });
                    });
                });
            });

            respuestas.forEach(resp => {
                const equipoId = resp['encuesta.equipoId'];
                const preguntaId = resp.preguntaId;
                const respuesta = resp.respuesta;

                if (equipoId && totalesPorOficina[equipoId] && totalesPorPregunta[preguntaId]) {
                    totalesPorOficina[equipoId].totalesPorPregunta[preguntaId].total++;
                    totalesPorOficina[equipoId].totalesOficina.total++;
                    totalesPorPregunta[preguntaId].total++;
                    totalesGenerales.total++;

                    if (respuesta === 'verde') {
                        totalesPorOficina[equipoId].totalesPorPregunta[preguntaId].verdes++;
                        totalesPorOficina[equipoId].totalesOficina.verdes++;
                        totalesPorPregunta[preguntaId].verdes++;
                        totalesGenerales.verdes++;
                    }
                }
            });

            this.oficinas.forEach(oficina => {
                const oficinaData = totalesPorOficina[oficina.id];
                Object.keys(oficinaData.totalesPorPregunta).forEach(preguntaId => {
                    const preguntaData = oficinaData.totalesPorPregunta[preguntaId];
                    const porcentaje = preguntaData.total > 0 ? (preguntaData.verdes / preguntaData.total) * 100 : 0;
                    preguntaData.porcentaje = porcentaje;
                    preguntaData.color = this.obtenerColorPorPorcentaje(porcentaje);
                });
                const oficinaTotalData = oficinaData.totalesOficina;
                const porcentajeOficina = oficinaTotalData.total > 0 ? (oficinaTotalData.verdes / oficinaTotalData.total) * 100 : 0;
                oficinaTotalData.porcentaje = porcentajeOficina;
                oficinaTotalData.color = this.obtenerColorPorPorcentaje(porcentajeOficina);
                
                oficina.totalesPorPregunta = oficinaData.totalesPorPregunta;
                oficina.totalesOficina = oficinaData.totalesOficina;
            });

            Object.keys(totalesPorPregunta).forEach(preguntaId => {
                const preguntaData = totalesPorPregunta[preguntaId];
                const porcentaje = preguntaData.total > 0 ? (preguntaData.verdes / preguntaData.total) * 100 : 0;
                preguntaData.porcentaje = porcentaje;
                preguntaData.color = this.obtenerColorPorPorcentaje(porcentaje);
            });

            const porcentajeGeneral = totalesGenerales.total > 0 ? (totalesGenerales.verdes / totalesGenerales.total) * 100 : 0;
            totalesGenerales.porcentaje = porcentajeGeneral;
            totalesGenerales.color = this.obtenerColorPorPorcentaje(porcentajeGeneral);

            this.totalesPorPregunta = totalesPorPregunta;
            this.totalesGenerales = totalesGenerales;
            this.usuariosData = [{}]; 
        },

        cargarDatosReporteDetallado: function () {
            const cargarPreguntas = $.ajax({
                url: 'api/v1/Pregunta',
                data: {
                    where: [ { type: 'and', value: [ { type: 'or', value: [ { type: 'equals', attribute: 'rolObjetivo', value: this.rolObjetivo }, { type: 'contains', attribute: 'rolObjetivo', value: this.rolObjetivo } ] }, { type: 'equals', attribute: 'estaActiva', value: 1 } ] } ],
                    orderBy: 'orden'
                }
            });
            
            let whereEncuestas = [{ type: 'equals', attribute: 'rolUsuario', value: this.rolObjetivo }];
            
            if (this.oficinaIdParaFiltrar) {
                whereEncuestas.push({ type: 'equals', attribute: 'equipoId', value: this.oficinaIdParaFiltrar });
            }
            if (this.usuarioId) {
                whereEncuestas.push({ type: 'equals', attribute: 'usuarioEvaluadoId', value: this.usuarioId });
            }

            if (this.fechaInicio && this.fechaCierre) {
                const fechaCierreCompleta = this.fechaCierre + ' 23:59:59';
                whereEncuestas.push({ type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: this.fechaInicio });
                whereEncuestas.push({ type: 'lessThanOrEquals', attribute: 'fechaCreacion', value: fechaCierreCompleta });
            }

            var cargarEncuestas = $.ajax({
                url: 'api/v1/Encuesta',
                data: {
                    where: whereEncuestas,
                    select: 'id,name,usuarioEvaluadoId,usuarioEvaluadoName,fechaEncuesta,porcentajeCompletado,equipoName'
                }
            });
            
            Promise.all([cargarPreguntas, cargarEncuestas]).then(function(results) {
                var preguntas = results[0].list || [];
                var encuestas = results[1].list || [];
                
                this.procesarPreguntas(preguntas);
                this.procesarEncuestas(encuestas);
                
            }.bind(this)).catch(function(error) {
                Espo.Ui.error('Error al cargar los datos del reporte');
                this.wait(false);
            }.bind(this));
        },

        procesarPreguntas: function (preguntas) {
            var agrupadas = {};
            
            preguntas.forEach(function(pregunta) {
                var categoria = pregunta.categoria || 'Sin Categoría';
                var subcategoria = pregunta.subCategoria || 'General';
                
                if (!agrupadas[categoria]) agrupadas[categoria] = {};
                if (!agrupadas[categoria][subcategoria]) agrupadas[categoria][subcategoria] = [];
                
                agrupadas[categoria][subcategoria].push({
                    id: pregunta.id,
                    texto: pregunta.textoPregunta || pregunta.name,
                    orden: pregunta.orden || 0
                });
            });
            
            Object.keys(agrupadas).forEach(function(categoria) {
                Object.keys(agrupadas[categoria]).forEach(function(subcategoria) {
                    agrupadas[categoria][subcategoria].sort((a, b) => (a.orden || 0) - (b.orden || 0));
                });
            });
            
            this.preguntasAgrupadas = agrupadas;
        },

        procesarEncuestas: function (encuestas) {
            if (encuestas.length === 0) {
                this.usuariosData = [];
                this.wait(false);
                this.reRender();
                return;
            }

            const encuestasUnicas = encuestas.map(encuesta => {
                return {
                    id: encuesta.id,
                    userId: encuesta.usuarioEvaluadoId,
                    userName: encuesta.usuarioEvaluadoName || 'Usuario sin nombre',
                    fechaEncuesta: encuesta.fechaEncuesta,
                    porcentajeCompletado: encuesta.porcentajeCompletado || 0,
                    oficinaName: encuesta.equipoName || ''
                };
            });

            this.cargarRespuestasParaEncuestas(encuestasUnicas);
        },

        cargarRespuestasParaEncuestas: function (encuestas) {
            var promesasRespuestas = encuestas.map(function(encuesta) {
                return $.ajax({
                    url: 'api/v1/RespuestaEncuesta',
                    data: {
                        where: [{ type: 'equals', attribute: 'encuestaId', value: encuesta.id }],
                        select: 'preguntaId,preguntaName,respuesta'
                    }
                }).then(function(respuestasData) {
                    encuesta.respuestas = {};
                    (respuestasData.list || []).forEach(function(resp) {
                        encuesta.respuestas[resp.preguntaId] = resp.respuesta;
                    });
                    return encuesta;
                });
            });
            
            Promise.all(promesasRespuestas).then(function(encuestasConRespuestas) {
                this.usuariosData = encuestasConRespuestas;
                this.usuariosMap = {};
                this.usuariosData.forEach(u => { this.usuariosMap[u.userId] = u; });

                this.calcularTotales();
                this.wait(false);
                this.reRender();
            }.bind(this)).catch(function(error) {
                this.usuariosData = [];
                this.wait(false);
                this.reRender();
            }.bind(this));
        },

        calcularTotales: function () {
            var totalPorPregunta = {};
            var todasLasPreguntas = [];
            
            Object.keys(this.preguntasAgrupadas).forEach(categoria => {
                Object.keys(this.preguntasAgrupadas[categoria]).forEach(subcategoria => {
                    this.preguntasAgrupadas[categoria][subcategoria].forEach(pregunta => {
                        todasLasPreguntas.push(pregunta.id);
                    });
                });
            });
            
            todasLasPreguntas.forEach(preguntaId => {
                var verdes = 0;
                var total = 0;
                this.usuariosData.forEach(usuario => {
                    if (usuario.respuestas[preguntaId]) {
                        total++;
                        if (usuario.respuestas[preguntaId] === 'verde') verdes++;
                    }
                });
                var porcentaje = total > 0 ? (verdes / total) * 100 : 0;
                totalPorPregunta[preguntaId] = {
                    verdes: verdes,
                    total: total,
                    porcentaje: porcentaje,
                    color: this.obtenerColorPorPorcentaje(porcentaje)
                };
            });
            
            this.usuariosData.forEach(usuario => {
                var verdes = 0;
                var total = 0;
                todasLasPreguntas.forEach(preguntaId => {
                    if (usuario.respuestas[preguntaId]) {
                        total++;
                        if (usuario.respuestas[preguntaId] === 'verde') verdes++;
                    }
                });
                var porcentaje = total > 0 ? (verdes / total) * 100 : 0;
                usuario.totales = {
                    verdes: verdes,
                    total: total,
                    porcentaje: porcentaje,
                    color: this.obtenerColorPorPorcentaje(porcentaje)
                };
            });
            
            this.totalesPorPregunta = totalPorPregunta;
        },

        obtenerColorPorPorcentaje: function (porcentaje) {
            if (porcentaje >= 80) return 'verde';
            if (porcentaje >= 60) return 'amarillo';
            return 'rojo';
        },

        obtenerColorCelda: function (usuarioId, preguntaId) {
            var usuario = this.usuariosMap[usuarioId];
            if (!usuario || !usuario.respuestas[preguntaId]) return 'gris';
            return usuario.respuestas[preguntaId];
        },

        exportarReporte: function () {
            Espo.Ui.notify('Funcionalidad de exportación pendiente de implementación', 'info');
        },

        data: function () {
            return {
                tituloReporte: this.tituloReporte,
                tipoReporte: this.tipoReporte,
                rolObjetivo: this.rolObjetivo,
                preguntas: this.preguntasAgrupadas,
                usuarios: this.usuariosData,
                totalesPorPregunta: this.totalesPorPregunta,
                tienedatos: (this.usuariosData && this.usuariosData.length > 0) || (this.esReporteGeneralCasaNacional && this.oficinas.length > 0),
                totalUsuarios: this.usuariosData ? this.usuariosData.length : 0,
                esReporteGeneralCasaNacional: this.esReporteGeneralCasaNacional,
                oficinas: this.oficinas,
                totalesPorOficina: this.totalesPorOficina,
                totalesGenerales: this.totalesGenerales
            };
        }
    });
});
