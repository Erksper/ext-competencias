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
            console.log('Inicializando preguntas...');
            this.$('[data-action="initQuestions"]').prop('disabled', true).text('Inicializando...');
            
            $.ajax({
                url: 'api/v1/action/CompetenciasInicializarPreguntas',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({}),
                success: function (resultado) {
                    console.log('Resultado inicialización:', resultado);
                    if (resultado.exito) {
                        Espo.Ui.success(resultado.mensaje);
                    } else {
                        Espo.Ui.error('Error en la inicialización');
                    }
                    
                    // Rehabilitar botón
                    this.$('[data-action="initQuestions"]').prop('disabled', false).text('Inicializar Preguntas');
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('Error inicializando preguntas:', error);
                    Espo.Ui.error('Error inicializando preguntas: ' + error);
                    
                    // Rehabilitar botón
                    this.$('[data-action="initQuestions"]').prop('disabled', false).text('Inicializar Preguntas');
                }.bind(this)
            });
        }
    });
});