define(['view'], function (View) {
    return View.extend({
        template: 'competencias:competenciasIndex',
        
        events: {
            'click [data-action="startSurvey"]': function () {
                this.getRouter().navigate('#Competencias/teamSelection', {trigger: true});
            },
            'click [data-action="viewReports"]': function () {
                this.getRouter().navigate('#Competencias/reportes', {trigger: true});
            }
        }
    });
});