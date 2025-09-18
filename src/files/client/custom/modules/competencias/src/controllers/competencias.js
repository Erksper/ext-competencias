define('competencias:controllers/competencias', ['controllers/base'], function (Base) {

    return Base.extend({
        
        checkAccess: function () {
            return true;
        },

        actionIndex: function () {
            console.log('Custom actionIndex executed!');
            this.main('competencias:views/competenciasIndex', {}, function (view) {
                view.render();
            });
        },

        actionTeamSelection: function () {
            this.main('competencias:views/seleccionEquipo', {}, view => view.render());
        },

        actionRoleSelection: function (params) {
            this.main('competencias:views/seleccionRol', {
                teamId: params.teamId,
                teamName: params.teamName
            }, view => view.render());
        },

        actionUserSelection: function (params) {
            this.main('competencias:views/seleccionUsuario', {
                teamId: params.teamId,
                teamName: params.teamName,
                role: params.role
            }, view => view.render());
        },

        actionSurvey: function (params) {
            this.main('competencias:views/encuesta', {
                teamId: params.teamId,
                teamName: params.teamName,
                role: params.role,
                userId: params.userId,
                userName: params.userName
            }, view => view.render());
        },

        // NUEVAS ACCIONES PARA REPORTES
        actionReports: function () {
            console.log('Custom actionReports executed!');
            this.main('competencias:views/reportes', {}, function (view) {
                view.render();
            });
        },

        actionReporteAsesores: function () {
            console.log('Custom actionReporteAsesores executed!');
            this.main('competencias:views/reporteAsesores', {}, function (view) {
                view.render();
            });
        },

        actionReporteGerentes: function () {
            console.log('Custom actionReporteGerentes executed!');
            this.main('competencias:views/reporteGerentes', {}, function (view) {
                view.render();
            });
        }
    });
});