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
            }
        },
        
        setup: function () {
            this.wait(true);
            this.cargarUsuarios();
        },
        
        cargarUsuarios: function () {
            console.log('🔄 NUEVA VERSIÓN - Cargando usuarios para:', {
                teamId: this.options.teamId,
                role: this.options.role
            });
            
            this.cargarUsuariosAPI();
        },

        filterUsers: function (e) {
            var searchText = $(e.currentTarget).val().toLowerCase();
            this.$el.find('.user-item').each(function (index, item) {
                var $item = $(item);
                var userName = $item.find('button').data('user-name').toLowerCase();
                $item.toggle(userName.includes(searchText));
            });
        },
        
        cargarUsuariosAPI: function () {
            $.ajax({
                url: 'api/v1/Team/' + this.options.teamId,
                type: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                success: function (team) {
                    console.log('✅ Team cargado:', team);
                    this.obtenerUsuariosDelEquipo(team);
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('❌ Error cargando team:', error);
                    this.cargarUsuariosFallback();
                }.bind(this)
            });
        },
        
        obtenerUsuariosDelEquipo: function (team) {
            console.log('🔍 CÓDIGO ACTUALIZADO - obtenerUsuariosDelEquipo ejecutándose');
            
            $.ajax({
                url: 'api/v1/Team/' + this.options.teamId + '/users',
                type: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                success: function (response) {
                    console.log('🟢 NUEVA VERSIÓN EJECUTÁNDOSE CORRECTAMENTE');
                    console.log('===== DEBUGGING USUARIOS CON cRol =====');
                    console.log('Respuesta completa:', response);
                    console.log('Rol que estamos buscando:', this.options.role);
                    
                    var usuarios = [];
                    var todosLosRoles = [];
                    
                    if (response.list && response.list.length > 0) {
                        response.list.forEach(function (user) {
                            console.log('👤 Procesando usuario:', user.name);
                            console.log('🏷️ Campo cRol:', user.cRol);
                            console.log('📋 Todas las propiedades:', Object.keys(user));
                            
                            if (user.cRol) {
                                todosLosRoles.push(user.cRol);
                            }
                            
                            // Normalizar valores
                            var rolUsuario = user.cRol ? user.cRol.toString().toLowerCase().trim() : '';
                            var rolBuscado = this.options.role.toLowerCase();
                            
                            console.log('🔍 Comparación:', {
                                rolUsuarioNormalizado: rolUsuario,
                                rolBuscado: rolBuscado
                            });
                            
                            // Lógica de filtrado exacta
                            var incluir = false;
                            
                            if (rolBuscado === 'gerente') {
                                incluir = (rolUsuario === 'gerente' || rolUsuario === 'director');
                                console.log('🎯 Búsqueda gerente/director:', incluir);
                            } else if (rolBuscado === 'asesor') {
                                incluir = (rolUsuario === 'asesor');
                                console.log('🎯 Búsqueda asesor:', incluir);
                            }
                            
                            if (incluir) {
                                console.log('✅ INCLUIDO:', user.name);
                                usuarios.push({
                                    id: user.id,
                                    name: user.name || user.userName,
                                    rol: user.cRol
                                });
                            } else {
                                console.log('❌ EXCLUIDO:', user.name);
                            }
                        }.bind(this));
                    }
                    
                    console.log('📊 Todos los roles encontrados:', todosLosRoles);
                    console.log('👥 Usuarios filtrados finales:', usuarios);
                    console.log('🔢 Total filtrados:', usuarios.length);
                    console.log('===== FIN DEBUG =====');
                    
                    // Aplicar filtro de historial de encuestas
                    this.filtrarUsuariosPorHistorial(usuarios);

                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('❌ Error obteniendo usuarios del equipo:', error);
                    this.cargarUsuariosFallback();
                }.bind(this)
            });
        },

        filtrarUsuariosPorHistorial: function(usuariosPorRol) {
            if (!usuariosPorRol || usuariosPorRol.length === 0) {
                console.log('No hay usuarios por rol para filtrar por historial.');
                this.usuarios = [];
                this.wait(false);
                return;
            }

            console.log('🔍 Filtrando', usuariosPorRol.length, 'usuarios por historial de encuestas...');
            var userIds = usuariosPorRol.map(u => u.id);

            this.getCollectionFactory().create('Encuesta', function(collection) {
                collection.fetch({
                    data: {
                        where: [
                            { type: 'in', attribute: 'usuarioEvaluadoId', value: userIds }
                        ],
                        maxSize: 2000 // Un número grande para obtener todas las encuestas de los usuarios
                    },
                    success: function(encuestasCollection) {
                        var ultimasEncuestas = {};
                        encuestasCollection.forEach(function(encuesta) {
                            var userId = encuesta.get('usuarioEvaluadoId');
                            var fechaMod = new Date(encuesta.get('fechaModificacion'));

                            if (!ultimasEncuestas[userId] || fechaMod > new Date(ultimasEncuestas[userId].get('fechaModificacion'))) {
                                ultimasEncuestas[userId] = encuesta;
                            }
                        });

                        console.log('🗺️ Mapa de últimas encuestas creado:', ultimasEncuestas);

                        var fechaLimite = new Date();
                        fechaLimite.setMonth(fechaLimite.getMonth() - 6);
                        console.log('🗓️ Fecha límite (6 meses atrás):', fechaLimite.toISOString());

                        var usuariosFinales = usuariosPorRol.filter(function(user) {
                            var ultimaEncuesta = ultimasEncuestas[user.id];

                            if (!ultimaEncuesta) {
                                console.log('✅ INCLUIR (sin encuesta):', user.name);
                                return true; // No tiene encuestas, se incluye
                            }

                            if (ultimaEncuesta.get('estado') === 'incompleta') {
                                console.log('✅ INCLUIR (incompleta):', user.name);
                                return true; // Tiene encuesta incompleta, se incluye
                            }

                            // Si está completada, verificar la fecha
                            var fechaModEncuesta = new Date(ultimaEncuesta.get('fechaModificacion'));
                            if (fechaModEncuesta < fechaLimite) {
                                console.log('✅ INCLUIR (completada > 6 meses):', user.name);
                                return true; // Completada hace más de 6 meses, se incluye
                            }

                            console.log('❌ EXCLUIR (completada < 6 meses):', user.name, ' - Fecha:', fechaModEncuesta.toISOString());
                            return false; // Completada hace menos de 6 meses, se excluye
                        });

                        console.log('👥 Usuarios finales tras filtro de historial:', usuariosFinales);
                        this.usuarios = usuariosFinales;
                        this.wait(false);

                    }.bind(this),
                    error: function() {
                        console.error('❌ Error al obtener el historial de encuestas. Mostrando todos los usuarios del rol como fallback.');
                        this.usuarios = usuariosPorRol;
                        this.wait(false);
                    }.bind(this)
                });
            }.bind(this));
        },
        
        cargarUsuariosFallback: function () {
            console.log('🔄 Método fallback ejecutándose');
            
            $.ajax({
                url: 'api/v1/User',
                type: 'GET',
                data: {
                    maxSize: 50,
                    where: [
                        {
                            type: 'isTrue',
                            attribute: 'isActive'
                        }
                    ]
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                success: function (response) {
                    console.log('📋 Todos los usuarios activos:', response);
                    
                    var usuarios = [];
                    if (response.list) {
                        response.list.forEach(function (user) {
                            var rolUsuario = user.cRol ? user.cRol.toLowerCase().trim() : '';
                            var rolBuscado = this.options.role.toLowerCase();
                            
                            var incluir = false;
                            if (rolBuscado === 'gerente') {
                                incluir = (rolUsuario === 'gerente' || rolUsuario === 'director');
                            } else if (rolBuscado === 'asesor') {
                                incluir = (rolUsuario === 'asesor');
                            }
                            
                            if (incluir) {
                                usuarios.push({
                                    id: user.id,
                                    name: user.name || user.userName,
                                    rol: user.cRol
                                });
                            }
                        }.bind(this));
                    }
                    
                    if (usuarios.length === 0) {
                        console.log('⚠️ No hay usuarios, creando datos de prueba');
                        usuarios = [
                            {
                                id: 'test-' + this.options.role + '-1', 
                                name: 'Prueba ' + this.options.role + ' 1',
                                rol: this.options.role
                            }
                        ];
                    }
                    
                    // Aplicar filtro de historial también en el fallback
                    this.filtrarUsuariosPorHistorial(usuarios);
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('❌ Error en fallback:', error);
                    this.usuarios = [
                        {
                            id: 'error-user', 
                            name: 'Usuario de Error',
                            rol: this.options.role
                        }
                    ];
                    this.wait(false);
                }.bind(this)
            });
        },
        
        data: function () {
            var data = {
                teamName: this.options.teamName,
                role: this.options.role,
                isGerente: this.options.role === 'gerente',
                usuarios: this.usuarios || []
            };
            
            console.log('📤 Data enviada al template:', data);
            
            return data;
        }
    });
});