define(['controller'], function (Controller) {
    
    return Controller.extend({
        
        defaultAction: 'index',
        
        index: function () {
            this.main('CompetenciasIndex');
        },
        
        teamSelection: function () {
            this.main('CompetenciasSeleccionEquipo');
        },
        
        roleSelection: function (options) {
            this.main('CompetenciasSeleccionRol', {
                teamId: options.teamId,
                teamName: options.teamName
            });
        },
        
        userSelection: function (options) {
            this.main('CompetenciasSeleccionUsuario', {
                teamId: options.teamId,
                teamName: options.teamName,
                role: options.role
            });
        },
        
        survey: function (options) {
            this.main('CompetenciasEncuesta', {
                teamId: options.teamId,
                teamName: options.teamName,
                userId: options.userId,
                userName: options.userName,
                role: options.role
            });
        }
    });
});