define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:user-selection',
        
        events: {
            'click [data-action="selectUser"]': function (e) {
                var userId = $(e.currentTarget).data('user-id');
                var userName = $(e.currentTarget).data('user-name');
                
                this.getRouter().navigate('#Competencias/survey?teamId=' + this.options.teamId + '&teamName=' + encodeURIComponent(this.options.teamName) + '&userId=' + userId + '&userName=' + encodeURIComponent(userName) + '&role=' + this.options.role, {trigger: true});
            },
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias/roleSelection?teamId=' + this.options.teamId + '&teamName=' + encodeURIComponent(this.options.teamName), {trigger: true});
            }
        },
        
        setup: function () {
            this.wait(true);
            this.cargarUsuarios();
        },
        
        cargarUsuarios: function () {
            $.ajax({
                url: 'Competencias/obtenerUsuariosEquipo',
                type: 'POST',
                data: JSON.stringify({
                    equipoId: this.options.teamId,
                    rol: this.options.role
                }),
                contentType: 'application/json',
                success: function (usuarios) {
                    this.usuarios = usuarios;
                    this.wait(false);
                }.bind(this)
            });
        },
        
        data: function () {
            return {
                teamName: this.options.teamName,
                role: this.options.role,
                usuarios: this.usuarios || []
            };
        }
    });
});