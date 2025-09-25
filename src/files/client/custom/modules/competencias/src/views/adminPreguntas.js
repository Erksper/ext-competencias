define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:adminPreguntas',
        
        events: {
            'click [data-action="crearPreguntas"]': function () {
                this.crearPreguntas();
            },
            'click [data-action="limpiarPreguntas"]': function () {
                this.limpiarPreguntas();
            },
            'click [data-action="contarPreguntas"]': function () {
                this.contarPreguntas();
            }
        },
        
        setup: function () {
            this.estadisticas = {
                preguntas: 0,
                encuestas: 0,
                respuestas: 0
            };
            this.cargarEstadisticas();
        },

        crearPreguntas: function () {
            if (!confirm('¿Estás seguro de que quieres crear las preguntas por defecto?')) {
                return;
            }

            this.disableButton('crearPreguntas');
            Espo.Ui.notify('Creando preguntas...', 'info');
            
            $.ajax({
                url: 'api/v1/action/CompetenciasInicializarPreguntas',
                type: 'POST',
                data: JSON.stringify({}),
                contentType: 'application/json',
                success: function (resultado) {
                    console.log('Resultado creación:', resultado);
                    
                    if (resultado.exito) {
                        Espo.Ui.success(`${resultado.mensaje}. Creadas: ${resultado.creadas}`);
                        if (resultado.errores && resultado.errores.length > 0) {
                            console.warn('Errores durante la creación:', resultado.errores);
                        }
                    } else {
                        Espo.Ui.warning(resultado.mensaje);
                    }
                    
                    this.cargarEstadisticas();
                    this.enableButton('crearPreguntas');
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('Error creando preguntas:', error);
                    Espo.Ui.error('Error al crear preguntas: ' + error);
                    this.enableButton('crearPreguntas');
                }.bind(this)
            });
        },

        limpiarPreguntas: function () {
            if (!confirm('⚠️ ADVERTENCIA: Esto eliminará TODAS las preguntas, encuestas y respuestas. ¿Continuar?')) {
                return;
            }

            if (!confirm('🚨 CONFIRMACIÓN FINAL: Esta acción NO se puede deshacer. ¿Estás absolutamente seguro?')) {
                return;
            }

            this.disableButton('limpiarPreguntas');
            Espo.Ui.notify('Eliminando datos...', 'warning');
            
            $.ajax({
                url: 'api/v1/action/CompetenciasLimpiarPreguntas',
                type: 'POST',
                data: JSON.stringify({}),
                contentType: 'application/json',
                success: function (resultado) {
                    console.log('Resultado limpieza:', resultado);
                    Espo.Ui.success(resultado.mensaje);
                    this.cargarEstadisticas();
                    this.enableButton('limpiarPreguntas');
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('Error limpiando preguntas:', error);
                    Espo.Ui.error('Error al limpiar preguntas: ' + error);
                    this.enableButton('limpiarPreguntas');
                }.bind(this)
            });
        },

        contarPreguntas: function () {
            this.cargarEstadisticas();
            Espo.Ui.success('Estadísticas actualizadas');
        },

        cargarEstadisticas: function () {
            $.ajax({
                url: 'api/v1/Pregunta',
                type: 'GET',
                data: { maxSize: 1 },
                success: function (response) {
                    this.estadisticas.preguntas = response.total || 0;
                    this.reRender();
                }.bind(this)
            });

            $.ajax({
                url: 'api/v1/Encuesta',
                type: 'GET',
                data: { maxSize: 1 },
                success: function (response) {
                    this.estadisticas.encuestas = response.total || 0;
                    this.reRender();
                }.bind(this)
            });

            $.ajax({
                url: 'api/v1/RespuestaEncuesta',
                type: 'GET',
                data: { maxSize: 1 },
                success: function (response) {
                    this.estadisticas.respuestas = response.total || 0;
                    this.reRender();
                }.bind(this)
            });
        },
        
        data: function () {
            return {
                estadisticas: this.estadisticas
            };
        }
    });
});