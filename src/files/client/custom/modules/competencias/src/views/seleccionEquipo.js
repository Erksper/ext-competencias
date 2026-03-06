define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:seleccionEquipo',
        
        events: {
            'click [data-action="selectTeam"]': function (e) {
                var teamId   = $(e.currentTarget).data('team-id');
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
            this.equipos             = [];
            this.accesoDenegado      = false;
            this.sinOficinaAsignada  = false;
            this.encuestaInactiva    = false;
            this.esCasaNacional      = false;

            this.wait(true);
            
            var user = this.getUser();
            this.getModelFactory().create('User', function (userModel) {
                userModel.id = user.id;
                userModel.fetch({ relations: { roles: true, teams: true } }).then(function() {
                    var roles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                    
                    this.esCasaNacional = roles.includes('casa nacional');
                    // Grupo 1: gerente, director, coordinador
                    var esGerenteDirectorCoord = roles.includes('gerente') || roles.includes('director') || roles.includes('coordinador');

                    if (this.esCasaNacional) {
                        this.cargarDatosPeriodo();
                    } else if (esGerenteDirectorCoord) {
                        this.accesoDenegado = false;
                        var teamIds   = userModel.get('teamsIds')   || [];
                        var teamNames = userModel.get('teamsNames') || {};

                        if (teamIds.length > 0) {
                            const claPattern = /^CLA\d+$/i;
                            const filteredTeamIds = teamIds.filter(id => !claPattern.test(id));
                            this.equipos = filteredTeamIds.map(function (id) {
                                return { id: id, name: teamNames[id] };
                            }).filter(team => team.name && team.name.toLowerCase() !== 'venezuela');
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
            this.getCollectionFactory().create('Competencias', function (col) {
                col.fetch({ data: { maxSize: 1, orderBy: 'fechaCierre', order: 'desc' } }).then(function () {
                    let fechaInicio = null, fechaCierre = null, encuestaActiva = false;
                    if (col.total > 0) {
                        const comp = col.at(0);
                        fechaInicio = comp.get('fechaInicio');
                        fechaCierre = comp.get('fechaCierre');
                        if (fechaInicio && fechaCierre) {
                            const hoy = new Date().toISOString().split('T')[0];
                            encuestaActiva = (hoy >= fechaInicio && hoy <= fechaCierre);
                        }
                    }
                    if (!encuestaActiva) {
                        this.encuestaInactiva = true; this.wait(false); return;
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
                var $item    = $(item);
                var teamName = $item.find('button').data('team-name').toLowerCase();
                $item.toggle(teamName.includes(searchText));
            });
        },

        cargarEquiposConEstado: function (fechaInicio, fechaCierre) {
            if (fechaCierre) fechaCierre += ' 23:59:59';

            const getAllTeams = () => new Promise((resolve, reject) => {
                const maxSize = 200; let allTeams = [];
                const fetchPage = (offset) => {
                    this.getCollectionFactory().create('Team', (col) => {
                        col.maxSize = maxSize; col.offset = offset;
                        col.fetch().then(() => {
                            allTeams = allTeams.concat(col.models || []);
                            if ((col.models || []).length === maxSize && allTeams.length < col.total) fetchPage(offset + maxSize);
                            else resolve(allTeams);
                        }).catch(reject);
                    });
                };
                fetchPage(0);
            });

            const getAllRevisionSurveys = () => new Promise((resolve, reject) => {
                const maxSize = 200; let all = [];
                const fetchPage = (offset) => {
                    this.getCollectionFactory().create('Encuesta', (col) => {
                        col.maxSize = maxSize; col.offset = offset;
                        col.data  = { select: 'equipoId' };
                        col.where = [
                            { attribute: 'estado', type: 'equals', value: 'revision' },
                            { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: fechaInicio },
                            { type: 'lessThanOrEquals',    attribute: 'fechaCreacion', value: fechaCierre }
                        ];
                        col.fetch().then(() => {
                            all = all.concat(col.models || []);
                            if ((col.models || []).length === maxSize && all.length < col.total) fetchPage(offset + maxSize);
                            else resolve(all);
                        }).catch(reject);
                    });
                };
                fetchPage(0);
            });

            Promise.all([getAllTeams.call(this), getAllRevisionSurveys.call(this)]).then(([allTeams, allSurveys]) => {
                const equiposConRevision = new Set();
                allSurveys.forEach(enc => { if (enc.get('equipoId')) equiposConRevision.add(enc.get('equipoId')); });

                const claPattern = /^CLA\d+$/i;
                this.equipos = allTeams
                    .filter(team => {
                        const tname = team.get('name') || '';
                        return !claPattern.test(team.id) && tname.toLowerCase() !== 'venezuela';
                    })
                    .map(team => {
                        const tieneRevision = equiposConRevision.has(team.id);
                        return { id: team.id, name: team.get('name'), color: tieneRevision ? '#d4edda' : 'transparent', sortOrder: tieneRevision ? 1 : 2 };
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
                equipos:            this.equipos || [],
                accesoDenegado:     this.accesoDenegado,
                sinOficinaAsignada: this.sinOficinaAsignada,
                encuestaInactiva:   this.encuestaInactiva,
                esCasaNacional:     this.esCasaNacional
            };
        }
    });
});