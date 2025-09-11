define(['controller'], function (Controller) {
    console.log('Controlador Competencias cargado!');
    
    return Controller.extend({
        
        checkAccess: function () {
            return true;
        },
        
        index: function () {
            console.log('Acción index ejecutada!');
            this.entire('CompetenciasIndex', {}, function (view) {
                view.render();
            });
        },
        
        teamSelection: function () {
            console.log('Acción teamSelection ejecutada!');
            this.entire('CompetenciasSeleccionEquipo', {}, function (view) {
                view.render();
            });
        },
        
        roleSelection: function () {
            var params = this.getRouter().getParams();
            console.log('Acción roleSelection ejecutada con params:', params);
            
            this.entire('CompetenciasSeleccionRol', {
                teamId: params.teamId,
                teamName: decodeURIComponent(params.teamName || '')
            }, function (view) {
                view.render();
            });
        },
        
        userSelection: function () {
            var params = this.getRouter().getParams();
            console.log('Acción userSelection ejecutada con params:', params);
            
            this.entire('CompetenciasSeleccionUsuario', {
                teamId: params.teamId,
                teamName: decodeURIComponent(params.teamName || ''),
                role: params.role
            }, function (view) {
                view.render();
            });
        },
        
        survey: function () {
            var params = this.getRouter().getParams();
            console.log('Acción survey ejecutada con params:', params);
            
            this.entire('CompetenciasEncuesta', {
                teamId: params.teamId,
                teamName: decodeURIComponent(params.teamName || ''),
                userId: params.userId,
                userName: decodeURIComponent(params.userName || ''),
                role: params.role
            }, function (view) {
                view.render();
            });
        }
    });
});