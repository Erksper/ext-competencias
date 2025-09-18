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
            this.encuestaId = null; // ID de la encuesta existente, si la hay
            this.guardandoEncuesta = false; // Flag para evitar múltiples envíos
            this.totalPreguntasDisponibles = 0; // Total de preguntas para la encuesta actual
            this.wait(true);
            this.cargarPreguntas(); // Inicia la cadena de carga
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
            }
            
            // Aplicar respuestas cargadas a la UI y actualizar indicadores
            this.renderRespuestasEnUI();
            this.actualizarIndicadoresDeProgreso();
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
                        this.totalPreguntasDisponibles = preguntasFiltradas.length;
                        this.procesarPreguntasAPI(preguntasFiltradas);
                        // Una vez que las preguntas están listas, buscar una encuesta incompleta
                        this.buscarEncuestaIncompleta();
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

        buscarEncuestaIncompleta: function() {
            console.log('🔍 Buscando encuesta incompleta para el usuario:', this.userId);
            this.getCollectionFactory().create('Encuesta', function (collection) {
                collection.fetch({
                    data: {
                        where: [
                            {
                                type: 'equals',
                                attribute: 'usuarioEvaluadoId',
                                value: this.userId
                            },
                            {
                                type: 'equals',
                                attribute: 'estado',
                                value: 'incompleta'
                            }
                        ],
                        maxSize: 1,
                        sortBy: 'fechaEncuesta',
                        order: 'desc'
                    },
                    success: function(collection) {
                        if (collection.total > 0) {
                            var encuesta = collection.at(0);
                            this.encuestaId = encuesta.id;
                            console.log('📝 Encuesta incompleta encontrada:', this.encuestaId);
                            this.cargarRespuestasGuardadas();
                        } else {
                            console.log('✨ No hay encuestas incompletas. Se creará una nueva.');
                            this.wait(false); // Termina la carga, es una encuesta nueva
                        }
                    }.bind(this),
                    error: function() {
                        console.error('❌ Error buscando encuesta incompleta.');
                        this.wait(false);
                    }.bind(this)
                });
            }.bind(this));
        },

        cargarRespuestasGuardadas: function() {
            console.log('🔄 Cargando respuestas para la encuesta:', this.encuestaId);
            
            // Obtener todas las IDs de preguntas activas para validar
            var preguntasActivasIds = new Set();
            Object.values(this.preguntas).forEach(subcategorias => {
                Object.values(subcategorias).forEach(preguntas => {
                    preguntas.forEach(pregunta => preguntasActivasIds.add(pregunta.id));
                });
            });

            this.getCollectionFactory().create('RespuestaEncuesta', function (respuestasCollection) {
                respuestasCollection.fetch({
                    data: {
                        where: [
                            { type: 'equals', attribute: 'encuestaId', value: this.encuestaId }
                        ],
                        maxSize: 200 // Un número grande para traer todas
                    },
                    success: function(collection) {
                        console.log('✅ Respuestas guardadas recuperadas:', collection.length);
                        collection.forEach(function(respuesta) {
                            var preguntaId = respuesta.get('preguntaId');
                            // Solo cargar respuestas de preguntas que siguen activas
                            if (preguntasActivasIds.has(preguntaId)) {
                                this.respuestas[preguntaId] = respuesta.get('respuesta');
                            } else {
                                console.warn('🗑️ Respuesta ignorada para pregunta inactiva o eliminada:', preguntaId);
                            }
                        }.bind(this));
                        
                        console.log('📊 Total de respuestas cargadas y validadas:', Object.keys(this.respuestas).length);
                        this.wait(false); // Termina la carga, la vista se renderizará
                    }.bind(this),
                    error: function() {
                        console.error('❌ Error cargando las respuestas guardadas.');
                        this.wait(false);
                    }.bind(this)
                });
            }.bind(this));
        },

        filtrarPreguntasPorRol: function (todasLasPreguntas) {
            console.log('🔍 Filtrando preguntas para rol:', this.role);
            console.log('Total preguntas en BD:', todasLasPreguntas.length);
            
            var preguntasFiltradas = [];
            
            todasLasPreguntas.forEach(function(pregunta) {
                var rolObjetivo = pregunta.rolObjetivo || [];
                var incluir = false;
                
                console.log('Pregunta:', pregunta.textoPregunta || pregunta.name, 'RolObjetivo:', rolObjetivo);
                
                if (Array.isArray(rolObjetivo)) {
                    // REFACTOR: Lógica simplificada y más robusta para determinar si se incluye la pregunta.
                    if (rolObjetivo.includes(this.role)) {
                        incluir = true;
                        if (rolObjetivo.length > 1) {
                            console.log('✅ Pregunta compartida incluida');
                        } else {
                            console.log('✅ Pregunta específica para', this.role);
                        }
                    } else {
                        console.log('❌ Pregunta excluida, no es para', this.role);
                    }
                }
                
                if (incluir) {
                    preguntasFiltradas.push({
                        id: pregunta.id,
                        texto: pregunta.textoPregunta || pregunta.name, // Usar 'texto' directamente
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
                    texto: pregunta.texto,
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
            this.actualizarIndicadoresDeProgreso();
        },

        renderRespuestasEnUI: function() {
            if (Object.keys(this.respuestas).length === 0) {
                return; // No hay nada que renderizar
            }
            console.log('🎨 Aplicando respuestas guardadas a la interfaz...');
            Object.keys(this.respuestas).forEach(function(preguntaId) {
                var color = this.respuestas[preguntaId];
                this.$el.find('[data-pregunta-id="' + preguntaId + '"]').removeClass('selected');
                this.$el.find('[data-pregunta-id="' + preguntaId + '"][data-color="' + color + '"]').addClass('selected');
            }.bind(this));
        },

        // REFACTOR: Nueva función para mostrar el estado de completitud por categoría/subcategoría (ya estaba)
        // FIX: Corregir selectores para que coincidan con el atributo 'data-categoria' y 'data-subcategoria' de la plantilla.
        // (ya estaba)
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

                    // FIX: Corregir selector para que coincida con el atributo 'data-subcategoria' de la plantilla.
                    var selectorSubcat = `.subcategoria-header[data-subcategoria="${subcategoriaNombre.replace(/"/g, '\\"')}"] .estado-completitud`;
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

                // FIX: Corregir selector para que coincida con el atributo 'data-categoria' de la plantilla.
                var selectorCat = `.categoria-header[data-categoria="${categoriaNombre.replace(/"/g, '\\"')}"] .estado-completitud`;
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

        // FIX: Eliminar dependencia de disableButton/enableButton y usar control manual
        guardarEncuesta: function () {
            if (this.encuestaId) {
                this.actualizarEncuestaExistente();
            } else {
                this.crearNuevaEncuesta();
            }
        },

        crearNuevaEncuesta: function() {
            var preguntasRespondidasCount = Object.keys(this.respuestas).length;

            if (preguntasRespondidasCount === 0 && !this.encuestaId) { // Solo para nuevas encuestas
                Espo.Ui.warning('Debes responder al menos una pregunta para guardar.');
                return;
            }

            if (this.guardandoEncuesta) {
                return;
            }
            this.guardandoEncuesta = true;

            var $saveButton = this.$el.find('[data-action="saveSurvey"]');
            $saveButton.prop('disabled', true).text('Guardando...');

            Espo.Ui.notify('Iniciando guardado de encuesta...', 'info');

            var totalPreguntasDisponibles = this.totalPreguntasDisponibles || 0;
            var estaCompleta = (totalPreguntasDisponibles > 0) && (preguntasRespondidasCount === totalPreguntasDisponibles);
            var estadoEncuesta = estaCompleta ? 'completada' : 'incompleta';
            var porcentajeCompletado = totalPreguntasDisponibles > 0 ? Math.round((preguntasRespondidasCount / totalPreguntasDisponibles) * 100) : 0;

            // 1. Crear y guardar la entidad principal 'Encuesta'
            this.getModelFactory().create('Encuesta', function(encuestaModel) {
                encuestaModel.set({
                    name: 'Evaluación ' + this.userName + ' - ' + new Date().toLocaleString(),
                    rolUsuario: this.role,
                    fechaModificacion: new Date().toISOString().slice(0, 19).replace('T', ' '),
                    fechaCreacion: new Date().toISOString().slice(0, 19).replace('T', ' '),
                    fechaEncuesta: new Date().toISOString().slice(0, 19).replace('T', ' '),
                    estado: estadoEncuesta,
                    totalPreguntas: totalPreguntasDisponibles,
                    preguntasRespondidas: preguntasRespondidasCount,
                    porcentajeCompletado: porcentajeCompletado,
                    observaciones: 'Encuesta completada desde el módulo web',
                    equipoId: this.teamId,
                    usuarioEvaluadoId: this.userId,
                    usuarioEvaluadorId: this.getUser().id,
                });

                encuestaModel.save({}, {
                    success: function(model) {
                        var encuestaId = model.get('id');
                        console.log('✅ Encuesta principal creada con ID:', encuestaId);
                        // 2. Una vez creada la encuesta, guardar las respuestas individuales
                        this.guardarRespuestas(encuestaId, encuestaModel);
                    }.bind(this),
                    error: function(model, xhr) {
                        console.error('❌ Error al crear la encuesta principal:', xhr);
                        Espo.Ui.error('Error crítico: No se pudo crear el registro de la encuesta.');
                        this.guardandoEncuesta = false;
                        $saveButton.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar Encuesta');
                    }.bind(this)
                });
            }.bind(this));
        },

        actualizarEncuestaExistente: function() {
            var preguntasRespondidasCount = Object.keys(this.respuestas).length;
            if (this.guardandoEncuesta) {
                return;
            }
            this.guardandoEncuesta = true;

            var $saveButton = this.$el.find('[data-action="saveSurvey"]');
            $saveButton.prop('disabled', true).text('Actualizando...');
            Espo.Ui.notify('Actualizando encuesta...', 'info');

            // FIX: Corregir la forma de obtener un modelo existente.
            // Se crea una instancia vacía, se le asigna el ID y luego se hace fetch.
            this.getModelFactory().create('Encuesta', function(encuestaModel) {
                encuestaModel.id = this.encuestaId;
                encuestaModel.fetch({
                    success: function(model) { // 'model' es el modelo ya cargado con datos del servidor
                        // Recalcular estado y porcentaje
                        var totalPreguntasDisponibles = this.totalPreguntasDisponibles || 0;
                        var estaCompleta = (totalPreguntasDisponibles > 0) && (preguntasRespondidasCount === totalPreguntasDisponibles);
                        var estadoEncuesta = estaCompleta ? 'completada' : 'incompleta';
                        var porcentajeCompletado = totalPreguntasDisponibles > 0 ? Math.round((preguntasRespondidasCount / totalPreguntasDisponibles) * 100) : 0;

                        model.set({
                            totalPreguntas: totalPreguntasDisponibles, // Actualizar por si cambiaron las preguntas
                            preguntasRespondidas: preguntasRespondidasCount,
                            porcentajeCompletado: porcentajeCompletado,
                            estado: estadoEncuesta,
                            fechaModificacion: new Date().toISOString().slice(0, 19).replace('T', ' ')
                        });

                        model.save({}, {
                            success: function(savedModel) {
                                console.log('✅ Encuesta principal actualizada. ID:', savedModel.id);
                                this.sincronizarRespuestas(savedModel.id, savedModel);
                            }.bind(this),
                            error: function() {
                                console.error('❌ Error al actualizar la encuesta principal.');
                                Espo.Ui.error('Error crítico: No se pudo actualizar el registro de la encuesta.');
                                this.guardandoEncuesta = false;
                                $saveButton.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar Encuesta');
                            }.bind(this)
                        });
                    }.bind(this),
                    error: function() {
                        console.error('❌ Error fatal: No se pudo recuperar la encuesta existente para actualizarla.');
                        Espo.Ui.error('No se pudo cargar la encuesta guardada. Intente de nuevo.');
                        this.guardandoEncuesta = false;
                        $saveButton.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar Encuesta');
                    }.bind(this)
                });
            }.bind(this));
        },

        sincronizarRespuestas: function(encuestaId, encuestaModel) {
            console.log('🔄 Sincronizando respuestas (Upsert) para la encuesta:', encuestaId);
            
            var respuestasNuevas = this.convertirRespuestasParaAPI();
            
            this.getCollectionFactory().create('RespuestaEncuesta', function (respuestasAntiguasCollection) {
                respuestasAntiguasCollection.fetch({
                    data: { where: [{ type: 'equals', attribute: 'encuestaId', value: encuestaId }], maxSize: 200 },
                    success: function(collection) {
                        var mapaRespuestasAntiguas = {};
                        collection.forEach(function(model) {
                            mapaRespuestasAntiguas[model.get('preguntaId')] = model;
                        });

                        console.log('🗺️ Mapa de respuestas antiguas creado:', Object.keys(mapaRespuestasAntiguas).length, 'respuestas.');

                        var procesadas = 0;
                        var errores = [];
                        var totalAProcesar = respuestasNuevas.length;

                        var procesarSincronizacion = function(index) {
                            if (index >= totalAProcesar) {
                                this.finalizarGuardado(procesadas, errores, totalAProcesar, encuestaModel);
                                return;
                            }

                            var nuevaRespuesta = respuestasNuevas[index];
                            var preguntaId = nuevaRespuesta.pregunta;
                            var modeloExistente = mapaRespuestasAntiguas[preguntaId];

                            var next = function(exito) {
                                if (exito) {
                                    procesadas++;
                                } else {
                                    errores.push(preguntaId);
                                }
                                setTimeout(function() { procesarSincronizacion.call(this, index + 1); }.bind(this), 10);
                            }.bind(this);

                            if (modeloExistente) {
                                if (modeloExistente.get('respuesta') !== nuevaRespuesta.color || (nuevaRespuesta.comentario && modeloExistente.get('comentario') !== nuevaRespuesta.comentario)) {
                                    modeloExistente.set({ respuesta: nuevaRespuesta.color, comentario: nuevaRespuesta.comentario });
                                    modeloExistente.save({}, {
                                        success: function() { console.log('✅ Respuesta actualizada:', preguntaId); next(true); },
                                        error: function() { console.warn('⚠️ Error actualizando:', preguntaId); next(false); }
                                    });
                                } else {
                                    next(true);
                                }
                            } else {
                                this.getModelFactory().create('RespuestaEncuesta', function(respuestaModel) {
                                    respuestaModel.set({
                                        name: 'Respuesta - ' + nuevaRespuesta.pregunta,
                                        respuesta: nuevaRespuesta.color,
                                        comentario: nuevaRespuesta.comentario,
                                        encuestaId: encuestaId,
                                        preguntaId: nuevaRespuesta.pregunta
                                    });
                                    respuestaModel.save({}, {
                                        success: function() { console.log('✅ Nueva respuesta creada:', preguntaId); next(true); },
                                        error: function() { console.warn('⚠️ Error creando:', preguntaId); next(false); }
                                    });
                                }.bind(this));
                            }
                        }.bind(this);

                        if (totalAProcesar > 0) {
                            procesarSincronizacion(0);
                        } else {
                            this.finalizarGuardado(0, [], 0, encuestaModel);
                        }

                    }.bind(this),
                    error: function() {
                        console.error('❌ Error fatal: No se pudieron recuperar las respuestas antiguas. Abortando actualización.');
                        Espo.Ui.error('No se pudo sincronizar con las respuestas guardadas. Intente de nuevo.');
                        var $saveButton = this.$el.find('[data-action="saveSurvey"]');
                        this.guardandoEncuesta = false;
                        $saveButton.prop('disabled', false).html('<i class="fas fa-save"></i> Guardar Encuesta');
                    }.bind(this)
                });
            }.bind(this));
        },

        guardarRespuestas: function(encuestaId, encuestaModel) {
            var respuestasArray = this.convertirRespuestasParaAPI();
            var creadas = 0;
            var errores = [];
            var total = respuestasArray.length;

            console.log('🔄 Iniciando guardado de', total, 'respuestas para la encuesta ID:', encuestaId);

            var procesarRespuestas = function(index) {
                // Cuando se hayan procesado todas, finalizar
                if (index >= respuestasArray.length) {
                    this.finalizarGuardado(creadas, errores, total, encuestaModel);
                    return;
                }

                var datoRespuesta = respuestasArray[index];

                // Crear un modelo para cada respuesta y guardarlo
                this.getModelFactory().create('RespuestaEncuesta', function(respuestaModel) {
                    respuestaModel.set({
                        name: 'Respuesta - ' + datoRespuesta.pregunta, // El 'name' se puede autogenerar en el backend
                        respuesta: datoRespuesta.color,
                        comentario: datoRespuesta.comentario,
                        encuestaId: encuestaId, // Vincular con la encuesta principal
                        preguntaId: datoRespuesta.pregunta
                    });

                    respuestaModel.save({}, {
                        success: function() {
                            creadas++;
                            console.log('✅ Respuesta guardada:', creadas + '/' + total);
                            // Procesar la siguiente respuesta con una pequeña pausa
                            setTimeout(function() { procesarRespuestas.call(this, index + 1); }.bind(this), 50);
                        }.bind(this),
                        error: function(model, xhr) {
                            errores.push('Error guardando respuesta para pregunta ' + datoRespuesta.pregunta);
                            console.warn('⚠️ Error guardando respuesta:', xhr);
                            setTimeout(function() { procesarRespuestas.call(this, index + 1); }.bind(this), 50);
                        }.bind(this)
                    });
                }.bind(this));

            }.bind(this);

            // Iniciar el proceso con la primera respuesta
            procesarRespuestas(0);
        },

        finalizarGuardado: function(creadas, errores, total, encuestaModel) {
            console.log('🏁 Proceso de guardado finalizado.');

            var totalPreguntasDisponibles = this.totalPreguntasDisponibles || 0;
            var estaCompleta = (totalPreguntasDisponibles > 0) && (creadas === totalPreguntasDisponibles);
            var estadoEncuesta = estaCompleta ? 'completada' : 'incompleta';
            var porcentajeCompletado = totalPreguntasDisponibles > 0 ? Math.round((creadas / totalPreguntasDisponibles) * 100) : 0;
            
            // Actualizar el modelo con los datos finales, por si hubo fallos en el guardado de respuestas
            encuestaModel.set({
                preguntasRespondidas: creadas,
                porcentajeCompletado: porcentajeCompletado,
                estado: estadoEncuesta
            });
            encuestaModel.save();

            if (errores.length === 0) {
                Espo.Ui.success(`✅ Encuesta guardada exitosamente. ${creadas}/${total} respuestas procesadas.`);
            } else {
                Espo.Ui.warning(`⚠️ Encuesta guardada con ${errores.length} errores. ${creadas}/${total} respuestas procesadas.`);
            }

            // Redirigir al usuario después de mostrar el mensaje
            setTimeout(function() {
                this.getRouter().navigate('#Competencias', {trigger: true});
            }.bind(this), 2000);
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
            
            console.log('🔄 Respuestas convertidas para API:', respuestasArray);
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