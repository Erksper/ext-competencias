// Actualiza: src/files/client/custom/modules/competencias/src/views/competenciasIndex.js
define(['view'], function (View) {
    return View.extend({
        template: 'competencias:competenciasIndex',
        
        events: {
            'click [data-action="startSurvey"]': function () {
                this.getRouter().navigate('#Competencias/teamSelection', {trigger: true});
            },
            'click [data-action="viewReports"]': function () {
                this.getRouter().navigate('#Competencias/reportes', {trigger: true});
            },
            'click [data-action="crearPreguntas"]': function () {
                this.crearPreguntas();
            }
        },

        setup: function () {
            this.esAdmin = this.getUser().isAdmin();
            this.mostrarBotonCrear = false;
            this.totalPreguntas = 0;
            
            // Solo verificar si es admin
            if (this.esAdmin) {
                this.wait(true);
                this.verificarPreguntas();
            }
        },

        verificarPreguntas: function () {
            console.log('🔍 Verificando preguntas existentes...');
            
            $.ajax({
                url: 'api/v1/Pregunta',
                type: 'GET',
                data: { 
                    maxSize: 1,  // Solo necesitamos saber si hay registros
                    where: [
                        {
                            type: 'isTrue',
                            attribute: 'estaActiva'
                        }
                    ]
                },
                success: function (response) {
                    this.totalPreguntas = response.total || 0;
                    this.mostrarBotonCrear = (this.totalPreguntas === 0);
                    
                    console.log('📊 Preguntas encontradas:', this.totalPreguntas);
                    console.log('👁️ Mostrar botón crear:', this.mostrarBotonCrear);
                    
                    this.wait(false);
                }.bind(this),
                error: function (xhr, status, error) {
                    console.warn('⚠️ Error verificando preguntas, asumiendo que no existen:', error);
                    // Si hay error, asumir que no hay preguntas y mostrar botón
                    this.mostrarBotonCrear = true;
                    this.totalPreguntas = 0;
                    this.wait(false);
                }.bind(this)
            });
        },

        crearPreguntas: function () {
            var mensaje = '¿Crear las preguntas por defecto del sistema?\n\n' +
                         '✅ Se crearán aproximadamente 20 preguntas\n' +
                         '📝 Organizadas por categorías (Personalidad, Técnicas, Planificación)\n' +
                         '👥 Para roles: Asesor y Gerente\n\n' +
                         '⚠️ Esta acción solo se puede hacer una vez.';

            if (!confirm(mensaje)) {
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
                    console.log('✅ Resultado creación preguntas:', resultado);
                    
                    if (resultado.exito) {
                        var mensaje = `🎉 ${resultado.mensaje}\n📝 Preguntas creadas: ${resultado.creadas || 0}`;
                        
                        if (resultado.errores && resultado.errores.length > 0) {
                            mensaje += `\n⚠️ Con ${resultado.errores.length} advertencias (ver consola)`;
                            console.warn('Advertencias:', resultado.errores);
                        }
                        
                        Espo.Ui.success(mensaje);
                        
                        // Ocultar el botón después de crear exitosamente
                        this.mostrarBotonCrear = false;
                        this.totalPreguntas = resultado.creadas || 0;
                        this.reRender();
                        
                    } else {
                        Espo.Ui.warning('⚠️ ' + resultado.mensaje);
                        this.enableButton('crearPreguntas');
                    }
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('❌ Error creando preguntas:', error);
                    Espo.Ui.error('❌ Error al crear preguntas: ' + error);
                    this.enableButton('crearPreguntas');
                }.bind(this)
            });
        },

        data: function () {
            return {
                esAdmin: this.esAdmin,
                mostrarBotonCrear: this.mostrarBotonCrear,
                totalPreguntas: this.totalPreguntas
            };
        }
    });
});