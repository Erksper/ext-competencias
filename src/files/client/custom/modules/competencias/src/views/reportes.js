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
            this.isPeriodoActivo = false;
            this.periodoMostrado = 'Cargando...';
            this.idOficinaUsuario = null;
            this.nombreOficinaUsuario = null;
            this.fechaInicioPeriodo = null;
            this.fechaCierrePeriodo = null;

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
            this.getModelFactory().create('User', (userModel) => {
                userModel.id = this.usuarioActual.id;
                userModel.fetch({ relations: { roles: true, teams: true } }).then(() => {
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

                    this.getCollectionFactory().create('Competencias', (competenciaCollection) => {
                        competenciaCollection.fetch({ 
                            data: { 
                                maxSize: 1,
                                orderBy: 'fechaCierre',
                                order: 'desc'
                            } 
                        }).then(() => {
                            if (competenciaCollection.total === 0) {
                                this.noHayPeriodos = true;
                                this.periodoMostrado = 'Ninguno';
                                this.wait(false);
                                this.reRender();
                                return;
                            }

                            const competencia = competenciaCollection.at(0);
                            const fechaInicio = competencia.get('fechaInicio');
                            const fechaCierre = competencia.get('fechaCierre');
                            const hoy = new Date().toISOString().split('T')[0];

                            this.isPeriodoActivo = (hoy >= fechaInicio && hoy <= fechaCierre);
                            this.periodoMostrado = `${fechaInicio} al ${fechaCierre}`;
                            this.fechaInicioPeriodo = fechaInicio;
                            this.fechaCierrePeriodo = fechaCierre;

                            if (!fechaInicio || !fechaCierre) {
                                Espo.Ui.error('El período de evaluación más reciente está mal configurado.');
                                this.wait(false);
                                return;
                            }

                            this.cargarDatosReportes(fechaInicio, fechaCierre);
                        }).catch(() => {
                            Espo.Ui.error('Error al verificar el período de evaluación.');
                            this.wait(false);
                        });
                    });
                }).catch(() => {
                    Espo.Ui.error('Error al verificar los permisos de usuario.');
                    this.wait(false);
                });
            });
        },

        cargarDatosReportes: function (fechaInicio, fechaCierre) {
            const fechaCierreCompleta = fechaCierre + ' 23:59:59';
            const wherePeriodo = [
                { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: fechaInicio },
                { type: 'lessThanOrEquals', attribute: 'fechaCreacion', value: fechaCierreCompleta }
            ];

            let promesas = [];

            const fetchGerentes = $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'rolUsuario', value: 'gerente' }, ...wherePeriodo], select: 'id', maxSize: 1 } });
            promesas.push(fetchGerentes);

            const fetchAsesores = $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'rolUsuario', value: 'asesor' }, ...wherePeriodo], select: 'id', maxSize: 1 } });
            promesas.push(fetchAsesores);

            if (this.esCasaNacional) {
                const fetchCompletas = $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'estado', value: 'completada' }, ...wherePeriodo], select: 'id', maxSize: 1 } });
                const fetchRevision = $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'estado', value: 'revision' }, ...wherePeriodo], select: 'id', maxSize: 1 } });
                const fetchIncompletas = $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'estado', value: 'incompleta' }, ...wherePeriodo], select: 'id', maxSize: 1 } });
                
                const fetchOficinas = new Promise((resolve, reject) => {
                    this.getCollectionFactory().create('Team', (collection) => {
                        collection.fetch({ data: { maxSize: 200 } }).then(() => resolve(collection)).catch(reject);
                    });
                });
                promesas.push(fetchCompletas, fetchRevision, fetchIncompletas, fetchOficinas);
            }

            const whereOficina = { type: 'equals', attribute: 'equipoId', value: this.idOficinaUsuario };
            const fetchGerentesOficina = this.esGerenteODirector
                ? $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'rolUsuario', value: 'gerente' }, whereOficina, ...wherePeriodo], select: 'id', maxSize: 1 } })
                : Promise.resolve({ total: 0 });
            promesas.push(fetchGerentesOficina);

            const fetchAsesoresOficina = this.esGerenteODirector
                ? $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'rolUsuario', value: 'asesor' }, whereOficina, ...wherePeriodo], select: 'id', maxSize: 1 } })
                : Promise.resolve({ total: 0 });
            promesas.push(fetchAsesoresOficina);

            const fetchEsteAsesor = this.esAsesor
                ? $.ajax({ url: 'api/v1/Encuesta', data: { where: [{ type: 'equals', attribute: 'usuarioEvaluadoId', value: this.usuarioActual.id }, ...wherePeriodo], select: 'id', maxSize: 1 } })
                : Promise.resolve({ total: 0 });
            promesas.push(fetchEsteAsesor);

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
                    const oficinaCollection = results[5];

                    this.estadisticasGenerales = {
                        totalEncuestas: encuestasCompletas + encuestasRevision + encuestasIncompletas,
                        encuestasCompletas: encuestasCompletas,
                        encuestasRevision: encuestasRevision,
                        encuestasIncompletas: encuestasIncompletas
                    };

                    this.oficinas = (oficinaCollection.models || []).map(team => ({
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
            }).catch((error) => {
                Espo.Ui.error('Error al cargar los datos de los reportes.');
            }).finally(() => {
                this.wait(false);
            });
        },

        afterRender: function () {
            if (this.esCasaNacional && this.oficinas.length > 0) {
                const $select = this.$el.find('select[name="oficina"]');
                if ($select[0].selectize) {
                    $select[0].selectize.destroy();
                }
                $select.selectize({
                    placeholder: 'Seleccione una oficina para filtrar',
                    allowClear: true
                });
                this.$el.find('.report-item-container[data-report-type="oficinaGerentes"]').hide();
                this.$el.find('.report-item-container[data-report-type="oficinaAsesores"]').hide();
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
            const params = `tipo=${tipo}&oficinaId=${oficinaId}`;
            this.getRouter().navigate(`#Competencias/reporteBase?${params}`, {trigger: true});
        },

        verReporteGeneral: function (tipo) {
            let params = `tipo=${tipo}`;
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
                noHayPeriodos: this.noHayPeriodos,
                oficinas: this.oficinas,
                isPeriodoActivo: this.isPeriodoActivo,
                periodoMostrado: this.periodoMostrado,
                sinReporteAsesor: this.sinReporteAsesor,
                sinReporteGerente: this.sinReporteGerente
            };
        }
    });
});
