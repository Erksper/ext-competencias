define(['controllers/base'], function (BaseController) {
    return BaseController.extend({
        
        checkAccess: function () {
            return true;
        },
        
        actionList: function () {
            console.log('Cargando aplicación Competencias directamente');
            this.entire('CompetenciasIndex', {}, function (view) {
                view.render();
            });
        },
        
        defaultAction: 'list'
    });
});