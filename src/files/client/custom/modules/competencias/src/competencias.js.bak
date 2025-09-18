define(['controller'], function (Controller) {
    
    return Controller.extend({
        
        // Página principal
        actionIndex: function () {
            this.entire('#Competencias', 'competencias:views/competenciasIndex', {});
        },

        // Selección de equipo
        actionTeamSelection: function () {
            this.entire('#Competencias/teamSelection', 'competencias:views/seleccionEquipo', {});
        },

        // Selección de rol
        actionRoleSelection: function () {
            var params = this.getParams();
            
            this.entire('#Competencias/roleSelection', 'competencias:views/seleccionRol', {
                teamId: params.teamId,
                teamName: params.teamName
            });
        },

        // Selección de usuario
        actionUserSelection: function () {
            var params = this.getParams();
            
            this.entire('#Competencias/userSelection', 'competencias:views/seleccionUsuario', {
                teamId: params.teamId,
                teamName: params.teamName,
                role: params.role
            });
        },

        // Encuesta
        actionSurvey: function () {
            var params = this.getParams();
            
            console.log('🎯 Controlador survey llamado con params:', params);
            
            this.entire('#Competencias/survey', 'competencias:views/encuesta', {
                teamId: params.teamId,
                teamName: params.teamName,
                userId: params.userId,
                userName: params.userName,
                role: params.role
            });
        },

        // Reportes  
        actionReportes: function () {
            this.entire('#Competencias/reportes', 'competencias:views/reportes', {});
        },

        // Utilidad para obtener parámetros de la URL
        getParams: function () {
            var params = {};
            var hash = window.location.hash;
            
            if (hash.includes('?')) {
                var queryString = hash.split('?')[1];
                var pairs = queryString.split('&');
                
                pairs.forEach(function(pair) {
                    var parts = pair.split('=');
                    if (parts.length === 2) {
                        params[parts[0]] = decodeURIComponent(parts[1]);
                    }
                });
            }
            
            return params;
        }
    });
});