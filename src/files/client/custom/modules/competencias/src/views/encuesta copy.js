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
                this.getRouter().navigate('#Competencias/userSelection?teamId=' + this.teamId + '&teamName=' + encodeURIComponent(this.teamName) + '&role=' + this.role, {trigger: true});
            }
        },
        
        setup: function () {
            // OBTENER PARÁMETROS DE LA URL en lugar de this.options
            this.parseURLParams();
            
            console.log('🚀 Configurando encuesta con parámetros de URL:', {
                equipo: this.teamName,
                rol: this.role, 
                usuario: this.userName
            });
            
            this.respuestas = {};
            this.wait(true);
            this.cargarPreguntas();
        },

        parseURLParams: function () {
            // Obtener parámetros de la URL actual
            var hash = window.location.hash;
            var params = {};
            
            if (hash.includes('?')) {
                var queryString = hash.split('?')[1];
                var pairs = queryString.split('&');
                
                pairs.forEach(function(pair) {
                    var parts = pair.split('=');
                    if (parts.length === 2) {
                        params[parts[0]] = decodeURIComponent(parts[1]);
                    }
                });
            }
            
            // Asignar parámetros a propiedades de la instancia
            this.teamId = params.teamId || 'unknown';
            this.teamName = params.teamName || 'Equipo Desconocido';
            this.userId = params.userId || 'unknown';
            this.userName = params.userName || 'Usuario Desconocido';
            this.role = params.role || 'unknown';
            
            console.log('📋 Parámetros parseados de URL:', {
                teamId: this.teamId,
                teamName: this.teamName,
                userId: this.userId,
                userName: this.userName,
                role: this.role
            });
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
                // REFACTOR: Actualizar indicadores al inicio
                this.actualizarIndicadoresDeProgreso(); 
            }
        },
        
        cargarPreguntas: function () {
            console.log('📝 Cargando preguntas para rol:', this.role);
            
            // CARGAR DIRECTAMENTE DESDE LA API DE PREGUNTA (igual que usuarios)
            $.ajax({
                url: 'api/v1/Pregunta',
                type: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                success: function (response) {
                    console.log('✅ Preguntas cargadas desde API Pregunta:', response);
                    
                    if (response.list && response.list.length > 0) {
                        var preguntasFiltradas = this.filtrarPreguntasPorRol(response.list);
                        this.procesarPreguntasAPI(preguntasFiltradas);
                        this.wait(false);
                    } else {
                        console.warn('⚠️ No se encontraron preguntas en la base de datos para este rol.');
                        this.preguntas = {}; // Dejar vacío para que el template muestre el mensaje
                        this.wait(false);
                    }
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('❌ Error cargando desde API Pregunta:', xhr, status, error);
                    Espo.Ui.error('❌ Error al cargar las preguntas. Por favor, intente de nuevo.');
                    this.wait(false);
                }.bind(this)
            });
        },

        filtrarPreguntasPorRol: function (todasLasPreguntas) {
            console.log('🔍 Filtrando preguntas para rol:', this.role);
            console.log('Total preguntas en BD:', todasLasPreguntas.length);
            
            var preguntasFiltradas = [];
            
            todasLasPreguntas.forEach(function(pregunta) {
                var rolObjetivo = pregunta.rolObjetivo || [];
                var incluir = false;
                
                console.log('Pregunta:', pregunta.pregunta || pregunta.textoPregunta, 'RolObjetivo:', rolObjetivo);
                
                if (Array.isArray(rolObjetivo)) {
                    // Si tiene múltiples roles y incluye gerente+asesor = compartida
                    if (rolObjetivo.length > 1 && 
                        rolObjetivo.includes('gerente') && 
                        rolObjetivo.includes('asesor')) {
                        incluir = true; // Pregunta compartida
                        console.log('✅ Pregunta compartida incluida');
                    }
                    // Si es específica para este rol
                    else if (rolObjetivo.includes(this.role)) {
                        incluir = true;
                        console.log('✅ Pregunta específica para', this.role);
                    }
                    else {
                        console.log('❌ Pregunta excluida, no es para', this.role);
                    }
                }
                
                if (incluir) {
                    preguntasFiltradas.push({
                        id: pregunta.id,
                        pregunta: pregunta.pregunta || pregunta.textoPregunta,
                        categoria: pregunta.categoria || 'Sin Categoría',
                        subcategoria: pregunta.subCategoria || 'General',
                        orden: pregunta.orden || 0
                    });
                }
            }.bind(this));
            
            // Ordenar por orden
            preguntasFiltradas.sort(function(a, b) {
                return (a.orden || 0) - (b.orden || 0);
            });
            
            console.log('Preguntas filtradas para', this.role + ':', preguntasFiltradas.length);
            return preguntasFiltradas;
        },

        procesarPreguntasAPI: function (preguntasArray) {
            console.log('🔄 Procesando preguntas de API:', preguntasArray);
            
            // Convertir array de preguntas a estructura anidada esperada por el template
            var preguntasAgrupadas = {};
            
            preguntasArray.forEach(function(pregunta) {
                var categoria = pregunta.categoria || 'Sin Categoría';
                var subcategoria = pregunta.subcategoria || 'General';
                
                if (!preguntasAgrupadas[categoria]) {
                    preguntasAgrupadas[categoria] = {};
                }
                
                if (!preguntasAgrupadas[categoria][subcategoria]) {
                    preguntasAgrupadas[categoria][subcategoria] = [];
                }
                
                preguntasAgrupadas[categoria][subcategoria].push({
                    id: pregunta.id,
                    texto: pregunta.pregunta, // La API devuelve "pregunta", el template espera "texto"
                    orden: pregunta.orden || 0
                });
            });
            
            // Ordenar preguntas dentro de cada subcategoría
            Object.keys(preguntasAgrupadas).forEach(function(categoria) {
                Object.keys(preguntasAgrupadas[categoria]).forEach(function(subcategoria) {
                    preguntasAgrupadas[categoria][subcategoria].sort(function(a, b) {
                        return (a.orden || 0) - (b.orden || 0);
                    });
                });
            });
            
            this.preguntas = preguntasAgrupadas;
            
            console.log('📊 Preguntas procesadas y agrupadas:', this.preguntas);
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
            
            // REFACTOR: Actualizar indicadores de progreso en lugar de verificar completitud total
            this.actualizarIndicadoresDeProgreso();
        },

        // REFACTOR: Nueva función para mostrar el estado de completitud por categoría/subcategoría
        actualizarIndicadoresDeProgreso: function () {
            var respuestas = this.respuestas;
            var preguntasAgrupadas = this.preguntas;

            Object.keys(preguntasAgrupadas).forEach(function (categoriaNombre) {
                var categoriaData = preguntasAgrupadas[categoriaNombre];
                var totalPreguntasCategoria = 0;
                var respondidasCategoria = 0;

                Object.keys(categoriaData).forEach(function (subcategoriaNombre) {
                    var preguntasSubcat = categoriaData[subcategoriaNombre];
                    var totalPreguntasSubcat = preguntasSubcat.length;
                    var respondidasSubcat = 0;

                    preguntasSubcat.forEach(function (pregunta) {
                        if (respuestas.hasOwnProperty(pregunta.id)) {
                            respondidasSubcat++;
                        }
                    });

                    var selectorSubcat = `.subcategoria-header[data-subcategoria-nombre='${subcategoriaNombre.replace(/'/g, "\\'")}'] .estado-completitud`;
                    var $indicadorSubcat = this.$el.find(selectorSubcat);
                    if (totalPreguntasSubcat > 0) {
                        if (respondidasSubcat === totalPreguntasSubcat) {
                            $indicadorSubcat.text('Completo').removeClass('incompleto').addClass('completo');
                        } else {
                            $indicadorSubcat.text('Incompleto').removeClass('completo').addClass('incompleto');
                        }
                    }

                    totalPreguntasCategoria += totalPreguntasSubcat;
                    respondidasCategoria += respondidasSubcat;
                }.bind(this));

                var selectorCat = `.categoria-header[data-categoria-nombre='${categoriaNombre.replace(/'/g, "\\'")}'] .estado-completitud`;
                var $indicadorCat = this.$el.find(selectorCat);
                if (totalPreguntasCategoria > 0) {
                    if (respondidasCategoria === totalPreguntasCategoria) {
                        $indicadorCat.text('Completo').removeClass('incompleto').addClass('completo');
                    } else {
                        $indicadorCat.text('Incompleto').removeClass('completo').addClass('incompleto');
                    }
                }
            }.bind(this));
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

        // REFACTOR: Permitir guardado parcial eliminando la validación de completitud.
        guardarEncuesta: function () {
            var preguntasRespondidas = Object.keys(this.respuestas).length;
            
            if (preguntasRespondidas === 0) {
                Espo.Ui.warning('Debes responder al menos una pregunta para guardar.');
                return;
            }

            this.disableButton('saveSurvey');
            Espo.Ui.notify('Guardando encuesta...', 'info');
            
            // USAR LA RUTA EXISTENTE DE TU ROUTES.JSON  
            $.ajax({
                url: 'api/v1/Competencias/action/guardarEncuesta',
                type: 'POST',
                data: JSON.stringify({
                    evaluado: this.userName,
                    evaluador: this.getUser().get('name'), 
                    rol: this.role,
                    equipo: this.teamName,
                    respuestas: this.convertirRespuestasParaAPI()
                }),
                contentType: 'application/json',
                success: function (response) {
                    console.log('✅ Encuesta guardada exitosamente:', response);
                    
                    if (response.success) {
                        Espo.Ui.success('✅ Encuesta guardada exitosamente');
                        this.getRouter().navigate('#Competencias', {trigger: true});
                    } else {
                        throw new Error(response.error || 'Error desconocido');
                    }
                }.bind(this),
                error: function (xhr, status, error) {
                    console.error('❌ Error guardando encuesta:', xhr, status, error);
                    Espo.Ui.error('❌ Error al guardar la encuesta: ' + error);
                    this.enableButton('saveSurvey');
                }.bind(this)
            });
        },

        convertirRespuestasParaAPI: function () {
            var respuestasArray = [];
            
            Object.keys(this.respuestas).forEach(function (preguntaId) {
                respuestasArray.push({
                    pregunta: preguntaId,
                    color: this.respuestas[preguntaId],
                    comentario: '' // Por ahora sin comentarios
                });
            }.bind(this));
            
            return respuestasArray;
        },

        data: function () {
            return {
                teamName: this.teamName,
                userName: this.userName, 
                role: this.role,
                preguntas: this.preguntas || {}
            };
        }
    });
});