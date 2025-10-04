define(['view'], function (View) {
    return View.extend({
        template: 'competencias:reporteBase',
        
        events: {
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias/reports', {trigger: true});
            },
            'click [data-action="exportarExcel"]': function () {
                this.exportarExcel();
            },
            'click [data-action="exportarCSV"]': function () {
                this.exportarCSV();
            }
        },
        
        setup: function () {
            const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
            this.tipoReporte = urlParams.get('tipo') || this.options.tipo || 'desconocido';
            this.oficinaId = urlParams.get('oficinaId') || this.options.oficinaId || null;
            this.periodoId = urlParams.get('periodoId') || this.options.periodoId || null;

            this.fechaInicio = null;
            this.fechaCierre = null;
            this.usuarioId = null; 
            this.oficinaIdParaFiltrar = this.oficinaId;
            
            if (this.tipoReporte.includes('gerente') || this.tipoReporte.includes('Gerente')) {
                this.rolObjetivo = 'gerente';
                this.textoEncabezado = 'Directores y/o Gerentes';
            } else {
                this.rolObjetivo = 'asesor';
                this.textoEncabezado = 'Asesores';
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
            
            this.logoOficina = null;
            this.nombreOficina = null;
            
            this.registrarHandlebarsHelpers();
            
            this.wait(true);
            this.cargarDatosIniciales();
        },

        cargarDatosIniciales: function () {
            const promesas = [];

            const fetchUser = new Promise((resolve, reject) => {
                this.getModelFactory().create('User', (userModel) => {
                    userModel.id = this.getUser().id;
                    userModel.fetch({ relations: { roles: true, teams: true } }).then(() => {
                        resolve(userModel);
                    }).catch(reject);
                });
            });
            promesas.push(fetchUser);

            let periodoPromise;
            if (this.periodoId) {
                periodoPromise = new Promise((resolve, reject) => {
                    this.getModelFactory().create('Competencias', (periodoModel) => {
                        periodoModel.id = this.periodoId;
                        periodoModel.fetch().then(() => {
                            if (periodoModel.id) {
                                resolve(periodoModel);
                            } else {
                                this.buscarUltimoPeriodo().then(resolve).catch(reject);
                            }
                        }).catch((error) => {
                            this.buscarUltimoPeriodo().then(resolve).catch(reject);
                        });
                    });
                });
            } else {
                periodoPromise = this.buscarUltimoPeriodo();
            }
            promesas.push(periodoPromise);

            Promise.all(promesas).then(([userModel, periodoModel]) => {
                const roles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                this.esCasaNacional = roles.includes('casa nacional');
                this.esGerenteODirector = roles.includes('gerente') || roles.includes('director');
                this.esAsesor = roles.includes('asesor');

                this.periodoId = periodoModel.id;
                this.fechaInicio = periodoModel.get('fechaInicio');
                this.fechaCierre = periodoModel.get('fechaCierre');
                
                if (!this.fechaInicio || !this.fechaCierre) {
                    Espo.Ui.error('El período de evaluación está mal configurado (faltan fechas).');
                    this.wait(false);
                    this.reRender();
                    return;
                }

                const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!fechaRegex.test(this.fechaInicio) || !fechaRegex.test(this.fechaCierre)) {
                    Espo.Ui.error('El formato de las fechas del período es incorrecto.');
                    this.wait(false);
                    this.reRender();
                    return;
                }

                this.configurarLogoYTitulo(userModel);
                this.cargarDatosReporte();

            }).catch(error => {
                Espo.Ui.error('Error al cargar el período de evaluación.');
                this.wait(false);
            });
        },

        buscarUltimoPeriodo: function () {
            return new Promise((resolve, reject) => {
                this.getCollectionFactory().create('Competencias', (collection) => {
                    collection.fetch({ 
                        data: { 
                            maxSize: 1, 
                            orderBy: 'fechaCierre', 
                            order: 'desc' 
                        } 
                    }).then(() => {
                        const ultimoPeriodo = collection.at(0);
                        if (ultimoPeriodo) {
                            resolve(ultimoPeriodo);
                        } else {
                            reject(new Error('No hay períodos de evaluación configurados.'));
                        }
                    }).catch(reject);
                });
            });
        },

        configurarLogoYTitulo: function (userModel) {
            if (this.tipoReporte === 'asesor') {
                this.usuarioId = this.getUser().id;
                this.tituloReporte = `Mi Reporte de Asesor (${this.getUser().get('name')})`;
                this.buscarLogoUsuarioCasaNacional();
            } 
            else if (this.tipoReporte === 'gerentes' || this.tipoReporte === 'asesores') {
                const teamIds = userModel.get('teamsIds') || [];
                
                if (teamIds.length > 0) {
                    this.oficinaIdParaFiltrar = teamIds[0];
                    this.nombreOficina = (userModel.get('teamsNames') || {})[teamIds[0]] || 'Mi Oficina';
                    // MODIFICACIÓN: Quitar "Oficina:" del título
                    this.tituloReporte = `Reporte de ${this.rolObjetivo === 'gerente' ? 'Gerentes y Directores' : 'Asesores'} (${this.nombreOficina})`;
                    this.buscarLogoPorOficina(this.oficinaIdParaFiltrar);
                } else {
                    this.buscarLogoUsuarioCasaNacional();
                }
            } 
            else if (this.tipoReporte === 'oficinaGerentes' || this.tipoReporte === 'oficinaAsesores') {
                this.getModelFactory().create('Team', (teamModel) => {
                    teamModel.id = this.oficinaId;
                    teamModel.fetch().then(() => {
                        this.nombreOficina = teamModel.get('name');
                        // MODIFICACIÓN: Quitar "Oficina:" del título
                        this.tituloReporte = `Reporte de ${this.rolObjetivo === 'gerente' ? 'Gerentes y Directores' : 'Asesores'} - ${this.nombreOficina}`;
                        this.buscarLogoPorOficina(this.oficinaId);
                        this.reRender();
                    }).catch(() => {
                        this.buscarLogoUsuarioCasaNacional();
                        this.reRender();
                    });
                });
            }
            else if (this.tipoReporte === 'generalGerentes' || this.tipoReporte === 'generalAsesores') {
                this.esReporteGeneralCasaNacional = true;
                this.buscarLogoUsuarioCasaNacional();
            }
        },

        buscarLogoPorOficina: function(teamId) {
            const self = this;
            
            $.ajax({
                url: `api/v1/Team/${teamId}/users`,
                type: 'GET',
                data: {
                    select: 'id,name,cImagenId',
                    maxSize: 50
                },
                success: function(response) {
                    const usuarios = response.list || [];
                    const usuarioConLogo = usuarios.find(u => 
                        u.name && u.name.toLowerCase().includes('por la casa') && u.cImagenId
                    );
                    
                    if (usuarioConLogo) {
                        const basePath = self.getBasePath();
                        const imageUrl = basePath + '?entryPoint=attachment&id=' + usuarioConLogo.cImagenId;
                        self.establecerLogo(imageUrl);
                    } else {
                        const usuarioConImagen = usuarios.find(u => u.cImagenId);
                        if (usuarioConImagen) {
                            const basePath = self.getBasePath();
                            const imageUrl = basePath + '?entryPoint=attachment&id=' + usuarioConImagen.cImagenId;
                            self.establecerLogo(imageUrl);
                        } else {
                            self.buscarLogoUsuarioCasaNacional();
                        }
                    }
                },
                error: function() {
                    self.buscarLogoUsuarioCasaNacional();
                }
            });
        },

        buscarLogoUsuarioCasaNacional: function() {
            const self = this;
            
            $.ajax({
                url: 'api/v1/User/68e0a532c9a03099b',
                data: {
                    select: 'id,name,cImagenId'
                }
            }).then(function(response) {
                if (response && response.cImagenId) {
                    const basePath = self.getBasePath();
                    const imageUrl = basePath + '?entryPoint=attachment&id=' + response.cImagenId;
                    self.establecerLogo(imageUrl);
                } else {
                    self.establecerLogo(null);
                }
            }).catch(function() {
                self.establecerLogo(null);
            });
        },

        establecerLogo: function (urlLogo) {
            this.logoOficina = urlLogo;
            if (this.isRendered()) {
                this.reRender();
            }
        },

        getBasePath: function() {
            const baseTag = document.querySelector('base');
            if (baseTag && baseTag.href) {
                return baseTag.href;
            }
            
            const currentUrl = window.location.href;
            const hashIndex = currentUrl.indexOf('/#');
            
            if (hashIndex !== -1) {
                return currentUrl.substring(0, hashIndex + 1);
            }
            
            const path = window.location.pathname;
            const lastSlashIndex = path.lastIndexOf('/');
            if (lastSlashIndex > 0) {
                const basePath = path.substring(0, lastSlashIndex + 1);
                return window.location.origin + basePath;
            }
            
            return window.location.origin + '/';
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
                data: { 
                    where: [ 
                        { type: 'and', value: [ 
                            { type: 'or', value: [ 
                                { type: 'equals', attribute: 'rolObjetivo', value: this.rolObjetivo }, 
                                { type: 'contains', attribute: 'rolObjetivo', value: this.rolObjetivo } 
                            ] }, 
                            { type: 'equals', attribute: 'estaActiva', value: 1 } 
                        ] } 
                    ], 
                    orderBy: 'orden' 
                }
            });

            const cargarOficinas = () => {
                return new Promise((resolve, reject) => {
                    const maxSize = 200;
                    let allTeams = [];
                    
                    const fetchPage = (offset) => {
                        this.getCollectionFactory().create('Team', (collection) => {
                            collection.fetch({
                                data: {
                                    maxSize: maxSize,
                                    offset: offset
                                }
                            }).then(() => {
                                allTeams = allTeams.concat(collection.models);
                                
                                if (collection.models.length < maxSize) {
                                    resolve(allTeams);
                                } else {
                                    fetchPage(offset + maxSize);
                                }
                            }).catch(reject);
                        });
                    };
                    
                    fetchPage(0);
                });
            };
            
            const cargarEncuestas = $.ajax({
                url: 'api/v1/Encuesta',
                data: {
                    where: whereEncuestas,
                    select: 'id,equipoId,equipoName' 
                }
            });

            Promise.all([cargarPreguntas, cargarOficinas(), cargarEncuestas]).then((results) => {
                const preguntas = results[0].list || [];
                const allTeamsModels = results[1];
                const encuestas = results[2].list || [];

                this.procesarPreguntas(preguntas);

                const todasLasOficinas = allTeamsModels.map(team => ({
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
                    .filter(oficina => oficinasConEncuestas.has(oficina.id))
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
                    }
                }).then(function(respuestasData) {
                    return (respuestasData.list || []).map(function(resp) {
                        return {
                            preguntaId: resp.preguntaId,
                            respuesta: resp.respuesta,
                            'encuesta.equipoId': encuesta.oficinaId
                        };
                    });
                }).catch(function() {
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
            }.bind(this)).catch(function() {
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
                    where: [ 
                        { type: 'and', value: [ 
                            { type: 'or', value: [ 
                                { type: 'equals', attribute: 'rolObjetivo', value: this.rolObjetivo }, 
                                { type: 'contains', attribute: 'rolObjetivo', value: this.rolObjetivo } 
                            ] }, 
                            { type: 'equals', attribute: 'estaActiva', value: 1 } 
                        ] } 
                    ],
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
                
            }.bind(this)).catch(function() {
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
            }.bind(this)).catch(function() {
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

        exportarCSV: function () {
            try {
                let csvContent = '\uFEFF';
                
                csvContent += this.tituloReporte + '\n\n';
                csvContent += 'Criterio:,Verde >=80%,Amarillo 60-80%,Rojo <60%\n\n';
                
                let headers = [this.textoEncabezado];
                let preguntasArray = [];
                
                Object.keys(this.preguntasAgrupadas).forEach(categoria => {
                    Object.keys(this.preguntasAgrupadas[categoria]).forEach(subcategoria => {
                        this.preguntasAgrupadas[categoria][subcategoria].forEach(pregunta => {
                            preguntasArray.push({
                                id: pregunta.id,
                                texto: pregunta.texto,
                                categoria: categoria,
                                subcategoria: subcategoria
                            });
                        });
                    });
                });
                
                preguntasArray.forEach(p => {
                    headers.push(`"${p.categoria} - ${p.subcategoria} - ${p.texto}"`);
                });
                headers.push('Sumatoria');
                
                csvContent += headers.join(',') + '\n';
                
                if (this.esReporteGeneralCasaNacional) {
                    this.oficinas.forEach(oficina => {
                        if (oficina.totalesOficina && oficina.totalesOficina.total > 0) {
                            let row = [`"${oficina.name}"`];
                            
                            preguntasArray.forEach(p => {
                                const datos = oficina.totalesPorPregunta[p.id];
                                const color = datos ? datos.color : 'gris';
                                row.push(this.traducirColor(color));
                            });
                            
                            const totalColor = this.traducirColor(oficina.totalesOficina.color);
                            row.push(`"${oficina.totalesOficina.verdes}/${oficina.totalesOficina.total} (${Math.round(oficina.totalesOficina.porcentaje)}%) - ${totalColor}"`);
                            
                            csvContent += row.join(',') + '\n';
                        }
                    });
                } else {
                    this.usuariosData.forEach(usuario => {
                        let row = [`"${usuario.userName}"`];
                        
                        preguntasArray.forEach(p => {
                            const respuesta = usuario.respuestas[p.id];
                            row.push(this.traducirColor(respuesta || 'gris'));
                        });
                        
                        const totalColor = this.traducirColor(usuario.totales.color);
                        row.push(`"${usuario.totales.verdes}/${usuario.totales.total} (${Math.round(usuario.totales.porcentaje)}%) - ${totalColor}"`);
                        
                        csvContent += row.join(',') + '\n';
                    });
                }
                
                let totalesRow = ['Totales'];
                preguntasArray.forEach(p => {
                    const datos = this.totalesPorPregunta[p.id];
                    const color = this.traducirColor(datos.color);
                    totalesRow.push(`"${datos.verdes}/${datos.total} (${Math.round(datos.porcentaje)}%) - ${color}"`);
                });
                
                if (this.esReporteGeneralCasaNacional && this.totalesGenerales) {
                    const totalColor = this.traducirColor(this.totalesGenerales.color);
                    totalesRow.push(`"${this.totalesGenerales.verdes}/${this.totalesGenerales.total} (${Math.round(this.totalesGenerales.porcentaje)}%) - ${totalColor}"`);
                } else {
                    totalesRow.push('');
                }
                
                csvContent += totalesRow.join(',') + '\n';
                
                this.descargarArchivo(csvContent, `${this.tituloReporte}.csv`, 'text/csv;charset=utf-8;');
                
                Espo.Ui.success('Reporte CSV exportado exitosamente');
                
            } catch (error) {
                Espo.Ui.error('Error al exportar el reporte a CSV');
            }
        },

        exportarExcel: function () {
            try {
                let htmlContent = `
                    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
                        xmlns:x="urn:schemas-microsoft-com:office:excel"
                        xmlns="http://www.w3.org/TR/REC-html40">
                    <head>
                        <meta charset="UTF-8">
                        <title>${this.tituloReporte}</title>
                        <!--[if gte mso 9]>
                        <xml>
                            <x:ExcelWorkbook>
                                <x:ExcelWorksheets>
                                    <x:ExcelWorksheet>
                                        <x:Name>Reporte</x:Name>
                                        <x:WorksheetOptions>
                                            <x:DisplayGridlines/>
                                            <x:Selected/>
                                            <x:FreezePanes/>
                                            <x:FrozenNoSplit/>
                                            <x:SplitHorizontal>6</x:SplitHorizontal>
                                            <x:TopRowBottomPane>6</x:TopRowBottomPane>
                                            <x:ActivePane>2</x:ActivePane>
                                        </x:WorksheetOptions>
                                    </x:ExcelWorksheet>
                                </x:ExcelWorksheets>
                            </x:ExcelWorkbook>
                        </xml>
                        <![endif]-->
                        <style>
                            table { 
                                mso-displayed-decimal-separator:"\\.";
                                mso-displayed-thousand-separator:"\\,";
                                border-collapse: collapse;
                                width: 100%;
                                font-family: Arial, sans-serif;
                                font-size: 9pt;
                                table-layout: fixed;
                            }
                            th { 
                                background-color: #4CAF50; 
                                color: white; 
                                font-weight: bold;
                                text-align: center;
                                vertical-align: middle;
                                padding: 3px;
                                border: 1px solid #2E7D32;
                                mso-pattern: solid #4CAF50;
                            }
                            td { 
                                padding: 2px;
                                text-align: center;
                                vertical-align: middle;
                                border: 1px solid #BDBDBD;
                                mso-number-format: "\\@";
                            }
                            .nombre-usuario { 
                                text-align: left; 
                                font-weight: bold;
                                background-color: #E3F2FD;
                                width: 200px;
                                mso-pattern: solid #E3F2FD;
                            }
                            
                            .verde { 
                                background-color: #4CAF50 !important; 
                                mso-pattern: solid #4CAF50;
                                color: white !important; 
                            }
                            .amarillo { 
                                background-color: #FFC107 !important; 
                                mso-pattern: solid #FFC107;
                                color: black !important; 
                            }
                            .rojo { 
                                background-color: #F44336 !important; 
                                mso-pattern: solid #F44336;
                                color: white !important; 
                            }
                            .gris { 
                                background-color: #9E9E9E !important; 
                                mso-pattern: solid #9E9E9E;
                                color: white !important; 
                            }
                            
                            .total-header {
                                background-color: #607D8B;
                                color: white;
                                font-weight: bold;
                                mso-pattern: solid #607D8B;
                            }
                            
                            .criterio-verde { 
                                background-color: #4CAF50 !important; 
                                mso-pattern: solid #4CAF50;
                                color: black !important; 
                                padding: 4px 8px; 
                                font-size: 8pt;
                                font-weight: bold;
                                display: inline-block;
                                border: 1px solid #2E7D32;
                            }
                            .criterio-amarillo { 
                                background-color: #FFC107 !important; 
                                mso-pattern: solid #FFC107;
                                color: black !important; 
                                padding: 4px 8px; 
                                font-size: 8pt;
                                font-weight: bold;
                                display: inline-block;
                                border: 1px solid #FF8F00;
                            }
                            .criterio-rojo { 
                                background-color: #F44336 !important; 
                                mso-pattern: solid #F44336;
                                color: black !important; 
                                padding: 4px 8px; 
                                font-size: 8pt;
                                font-weight: bold;
                                display: inline-block;
                                border: 1px solid #C62828;
                            }
                            .criterio-gris { 
                                background-color: #9E9E9E !important; 
                                mso-pattern: solid #9E9E9E;
                                color: black !important; 
                                padding: 4px 8px; 
                                font-size: 8pt;
                                font-weight: bold;
                                display: inline-block;
                                border: 1px solid #616161;
                            }
                            
                            .titulo-principal {
                                font-size: 14pt;
                                font-weight: bold;
                                color: #2E7D32;
                                padding: 5px;
                                background-color: #E8F5E8;
                                border: 1px solid #4CAF50;
                                mso-pattern: solid #E8F5E8;
                            }
                            .subtitulo {
                                font-size: 10pt;
                                color: #555;
                                padding: 2px;
                            }
                            .pregunta-cell {
                                writing-mode: vertical-rl;
                                text-orientation: mixed;
                                height: 80px;
                                width: 25px;
                                font-size: 7pt;
                                line-height: 1.2;
                                padding: 1px;
                                mso-pattern: solid #ECF0F1;
                                background-color: #ECF0F1;
                            }
                            .porcentaje-cell {
                                font-weight: bold;
                            }
                            .fraccion-cell {
                                font-size: 8pt;
                                line-height: 1.1;
                            }
                        </style>
                    </head>
                    <body>
                        <table width="100%" style="margin-bottom: 10px; border: none;">
                            <tr>
                                <td class="titulo-principal" colspan="5" style="text-align: center;">
                                    ${this.tituloReporte}
                                </td>
                            </tr>
                            <tr>
                                <td class="subtitulo" colspan="5" style="text-align: center;">
                                    Período: ${this.fechaInicio} al ${this.fechaCierre}
                                </td>
                            </tr>
                        </table>

                        <table width="100%" style="margin-bottom: 10px; border: 1px solid #BDBDBD; font-size: 8pt;">
                            <tr>
                                <td style="background-color: #F5F5F5; font-weight: bold; padding: 6px; text-align: center; width: 120px; mso-pattern: solid #F5F5F5;">
                                    Criterio de Evaluación
                                </td>
                                <td style="padding: 4px; text-align: center; width: 100px;">
                                    <div class="criterio-verde">Verde ≥ 80%</div>
                                </td>
                                <td style="padding: 4px; text-align: center; width: 100px;">
                                    <div class="criterio-amarillo">Amarillo 60% - 80%</div>
                                </td>
                                <td style="padding: 4px; text-align: center; width: 100px;">
                                    <div class="criterio-rojo">Rojo < 60%</div>
                                </td>
                                <td style="padding: 4px; text-align: center; width: 100px;">
                                    <div class="criterio-gris">Sin respuesta</div>
                                </td>
                            </tr>
                        </table>

                        <table>
                            <tr>
                                <th rowspan="3" style="width: 180px;">${this.textoEncabezado}</th>
                `;

                let preguntasArray = [];
                let categoriasMap = new Map();
                let currentCol = 1;

                Object.keys(this.preguntasAgrupadas).forEach(categoria => {
                    if (!categoriasMap.has(categoria)) {
                        categoriasMap.set(categoria, {
                            startCol: currentCol,
                            subcategorias: new Map()
                        });
                    }
                    
                    Object.keys(this.preguntasAgrupadas[categoria]).forEach(subcategoria => {
                        const catData = categoriasMap.get(categoria);
                        catData.subcategorias.set(subcategoria, {
                            startCol: currentCol,
                            preguntas: []
                        });
                        
                        this.preguntasAgrupadas[categoria][subcategoria].forEach(pregunta => {
                            preguntasArray.push({
                                ...pregunta,
                                categoria: categoria,
                                subcategoria: subcategoria,
                                colIndex: currentCol
                            });
                            catData.subcategorias.get(subcategoria).preguntas.push(pregunta);
                            currentCol++;
                        });
                    });
                    
                    categoriasMap.get(categoria).endCol = currentCol - 1;
                });

                const totalPreguntas = preguntasArray.length;

                htmlContent += '<!-- Categorías -->';
                categoriasMap.forEach((catData, categoria) => {
                    const colSpan = catData.endCol - catData.startCol + 1;
                    htmlContent += `<th colspan="${colSpan}" style="background-color: #757575; font-size: 9pt; mso-pattern: solid #757575;">${categoria}</th>`;
                });
                htmlContent += `<th rowspan="3" style="background-color: #455A64; width: 80px; font-size: 9pt; mso-pattern: solid #455A64;">Sumatoria<br/>del equipo</th></tr>`;

                htmlContent += '<tr><!-- Subcategorías -->';
                categoriasMap.forEach((catData, categoria) => {
                    catData.subcategorias.forEach((subcatData, subcategoria) => {
                        const colSpan = subcatData.preguntas.length;
                        htmlContent += `<th colspan="${colSpan}" style="background-color: #9E9E9E; font-size: 8pt; mso-pattern: solid #9E9E9E;">${subcategoria}</th>`;
                    });
                });
                htmlContent += '</tr>';

                htmlContent += '<tr><!-- Preguntas -->';
                preguntasArray.forEach(pregunta => {
                    const textoCompleto = pregunta.texto;
                    const textoLimpio = textoCompleto.replace(/"/g, '""');
                    htmlContent += `<th class="pregunta-cell" title="${textoLimpio}" style="background-color: #ECF0F1; mso-pattern: solid #ECF0F1;">${textoLimpio}</th>`;
                });
                htmlContent += '</tr>';

                if (this.esReporteGeneralCasaNacional) {
                    this.oficinas.forEach(oficina => {
                        if (oficina.totalesOficina && oficina.totalesOficina.total > 0) {
                            htmlContent += `<tr>
                                <td class="nombre-usuario" style="font-size: 9pt;">${oficina.name}</td>`;
                            
                            preguntasArray.forEach(pregunta => {
                                const datos = oficina.totalesPorPregunta[pregunta.id];
                                const colorClass = datos ? datos.color : 'gris';
                                const porcentaje = datos ? Math.round(datos.porcentaje) : '';
                                const colorHex = this.obtenerColorHex(colorClass);
                                htmlContent += `<td class="${colorClass} porcentaje-cell" style="mso-pattern: solid ${colorHex};">${porcentaje}%</td>`;
                            });
                            
                            const totalPorcentaje = Math.round(oficina.totalesOficina.porcentaje);
                            const fraccion = `${oficina.totalesOficina.verdes}/${oficina.totalesOficina.total}`;
                            const totalColorHex = this.obtenerColorHex(oficina.totalesOficina.color);
                            htmlContent += `<td class="${oficina.totalesOficina.color} fraccion-cell" style="font-weight: bold; mso-pattern: solid ${totalColorHex};">
                                ${fraccion}<br/>(${totalPorcentaje}%)
                            </td></tr>`;
                        }
                    });
                } else {
                    this.usuariosData.forEach(usuario => {
                        htmlContent += `<tr>
                            <td class="nombre-usuario" style="font-size: 9pt;">${usuario.userName}</td>`;
                        
                        preguntasArray.forEach(pregunta => {
                            const respuesta = usuario.respuestas[pregunta.id];
                            const colorClass = respuesta || 'gris';
                            const simbolo = respuesta ? '●' : '';
                            const colorHex = this.obtenerColorHex(colorClass);
                            htmlContent += `<td class="${colorClass}" style="mso-pattern: solid ${colorHex};">${simbolo}</td>`;
                        });
                        
                        const totalPorcentaje = Math.round(usuario.totales.porcentaje);
                        const fraccion = `${usuario.totales.verdes}/${usuario.totales.total}`;
                        const totalColorHex = this.obtenerColorHex(usuario.totales.color);
                        htmlContent += `<td class="${usuario.totales.color} fraccion-cell" style="font-weight: bold; mso-pattern: solid ${totalColorHex};">
                            ${fraccion}<br/>(${totalPorcentaje}%)
                        </td></tr>`;
                    });
                }

                htmlContent += `<tr>
                    <td class="total-header" style="font-size: 9pt;">TOTALES</td>`;
                
                preguntasArray.forEach(pregunta => {
                    const datos = this.totalesPorPregunta[pregunta.id];
                    const porcentaje = Math.round(datos.porcentaje);
                    const fraccion = `${datos.verdes}/${datos.total}`;
                    const colorHex = this.obtenerColorHex(datos.color);
                    htmlContent += `<td class="${datos.color} fraccion-cell" style="font-weight: bold; mso-pattern: solid ${colorHex};">
                        ${fraccion}<br/>(${porcentaje}%)
                    </td>`;
                });
                
                if (this.esReporteGeneralCasaNacional && this.totalesGenerales) {
                    const totalGeneralPorcentaje = Math.round(this.totalesGenerales.porcentaje);
                    const fraccion = `${this.totalesGenerales.verdes}/${this.totalesGenerales.total}`;
                    const totalColorHex = this.obtenerColorHex(this.totalesGenerales.color);
                    htmlContent += `<td class="${this.totalesGenerales.color} fraccion-cell" style="font-weight: bold; mso-pattern: solid ${totalColorHex};">
                        ${fraccion}<br/>(${totalGeneralPorcentaje}%)
                    </td>`;
                } else {
                    let totalVerdes = 0;
                    let totalTotal = 0;
                    preguntasArray.forEach(pregunta => {
                        const datos = this.totalesPorPregunta[pregunta.id];
                        totalVerdes += datos.verdes;
                        totalTotal += datos.total;
                    });
                    const porcentajeGeneral = totalTotal > 0 ? Math.round((totalVerdes / totalTotal) * 100) : 0;
                    const colorGeneral = this.obtenerColorPorPorcentaje(porcentajeGeneral);
                    const fraccion = `${totalVerdes}/${totalTotal}`;
                    const totalColorHex = this.obtenerColorHex(colorGeneral);
                    htmlContent += `<td class="${colorGeneral} fraccion-cell" style="font-weight: bold; mso-pattern: solid ${totalColorHex};">
                        ${fraccion}<br/>(${porcentajeGeneral}%)
                    </td>`;
                }
                
                htmlContent += `</tr></table>
                        
                    </body></html>`;

                const blob = new Blob([htmlContent], { 
                    type: 'application/vnd.ms-excel'
                });
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                
                const fecha = new Date().toISOString().split('T')[0];
                const nombreArchivo = `Reporte_${this.rolObjetivo}_${fecha}.xls`;
                
                link.download = nombreArchivo;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);

                Espo.Ui.success('Reporte Excel exportado exitosamente');
                
            } catch (error) {
                Espo.Ui.error('Error al exportar el reporte: ' + error.message);
            }
        },

        obtenerColorHex: function(color) {
            const colores = {
                'verde': '#4CAF50',
                'amarillo': '#FFC107', 
                'rojo': '#F44336',
                'gris': '#9E9E9E'
            };
            return colores[color] || colores['gris'];
        },

        traducirColor: function(color) {
            const traducciones = {
                'verde': 'Verde',
                'amarillo': 'Amarillo', 
                'rojo': 'Rojo',
                'gris': 'Sin respuesta'
            };
            return traducciones[color] || color;
        },

        descargarArchivo: function (contenido, nombreArchivo, mimeType) {
            const blob = new Blob([contenido], { type: mimeType });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = nombreArchivo;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        },

        data: function () {
            const data = {
                tituloReporte: this.tituloReporte,
                tipoReporte: this.tipoReporte,
                rolObjetivo: this.rolObjetivo,
                textoEncabezado: this.textoEncabezado,
                preguntas: this.preguntasAgrupadas,
                usuarios: this.usuariosData,
                totalesPorPregunta: this.totalesPorPregunta,
                tienedatos: (this.usuariosData && this.usuariosData.length > 0) || (this.esReporteGeneralCasaNacional && this.oficinas.length > 0),
                totalUsuarios: this.usuariosData ? this.usuariosData.length : 0,
                esReporteGeneralCasaNacional: this.esReporteGeneralCasaNacional,
                oficinas: this.oficinas,
                totalesPorOficina: this.totalesPorOficina,
                totalesGenerales: this.totalesGenerales,
                logoOficina: this.logoOficina,
                nombreOficina: this.nombreOficina,
                fechaInicio: this.fechaInicio,
                fechaCierre: this.fechaCierre
            };

            return data;
        }
    });
});