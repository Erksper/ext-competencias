define('competencias:controllers/competencias', ['controllers/base'], function (Base) {

    return Base.extend({
        
        checkAccess: function () {
            return true;
        },

        actionIndex: function () {
            this.main('competencias:views/competenciasIndex', {}, view => view.render());
        },

        actionSeleccionEvaluados: function () {
            this.main('competencias:views/seleccionEvaluados', {}, view => view.render());
        },

        actionSurvey: function (params) {
            this.main('competencias:views/encuesta', params, view => view.render());
        },

        actionReports: function () {
            this.main('competencias:views/reportes', {}, function (view) {
                view.render();
            });
        },

        actionReporteBase: function (params) {
            this.main('competencias:views/reporteBase', {
                tipo:        params.tipo,
                oficinaId:   params.oficinaId,
                oficinaName: params.oficinaName
            }, function (view) {
                view.render();
            });
        },

        actionListaEdicion: function (params) {
            this.main('competencias:views/listaEdicion', {
                periodoId: params.periodoId || null
            }, function (view) {
                view.render();
            });
        }
    });
});