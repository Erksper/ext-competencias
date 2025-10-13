define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:seleccionUsuario',
        
        events: {
            'click [data-action="selectUser"]': function (e) {
                var userId = $(e.currentTarget).data('user-id');
                var userName = $(e.currentTarget).data('user-name');
                
                this.getRouter().navigate('#Competencias/survey?teamId=' + this.options.teamId + '&teamName=' + encodeURIComponent(this.options.teamName) + '&userId=' + userId + '&userName=' + encodeURIComponent(userName) + '&role=' + this.options.role, {trigger: true});
            },
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias/roleSelection?teamId=' + this.options.teamId + '&teamName=' + encodeURIComponent(this.options.teamName), {trigger: true});
            },
            'keyup [data-action="filterUsers"]': function (e) {
                this.filterUsers(e);
            },
            'click [data-action="backToHome"]': function () {
                this.getRouter().navigate('#', {trigger: true});
            }
        },
        
        setup: function () {
            this.usuarios = [];
            this.accesoDenegado = false;
            this.encuestaInactiva = false;
            this.wait(true);
            this.cargarDatos();
        },

        cargarDatos: function () {
            this.getModelFactory().create('User', function (userModel) {
                userModel.id = this.getUser().id;
                userModel.fetch({ relations: { roles: true } }).then(function () {
                    this.getCollectionFactory().create('Competencias', function (competenciaCollection) {
                        competenciaCollection.fetch({ 
                            data: { 
                                maxSize: 1,
                                orderBy: 'fechaCierre',
                                order: 'desc'
                            } 
                        }).then(function () {
                            const roles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                            const puedeAcceder = roles.includes('casa nacional') || roles.includes('gerente') || roles.includes('director');

                            if (!puedeAcceder) {
                                this.accesoDenegado = true;
                                this.wait(false);
                                return;
                            }

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

                            this.cargarUsuariosConEstado(fechaInicio, fechaCierre);
                        }.bind(this)).catch(function () {
                            Espo.Ui.error('Error al verificar permisos y período de evaluación.');
                            this.wait(false);
                        }.bind(this));
                    }.bind(this));
                }.bind(this)).catch(function () {
                    Espo.Ui.error('Error al verificar permisos y período de evaluación.');
                    this.wait(false);
                }.bind(this));
            }.bind(this));
        },

        cargarUsuariosConEstado: function (fechaInicio, fechaCierre) {
            this.wait(true);
            
            const getRoleIds = () => {
                return new Promise((resolve, reject) => {
                    this.getCollectionFactory().create('Role', (roleCollection) => {
                        roleCollection.maxSize = 200;
                        roleCollection.where = [{
                            type: 'in',
                            attribute: 'name',
                            value: ['Gerente', 'Director', 'Asesor']
                        }];
                        
                        roleCollection.fetch().then(() => {
                            const roleIdMap = {};
                            roleCollection.forEach(role => {
                                roleIdMap[role.get('name').toLowerCase()] = role.id;
                            });
                            resolve(roleIdMap);
                        }).catch(reject);
                    });
                });
            };

            const getAllTeamUsers = () => {
                return new Promise((resolve, reject) => {
                    const maxSize = 200;
                    let allUsers = [];
                    
                    const fetchPage = (offset) => {
                        $.ajax({
                            url: `api/v1/Team/${this.options.teamId}/users`,
                            data: {
                                select: 'id,name,rolesIds,isActive',
                                maxSize: maxSize,
                                offset: offset
                            }
                        }).then(response => {
                            const users = (response.list || []).filter(u => u.isActive);
                            allUsers = allUsers.concat(users);
                            
                            if (response.list.length < maxSize) {
                                resolve(allUsers);
                            } else {
                                fetchPage(offset + maxSize);
                            }
                        }).catch(reject);
                    };
                    
                    fetchPage(0);
                });
            };

            Promise.all([getRoleIds.call(this), getAllTeamUsers.call(this)]).then(([roleIdMap, teamUsers]) => {
                const rolBuscado = this.options.role.toLowerCase();
                const targetRoleIds = new Set();

                if (rolBuscado === 'gerente') {
                    if (roleIdMap['gerente']) targetRoleIds.add(roleIdMap['gerente']);
                    if (roleIdMap['director']) targetRoleIds.add(roleIdMap['director']);
                } else if (rolBuscado === 'asesor') {
                    if (roleIdMap['asesor']) targetRoleIds.add(roleIdMap['asesor']);
                }

                if (targetRoleIds.size === 0) {
                    this.usuarios = [];
                    this.wait(false);
                    return;
                }

                const usuariosPorRol = teamUsers.filter(user => {
                    const userRoleIds = user.rolesIds || [];
                    return userRoleIds.some(roleId => targetRoleIds.has(roleId));
                });

                if (usuariosPorRol.length === 0) {
                    this.usuarios = [];
                    this.wait(false);
                    return;
                }

                const finalUserIds = usuariosPorRol.map(u => u.id);

                if (fechaCierre) {
                    fechaCierre += ' 23:59:59';
                }

                const getAllEncuestas = () => {
                    return new Promise((resolve, reject) => {
                        const maxSize = 200;
                        let allEncuestas = [];
                        
                        const fetchEncuestasPage = (offset) => {
                            this.getCollectionFactory().create('Encuesta', (encuestaCollection) => {
                                encuestaCollection.maxSize = maxSize;
                                encuestaCollection.offset = offset;
                                encuestaCollection.data = {
                                    select: 'id,usuarioEvaluadoId,estado'
                                };
                                encuestaCollection.where = [
                                    { type: 'in', attribute: 'usuarioEvaluadoId', value: finalUserIds },
                                    { type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: fechaInicio },
                                    { type: 'lessThanOrEquals', attribute: 'fechaCreacion', value: fechaCierre }
                                ];
                                
                                encuestaCollection.fetch().then(() => {
                                    const models = encuestaCollection.models || [];
                                    allEncuestas = allEncuestas.concat(models);
                                    
                                    if (models.length === maxSize && allEncuestas.length < encuestaCollection.total) {
                                        fetchEncuestasPage(offset + maxSize);
                                    } else {
                                        resolve(allEncuestas);
                                    }
                                }).catch(reject);
                            });
                        };
                        
                        fetchEncuestasPage(0);
                    });
                };

                getAllEncuestas.call(this).then((todasLasEncuestas) => {
                    const ultimasEncuestas = {};
                    todasLasEncuestas.forEach((encuesta) => {
                        const userId = encuesta.get('usuarioEvaluadoId');
                        if (!ultimasEncuestas[userId]) {
                            ultimasEncuestas[userId] = encuesta;
                        }
                    });

                    this.usuarios = usuariosPorRol
                        .filter(user => {
                            const encuesta = ultimasEncuestas[user.id];
                            return !encuesta || encuesta.get('estado') !== 'completada';
                        })
                        .map(user => {
                            const encuesta = ultimasEncuestas[user.id];
                            let color = '#f8d7da';
                            
                            if (encuesta) {
                                const estado = encuesta.get('estado');
                                if (estado === 'incompleta') {
                                    color = '#fff3cd'; 
                                } else if (estado === 'revision') {
                                    color = '#d4edda'; 
                                }
                            }
                            
                            return {
                                id: user.id,
                                name: user.name,
                                color: color
                            };
                        });

                    const colorOrder = {
                        '#fff3cd': 1, 
                        '#f8d7da': 2, 
                        '#d4edda': 3  
                    };
                    this.usuarios.sort((a, b) => (colorOrder[a.color] || 99) - (colorOrder[b.color] || 99));

                    this.wait(false);
                }).catch(error => {
                    let errorMessage = 'Error al cargar las encuestas.';
                    if (error && error.responseJSON && error.responseJSON.message) {
                        errorMessage += ' Detalle: ' + error.responseJSON.message;
                    } else if (error && error.statusText) {
                        errorMessage += ' Estado: ' + error.statusText;
                    }
                    Espo.Ui.error(errorMessage);
                    this.wait(false);
                });

            }).catch(error => {
                let errorMessage = 'Error al cargar los datos iniciales.';
                if (error && error.responseJSON && error.responseJSON.message) {
                    errorMessage += ' Detalle: ' + error.responseJSON.message;
                } else if (error && error.statusText) {
                    errorMessage += ' Estado: ' + error.statusText;
                }
                Espo.Ui.error(errorMessage);
                this.wait(false);
            });
        },

        filterUsers: function (e) {
            var searchText = $(e.currentTarget).val().toLowerCase();
            this.$el.find('.user-item').each(function (index, item) {
                var $item = $(item);
                var userName = $item.find('button').data('user-name').toLowerCase();
                $item.toggle(userName.includes(searchText));
            });
        },
        
        data: function () {
            var data = {
                teamName: this.options.teamName,
                role: this.options.role,
                isGerente: this.options.role === 'gerente',
                usuarios: this.usuarios || [],
                accesoDenegado: this.accesoDenegado,
                encuestaInactiva: this.encuestaInactiva
            };
            return data;
        }
    });
});