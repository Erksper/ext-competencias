define(['controllers/base'], function (BaseController) {
    return BaseController.extend({
        
        checkAccess: function () {
            return true;
        },
        
        actionList: function () {
            console.log('Redirigiendo desde actionList a CompetenciasApp');
            this.getRouter().navigate('#CompetenciasApp', {trigger: true, replace: true});
        },
        
        actionIndex: function () {
            console.log('Redirigiendo desde actionIndex a CompetenciasApp');
            this.getRouter().navigate('#CompetenciasApp', {trigger: true, replace: true});
        },
        
        defaultAction: 'list'
    });
});