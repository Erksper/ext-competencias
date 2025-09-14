define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:encuesta',
        
        events: {
            'click [data-action="selectColor"]': function (e) {
                var preguntaId = $(e.currentTarget).data('pregunta-id');
                var color = $(e.currentTarget).data('color');
                
                this.seleccionarColor(preguntaId, color);
            },
            'click [data-action="toggleCategory"]': function (e) {
                this.toggleCategory(e);
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

        afterRender: function () {
            // Abrir la primera categoría por defecto
            var $firstHeader = this.$el.find('.category-header').first();
            if ($firstHeader.length) {
                $firstHeader.addClass('active');
                $firstHeader.next('.category-content').show();
            }
        },
        
        cargarPreguntas: function () {
            console.log('Cargando preguntas para rol:', this.options.role);
            
            // Usar acción estándar del controlador
            $.ajax({
                url: 'api/v1/action/CompetenciasObtenerPreguntasPorRol',
                type: 'POST',
                data: JSON.stringify({
                    rol: this.options.role
                }),
                contentType: 'application/json',
                success: function (preguntas) {
                    console.log('Preguntas cargadas:', preguntas);
                    this.preguntas = preguntas;
                    this.wait(false);
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('Error cargando preguntas:', error);
                    
                    // Datos de prueba si falla la carga
                    this.preguntas = this.obtenerPreguntasPrueba();
                    this.wait(false);
                }.bind(this)
            });
        },
        
        obtenerPreguntasPrueba: function () {
            if (this.options.role === 'gerente') {
                return {
                    'Personalidad': [
                        {id: 'p1', texto: 'Competencia de Liderazgo', orden: 1},
                        {id: 'p2', texto: 'Competencia Emocional', orden: 2}
                    ],
                    'Competencias Técnicas': [
                        {id: 'p3', texto: 'Planificación comercial', orden: 3},
                        {id: 'p4', texto: 'Análisis de métricas y KPIs', orden: 4}
                    ]
                };
            } else {
                return {
                    'Personalidad': [
                        {id: 'p5', texto: 'Competencia Individual', orden: 1},
                        {id: 'p6', texto: 'Competencia Social', orden: 2}
                    ],
                    'Competencias Técnicas': [
                        {id: 'p7', texto: 'Conocimiento industria inmobiliaria', orden: 3},
                        {id: 'p8', texto: 'Manejo herramientas tecnológicas', orden: 4}
                    ]
                };
            }
        },
        
        seleccionarColor: function (preguntaId, color) {
            this.respuestas[preguntaId] = color;
            
            console.log('🎨 Color seleccionado:', {
                pregunta: preguntaId,
                color: color
            });
            
            // Remover selección previa de esta pregunta
            this.$el.find('[data-pregunta-id="' + preguntaId + '"]').removeClass('selected');
            
            // Agregar selección al botón clickeado
            this.$el.find('[data-pregunta-id="' + preguntaId + '"][data-color="' + color + '"]').addClass('selected');
            
            console.log('✅ Respuesta guardada. Total respuestas:', Object.keys(this.respuestas).length);
        },
        
        toggleCategory: function (e) {
            var $header = $(e.currentTarget);
            var $content = $header.next('.category-content');

            // Comprueba si el panel clickeado ya estaba activo
            var wasActive = $header.hasClass('active');

            // Cierra todos los paneles
            this.$el.find('.category-header').removeClass('active');
            this.$el.find('.category-content').slideUp('fast');

            // Si no estaba activo, lo abre
            if (!wasActive) {
                $header.addClass('active');
                $content.slideDown('fast');
            }
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
                url: 'api/v1/action/CompetenciasGuardarEncuesta',
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
                    console.log('Encuesta guardada:', resultado);
                    if (resultado.exito) {
                        Espo.Ui.success('Encuesta guardada exitosamente');
                        this.getRouter().navigate('#Competencias', {trigger: true});
                    }
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('Error guardando encuesta:', error);
                    Espo.Ui.error('Error al guardar la encuesta: ' + error);
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