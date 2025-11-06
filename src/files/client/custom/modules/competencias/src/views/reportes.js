define(['view', 'jquery', 'lib!selectize'], function (View, $) {
    
    return View.extend({
        
        template: 'competencias:reportes',
        
        events: {
            'click [data-action="generalGerentes"]': function () {
                this.verReporteGeneral('generalGerentes');
            },
            'click [data-action="generalAsesores"]': function () {
                this.verReporteGeneral('generalAsesores');
            },
            'click [data-action="gerentes"]': function () {
                this.verReporteGeneral('gerentes');
            },
            'click [data-action="asesores"]': function () {
                this.verReporteGeneral('asesores');
            },
            'click [data-action="asesor"]': function () {
                this.verReporteGeneral('asesor');
            },
            'click [data-action="oficinaGerentes"]': function () {
                this.verReportePorOficina('oficinaGerentes');
            },
            'click [data-action="oficinaAsesores"]': function () {
                this.verReportePorOficina('oficinaAsesores');
            },
            'change select[name="oficina"]': function (e) {
                this.actualizarDisponibilidadReportesOficina(e);
            },
            'change select[name="periodo"]': function (e) {
                this.periodoSeleccionadoId = $(e.currentTarget).val();
                this.actualizarPeriodoSeleccionado();
            },
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias', {trigger: true});
            }
        },
        
        setup: function () {
            this.reportesDisponibles = [];
            this.oficinas = [];
            this.usuarioActual = this.getUser();
            this.esCasaNacional = false;
            this.esGerenteODirector = false;
            this.esAsesor = false;
            this.sinReporteAsesor = false;
            this.sinReporteGerente = false;
            this.noHayPeriodos = false;
            this.periodoMostrado = 'Cargando...';
            this.idOficinaUsuario = null;
            this.nombreOficinaUsuario = null;
            this.periodos = [];
            this.fechaInicioPeriodo = null;
            this.fechaCierrePeriodo = null;
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

        cargarDatosIniciales: function () {
            const userPromise = new Promise((resolve, reject) => {
                this.getModelFactory().create('User', (userModel) => {
                    userModel.id = this.usuarioActual.id;
                    userModel.fetch({ relations: { roles: true, teams: true } }).then(() => {
                        resolve(userModel);
                    }).catch(reject);
                });
            });

            const periodosPromise = new Promise((resolve, reject) => {
                this.getCollectionFactory().create('Competencias', (collection) => {
                    collection.fetch({
                        data: {
                            orderBy: 'fechaCierre',
                            order: 'desc',
                            maxSize: 500,
                        }
                    }).then(() => {
                        resolve(collection);
                    }).catch(reject);
                });
            });

            Promise.all([userPromise, periodosPromise]).then(([userModel, periodosCollection]) => {
                const roles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                this.esCasaNacional = roles.includes('casa nacional');
                this.esGerenteODirector = roles.includes('gerente') || roles.includes('director');
                this.esAsesor = roles.includes('asesor');

                if (this.esGerenteODirector) {
                    const teamIds = userModel.get('teamsIds') || [];
                    const teamNames = userModel.get('teamsNames') || {};
                    if (teamIds.length > 0) {
                        this.idOficinaUsuario = teamIds[0];
                        this.nombreOficinaUsuario = teamNames[teamIds[0]];
                    }
                }

                this.periodos = periodosCollection.models
                    .filter(model => model.get('fechaInicio') && model.get('fechaCierre'))
                    .map(model => {
                        return {
                            id: model.id,
                            name: `Evaluaciones ${this.getDateTime().toDisplayDate(model.get('fechaInicio'))} - ${this.getDateTime().toDisplayDate(model.get('fechaCierre'))}`,
                            fechaInicio: model.get('fechaInicio'),
                            fechaCierre: model.get('fechaCierre')
                        };
                    });

                if (this.periodos.length === 0) {
                    this.noHayPeriodos = true;
                    this.periodoMostrado = 'Ninguno';
                    this.wait(false);
                    this.reRender();
                    return;
                }

                // Para asesores: usar el último período (más reciente)
                // Para otros roles: buscar período activo o usar el más reciente
                if (this.esAsesor && !this.esCasaNacional && !this.esGerenteODirector) {
                    const periodoAUsar = this.periodos[0];
                    this.periodoSeleccionadoId = periodoAUsar.id;
                    this.actualizarPeriodoSeleccionado();
                } else {
                    const hoy = new Date().toISOString().split('T')[0];
                    let periodoActivo = this.periodos.find(p => hoy >= p.fechaInicio && hoy <= p.fechaCierre);
                    const periodoAUsar = periodoActivo || this.periodos[0];
                    this.periodoSeleccionadoId = periodoAUsar.id;
                    this.actualizarPeriodoSeleccionado();
                }

            }).catch(() => {
                Espo.Ui.error('Error al cargar datos iniciales. Revise la consola del navegador para más detalles.');
                this.wait(false);
            });
        },

        actualizarPeriodoSeleccionado: function () {
            const periodo = this.periodos.find(p => p.id === this.periodoSeleccionadoId);
            if (!periodo) return;

            const fechaInicio = periodo.fechaInicio;
            const fechaCierre = periodo.fechaCierre;

            this.periodoMostrado = `${this.getDateTime().toDisplayDate(fechaInicio)} al ${this.getDateTime().toDisplayDate(fechaCierre)}`;
            this.fechaInicioPeriodo = fechaInicio;
            this.fechaCierrePeriodo = fechaCierre;

            this.cargarDatosReportes(fechaInicio, fechaCierre);
        },

        cargarDatosReportes: function (fechaInicio, fechaCierre) {
            const fechaCierreCompleta = fechaCierre + ' 23:59:59';
            const wherePeriodo = [
                { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: fechaInicio },
                { type: 'lessThanOrEquals', attribute: 'fechaCreacion', value: fechaCierreCompleta }
            ];

            let promesas = [];

            const fetchGerentes = $.ajax({ 
                url: 'api/v1/Encuesta', 
                data: { 
                    where: [
                        { type: 'equals', attribute: 'rolUsuario', value: 'gerente' }, 
                        ...wherePeriodo
                    ], 
                    select: 'id', 
                    maxSize: 1 
                } 
            });

            const fetchAsesores = $.ajax({ 
                url: 'api/v1/Encuesta', 
                data: { 
                    where: [
                        { type: 'equals', attribute: 'rolUsuario', value: 'asesor' }, 
                        ...wherePeriodo
                    ], 
                    select: 'id', 
                    maxSize: 1 
                } 
            });

            promesas.push(fetchGerentes, fetchAsesores);

            if (this.esCasaNacional) {
                const fetchCompletas = $.ajax({ 
                    url: 'api/v1/Encuesta', 
                    data: { 
                        where: [
                            { type: 'equals', attribute: 'estado', value: 'completada' }, 
                            ...wherePeriodo
                        ], 
                        select: 'id', 
                        maxSize: 1 
                    } 
                });

                const fetchRevision = $.ajax({ 
                    url: 'api/v1/Encuesta', 
                    data: { 
                        where: [
                            { type: 'equals', attribute: 'estado', value: 'revision' }, 
                            ...wherePeriodo
                        ], 
                        select: 'id', 
                        maxSize: 1 
                    } 
                });

                const fetchIncompletas = $.ajax({ 
                    url: 'api/v1/Encuesta', 
                    data: { 
                        where: [
                            { type: 'equals', attribute: 'estado', value: 'incompleta' }, 
                            ...wherePeriodo
                        ], 
                        select: 'id', 
                        maxSize: 1 
                    } 
                });
                
                // Cargar todas las oficinas con paginación
                const fetchOficinas = () => {
                    return new Promise((resolve, reject) => {
                        const maxSize = 200;
                        let allTeams = [];
                        
                        const fetchPage = (offset) => {
                            this.getCollectionFactory().create('Team', (collection) => {
                                collection.maxSize = maxSize;
                                collection.offset = offset;
                                
                                collection.fetch().then(() => {
                                    const models = collection.models || [];
                                    allTeams = allTeams.concat(models);
                                    
                                    if (models.length === maxSize && allTeams.length < collection.total) {
                                        fetchPage(offset + maxSize);
                                    } else {
                                        resolve(allTeams);
                                    }
                                }).catch(reject);
                            });
                        };
                        
                        fetchPage(0);
                    });
                };
                
                promesas.push(fetchCompletas, fetchRevision, fetchIncompletas, fetchOficinas.call(this));
            }

            const whereOficina = { type: 'equals', attribute: 'equipoId', value: this.idOficinaUsuario };
            const fetchGerentesOficina = this.esGerenteODirector
                ? $.ajax({ 
                    url: 'api/v1/Encuesta', 
                    data: { 
                        where: [
                            { type: 'equals', attribute: 'rolUsuario', value: 'gerente' }, 
                            whereOficina, 
                            ...wherePeriodo
                        ], 
                        select: 'id', 
                        maxSize: 1 
                    } 
                })
                : Promise.resolve({ total: 0 });

            const fetchAsesoresOficina = this.esGerenteODirector
                ? $.ajax({ 
                    url: 'api/v1/Encuesta', 
                    data: { 
                        where: [
                            { type: 'equals', attribute: 'rolUsuario', value: 'asesor' }, 
                            whereOficina, 
                            ...wherePeriodo
                        ], 
                        select: 'id', 
                        maxSize: 1 
                    } 
                })
                : Promise.resolve({ total: 0 });

            const fetchEsteAsesor = this.esAsesor
                ? $.ajax({ 
                    url: 'api/v1/Encuesta', 
                    data: { 
                        where: [
                            { type: 'equals', attribute: 'usuarioEvaluadoId', value: this.usuarioActual.id }, 
                            ...wherePeriodo
                        ], 
                        select: 'id', 
                        maxSize: 1 
                    } 
                })
                : Promise.resolve({ total: 0 });

            promesas.push(fetchGerentesOficina, fetchAsesoresOficina, fetchEsteAsesor);

            Promise.all(promesas).then((results) => {
                const encuestasGerente = results[0].total || 0;
                const encuestasAsesor = results[1].total || 0;

                let resultIndex = 2;
                if (this.esCasaNacional) {
                    resultIndex = 6;
                }
                const encuestasGerenteOficina = results[resultIndex++].total || 0;
                const encuestasAsesorOficina = results[resultIndex++].total || 0;
                const encuestasEsteAsesor = results[resultIndex++].total || 0;

                this.sinReporteAsesor = encuestasAsesor === 0;
                this.sinReporteGerente = encuestasGerente === 0;
                
                let reportes = [];
                
                const reporteGeneralGerentes = { tipo: 'generalGerentes', titulo: 'Reporte General (Gerentes y Directores)', descripcion: 'Matriz de competencias de todas las oficinas.', icono: 'fa-globe-americas', disponible: false, esDinamico: false };
                const reporteGeneralAsesores = { tipo: 'generalAsesores', titulo: 'Reporte General (Asesores)', descripcion: 'Matriz de competencias de todas las oficinas.', icono: 'fa-globe-americas', disponible: false, esDinamico: false };
                const reporteOficinaGerentes = { tipo: 'oficinaGerentes', titulo: 'Reporte de Gerentes y Directores (Oficina)', descripcion: 'Matriz de competencias de la oficina seleccionada.', icono: 'fa-user-tie', disponible: false, esDinamico: true };
                const reporteOficinaAsesores = { tipo: 'oficinaAsesores', titulo: 'Reporte de Asesores (Oficina)', descripcion: 'Matriz de competencias de la oficina seleccionada.', icono: 'fa-users', disponible: false, esDinamico: true };

                if (this.esCasaNacional) {
                    reporteGeneralGerentes.disponible = encuestasGerente > 0;
                    reporteGeneralAsesores.disponible = encuestasAsesor > 0;
                    reportes = [reporteGeneralGerentes, reporteGeneralAsesores, reporteOficinaGerentes, reporteOficinaAsesores];

                    const encuestasCompletas = results[2].total || 0;
                    const encuestasRevision = results[3].total || 0;
                    const encuestasIncompletas = results[4].total || 0;
                    const allTeamsModels = results[5];

                    this.estadisticasGenerales = {
                        totalEncuestas: encuestasCompletas + encuestasRevision + encuestasIncompletas,
                        encuestasCompletas: encuestasCompletas,
                        encuestasRevision: encuestasRevision,
                        encuestasIncompletas: encuestasIncompletas
                    };

                    const claPattern = /^CLA\d+$/i;
                    this.oficinas = (allTeamsModels || [])
                        .filter(team => !claPattern.test(team.id))
                        .map(team => ({
                            id: team.id,
                            name: team.get('name')
                        }));
                    this.oficinas.sort((a, b) => a.name.localeCompare(b.name));
                } else if (this.esGerenteODirector) {
                    this.sinReporteGerente = encuestasGerenteOficina === 0;
                    this.sinReporteAsesor = encuestasAsesorOficina === 0;

                    reporteGeneralGerentes.tipo = 'gerentes';
                    reporteGeneralGerentes.titulo = 'Reporte de Gerentes y Directores (' + (this.nombreOficinaUsuario || 'Mi Oficina') + ')';
                    reporteGeneralGerentes.descripcion = 'Matriz de competencias de su oficina.';
                    reporteGeneralGerentes.disponible = encuestasGerenteOficina > 0;
                    
                    reporteGeneralAsesores.tipo = 'asesores';
                    reporteGeneralAsesores.titulo = 'Reporte de Asesores (' + (this.nombreOficinaUsuario || 'Mi Oficina') + ')';
                    reporteGeneralAsesores.descripcion = 'Matriz de competencias de su oficina.';
                    reporteGeneralAsesores.disponible = encuestasAsesorOficina > 0;
                    
                    reportes = [reporteGeneralGerentes, reporteGeneralAsesores];
                } else if (this.esAsesor) {
                    reporteGeneralAsesores.tipo = 'asesor';
                    this.sinReporteAsesor = encuestasEsteAsesor === 0;
                    reporteGeneralAsesores.titulo = 'Mi Reporte de Asesor (' + this.usuarioActual.get('name') + ')';
                    reporteGeneralAsesores.descripcion = 'Mi matriz de competencias evaluadas.';
                    reporteGeneralAsesores.disponible = encuestasEsteAsesor > 0;
                    reportes = [reporteGeneralAsesores];
                }

                this.reportesDisponibles = reportes;
                this.reRender();
            }).catch(() => {
                Espo.Ui.error('Error al cargar los datos de los reportes.');
            }).finally(() => {
                this.wait(false);
            });
        },

        afterRender: function () {
            if (this.esCasaNacional) {
                if (this.oficinas.length > 0) {
                    const $selectOficina = this.$el.find('select[name="oficina"]');
                    if (!$selectOficina[0].selectize) {
                        $selectOficina.selectize({
                            placeholder: 'Seleccione una oficina para filtrar',
                            allowClear: true
                        });
                    }
                    this.$el.find('.report-item-container[data-report-type="oficinaGerentes"]').hide();
                    this.$el.find('.report-item-container[data-report-type="oficinaAsesores"]').hide();
                }
                
                const $selectPeriodo = this.$el.find('select[name="periodo"]');
                
                if (!$selectPeriodo[0].selectize) {
                    $selectPeriodo.selectize({
                        placeholder: 'Seleccione un período',
                        allowClear: false
                    });
                    
                    if (this.periodoSeleccionadoId) {
                        $selectPeriodo[0].selectize.setValue(this.periodoSeleccionadoId, true);
                    }
                }
            } else if (this.esGerenteODirector) {
                const $selectPeriodo = this.$el.find('select[name="periodo"]');
                
                if ($selectPeriodo.length && !$selectPeriodo[0].selectize) {
                    $selectPeriodo.selectize({
                        placeholder: 'Seleccione un período',
                        allowClear: false
                    });
                    
                    if (this.periodoSeleccionadoId) {
                        $selectPeriodo[0].selectize.setValue(this.periodoSeleccionadoId, true);
                    }
                }
            }
        },

        actualizarDisponibilidadReportesOficina: function (e) {
            var oficinaId = $(e.currentTarget).val();

            var $containerGerentes = this.$el.find('.report-item-container[data-report-type="oficinaGerentes"]');
            var $containerAsesores = this.$el.find('.report-item-container[data-report-type="oficinaAsesores"]');
            
            this.$el.find('#no-reports-for-office-msg').remove();

            if (!oficinaId) {
                $containerGerentes.hide();
                $containerAsesores.hide();
                return;
            }

            this.wait(true);

            const wherePeriodo = [
                { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: this.fechaInicioPeriodo },
                { type: 'lessThanOrEquals', attribute: 'fechaCreacion', value: this.fechaCierrePeriodo + ' 23:59:59' }
            ];
            const whereOficina = { type: 'equals', attribute: 'equipoId', value: oficinaId };

            const fetchGerentes = $.ajax({
                url: 'api/v1/Encuesta',
                data: { where: [{ type: 'equals', attribute: 'rolUsuario', value: 'gerente' }, whereOficina, ...wherePeriodo], select: 'id', maxSize: 1 }
            });

            const fetchAsesores = $.ajax({
                url: 'api/v1/Encuesta',
                data: { where: [{ type: 'equals', attribute: 'rolUsuario', value: 'asesor' }, whereOficina, ...wherePeriodo], select: 'id', maxSize: 1 }
            });

            Promise.all([fetchGerentes, fetchAsesores]).then(([gerentesResult, asesoresResult]) => {
                const gerentesDisponibles = (gerentesResult.total || 0) > 0;
                const asesoresDisponibles = (asesoresResult.total || 0) > 0;
                const oficinaName = $(e.currentTarget).find('option:selected').text();

                if (gerentesDisponibles) {
                    $containerGerentes.find('h4').text('Reporte de Gerentes y Directores (' + oficinaName + ')');
                }
                $containerGerentes.toggle(gerentesDisponibles);

                if (asesoresDisponibles) {
                    $containerAsesores.find('h4').text('Reporte de Asesores (' + oficinaName + ')');
                }
                $containerAsesores.toggle(asesoresDisponibles);

                if (!gerentesDisponibles && !asesoresDisponibles) {
                    this.$el.find('.reports-container').prepend('<div id="no-reports-for-office-msg" class="col-md-12"><div class="alert alert-info text-center">No hay evaluaciones para esta oficina en el período seleccionado.</div></div>');
                }

                this.wait(false);
            }).catch(() => {
                Espo.Ui.error('Error al verificar los reportes para la oficina seleccionada.');
                this.wait(false);
            });
        },

        verReportePorOficina: function (tipo) {
            var oficinaId = this.$el.find('select[name="oficina"]').val();
            if (!oficinaId) {
                Espo.Ui.warning('Por favor, seleccione una oficina para generar el reporte.');
                return;
            }
            const periodoId = this.periodoSeleccionadoId || this.periodos[0].id;
            const params = `tipo=${tipo}&oficinaId=${oficinaId}&periodoId=${periodoId}`;
            this.getRouter().navigate(`#Competencias/reporteBase?${params}`, {trigger: true});
        },

        verReporteGeneral: function (tipo) {
            const periodoId = this.periodoSeleccionadoId || this.periodos[0].id;
            let params = `tipo=${tipo}&periodoId=${periodoId}`;
            this.getRouter().navigate(`#Competencias/reporteBase?${params}`, {trigger: true});
        },

        data: function () {
            return {
                reportes: this.reportesDisponibles,
                estadisticas: this.estadisticasGenerales,
                usuario: {
                    name: this.usuarioActual.get('name'),
                    type: this.usuarioActual.get('type')
                },
                tieneReportes: this.reportesDisponibles.some(r => r.disponible || (this.esCasaNacional && r.esDinamico)),
                esCasaNacional: this.esCasaNacional,
                esGerenteODirector: this.esGerenteODirector,
                esAsesor: this.esAsesor,
                noHayPeriodos: this.noHayPeriodos,
                periodos: this.periodos,
                oficinas: this.oficinas,
                periodoMostrado: this.periodoMostrado,
                sinReporteAsesor: this.sinReporteAsesor,
                sinReporteGerente: this.sinReporteGerente
            };
        }
    });
});