define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:encuesta',
        
        events: {
            'click [data-action="selectColor"]': function (e) {
                var preguntaId = $(e.currentTarget).data('pregunta-id');
                var color = $(e.currentTarget).data('color');
                
                this.seleccionarColor(preguntaId, color);
            },
            'click [data-action="toggleCategoria"]': function (e) {
                this.toggleCategoria(e);
            },
            'click [data-action="toggleSubcategoria"]': function (e) {
                this.toggleSubcategoria(e);
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
            // Abrir la primera categoría y primera subcategoría por defecto
            var $firstCategoriaHeader = this.$el.find('.categoria-header').first();
            if ($firstCategoriaHeader.length) {
                $firstCategoriaHeader.addClass('active');
                $firstCategoriaHeader.next('.categoria-content').show();
                
                // Abrir primera subcategoría dentro de la primera categoría
                var $firstSubcategoriaHeader = $firstCategoriaHeader.next('.categoria-content').find('.subcategoria-header').first();
                if ($firstSubcategoriaHeader.length) {
                    $firstSubcategoriaHeader.addClass('active');
                    $firstSubcategoriaHeader.next('.subcategoria-content').show();
                }
            }
        },
        
        cargarPreguntas: function () {
            console.log('Cargando preguntas para rol:', this.options.role);
            
            $.ajax({
                url: 'api/v1/Competencias/action/obtenerPreguntasPorRol',
                type: 'POST',
                data: JSON.stringify({
                    rol: this.options.role
                }),
                contentType: 'application/json',
                success: function (preguntas) {
                    console.log('Preguntas cargadas con subcategorías:', preguntas);
                    this.preguntas = preguntas;
                    this.wait(false);
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('Error cargando preguntas:', error, xhr.responseJSON || xhr.responseText);
                    this.wait(false);
                    Espo.Ui.error('No se pudieron cargar las preguntas. Revisa la consola para más detalles.');
                }.bind(this)
            });
        },
        
        obtenerPreguntasPrueba: function () {
            if (this.options.role === 'gerente') {
                return {
                    'Personalidad': {
                        'Liderazgo': [
                            {id: 'test-g1', texto: 'Competencia de Liderazgo', orden: 1},
                            {id: 'test-g2', texto: 'Motivación de Equipos', orden: 2}
                        ],
                        'Inteligencia Emocional': [
                            {id: 'test-g3', texto: 'Competencia Emocional', orden: 3},
                            {id: 'test-g4', texto: 'Toma de Decisiones', orden: 4}
                        ]
                    },
                    'Competencias Técnicas': {
                        'Planificación': [
                            {id: 'test-g5', texto: 'Planificación comercial', orden: 5},
                            {id: 'test-g6', texto: 'Gestión de presupuestos', orden: 6}
                        ],
                        'Análisis': [
                            {id: 'test-g7', texto: 'Análisis de métricas y KPIs', orden: 7}
                        ]
                    }
                };
            } else {
                return {
                    'Personalidad': {
                        'Competencias Individuales': [
                            {id: 'test-a1', texto: 'Competencia Individual', orden: 1},
                            {id: 'test-a2', texto: 'Competencia de Adaptabilidad', orden: 2}
                        ],
                        'Competencias Sociales': [
                            {id: 'test-a3', texto: 'Competencia Social', orden: 3},
                            {id: 'test-a4', texto: 'Competencia de Comunicación', orden: 4}
                        ]
                    },
                    'Competencias Técnicas': {
                        'Conocimiento del Sector': [
                            {id: 'test-a5', texto: 'Conocimiento industria inmobiliaria', orden: 5},
                            {id: 'test-a6', texto: 'Ley de Inversiones', orden: 6}
                        ],
                        'Herramientas y Procesos': [
                            {id: 'test-a7', texto: 'Procedimiento de compraventa', orden: 7},
                            {id: 'test-a8', texto: 'Manejo herramientas tecnológicas', orden: 8}
                        ]
                    }
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
        
        toggleCategoria: function (e) {
            var $header = $(e.currentTarget);
            var $content = $header.next('.categoria-content');

            // Comprueba si el panel clickeado ya estaba activo
            var wasActive = $header.hasClass('active');

            // Cierra todas las categorías
            this.$el.find('.categoria-header').removeClass('active');
            this.$el.find('.categoria-content').slideUp('fast');

            // Si no estaba activo, lo abre
            if (!wasActive) {
                $header.addClass('active');
                $content.slideDown('fast');
            }
        },

        toggleSubcategoria: function (e) {
            var $header = $(e.currentTarget);
            var $content = $header.next('.subcategoria-content');

            // Toggle de la subcategoría específica
            if ($header.hasClass('active')) {
                $header.removeClass('active');
                $content.slideUp('fast');
            } else {
                // Cerrar otras subcategorías en la misma categoría
                var $parentCategoria = $header.closest('.categoria-content');
                $parentCategoria.find('.subcategoria-header').removeClass('active');
                $parentCategoria.find('.subcategoria-content').slideUp('fast');

                // Abrir la seleccionada
                $header.addClass('active');
                $content.slideDown('fast');
            }
        },

        guardarEncuesta: function () {
            var totalPreguntas = this.contarTotalPreguntas();
            var preguntasRespondidas = Object.keys(this.respuestas).length;
            
            console.log('📊 Validando encuesta:', {
                totalPreguntas: totalPreguntas,
                preguntasRespondidas: preguntasRespondidas
            });
            
            if (preguntasRespondidas < totalPreguntas) {
                Espo.Ui.error(`Por favor responde todas las preguntas antes de guardar.\nRespondidas: ${preguntasRespondidas}/${totalPreguntas}`);
                return;
            }
            
            this.disableButton('saveSurvey');
            
            $.ajax({
                url: 'api/v1/Competencias/action/guardarEncuesta',
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
                        Espo.Ui.success('✅ Encuesta guardada exitosamente');
                        this.getRouter().navigate('#Competencias', {trigger: true});
                    } else {
                        Espo.Ui.error('❌ Error: ' + resultado.mensaje);
                        this.enableButton('saveSurvey');
                    }
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('Error guardando encuesta:', error);
                    Espo.Ui.error('❌ Error al guardar la encuesta: ' + error);
                    this.enableButton('saveSurvey');
                }.bind(this)
            });
        },

        contarTotalPreguntas: function () {
            var total = 0;
            
            // Contar preguntas en estructura anidada
            Object.keys(this.preguntas || {}).forEach(function (categoria) {
                Object.keys(this.preguntas[categoria] || {}).forEach(function (subcategoria) {
                    if (Array.isArray(this.preguntas[categoria][subcategoria])) {
                        total += this.preguntas[categoria][subcategoria].length;
                    }
                }.bind(this));
            }.bind(this));
            
            return total;
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