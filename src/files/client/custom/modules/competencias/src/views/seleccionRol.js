define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:seleccionRol',
        
        events: {
            'click [data-action="selectRole"]': function (e) {
                var role = $(e.currentTarget).data('role');
                
                this.getRouter().navigate('#Competencias/userSelection?teamId=' + this.options.teamId + '&teamName=' + encodeURIComponent(this.options.teamName) + '&role=' + role, {trigger: true});
            },
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias/teamSelection', {trigger: true});
            },
            'click [data-action="backToHome"]': function () {
                this.getRouter().navigate('#', {trigger: true});
            }
        },
        
        setup: function () {
            this.accesoDenegado = false;
            this.encuestaInactiva = false;
            this.wait(true);

            this.getModelFactory().create('User', function (userModel) {
                userModel.id = this.getUser().id;
                userModel.fetch({ relations: { roles: true } }).then(function () {
                    this.getCollectionFactory().create('Competencias', function (competenciaCollection) {
                        competenciaCollection.fetch({ data: { maxSize: 1 } }).then(function () {
                            const roles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                            const puedeAcceder = roles.includes('casa nacional') || roles.includes('gerente') || roles.includes('director');

                            if (!puedeAcceder) {
                                this.accesoDenegado = true;
                                this.wait(false);
                                return;
                            }

                            let encuestaActiva = false;
                            if (competenciaCollection.total > 0) {
                                const competencia = competenciaCollection.at(0);
                                const fechaInicio = competencia.get('fechaInicio');
                                const fechaCierre = competencia.get('fechaCierre');

                                if (fechaInicio && fechaCierre) {
                                    const hoy = new Date().toISOString().split('T')[0];
                                    encuestaActiva = (hoy >= fechaInicio && hoy <= fechaCierre);
                                }
                            }

                            if (!encuestaActiva) {
                                this.encuestaInactiva = true;
                            }
                            
                            this.wait(false);
                        }.bind(this)).catch(function (error) {
                            Espo.Ui.error('Error al verificar permisos y período de evaluación.');
                            this.wait(false);
                        }.bind(this));
                    }.bind(this));
                }.bind(this)).catch(function (error) {
                    Espo.Ui.error('Error al verificar permisos y período de evaluación.');
                    this.wait(false);
                }.bind(this));
            }.bind(this));
        },
        
        data: function () {
            return {
                teamId: this.options.teamId,
                teamName: this.options.teamName,
                accesoDenegado: this.accesoDenegado,
                encuestaInactiva: this.encuestaInactiva
            };
        }
    });
});