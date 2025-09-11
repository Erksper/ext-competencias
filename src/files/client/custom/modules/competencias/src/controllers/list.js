define(['controllers/list'], function (ListController) {
    return ListController.extend({
        defaultAction: 'list',
        
        beforeBeforeRender: function () {
            console.log('Redirigiendo desde entidad Competencias a CompetenciasApp');
            this.getRouter().navigate('#CompetenciasApp', {trigger: true, replace: true});
            return false;
        },
        
        list: function () {
            this.getRouter().navigate('#CompetenciasApp', {trigger: true, replace: true});
        }
    });
});