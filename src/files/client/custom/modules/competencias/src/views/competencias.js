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
                teamName: decodeURIComponent(options.teamName)
            });
        },
        
        userSelection: function (options) {
            this.main('CompetenciasSeleccionUsuario', {
                teamId: options.teamId,
                teamName: decodeURIComponent(options.teamName),
                role: options.role
            });
        },
        
        survey: function (options) {
            this.main('CompetenciasEncuesta', {
                teamId: options.teamId,
                teamName: decodeURIComponent(options.teamName),
                userId: options.userId,
                userName: decodeURIComponent(options.userName),
                role: options.role
            });
        }
    });
});