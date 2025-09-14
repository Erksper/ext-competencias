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
            // Usar API estándar de EspoCRM en lugar de rutas custom
            this.getModelFactory().create('Team', function (model) {
                model.fetch().then(function () {
                    // Si esto funciona, usar la colección
                    this.getCollectionFactory().create('Team', function (collection) {
                        collection.fetch().then(function () {
                            console.log('Equipos cargados desde colección:', collection.models);
                            
                            var equipos = [];
                            collection.models.forEach(function (team) {
                                equipos.push({
                                    id: team.get('id'),
                                    name: team.get('name')
                                });
                            });
                            
                            this.equipos = equipos;
                            this.wait(false);
                        }.bind(this)).catch(function (error) {
                            console.error('Error con colección:', error);
                            this.cargarEquiposDirecto();
                        }.bind(this));
                    }.bind(this));
                }.bind(this)).catch(function (error) {
                    console.error('Error con modelo:', error);
                    this.cargarEquiposDirecto();
                }.bind(this));
            }.bind(this));
        },
        
        // Método alternativo usando AJAX directo a la API de EspoCRM
        cargarEquiposDirecto: function () {
            $.ajax({
                url: 'api/v1/Team',
                type: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                success: function (response) {
                    console.log('Equipos cargados desde API:', response);
                    
                    var equipos = [];
                    if (response.list) {
                        response.list.forEach(function (team) {
                            equipos.push({
                                id: team.id,
                                name: team.name
                            });
                        });
                    }
                    
                    this.equipos = equipos;
                    this.wait(false);
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('Error cargando equipos desde API:', error);
                    Espo.Ui.error('Error cargando equipos: ' + error);
                    
                    // Como último recurso, datos hardcodeados para testing
                    this.equipos = [
                        {id: 'test1', name: 'Equipo de Prueba 1'},
                        {id: 'test2', name: 'Equipo de Prueba 2'}
                    ];
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