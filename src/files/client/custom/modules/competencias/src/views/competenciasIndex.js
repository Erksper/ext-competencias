// Actualiza: src/files/client/custom/modules/competencias/src/views/competenciasIndex.js
define(['view'], function (View) {
    return View.extend({
        template: 'competencias:competenciasIndex',
        
        events: {
            'click [data-action="startSurvey"]': function (e) {
                if (this.totalPreguntas === 0) {
                    e.preventDefault();
                    Espo.Ui.warning('⚠️ Primero debes crear las preguntas del sistema antes de iniciar evaluaciones.');
                    return false;
                }
                this.getRouter().navigate('#Competencias/teamSelection', {trigger: true});
            },
            'click [data-action="viewReports"]': function (e) {
                if (this.totalPreguntas === 0) {
                    e.preventDefault();
                    Espo.Ui.warning('⚠️ No hay datos para mostrar. Primero crea las preguntas e inicia algunas evaluaciones.');
                    return false;
                }
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
            
            // Verificar preguntas siempre (admin y usuarios normales)
            this.wait(true);
            this.verificarPreguntas();
        },

        verificarPreguntas: function () {
            console.log('🔍 Verificando preguntas existentes...');
            
            // Método más robusto: primero verificar si la entidad existe
            $.ajax({
                url: 'api/v1/Pregunta',
                type: 'GET',
                data: { 
                    maxSize: 1,
                    select: ['id']  // Solo necesitamos el ID para verificar existencia
                },
                success: function (response) {
                    console.log('✅ Entidad Pregunta existe, respuesta:', response);
                    this.totalPreguntas = response.total || 0;
                    this.mostrarBotonCrear = (this.totalPreguntas === 0 && this.esAdmin);
                    
                    console.log('📊 Preguntas encontradas:', this.totalPreguntas);
                    console.log('👁️ Mostrar botón crear:', this.mostrarBotonCrear);
                    
                    this.wait(false);
                }.bind(this),
                error: function (xhr, status, error) {
                    console.warn('⚠️ Error verificando preguntas:', {
                        status: xhr.status,
                        statusText: xhr.statusText,
                        error: error
                    });
                    
                    // Manejar diferentes tipos de error
                    if (xhr.status === 404) {
                        console.error('❌ Entidad Pregunta no existe. Se necesita un Rebuild.');
                        Espo.Ui.error('La entidad Pregunta no existe. Ve a Admin Panel → Rebuild.');
                    } else if (xhr.status === 403) {
                        console.warn('⚠️ Sin permisos para acceder a Pregunta');
                    } else {
                        console.warn('⚠️ Error desconocido, asumiendo entidad vacía');
                    }
                    
                    // Asumir que no hay preguntas
                    this.totalPreguntas = 0;
                    this.mostrarBotonCrear = this.esAdmin;
                    this.wait(false);
                }.bind(this)
            });
        },

        afterRender: function () {
            // Actualizar estado visual de los botones según si hay preguntas
            this.actualizarEstadoBotones();
        },

        actualizarEstadoBotones: function () {
            var $startButton = this.$el.find('[data-action="startSurvey"]');
            var $reportsButton = this.$el.find('[data-action="viewReports"]');
            
            if (this.totalPreguntas === 0) {
                // Deshabilitar botones y cambiar apariencia
                $startButton
                    .addClass('btn-disabled disabled')
                    .prop('disabled', true)
                    .attr('title', 'Primero debes crear las preguntas del sistema');
                    
                $reportsButton
                    .addClass('btn-disabled disabled')
                    .prop('disabled', true)
                    .attr('title', 'No hay datos para mostrar reportes');
                    
                console.log('🔒 Botones deshabilitados - Sin preguntas');
            } else {
                // Habilitar botones
                $startButton
                    .removeClass('btn-disabled disabled')
                    .prop('disabled', false)
                    .removeAttr('title');
                    
                $reportsButton
                    .removeClass('btn-disabled disabled')
                    .prop('disabled', false)
                    .removeAttr('title');
                    
                console.log('✅ Botones habilitados - Preguntas disponibles:', this.totalPreguntas);
            }
        },

        crearPreguntas: function () {
            var mensaje = '¿Crear las preguntas por defecto del sistema?\n\n' +
                         '✅ Se crearán aproximadamente 49 preguntas\n' +
                         '📝 Organizadas por categorías (Personalidad, Técnicas, Funcionales)\n' +
                         '👥 Para roles: Asesor y Gerente/Director\n' +
                         '🔄 17 preguntas compartidas entre ambos roles\n' +
                         '👔 18 preguntas exclusivas para Gerentes/Directores\n' +
                         '👨‍💼 14 preguntas exclusivas para Asesores\n\n' +
                         '⚠️ Esta acción solo se puede hacer una vez.';

            if (!confirm(mensaje)) {
                return;
            }

            // Deshabilitar botón
            var $boton = this.$el.find('[data-action="crearPreguntas"]');
            $boton.prop('disabled', true).addClass('disabled').text('Creando...');
            
            Espo.Ui.notify('Creando preguntas...', 'info');
            
            $.ajax({
                url: 'api/v1/action/CompetenciasInicializarPreguntas',
                type: 'POST',
                data: JSON.stringify({}),
                contentType: 'application/json',
                success: function (resultado) {
                    console.log('✅ Resultado creación preguntas:', resultado);
                    
                    if (resultado.exito) {
                        var mensajeExito = `🎉 ${resultado.mensaje}\n📝 Preguntas creadas: ${resultado.creadas || 0}`;
                        
                        if (resultado.errores && resultado.errores.length > 0) {
                            mensajeExito += `\n⚠️ Con ${resultado.errores.length} advertencias (ver consola)`;
                            console.warn('Advertencias:', resultado.errores);
                        }
                        
                        Espo.Ui.success(mensajeExito);
                        
                        // Actualizar estado y re-renderizar
                        this.mostrarBotonCrear = false;
                        this.totalPreguntas = resultado.creadas || 0;
                        this.reRender();
                        
                    } else {
                        Espo.Ui.warning('⚠️ ' + resultado.mensaje);
                        $boton.prop('disabled', false).removeClass('disabled').text('Inicializar Sistema');
                    }
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('❌ Error creando preguntas:', error);
                    
                    var mensajeError = '❌ Error al crear preguntas: ' + error;
                    if (xhr.status === 404) {
                        mensajeError += '\n\n🔧 Ve a Admin Panel → Rebuild y ejecuta un rebuild del sistema.';
                    } else if (xhr.status === 500) {
                        mensajeError += '\n\n🔧 Error del servidor. Verifica los logs del sistema.';
                    }
                    
                    Espo.Ui.error(mensajeError);
                    $boton.prop('disabled', false).removeClass('disabled').text('Inicializar Sistema');
                }.bind(this)
            });
        },

        data: function () {
            return {
                esAdmin: this.esAdmin,
                mostrarBotonCrear: this.mostrarBotonCrear,
                totalPreguntas: this.totalPreguntas,
                sinPreguntas: (this.totalPreguntas === 0),
                errorEntidad: (this.totalPreguntas === -1)
            };
        }
    });
});