define(['view'], function (View) {
    
    return View.extend({
        
        template: 'competencias:reporteGerentes',
        
        events: {
            'click [data-action="back"]': function () {
                this.getRouter().navigate('#Competencias/reports', {trigger: true});
            },
            'click [data-action="exportar"]': function () {
                this.exportarReporte();
            }
        },
        
        setup: function () {
            console.log('📊 Configurando reporte de gerentes');
            this.datosReporte = null;
            this.preguntasAgrupadas = {};
            this.usuariosData = [];
            this.usuariosMap = {}; // Mapa para acceso rápido
            
            // Registrar helpers de Handlebars
            this.registrarHandlebarsHelpers();
            
            this.wait(true);
            this.cargarDatosReporte();
        },

        registrarHandlebarsHelpers: function () {
            var self = this;
            
            // Helper para contar columnas en una categoría
            Handlebars.registerHelper('getColumnCount', function(categoria) {
                var count = 0;
                Object.keys(categoria).forEach(function(subcategoria) {
                    count += categoria[subcategoria].length;
                });
                return count;
            });
            
            // Helper para obtener color de celda
            Handlebars.registerHelper('getCeldaColor', function(usuarioId, preguntaId) {
                return self.obtenerColorCelda(usuarioId, preguntaId);
            });
            
            // Helper para formatear porcentajes
            Handlebars.registerHelper('formatPorcentaje', function(porcentaje) {
                return Math.round(porcentaje || 0);
            });
            
            // Helper para truncar texto
            Handlebars.registerHelper('truncateText', function(texto, longitud) {
                if (!texto) return '';
                return texto.length > longitud ? texto.substring(0, longitud) + '...' : texto;
            });
            
            // Helper para obtener datos de totales
            Handlebars.registerHelper('lookup', function(obj, key) {
                return obj && obj[key];
            });
        },

        cargarDatosReporte: function () {
            console.log('🔍 Cargando datos del reporte de gerentes...');
            
            // Cargar preguntas para gerentes
            var cargarPreguntas = $.ajax({
                url: 'api/v1/Pregunta',
                data: {
                    where: [
                        {
                            type: 'or',
                            value: [
                                { type: 'equals', attribute: 'rolObjetivo', value: 'gerente' },
                                { type: 'contains', attribute: 'rolObjetivo', value: 'gerente' }
                            ]
                        }
                    ],
                    orderBy: 'orden'
                }
            });
            
            // Cargar encuestas de gerentes
            var cargarEncuestas = $.ajax({
                url: 'api/v1/Encuesta',
                data: {
                    where: [{ type: 'equals', attribute: 'rolUsuario', value: 'gerente' }],
                    select: 'id,name,usuarioEvaluadoId,usuarioEvaluadoName,fechaEncuesta,porcentajeCompletado'
                }
            });
            
            Promise.all([cargarPreguntas, cargarEncuestas]).then(function(results) {
                var preguntas = results[0].list || [];
                var encuestas = results[1].list || [];
                
                console.log('✅ Datos cargados - Preguntas:', preguntas.length, 'Encuestas:', encuestas.length);
                
                this.procesarPreguntas(preguntas);
                this.procesarEncuestas(encuestas);
                
            }.bind(this)).catch(function(error) {
                console.error('❌ Error cargando datos del reporte:', error);
                Espo.Ui.error('Error al cargar los datos del reporte');
                this.wait(false);
            }.bind(this));
        },

        procesarPreguntas: function (preguntas) {
            console.log('🔄 Procesando', preguntas.length, 'preguntas para gerentes...');
            
            var agrupadas = {};
            
            preguntas.forEach(function(pregunta) {
                var categoria = pregunta.categoria || 'Sin Categoría';
                var subcategoria = pregunta.subCategoria || 'General';
                
                if (!agrupadas[categoria]) {
                    agrupadas[categoria] = {};
                }
                
                if (!agrupadas[categoria][subcategoria]) {
                    agrupadas[categoria][subcategoria] = [];
                }
                
                agrupadas[categoria][subcategoria].push({
                    id: pregunta.id,
                    texto: pregunta.textoPregunta || pregunta.name,
                    orden: pregunta.orden || 0
                });
            });
            
            // Ordenar preguntas dentro de cada subcategoría
            Object.keys(agrupadas).forEach(function(categoria) {
                Object.keys(agrupadas[categoria]).forEach(function(subcategoria) {
                    agrupadas[categoria][subcategoria].sort(function(a, b) {
                        return (a.orden || 0) - (b.orden || 0);
                    });
                });
            });
            
            this.preguntasAgrupadas = agrupadas;
            console.log('📊 Preguntas agrupadas por categoría:', Object.keys(agrupadas));
        },

        procesarEncuestas: function (encuestas) {
            console.log('🔄 Procesando', encuestas.length, 'encuestas...');
            
            if (encuestas.length === 0) {
                this.usuariosData = [];
                this.wait(false);
                return;
            }
            
            // Agrupar encuestas por usuario (obtener la más reciente de cada usuario)
            var encuestasPorUsuario = {};
            encuestas.forEach(function(encuesta) {
                var userId = encuesta.usuarioEvaluadoId;
                var userName = encuesta.usuarioEvaluadoName || 'Usuario sin nombre';
                
                if (!encuestasPorUsuario[userId] || 
                    new Date(encuesta.fechaEncuesta) > new Date(encuestasPorUsuario[userId].fechaEncuesta)) {
                    encuestasPorUsuario[userId] = {
                        id: encuesta.id,
                        userId: userId,
                        userName: userName,
                        fechaEncuesta: encuesta.fechaEncuesta,
                        porcentajeCompletado: encuesta.porcentajeCompletado || 0
                    };
                }
            });
            
            var encuestasUnicas = Object.values(encuestasPorUsuario);
            console.log('👥 Usuarios únicos encontrados:', encuestasUnicas.length);
            
            // Cargar respuestas para cada encuesta
            this.cargarRespuestasParaEncuestas(encuestasUnicas);
        },

        cargarRespuestasParaEncuestas: function (encuestas) {
            console.log('🔍 Cargando respuestas para', encuestas.length, 'encuestas...');
            
            var promesasRespuestas = encuestas.map(function(encuesta) {
                return $.ajax({
                    url: 'api/v1/RespuestaEncuesta',
                    data: {
                        where: [{ type: 'equals', attribute: 'encuestaId', value: encuesta.id }],
                        select: 'preguntaId,preguntaName,respuesta'
                    }
                }).then(function(respuestasData) {
                    encuesta.respuestas = {};
                    (respuestasData.list || []).forEach(function(resp) {
                        encuesta.respuestas[resp.preguntaId] = resp.respuesta;
                    });
                    return encuesta;
                });
            });
            
            Promise.all(promesasRespuestas).then(function(encuestasConRespuestas) {
                console.log('✅ Respuestas cargadas para todas las encuestas');
                this.usuariosData = encuestasConRespuestas;
                
                // Crear mapa de usuarios para acceso rápido en los helpers
                this.usuariosMap = {};
                this.usuariosData.forEach(u => { this.usuariosMap[u.userId] = u; });

                this.calcularTotales();
                this.wait(false);
            }.bind(this)).catch(function(error) {
                console.error('❌ Error cargando respuestas:', error);
                this.usuariosData = [];
                this.wait(false);
            }.bind(this));
        },

        calcularTotales: function () {
            console.log('🧮 Calculando totales y porcentajes...');
            
            // Calcular totales por pregunta (columnas)
            var totalPorPregunta = {};
            var todasLasPreguntas = [];
            
            // Recopilar todas las preguntas
            Object.keys(this.preguntasAgrupadas).forEach(function(categoria) {
                Object.keys(this.preguntasAgrupadas[categoria]).forEach(function(subcategoria) {
                    this.preguntasAgrupadas[categoria][subcategoria].forEach(function(pregunta) {
                        todasLasPreguntas.push(pregunta.id);
                    });
                }.bind(this));
            }.bind(this));
            
            // Calcular totales por pregunta
            todasLasPreguntas.forEach(function(preguntaId) {
                var verdes = 0;
                var total = 0;
                
                this.usuariosData.forEach(function(usuario) {
                    if (usuario.respuestas[preguntaId]) {
                        total++;
                        if (usuario.respuestas[preguntaId] === 'verde') {
                            verdes++;
                        }
                    }
                });
                
                var porcentaje = total > 0 ? (verdes / total) * 100 : 0;
                totalPorPregunta[preguntaId] = {
                    verdes: verdes,
                    total: total,
                    porcentaje: porcentaje,
                    color: this.obtenerColorPorPorcentaje(porcentaje)
                };
            }.bind(this));
            
            // Calcular totales por usuario (filas)
            this.usuariosData.forEach(function(usuario) {
                var verdes = 0;
                var total = 0;
                
                todasLasPreguntas.forEach(function(preguntaId) {
                    if (usuario.respuestas[preguntaId]) {
                        total++;
                        if (usuario.respuestas[preguntaId] === 'verde') {
                            verdes++;
                        }
                    }
                });
                
                var porcentaje = total > 0 ? (verdes / total) * 100 : 0;
                usuario.totales = {
                    verdes: verdes,
                    total: total,
                    porcentaje: porcentaje,
                    color: this.obtenerColorPorPorcentaje(porcentaje)
                };
            }.bind(this));
            
            this.totalesPorPregunta = totalPorPregunta;
            console.log('📊 Totales calculados para', Object.keys(totalPorPregunta).length, 'preguntas');
        },

        obtenerColorPorPorcentaje: function (porcentaje) {
            if (porcentaje >= 80) return 'verde';
            if (porcentaje >= 60) return 'amarillo';
            return 'rojo';
        },

        obtenerColorCelda: function (usuarioId, preguntaId) {
            var usuario = this.usuariosMap[usuarioId];
            if (!usuario || !usuario.respuestas[preguntaId]) {
                return 'gris'; // Sin respuesta
            }
            return usuario.respuestas[preguntaId];
        },

        exportarReporte: function () {
            console.log('📄 Exportando reporte...');
            Espo.Ui.notify('Funcionalidad de exportación pendiente de implementación', 'info');
        },

        data: function () {
            return {
                preguntas: this.preguntasAgrupadas,
                usuarios: this.usuariosData,
                totalesPorPregunta: this.totalesPorPregunta,
                tienedatos: this.usuariosData && this.usuariosData.length > 0,
                totalUsuarios: this.usuariosData ? this.usuariosData.length : 0
            };
        }
    });
});
