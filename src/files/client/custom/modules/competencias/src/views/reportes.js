define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:reportes',
        
        events: {
            'click [data-action="reporteAsesores"]': function () {
                this.verReporteAsesores();
            },
            'click [data-action="reporteGerentes"]': function () {
                this.verReporteGerentes();
            },
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias', {trigger: true});
            }
        },
        
        setup: function () {
            console.log('🏗️ Configurando vista de reportes');
            this.reportesDisponibles = [];
            this.usuarioActual = this.getUser();
            this.wait(true);
            this.verificarReportesDisponibles();
        },

        verificarReportesDisponibles: function () {
            console.log('🔍 Verificando reportes disponibles para usuario:', this.usuarioActual.get('name'));
            
            // Verificar si hay encuestas disponibles y qué tipos de reportes puede ver este usuario
            $.ajax({
                url: 'api/v1/action/verificarReportesDisponibles',
                type: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({
                    userId: this.usuarioActual.get('id'),
                    userName: this.usuarioActual.get('name'),
                    userType: this.usuarioActual.get('type')
                }),
                success: function (response) {
                    console.log('✅ Reportes disponibles:', response);
                    
                    if (response.success) {
                        this.reportesDisponibles = response.reportes || [];
                        this.estadisticasGenerales = response.estadisticas || {};
                    } else {
                        console.warn('⚠️ No se pudieron verificar los reportes disponibles');
                        this.reportesDisponibles = [];
                    }
                    
                    this.wait(false);
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('❌ Error verificando reportes:', error);
                    Espo.Ui.error('Error al cargar los reportes disponibles');
                    
                    // Fallback: mostrar reportes básicos sin filtrado
                    this.reportesDisponibles = [
                        {tipo: 'asesores', titulo: 'Reporte de Asesores', disponible: true},
                        {tipo: 'gerentes', titulo: 'Reporte de Gerentes', disponible: true}
                    ];
                    this.wait(false);
                }.bind(this)
            });
        },

        verReporteAsesores: function () {
            console.log('📊 Navegando a reporte de asesores');
            this.getRouter().navigate('#Competencias/reporteAsesores', {trigger: true});
        },

        verReporteGerentes: function () {
            console.log('📊 Navegando a reporte de gerentes');
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