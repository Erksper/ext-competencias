define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:seleccionEquipo',
        
        events: {
            'click [data-action="selectTeam"]': function (e) {
                var teamId = $(e.currentTarget).data('team-id');
                var teamName = $(e.currentTarget).data('team-name');
                
                this.getRouter().navigate('#Competencias/roleSelection?teamId=' + teamId + '&teamName=' + encodeURIComponent(teamName), {trigger: true});
            },
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias', {trigger: true});
            }
        },
        
        setup: function () {
            this.wait(true);
            this.cargarEquipos();
        },
        
        cargarEquipos: function () {
            $.ajax({
                url: 'Competencias/obtenerEquipos',
                type: 'GET',
                success: function (equipos) {
                    console.log('Equipos cargados:', equipos);
                    this.equipos = equipos;
                    this.wait(false);
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('Error cargando equipos:', error);
                    Espo.Ui.error('Error cargando equipos: ' + error);
                    this.wait(false);
                }.bind(this)
            });
        },
        
        data: function () {
            return {
                equipos: this.equipos || []
            };
        }
    });
});