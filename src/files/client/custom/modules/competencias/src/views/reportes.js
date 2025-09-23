define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:reportes',
        
        events: {
            'click [data-action="reporteasesores"]': function () {
                this.verReporteAsesores();
            },
            'click [data-action="reportegerentes"]': function () {
                this.verReporteGerentes();
            },
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias', {trigger: true});
            }
        },
        
        setup: function () {
            this.reportesDisponibles = [];
            this.usuarioActual = this.getUser();
            this.wait(true);
            this.verificarReportesDisponibles();
        },

        verificarReportesDisponibles: function () {

            this.estadisticasGenerales = {
                totalEncuestas: '(Cargando...)',
                encuestasAsesor: 0,
                encuestasGerente: 0
            };

            // Llamadas a la API estándar de la entidad 'Encuesta' para obtener las estadísticas.
            // Esto evita la necesidad de una acción de controlador personalizada.
            var fetchTotal = $.ajax({
                url: 'api/v1/Encuesta',
                data: { select: 'id', maxSize: 1 }
            });

            var fetchAsesores = $.ajax({
                url: 'api/v1/Encuesta',
                data: {
                    where: [{ type: 'equals', attribute: 'rolUsuario', value: 'asesor' }],
                    select: 'id',
                    maxSize: 1
                }
            });

            var fetchGerentes = $.ajax({
                url: 'api/v1/Encuesta',
                data: {
                    where: [{ type: 'equals', attribute: 'rolUsuario', value: 'gerente' }],
                    select: 'id',
                    maxSize: 1
                }
            });

            Promise.all([fetchTotal, fetchAsesores, fetchGerentes]).then(function(results) {
                var totalEncuestas = results[0].total || 0;
                var encuestasAsesor = results[1].total || 0;
                var encuestasGerente = results[2].total || 0;

                this.estadisticasGenerales = {
                    totalEncuestas: totalEncuestas,
                    encuestasAsesor: encuestasAsesor,
                    encuestasGerente: encuestasGerente
                };

                var reportes = [];
                if (encuestasGerente > 0) {
                    reportes.push({
                        tipo: 'gerentes', 
                        titulo: 'Reporte de Gerentes', 
                        descripcion: 'Matriz de competencias evaluadas de gerentes y directores', 
                        icono: 'fa-user-tie', 
                        disponible: true,
                        cantidadEncuestas: encuestasGerente
                    });
                }
                if (encuestasAsesor > 0) {
                    reportes.push({
                        tipo: 'asesores', 
                        titulo: 'Reporte de Asesores', 
                        descripcion: 'Matriz de competencias evaluadas de asesores', 
                        icono: 'fa-users', 
                        disponible: true,
                        cantidadEncuestas: encuestasAsesor
                    });
                }
                
                this.reportesDisponibles = reportes;
                this.reRender();
                this.wait(false);

            }.bind(this)).catch(function(error) {
                this.reportesDisponibles = [];
                this.estadisticasGenerales = { totalEncuestas: 'N/A', encuestasAsesor: 'N/A', encuestasGerente: 'N/A' };
                this.reRender();
                this.wait(false);
            }.bind(this));
        },

        verReporteAsesores: function () {
            this.getRouter().navigate('#Competencias/reporteAsesores', {trigger: true});
        },

        verReporteGerentes: function () {
            this.getRouter().navigate('#Competencias/reporteGerentes', {trigger: true});
        },

        data: function () {
            return {
                reportes: this.reportesDisponibles,
                estadisticas: this.estadisticasGenerales,
                usuario: {
                    name: this.usuarioActual.get('name'),
                    type: this.usuarioActual.get('type')
                },
                tieneReportes: this.reportesDisponibles.length > 0
            };
        }
    });
});