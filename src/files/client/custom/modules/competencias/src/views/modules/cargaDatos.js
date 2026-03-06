/**
 * Módulo reutilizable: Carga de Datos de Reporte
 * ─────────────────────────────────────────────────
 * Maneja toda la lógica de fetching de encuestas, preguntas y respuestas.
 *
 * Requiere que la view host tenga:
 *   this.rolObjetivo, this.fechaInicio, this.fechaCierre,
 *   this.oficinaIdParaFiltrar, this.usuarioId,
 *   this.esReporteGeneralCasaNacional
 */
define([], function () {

    return {

        // ════════════════════════════════════════════════════════
        //  DESPACHAR CARGA SEGÚN TIPO
        // ════════════════════════════════════════════════════════
        cargarDatosReporte: function () {
            if (this.esReporteGeneralCasaNacional) {
                this.tituloReporte = 'Reporte General de ' + (this.rolObjetivo === 'gerente' ? 'Gerentes y Directores' : 'Asesores');
                this.cargarDatosReporteGeneral();
            } else {
                this.cargarDatosReporteDetallado();
            }
        },

        // ════════════════════════════════════════════════════════
        //  REPORTE GENERAL (Casa Nacional — todas las oficinas)
        // ════════════════════════════════════════════════════════
        cargarDatosReporteGeneral: function () {
            var self = this;
            
            Espo.Ajax.getRequest('Competencias/action/getReporteGeneral', {
                periodoId: this.periodoId,
                rolObjetivo: this.rolObjetivo
            }).then(function (response) {
                if (response.success) {
                    self.preguntasAgrupadas = response.preguntas || {};
                    self.oficinas = response.oficinas || [];
                    self.totalesPorPregunta = response.totalesPorPregunta || {};
                    self.totalesGenerales = response.totalesGenerales || {
                        verdes: 0, amarillos: 0, rojos: 0, total: 0, porcentaje: 0, color: 'gris'
                    };
                    
                    console.log('✅ Reporte general cargado desde backend');
                    console.log('Oficinas:', self.oficinas.length);
                    console.log('Totales generales:', self.totalesGenerales);
                    
                    self.wait(false);
                    self.reRender();
                    self.cargarPlanesAccion();
                } else {
                    Espo.Ui.error(response.error || 'Error al cargar reporte general');
                    self.wait(false);
                }
            }).catch(function (error) {
                console.error('❌ Error al cargar reporte general:', error);
                Espo.Ui.error('Error al cargar los datos del reporte general');
                self.wait(false);
            });
        },

        cargarRespuestasParaEncuestasGeneral: function (encuestas) {
            var self = this;
            
            // Crear un mapa de encuestas por ID para acceso rápido
            var encuestasMap = {};
            encuestas.forEach(function(e) {
                encuestasMap[e.id] = e;
            });

            var encuestasIds = encuestas.map(function(e) { return e.id; });
            
            if (encuestasIds.length === 0) {
                self.procesarRespuestasGenerales([]);
                self.wait(false);
                self.reRender();
                return;
            }

            console.log('📥 Cargando respuestas para', encuestasIds.length, 'encuestas');

            // Dividir en lotes de encuestas (límite de where in)
            var lotesEncuestas = [];
            var tamanoLoteEncuestas = 200;
            for (var i = 0; i < encuestasIds.length; i += tamanoLoteEncuestas) {
                lotesEncuestas.push(encuestasIds.slice(i, i + tamanoLoteEncuestas));
            }

            // Para cada lote de encuestas, paginar las respuestas
            var promesasTotales = [];

            lotesEncuestas.forEach(function(loteEncuestasIds) {
                var promesaLote = new Promise(function(resolve, reject) {
                    var maxSize = 200;
                    var offset = 0;
                    var todasLasRespuestasDelLote = [];
                    
                    function fetchNextPage() {
                        Espo.Ajax.getRequest('RespuestaEncuesta', {
                            where: [
                                { 
                                    type: 'in', 
                                    attribute: 'encuestaId', 
                                    value: loteEncuestasIds 
                                }
                            ],
                            select: 'id,preguntaId,preguntaName,respuesta,encuestaId',
                            maxSize: maxSize,
                            offset: offset
                        }).then(function(response) {
                            var respuestas = response.list || [];
                            todasLasRespuestasDelLote = todasLasRespuestasDelLote.concat(respuestas);
                            
                            if (respuestas.length < maxSize) {
                                resolve(todasLasRespuestasDelLote);
                            } else {
                                offset += maxSize;
                                fetchNextPage();
                            }
                        }).catch(function(error) {
                            console.error('Error cargando página de respuestas:', error);
                            reject(error);
                        });
                    }
                    
                    fetchNextPage();
                });
                
                promesasTotales.push(promesaLote);
            });

            Promise.all(promesasTotales).then(function(resultadosLotes) {
                // Combinar todas las respuestas
                var todasLasRespuestas = [];
                resultadosLotes.forEach(function(lote) {
                    todasLasRespuestas = todasLasRespuestas.concat(lote);
                });

                console.log('✅ Total respuestas cargadas:', todasLasRespuestas.length);

                // Enriquecer respuestas con datos de la encuesta
                var respuestasEnriquecidas = todasLasRespuestas.map(function(r) {
                    var encuesta = encuestasMap[r.encuestaId] || {};
                    return {
                        preguntaId: r.preguntaId,
                        respuesta: r.respuesta,
                        'encuesta.equipoId': encuesta.equipoId,
                        'encuesta.equipoName': encuesta.equipoName
                    };
                }).filter(function(r) {
                    // Filtrar respuestas sin oficina válida
                    return r['encuesta.equipoId'] && self.oficinas.some(o => o.id === r['encuesta.equipoId']);
                });

                console.log('📊 Respuestas enriquecidas:', respuestasEnriquecidas.length);

                self.procesarRespuestasGenerales(respuestasEnriquecidas);
                self.wait(false);
                self.reRender();
                self.cargarPlanesAccion();

            }).catch(function(error) {
                console.error('❌ Error al cargar las respuestas:', error);
                Espo.Ui.error('Error al cargar las respuestas del reporte general.');
                self.wait(false);
            });
        },

        procesarRespuestasGenerales: function (respuestas) {
            var self = this;
            
            if (!respuestas || respuestas.length === 0) {
                console.log('ℹ️ No hay respuestas para procesar');
                this.usuariosData = [];
                this.totalesPorPregunta = {};
                this.totalesGenerales = { verdes: 0, amarillos: 0, rojos: 0, total: 0, porcentaje: 0, color: 'gris' };
                return;
            }

            console.log('🔄 Procesando', respuestas.length, 'respuestas para', this.oficinas.length, 'oficinas');

            // Inicializar estructuras de datos
            var totalesPorOficina = {};
            var totalesGenerales = { verdes: 0, amarillos: 0, rojos: 0, total: 0 };
            var totalesPorPregunta = {};

            // Inicializar oficinas
            this.oficinas.forEach(function(o) {
                totalesPorOficina[o.id] = {
                    name: o.name,
                    totalesPorPregunta: {},
                    totalesOficina: { verdes: 0, amarillos: 0, rojos: 0, total: 0 }
                };
            });

            // Inicializar preguntas
            Object.values(this.preguntasAgrupadas || {}).forEach(function(cat) {
                Object.values(cat).forEach(function(subcat) {
                    subcat.forEach(function(p) {
                        totalesPorPregunta[p.id] = { verdes: 0, amarillos: 0, rojos: 0, total: 0 };
                        
                        self.oficinas.forEach(function(o) {
                            if (!totalesPorOficina[o.id].totalesPorPregunta[p.id]) {
                                totalesPorOficina[o.id].totalesPorPregunta[p.id] = { 
                                    verdes: 0, amarillos: 0, rojos: 0, total: 0 
                                };
                            }
                        });
                    });
                });
            });

            console.log('📊 Estructuras inicializadas');

            // Procesar cada respuesta
            respuestas.forEach(function(resp, index) {
                var oficinaId = resp['encuesta.equipoId'];
                var preguntaId = resp.preguntaId;
                var color = resp.respuesta;

                if (!oficinaId || !preguntaId || !color) {
                    console.warn('⚠️ Respuesta incompleta:', resp);
                    return;
                }

                var oficina = totalesPorOficina[oficinaId];
                var preguntaTotales = totalesPorPregunta[preguntaId];

                if (!oficina) {
                    console.warn('⚠️ Oficina no encontrada:', oficinaId);
                    return;
                }

                if (!preguntaTotales) {
                    console.warn('⚠️ Pregunta no encontrada:', preguntaId);
                    return;
                }

                // Actualizar totales de oficina por pregunta
                if (oficina.totalesPorPregunta[preguntaId]) {
                    oficina.totalesPorPregunta[preguntaId].total++;
                    
                    if (color === 'verde') {
                        oficina.totalesPorPregunta[preguntaId].verdes++;
                    } else if (color === 'amarillo') {
                        oficina.totalesPorPregunta[preguntaId].amarillos++;
                    } else if (color === 'rojo') {
                        oficina.totalesPorPregunta[preguntaId].rojos++;
                    }
                }

                // Actualizar totales generales de oficina
                oficina.totalesOficina.total++;
                if (color === 'verde') {
                    oficina.totalesOficina.verdes++;
                } else if (color === 'amarillo') {
                    oficina.totalesOficina.amarillos++;
                } else if (color === 'rojo') {
                    oficina.totalesOficina.rojos++;
                }

                // Actualizar totales por pregunta (global)
                preguntaTotales.total++;
                if (color === 'verde') {
                    preguntaTotales.verdes++;
                } else if (color === 'amarillo') {
                    preguntaTotales.amarillos++;
                } else if (color === 'rojo') {
                    preguntaTotales.rojos++;
                }

                // Actualizar totales generales
                totalesGenerales.total++;
                if (color === 'verde') {
                    totalesGenerales.verdes++;
                } else if (color === 'amarillo') {
                    totalesGenerales.amarillos++;
                } else if (color === 'rojo') {
                    totalesGenerales.rojos++;
                }
            });

            console.log('📊 Totales generales:', totalesGenerales);

            // Calcular porcentajes y colores para cada oficina (por pregunta)
            self.oficinas.forEach(function(o) {
                var od = totalesPorOficina[o.id];
                
                // Calcular por pregunta
                Object.keys(od.totalesPorPregunta).forEach(function(pid) {
                    var pd = od.totalesPorPregunta[pid];
                    if (pd.total > 0) {
                        pd.porcentaje = (pd.verdes / pd.total) * 100;
                        pd.color = self.obtenerColorDistribucion(
                            pd.verdes, pd.amarillos, pd.rojos, pd.total
                        );
                    } else {
                        pd.porcentaje = 0;
                        pd.color = 'gris';
                    }
                });

                // Calcular totales de oficina
                var otd = od.totalesOficina;
                if (otd.total > 0) {
                    otd.porcentaje = (otd.verdes / otd.total) * 100;
                    otd.color = self.obtenerColorDistribucion(
                        otd.verdes, otd.amarillos, otd.rojos, otd.total
                    );
                } else {
                    otd.porcentaje = 0;
                    otd.color = 'gris';
                }

                // Asignar de vuelta
                o.totalesPorPregunta = od.totalesPorPregunta;
                o.totalesOficina = od.totalesOficina;
            });

            // Calcular porcentajes y colores por pregunta (global)
            Object.keys(totalesPorPregunta).forEach(function(pid) {
                var pd = totalesPorPregunta[pid];
                if (pd.total > 0) {
                    pd.porcentaje = (pd.verdes / pd.total) * 100;
                    pd.color = self.obtenerColorDistribucion(
                        pd.verdes, pd.amarillos, pd.rojos, pd.total
                    );
                } else {
                    pd.porcentaje = 0;
                    pd.color = 'gris';
                }
            });

            // Calcular totales generales
            if (totalesGenerales.total > 0) {
                totalesGenerales.porcentaje = (totalesGenerales.verdes / totalesGenerales.total) * 100;
                totalesGenerales.color = self.obtenerColorDistribucion(
                    totalesGenerales.verdes, 
                    totalesGenerales.amarillos, 
                    totalesGenerales.rojos, 
                    totalesGenerales.total
                );
            } else {
                totalesGenerales.porcentaje = 0;
                totalesGenerales.color = 'gris';
            }

            // Asignar a la instancia
            this.totalesPorPregunta = totalesPorPregunta;
            this.totalesGenerales = totalesGenerales;
            this.usuariosData = [{}]; // Placeholder para mantener compatibilidad

            console.log('✅ Procesamiento completado');
            console.log('🏢 Oficinas procesadas:', this.oficinas.length);
            console.log('📊 Oficinas con datos:', this.oficinas.filter(o => o.totalesOficina.total > 0).length);
        },

        // ════════════════════════════════════════════════════════
        //  REPORTE DETALLADO (por oficina o usuario)
        // ════════════════════════════════════════════════════════
        cargarDatosReporteDetallado: function () {
            var self = this;
            
            var cargarPreguntas = Espo.Ajax.getRequest('Pregunta', {
                where: [
                    {
                        type: 'and',
                        value: [
                            {
                                type: 'or',
                                value: [
                                    { type: 'equals', attribute: 'rolObjetivo', value: this.rolObjetivo },
                                    { type: 'contains', attribute: 'rolObjetivo', value: this.rolObjetivo }
                                ]
                            },
                            { type: 'equals', attribute: 'estaActiva', value: 1 }
                        ]
                    }
                ],
                orderBy: 'orden',
                maxSize: 200
            });

            var whereEncuestas = [{ type: 'equals', attribute: 'rolUsuario', value: this.rolObjetivo }];
            if (this.oficinaIdParaFiltrar) {
                whereEncuestas.push({ type: 'equals', attribute: 'equipoId', value: this.oficinaIdParaFiltrar });
            }
            if (this.usuarioId) {
                whereEncuestas.push({ type: 'equals', attribute: 'usuarioEvaluadoId', value: this.usuarioId });
            }
            if (this.fechaInicio && this.fechaCierre) {
                whereEncuestas.push({ type: 'greaterThanOrEquals', attribute: 'fechaCreacion', value: this.fechaInicio });
                whereEncuestas.push({ type: 'lessThanOrEquals', attribute: 'fechaCreacion', value: this.fechaCierre + ' 23:59:59' });
            }

            // Cargar TODAS las encuestas con paginación (lotes de 200)
            var cargarTodasLasEncuestas = function() {
                return new Promise(function(resolve, reject) {
                    var maxSize = 200;
                    var offset = 0;
                    var todasLasEncuestas = [];
                    
                    function fetchNextPage() {
                        Espo.Ajax.getRequest('Encuesta', {
                            where: whereEncuestas,
                            select: 'id,name,usuarioEvaluadoId,usuarioEvaluadoName,fechaEncuesta,porcentajeCompletado,equipoName',
                            maxSize: maxSize,
                            offset: offset
                        }).then(function(response) {
                            var encuestas = response.list || [];
                            todasLasEncuestas = todasLasEncuestas.concat(encuestas);
                            
                            if (encuestas.length < maxSize) {
                                // No hay más páginas
                                resolve(todasLasEncuestas);
                            } else {
                                // Ir a la siguiente página
                                offset += maxSize;
                                fetchNextPage();
                            }
                        }).catch(function(error) {
                            console.error('Error cargando página de encuestas:', error);
                            reject(error);
                        });
                    }
                    
                    fetchNextPage();
                });
            };

            Promise.all([cargarPreguntas, cargarTodasLasEncuestas()]).then(function(results) {
                var preguntas = results[0] && results[0].list ? results[0].list : [];
                var encuestas = results[1] || [];

                console.log('📊 Reporte Detallado - Datos cargados:', {
                    totalPreguntas: preguntas.length,
                    totalEncuestas: encuestas.length,
                    rolObjetivo: self.rolObjetivo,
                    oficinaId: self.oficinaIdParaFiltrar,
                    usuarioId: self.usuarioId
                });

                self.procesarPreguntas(preguntas);
                self.procesarEncuestas(encuestas);
            }).catch(function(error) {
                console.error('❌ Error al cargar datos del reporte detallado:', error);
                Espo.Ui.error('Error al cargar los datos del reporte');
                self.wait(false);
            });
        },

        procesarPreguntas: function (preguntas) {
            var agrupadas = {};
            
            preguntas.forEach(function(p) {
                var cat = p.categoria || 'Sin Categoría';
                var sub = p.subCategoria || 'General';
                
                if (!agrupadas[cat]) agrupadas[cat] = {};
                if (!agrupadas[cat][sub]) agrupadas[cat][sub] = [];
                
                agrupadas[cat][sub].push({ 
                    id: p.id, 
                    texto: p.textoPregunta || p.name, 
                    orden: p.orden || 0 
                });
            });

            // Ordenar preguntas dentro de cada subcategoría
            Object.keys(agrupadas).forEach(function(cat) {
                Object.keys(agrupadas[cat]).forEach(function(sub) {
                    agrupadas[cat][sub].sort(function(a, b) { 
                        return (a.orden || 0) - (b.orden || 0); 
                    });
                });
            });

            this.preguntasAgrupadas = agrupadas;
            console.log('📚 Preguntas agrupadas:', Object.keys(agrupadas).length, 'categorías');
        },

        procesarEncuestas: function (encuestas) {
            var self = this;
            
            if (encuestas.length === 0) {
                console.log('ℹ️ No hay encuestas para procesar');
                this.usuariosData = [];
                this.wait(false);
                this.reRender();
                this.cargarPlanesAccion();
                return;
            }

            var encuestasUnicas = encuestas.map(function(e) {
                return {
                    id:                  e.id,
                    userId:              e.usuarioEvaluadoId,
                    userName:            e.usuarioEvaluadoName || 'Usuario sin nombre',
                    fechaEncuesta:       e.fechaEncuesta,
                    porcentajeCompletado: e.porcentajeCompletado || 0,
                    oficinaName:         e.equipoName || ''
                };
            });

            this.cargarRespuestasParaEncuestas(encuestasUnicas);
        },

        cargarRespuestasParaEncuestas: function (encuestas) {
            var self = this;
            
            var encuestasIds = encuestas.map(function(e) { return e.id; });
            
            if (encuestasIds.length === 0) {
                self.usuariosData = [];
                self.wait(false);
                self.reRender();
                return;
            }

            console.log('📥 Cargando respuestas para', encuestasIds.length, 'encuestas');

            // Dividir en lotes de encuestas (límite de where in)
            var lotesEncuestas = [];
            var tamanoLoteEncuestas = 200;
            for (var i = 0; i < encuestasIds.length; i += tamanoLoteEncuestas) {
                lotesEncuestas.push(encuestasIds.slice(i, i + tamanoLoteEncuestas));
            }

            // Para cada lote de encuestas, necesitamos paginar las respuestas
            var promesasTotales = [];

            lotesEncuestas.forEach(function(loteEncuestasIds) {
                // Crear una promesa que maneje la paginación de respuestas para este lote de encuestas
                var promesaLote = new Promise(function(resolve, reject) {
                    var maxSize = 200;
                    var offset = 0;
                    var todasLasRespuestasDelLote = [];
                    
                    function fetchNextPage() {
                        Espo.Ajax.getRequest('RespuestaEncuesta', {
                            where: [
                                { 
                                    type: 'in', 
                                    attribute: 'encuestaId', 
                                    value: loteEncuestasIds 
                                }
                            ],
                            select: 'preguntaId,respuesta,encuestaId',
                            maxSize: maxSize,
                            offset: offset
                        }).then(function(response) {
                            var respuestas = response.list || [];
                            todasLasRespuestasDelLote = todasLasRespuestasDelLote.concat(respuestas);
                            
                            if (respuestas.length < maxSize) {
                                // No hay más páginas para este lote
                                resolve(todasLasRespuestasDelLote);
                            } else {
                                // Ir a la siguiente página
                                offset += maxSize;
                                fetchNextPage();
                            }
                        }).catch(function(error) {
                            console.error('Error cargando página de respuestas:', error);
                            reject(error);
                        });
                    }
                    
                    fetchNextPage();
                });
                
                promesasTotales.push(promesaLote);
            });

            Promise.all(promesasTotales).then(function(resultadosLotes) {
                // Combinar todas las respuestas de todos los lotes
                var todasLasRespuestas = [];
                resultadosLotes.forEach(function(lote) {
                    todasLasRespuestas = todasLasRespuestas.concat(lote);
                });

                console.log('✅ Total respuestas cargadas:', todasLasRespuestas.length);

                // Crear mapa de respuestas por encuesta
                var respuestasPorEncuesta = {};
                
                todasLasRespuestas.forEach(function(r) {
                    if (!respuestasPorEncuesta[r.encuestaId]) {
                        respuestasPorEncuesta[r.encuestaId] = {};
                    }
                    respuestasPorEncuesta[r.encuestaId][r.preguntaId] = r.respuesta;
                });

                // Asignar respuestas a cada encuesta
                encuestas.forEach(function(e) {
                    e.respuestas = respuestasPorEncuesta[e.id] || {};
                });

                self.usuariosData = encuestas;
                self.usuariosMap = {};
                self.usuariosData.forEach(function(u) { 
                    self.usuariosMap[u.userId] = u; 
                });

                self.calcularTotales();
                self.wait(false);
                self.reRender();
                self.cargarPlanesAccion();

            }).catch(function(error) {
                console.error('❌ Error al cargar respuestas:', error);
                self.usuariosData = [];
                self.wait(false);
                self.reRender();
            });
        },

        calcularTotales: function () {
            var self = this;
            var todasLasPreguntas = [];
            var totalPorPregunta = {};

            // Obtener todas las preguntas
            Object.keys(this.preguntasAgrupadas || {}).forEach(function(cat) {
                Object.keys(self.preguntasAgrupadas[cat]).forEach(function(sub) {
                    self.preguntasAgrupadas[cat][sub].forEach(function(p) { 
                        todasLasPreguntas.push(p.id); 
                    });
                });
            });

            // Totales por columna (pregunta)
            todasLasPreguntas.forEach(function(pid) {
                var verdes = 0, amarillos = 0, rojos = 0, total = 0;
                
                self.usuariosData.forEach(function(u) {
                    var r = u.respuestas[pid];
                    if (r) {
                        total++;
                        if (r === 'verde') verdes++;
                        else if (r === 'amarillo') amarillos++;
                        else if (r === 'rojo') rojos++;
                    }
                });

                var pct = total > 0 ? (verdes / total) * 100 : 0;
                totalPorPregunta[pid] = {
                    verdes: verdes, 
                    amarillos: amarillos, 
                    rojos: rojos,
                    total: total, 
                    porcentaje: pct,
                    color: self.obtenerColorDistribucion(verdes, amarillos, rojos, total)
                };
            });

            // Totales por fila (usuario)
            this.usuariosData.forEach(function(u) {
                var verdes = 0, amarillos = 0, rojos = 0, total = 0;
                
                todasLasPreguntas.forEach(function(pid) {
                    var r = u.respuestas[pid];
                    if (r) {
                        total++;
                        if (r === 'verde') verdes++;
                        else if (r === 'amarillo') amarillos++;
                        else if (r === 'rojo') rojos++;
                    }
                });

                var pct = total > 0 ? (verdes / total) * 100 : 0;
                u.totales = {
                    verdes: verdes, 
                    amarillos: amarillos, 
                    rojos: rojos,
                    total: total, 
                    porcentaje: pct,
                    color: self.obtenerColorDistribucion(verdes, amarillos, rojos, total)
                };
            });

            this.totalesPorPregunta = totalPorPregunta;
            
            console.log('📊 Totales calculados:', {
                totalUsuarios: this.usuariosData.length,
                totalPreguntas: todasLasPreguntas.length,
                preguntasConDatos: Object.values(totalPorPregunta).filter(t => t.total > 0).length
            });
        },

        /**
         * Fórmula de semáforo basada en distribución de competencias.
         */
        obtenerColorDistribucion: function (verdes, amarillos, rojos, total) {
            if (total === 0) return 'gris';

            var pV = (verdes   / total) * 100;
            var pA = (amarillos / total) * 100;
            var pR = (rojos    / total) * 100;

            // Verde: ≥80% en verde (el resto puede ser amarillo o rojo)
            if (pV >= 80) return 'verde';

            // Amarillo: ≥60% en verde
            if (pV >= 60) return 'amarillo';

            // Con 40–59% verde:
            if (pV >= 40) {
                // Sin rojos (todo el resto es amarillo) → Amarillo
                if (pR === 0) return 'amarillo';
                // Amarillo domina sobre rojo → Amarillo
                if (pA >= pR) return 'amarillo';
                // Rojo domina sobre amarillo → Rojo
                return 'rojo';
            }

            // Menos del 40% verde → Rojo
            return 'rojo';
        },

        // Mantener para compatibilidad
        obtenerColorPorPorcentaje: function (porcentaje) {
            if (porcentaje >= 80) return 'verde';
            if (porcentaje >= 60) return 'amarillo';
            return 'rojo';
        },

        obtenerColorCelda: function (usuarioId, preguntaId) {
            var u = this.usuariosMap[usuarioId];
            if (!u || !u.respuestas[preguntaId]) return 'gris';
            return u.respuestas[preguntaId];
        }
    };
});