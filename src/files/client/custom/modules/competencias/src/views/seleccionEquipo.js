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

            const getAllTeams = () => {
                return new Promise((resolve, reject) => {
                    const maxSize = 200;
                    let allTeams = [];
                    
                    const fetchPage = (offset) => {
                        this.getCollectionFactory().create('Team', (collection) => {
                            collection.maxSize = maxSize;
                            collection.offset = offset;
                            
                            collection.fetch().then(() => {
                                const models = collection.models || [];
                                allTeams = allTeams.concat(models);

                                if (models.length === maxSize && allTeams.length < collection.total) {
                                    fetchPage(offset + maxSize);
                                } else {
                                    resolve(allTeams);
                                }
                            }).catch(reject);
                        });
                    };
                    
                    fetchPage(0);
                });
            };

            const getAllRevisionSurveys = () => {
                return new Promise((resolve, reject) => {
                    const maxSize = 200;
                    let allSurveys = [];
                    
                    const fetchPage = (offset) => {
                        this.getCollectionFactory().create('Encuesta', (collection) => {
                            collection.maxSize = maxSize;
                            collection.offset = offset;
                            collection.data = {
                                select: 'equipoId'
                            };
                            collection.where = [
                                { attribute: 'estado', type: 'equals', value: 'revision' },
                                { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: fechaInicio },
                                { type: 'lessThanOrEquals', attribute: 'fechaCreacion', value: fechaCierre }
                            ];
                            
                            collection.fetch().then(() => {
                                const models = collection.models || [];
                                allSurveys = allSurveys.concat(models);
                                
                                if (models.length === maxSize && allSurveys.length < collection.total) {
                                    fetchPage(offset + maxSize);
                                } else {
                                    resolve(allSurveys);
                                }
                            }).catch(reject);
                        });
                    };
                    
                    fetchPage(0);
                });
            };

            Promise.all([
                getAllTeams.call(this), 
                getAllRevisionSurveys.call(this)
            ]).then(([allTeams, allSurveys]) => {
                const equiposConRevision = new Set();
                allSurveys.forEach(encuesta => {
                    if (encuesta.get('equipoId')) {
                        equiposConRevision.add(encuesta.get('equipoId'));
                    }
                });
                
                this.equipos = allTeams.map(team => {
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
                console.error('Error al cargar equipos:', error);
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