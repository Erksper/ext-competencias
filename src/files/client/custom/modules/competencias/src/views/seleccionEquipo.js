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
            this.encuestaInactiva = false;
            this.esCasaNacional = false;

            this.wait(true);
            
            var user = this.getUser();
            this.getModelFactory().create('User', function (userModel) {
                userModel.id = user.id;
                userModel.fetch({ relations: { roles: true, teams: true } }).then(function() {
                    var roles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                    
                    this.esCasaNacional = roles.includes('casa nacional');
                    var esGerenteODirector = roles.includes('gerente') || roles.includes('director');

                    if (this.esCasaNacional) {
                        this.cargarDatosPeriodo();
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
                        this.accesoDenegado = true;
                        this.wait(false);
                    }
                }.bind(this));
            }.bind(this));
        },
        
        cargarDatosPeriodo: function() {
            this.getCollectionFactory().create('Competencias', function (competenciaCollection) {
                competenciaCollection.fetch({ 
                    data: { 
                        maxSize: 1,
                        orderBy: 'fechaCierre',
                        order: 'desc'
                    } 
                }).then(function () {
                    let fechaInicio = null;
                    let fechaCierre = null;
                    let encuestaActiva = false;

                    if (competenciaCollection.total > 0) {
                        const competencia = competenciaCollection.at(0);
                        fechaInicio = competencia.get('fechaInicio');
                        fechaCierre = competencia.get('fechaCierre');

                        if (fechaInicio && fechaCierre) {
                            const hoy = new Date().toISOString().split('T')[0];
                            encuestaActiva = (hoy >= fechaInicio && hoy <= fechaCierre);
                        }
                    }

                    if (!encuestaActiva) {
                        this.encuestaInactiva = true;
                        this.wait(false);
                        return;
                    }

                    this.cargarEquiposConEstado(fechaInicio, fechaCierre);
                }.bind(this)).catch(function () {
                    Espo.Ui.error('Error al verificar el período de evaluación.');
                    this.wait(false);
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

        cargarEquiposConEstado: function (fechaInicio, fechaCierre) {
            if (fechaCierre) {
                fechaCierre += ' 23:59:59';
            }

            const getTeams = new Promise((resolve, reject) => {
                this.getCollectionFactory().create('Team', (collection) => {
                    collection.fetch({
                        data: {
                            maxSize: 500 
                        }
                    }).then(() => resolve(collection)).catch(reject);
                });
            });

            const getRevisionSurveys = new Promise((resolve, reject) => {
                this.getCollectionFactory().create('Encuesta', (collection) => {
                    collection.fetch({
                        data: {
                            select: 'equipoId',
                            where: [
                                { attribute: 'estado', type: 'equals', value: 'revision' },
                                { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: fechaInicio },
                                { type: 'lessThanOrEquals', attribute: 'fechaCreacion', value: fechaCierre }
                            ]
                        }
                    }).then(() => resolve(collection)).catch(reject);
                });
            });

            Promise.all([getTeams, getRevisionSurveys]).then(([teamCollection, encuestaCollection]) => {
                const equiposConRevision = new Set();
                (encuestaCollection.models || []).forEach(encuesta => {
                    if (encuesta.get('equipoId')) {
                        equiposConRevision.add(encuesta.get('equipoId'));
                    }
                });
                
                this.equipos = (teamCollection.models || []).map(team => {
                    const tieneRevision = equiposConRevision.has(team.id);
                    return {
                        id: team.id,
                        name: team.get('name'),
                        color: tieneRevision ? '#d4edda' : 'transparent',
                        sortOrder: tieneRevision ? 1 : 2
                    };
                });

                this.equipos.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

                this.wait(false);
            }).catch(error => {
                Espo.Ui.error('Error al cargar la lista de oficinas con su estado.');
                this.wait(false);
            });
        },
        
        data: function () {
            return {
                equipos: this.equipos || [],
                accesoDenegado: this.accesoDenegado,
                sinOficinaAsignada: this.sinOficinaAsignada,
                encuestaInactiva: this.encuestaInactiva,
                esCasaNacional: this.esCasaNacional
            };
        }
    });
});
