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
            },
            'keyup [data-action="filterTeams"]': function (e) {
                this.filterTeams(e);
            }
        },
        
        setup: function () {
            this.equipos = [];
            this.accesoDenegado = false;
            this.sinOficinaAsignada = false;

            this.wait(true);
            
            var user = this.getUser();
            this.getModelFactory().create('User', function (userModel) {
                userModel.id = user.id;
                // Fetch user with roles and teams relationships
                userModel.fetch({ relations: { roles: true, teams: true } }).then(function() {
                    var roles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                    
                    var esCasaNacional = roles.includes('casa nacional');
                    var esGerenteODirector = roles.includes('gerente') || roles.includes('director');

                    if (esCasaNacional) {
                        this.accesoDenegado = false;
                        this.cargarTodosLosEquipos();
                    } else if (esGerenteODirector) {
                        this.accesoDenegado = false;
                        var teamIds = userModel.get('teamsIds') || [];
                        var teamNames = userModel.get('teamsNames') || {};

                        if (teamIds.length > 0) {
                            this.equipos = teamIds.map(function(id) {
                                return {
                                    id: id,
                                    name: teamNames[id]
                                };
                            });
                            this.wait(false);
                        } else {
                            this.sinOficinaAsignada = true;
                            this.wait(false);
                        }
                    } else {
                        // Asesor u otro rol no permitido para seleccionar equipo
                        this.accesoDenegado = true;
                        this.wait(false);
                    }
                }.bind(this));
            }.bind(this));
        },
        
        filterTeams: function (e) {
            var searchText = $(e.currentTarget).val().toLowerCase();
            this.$el.find('.team-item').each(function (index, item) {
                var $item = $(item);
                var teamName = $item.find('button').data('team-name').toLowerCase();
                $item.toggle(teamName.includes(searchText));
            });
        },

        cargarTodosLosEquipos: function () {
            this.getCollectionFactory().create('Team', function (collection) {
                collection.fetch().then(function () {
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
                    console.error('Error cargando todos los equipos:', error);
                    Espo.Ui.error('Error al cargar la lista de oficinas.');
                    this.wait(false);
                }.bind(this));
            }.bind(this));
        },
        
        data: function () {
            return {
                equipos: this.equipos || [],
                accesoDenegado: this.accesoDenegado,
                sinOficinaAsignada: this.sinOficinaAsignada
            };
        }
    });
});