define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:encuesta',
        
        events: {
            'click [data-action="selectColor"]': function (e) {
                var preguntaId = $(e.currentTarget).data('pregunta-id');
                var color = $(e.currentTarget).data('color');
                
                this.seleccionarColor(preguntaId, color);
            },
            'click [data-action="saveSurvey"]': function () {
                this.guardarEncuesta();
            },
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias/userSelection?teamId=' + this.options.teamId + '&teamName=' + encodeURIComponent(this.options.teamName) + '&role=' + this.options.role, {trigger: true});
            }
        },
        
        setup: function () {
            this.respuestas = {};
            this.wait(true);
            this.cargarPreguntas();
        },
        
        cargarPreguntas: function () {
            $.ajax({
                url: 'Competencias/obtenerPreguntasPorRol',
                type: 'POST',
                data: JSON.stringify({
                    rol: this.options.role
                }),
                contentType: 'application/json',
                success: function (preguntas) {
                    this.preguntas = preguntas;
                    this.wait(false);
                }.bind(this)
            });
        },
        
        seleccionarColor: function (preguntaId, color) {
            this.respuestas[preguntaId] = color;
            
            // Actualizar visualmente
            this.$('[data-pregunta-id="' + preguntaId + '"]').removeClass('selected');
            this.$('[data-pregunta-id="' + preguntaId + '"][data-color="' + color + '"]').addClass('selected');
        },
        
        guardarEncuesta: function () {
            var totalPreguntas = 0;
            var preguntasRespondidas = Object.keys(this.respuestas).length;
            
            Object.keys(this.preguntas).forEach(function (categoria) {
                totalPreguntas += this.preguntas[categoria].length;
            }.bind(this));
            
            if (preguntasRespondidas < totalPreguntas) {
                Espo.Ui.error('Por favor responde todas las preguntas antes de guardar.');
                return;
            }
            
            this.disableButton('saveSurvey');
            
            $.ajax({
                url: 'Competencias/guardarEncuesta',
                type: 'POST',
                data: JSON.stringify({
                    equipoId: this.options.teamId,
                    usuarioEvaluadoId: this.options.userId,
                    nombreUsuarioEvaluado: this.options.userName,
                    rolUsuario: this.options.role,
                    respuestas: this.respuestas
                }),
                contentType: 'application/json',
                success: function (resultado) {
                    if (resultado.exito) {
                        Espo.Ui.success('Encuesta guardada exitosamente');
                        this.getRouter().navigate('#Competencias', {trigger: true});
                    }
                }.bind(this),
                error: function () {
                    Espo.Ui.error('Error al guardar la encuesta');
                    this.enableButton('saveSurvey');
                }.bind(this)
            });
        },
        
        data: function () {
            return {
                teamName: this.options.teamName,
                userName: this.options.userName,
                role: this.options.role,
                preguntas: this.preguntas || {}
            };
        }
    });
});