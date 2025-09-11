define('competencias:controllers/competencias', ['controllers/base'], function (Base) {

    return Base.extend({
        
        checkAccess: function () {
            return true;
        },

        index: function () {
            console.log('Custom index action executed!');
            this.entire('competencias:views/competenciasIndex', {}, function (view) {
                view.render();
            });
        },

        teamSelection: function () {
            this.entire('competencias:views/seleccionEquipo', {}, view => view.render());
        },

        roleSelection: function (params) {
            this.entire('competencias:views/seleccionRol', {
                teamId: params.teamId,
                teamName: params.teamName
            }, view => view.render());
        },

        userSelection: function (params) {
            this.entire('competencias:views/seleccionUsuario', {
                teamId: params.teamId,
                teamName: params.teamName,
                role: params.role
            }, view => view.render());
        },

        survey: function (params) {
            this.entire('competencias:views/encuesta', {
                teamId: params.teamId,
                teamName: params.teamName,
                role: params.role,
                userId: params.userId,
                userName: params.userName
            }, view => view.render());
        }
    });
});
