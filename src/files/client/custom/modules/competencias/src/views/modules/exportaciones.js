/**
 * Módulo reutilizable: Exportaciones (Excel / CSV)
 * ──────────────────────────────────────────────────
 * Mixin que agrega capacidades de exportación a cualquier view.
 *
 * Requiere que la view host tenga disponibles:
 *   this.tituloReporte
 *   this.textoEncabezado
 *   this.preguntasAgrupadas
 *   this.usuariosData
 *   this.totalesPorPregunta
 *   this.totalesGenerales
 *   this.esReporteGeneralCasaNacional
 *   this.oficinas  (para reporte general)
 */
define([], function () {

    function descargarArchivo(contenido, nombre, mime) {
        var blob = new Blob([contenido], { type: mime });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = nombre;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    function traducirColor(color) {
        return { 'verde': 'Verde', 'amarillo': 'Amarillo', 'rojo': 'Rojo', 'gris': 'Sin respuesta' }[color] || color;
    }

    function obtenerColorHex(color) {
        return { 'verde': 'FF4CAF50', 'amarillo': 'FFFFC107', 'rojo': 'FFF44336', 'gris': 'FF9E9E9E' }[color] || 'FF9E9E9E';
    }

    return {

        traducirColor: traducirColor,
        obtenerColorHex: obtenerColorHex,
        descargarArchivo: descargarArchivo,

        // ════════════════════════════════════════════════════════
        //  EXPORTAR CSV
        // ════════════════════════════════════════════════════════
        exportarCSV: function () {
            try {
                var self = this;
                var csvContent = '\uFEFF';
                csvContent += this.tituloReporte + '\n\n';
                csvContent += 'Criterio:,Verde >=80%,Amarillo 60-80%,Rojo <60%\n\n';

                var preguntasArray = this._getPreguntasArray();
                var headers = [this.textoEncabezado];
                preguntasArray.forEach(function(p) {
                    headers.push('"' + p.categoria + ' - ' + p.subcategoria + ' - ' + p.texto + '"');
                });
                headers.push('Sumatoria');
                csvContent += headers.join(',') + '\n';

                if (this.esReporteGeneralCasaNacional) {
                    this.oficinas.forEach(function(o) {
                        if (o.totalesOficina && o.totalesOficina.total > 0) {
                            var row = ['"' + o.name + '"'];
                            preguntasArray.forEach(function(p) {
                                row.push(traducirColor((o.totalesPorPregunta[p.id] || {}).color || 'gris'));
                            });
                            row.push('"' + o.totalesOficina.verdes + '/' + o.totalesOficina.total +
                                ' (' + Math.round(o.totalesOficina.porcentaje) + '%) - ' +
                                traducirColor(o.totalesOficina.color) + '"');
                            csvContent += row.join(',') + '\n';
                        }
                    });
                } else {
                    this.usuariosData.forEach(function(u) {
                        var row = ['"' + u.userName + '"'];
                        preguntasArray.forEach(function(p) {
                            row.push(traducirColor(u.respuestas[p.id] || 'gris'));
                        });
                        row.push('"' + u.totales.verdes + '/' + u.totales.total +
                            ' (' + Math.round(u.totales.porcentaje) + '%) - ' +
                            traducirColor(u.totales.color) + '"');
                        csvContent += row.join(',') + '\n';
                    });
                }

                // Fila totales
                var totalesRow = ['Totales'];
                preguntasArray.forEach(function(p) {
                    var d = self.totalesPorPregunta[p.id] || {};
                    totalesRow.push('"' + (d.verdes || 0) + '/' + (d.total || 0) +
                        ' (' + Math.round(d.porcentaje || 0) + '%) - ' + traducirColor(d.color || 'gris') + '"');
                });
                if (this.esReporteGeneralCasaNacional && this.totalesGenerales) {
                    totalesRow.push('"' + this.totalesGenerales.verdes + '/' + this.totalesGenerales.total +
                        ' (' + Math.round(this.totalesGenerales.porcentaje) + '%) - ' +
                        traducirColor(this.totalesGenerales.color) + '"');
                } else { totalesRow.push(''); }
                csvContent += totalesRow.join(',') + '\n';

                descargarArchivo(csvContent, this.tituloReporte + '.csv', 'text/csv;charset=utf-8;');
                Espo.Ui.success('Reporte CSV exportado exitosamente');
            } catch (e) {
                console.error(e);
                Espo.Ui.error('Error al exportar el reporte a CSV');
            }
        },

        // ════════════════════════════════════════════════════════
        //  EXPORTAR EXCEL (XLSX manual via XML SpreadsheetML)
        // ════════════════════════════════════════════════════════
        exportarExcel: function () {
            try {
                var self          = this;
                var preguntasArray = this._getPreguntasArray();
                var esGeneral     = this.esReporteGeneralCasaNacional;

                // ── Helpers de celda ──────────────────────────────
                function celda(valor, tipo, bgColorARGB, bold) {
                    tipo    = tipo    || 'String';
                    bgColorARGB = bgColorARGB || null;
                    bold    = bold    || false;
                    var style = '';
                    if (bgColorARGB || bold) {
                        style = ' s="' + (bgColorARGB ? bgColorARGB : '') + (bold ? 'B' : '') + '"';
                    }
                    return '<Cell' + style + '><Data ss:Type="' + tipo + '">' +
                           String(valor).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') +
                           '</Data></Cell>';
                }

                function celdaColor(color) {
                    var hex = obtenerColorHex(color);
                    var texto = traducirColor(color);
                    // Celda con background
                    return '<Cell ss:StyleID="color_' + color + '"><Data ss:Type="String">' + texto + '</Data></Cell>';
                }

                // ── Estilos ───────────────────────────────────────
                var estilos = '<Styles>' +
                    '<Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#B8A279" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF" ss:Bold="1"/></Style>' +
                    '<Style ss:ID="totales"><Font ss:Bold="1"/><Interior ss:Color="#f5f5f5" ss:Pattern="Solid"/></Style>' +
                    '<Style ss:ID="titulo"><Font ss:Bold="1" ss:Size="14"/></Style>' +
                    '<Style ss:ID="color_verde"><Interior ss:Color="#4CAF50" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF"/></Style>' +
                    '<Style ss:ID="color_amarillo"><Interior ss:Color="#FFC107" ss:Pattern="Solid"/></Style>' +
                    '<Style ss:ID="color_rojo"><Interior ss:Color="#F44336" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF"/></Style>' +
                    '<Style ss:ID="color_gris"><Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/></Style>' +
                    '</Styles>';

                // ── Construir filas ───────────────────────────────
                var filas = '';

                // Título
                filas += '<Row><Cell ss:StyleID="titulo"><Data ss:Type="String">' + this.tituloReporte + '</Data></Cell></Row>';
                filas += '<Row></Row>';

                // Criterios
                filas += '<Row>' +
                    '<Cell><Data ss:Type="String">Criterio:</Data></Cell>' +
                    '<Cell ss:StyleID="color_verde"><Data ss:Type="String">Verde &gt;= 80%</Data></Cell>' +
                    '<Cell ss:StyleID="color_amarillo"><Data ss:Type="String">Amarillo 60-80%</Data></Cell>' +
                    '<Cell ss:StyleID="color_rojo"><Data ss:Type="String">Rojo &lt; 60%</Data></Cell>' +
                    '</Row><Row></Row>';

                // Headers columnas
                var headerRow = '<Row><Cell ss:StyleID="header"><Data ss:Type="String">' + this.textoEncabezado + '</Data></Cell>';
                preguntasArray.forEach(function(p) {
                    headerRow += '<Cell ss:StyleID="header"><Data ss:Type="String">' +
                        p.categoria + ' - ' + p.subcategoria + ' - ' + p.texto +
                        '</Data></Cell>';
                });
                headerRow += '<Cell ss:StyleID="header"><Data ss:Type="String">Sumatoria</Data></Cell></Row>';
                filas += headerRow;

                // Filas de datos
                if (esGeneral) {
                    this.oficinas.forEach(function(o) {
                        if (!o.totalesOficina || o.totalesOficina.total === 0) return;
                        var fila = '<Row><Cell><Data ss:Type="String">' + o.name + '</Data></Cell>';
                        preguntasArray.forEach(function(p) {
                            var color = (o.totalesPorPregunta[p.id] || {}).color || 'gris';
                            fila += celdaColor(color);
                        });
                        var ot = o.totalesOficina;
                        fila += '<Cell ss:StyleID="color_' + ot.color + '"><Data ss:Type="String">' +
                            ot.verdes + '/' + ot.total + ' (' + Math.round(ot.porcentaje) + '%) - ' + traducirColor(ot.color) +
                            '</Data></Cell></Row>';
                        filas += fila;
                    });
                } else {
                    this.usuariosData.forEach(function(u) {
                        var fila = '<Row><Cell><Data ss:Type="String">' + (u.userName || '') + '</Data></Cell>';
                        preguntasArray.forEach(function(p) {
                            var color = u.respuestas[p.id] || 'gris';
                            fila += celdaColor(color);
                        });
                        var t = u.totales || {};
                        fila += '<Cell ss:StyleID="color_' + (t.color || 'gris') + '"><Data ss:Type="String">' +
                            (t.verdes || 0) + '/' + (t.total || 0) + ' (' + Math.round(t.porcentaje || 0) + '%) - ' + traducirColor(t.color || 'gris') +
                            '</Data></Cell></Row>';
                        filas += fila;
                    });
                }

                // Fila totales
                var totalFila = '<Row><Cell ss:StyleID="totales"><Data ss:Type="String">Totales</Data></Cell>';
                preguntasArray.forEach(function(p) {
                    var d = self.totalesPorPregunta[p.id] || {};
                    totalFila += '<Cell ss:StyleID="totales"><Data ss:Type="String">' +
                        (d.verdes || 0) + '/' + (d.total || 0) + ' (' + Math.round(d.porcentaje || 0) + '%) - ' + traducirColor(d.color || 'gris') +
                        '</Data></Cell>';
                });
                if (esGeneral && this.totalesGenerales) {
                    var tg = this.totalesGenerales;
                    totalFila += '<Cell ss:StyleID="totales"><Data ss:Type="String">' +
                        (tg.verdes || 0) + '/' + (tg.total || 0) + ' (' + Math.round(tg.porcentaje || 0) + '%) - ' + traducirColor(tg.color || 'gris') +
                        '</Data></Cell>';
                } else { totalFila += '<Cell></Cell>'; }
                totalFila += '</Row>';
                filas += totalFila;

                // ── Ensamblar XML ─────────────────────────────────
                var xml = '<?xml version="1.0" encoding="UTF-8"?>' +
                    '<?mso-application progid="Excel.Sheet"?>' +
                    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
                        'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" ' +
                        'xmlns:x="urn:schemas-microsoft-com:office:excel">' +
                    estilos +
                    '<Worksheet ss:Name="Reporte">' +
                    '<Table>' + filas + '</Table>' +
                    '</Worksheet>' +
                    '</Workbook>';

                descargarArchivo(xml, this.tituloReporte + '.xls', 'application/vnd.ms-excel;charset=utf-8;');
                Espo.Ui.success('Reporte Excel exportado exitosamente');
            } catch (e) {
                console.error(e);
                Espo.Ui.error('Error al exportar el reporte a Excel');
            }
        },

        // ── Helper interno: aplanar preguntas en array ──
        _getPreguntasArray: function () {
            var arr = [];
            var agrupadas = this.preguntasAgrupadas || {};
            Object.keys(agrupadas).forEach(function(categoria) {
                Object.keys(agrupadas[categoria]).forEach(function(subcategoria) {
                    agrupadas[categoria][subcategoria].forEach(function(p) {
                        arr.push({ id: p.id, texto: p.texto, categoria: categoria, subcategoria: subcategoria });
                    });
                });
            });
            return arr;
        }
    };
});
