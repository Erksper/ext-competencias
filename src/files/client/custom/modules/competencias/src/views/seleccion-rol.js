define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:seleccion-rol',
        
        events: {
            'click [data-action="selectRole"]': function (e) {
                var role = $(e.currentTarget).data('role');
                
                this.getRouter().navigate('#Competencias/userSelection?teamId=' + this.options.teamId + '&teamName=' + encodeURIComponent(this.options.teamName) + '&role=' + role, {trigger: true});
            },
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias/teamSelection', {trigger: true});
            }
        },
        
        data: function () {
            return {
                teamName: this.options.teamName
            };
        }
    });
});