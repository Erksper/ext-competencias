define(['view'], function (View) {
    return View.extend({
        template: 'competencias:competenciasIndex',
        
        events: {
            'click [data-action="startSurvey"]': function () {
                this.getRouter().navigate('#Competencias/teamSelection', {trigger: true});
            },
            'click [data-action="initQuestions"]': function () {
                this.inicializarPreguntas();
            }
        },
        
        inicializarPreguntas: function () {
            $.ajax({
                url: 'Competencias/inicializarPreguntas',
                type: 'POST',
                success: function (resultado) {
                    if (resultado.exito) {
                        Espo.Ui.success(resultado.mensaje);
                    }
                }.bind(this)
            });
        }
    });
});