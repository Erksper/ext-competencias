define(['controllers/list'], function (ListController) {
    return ListController.extend({
        defaultAction: 'list',
        
        beforeBeforeRender: function () {
            this.getRouter().navigate('#CompetenciasModule', {trigger: true});
        }
    });
});