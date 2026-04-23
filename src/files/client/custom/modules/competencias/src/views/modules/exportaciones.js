// client/custom/modules/competencias/src/views/modules/exportaciones.js
define([], function () {

    // ------------------------------------------------------------
    //  UTILIDADES COMUNES
    // ------------------------------------------------------------
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
        var mapa = { 'verde': 'Verde', 'amarillo': 'Amarillo', 'rojo': 'Rojo', 'gris': 'Sin respuesta' };
        return mapa[color] || color;
    }

    function obtenerColorHex(color) {
        var mapa = { 'verde': 'FF4CAF50', 'amarillo': 'FFFFC107', 'rojo': 'FFF44336', 'gris': 'FF9E9E9E' };
        return mapa[color] || 'FF9E9E9E';
    }

    // Escape para contenido de celdas (XML / HTML)
    function escapeXml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // ------------------------------------------------------------
    //  EXPORTACIÓN CSV
    // ------------------------------------------------------------
    function exportarCSV() {
        try {
            var self = this;
            var csvContent = '\uFEFF'; // BOM para UTF-8
            csvContent += this.tituloReporte + '\n\n';
            csvContent += 'Criterio:,Verde >=80%,Amarillo 60-80%,Rojo <60%\n\n';

            var preguntasArray = this._getPreguntasArray();
            var headers = [this.textoEncabezado];
            preguntasArray.forEach(function(p) {
                headers.push('"' + escapeCsv(p.categoria + ' - ' + p.subcategoria + ' - ' + p.texto) + '"');
            });
            headers.push('Sumatoria');
            csvContent += headers.join(',') + '\n';

            if (this.esReporteGeneralCasaNacional) {
                this.oficinas.forEach(function(o) {
                    if (o.totalesOficina && o.totalesOficina.total > 0) {
                        var row = ['"' + escapeCsv(o.name) + '"'];
                        preguntasArray.forEach(function(p) {
                            var color = (o.totalesPorPregunta[p.id] || {}).color || 'gris';
                            row.push(traducirColor(color));
                        });
                        var ot = o.totalesOficina;
                        // NOTA: en el reporte general, el backend usa "verde" (singular)
                        row.push('"' + (ot.verde || 0) + '/' + ot.total +
                            ' (' + Math.round(ot.porcentaje) + '%) - ' + traducirColor(ot.color) + '"');
                        csvContent += row.join(',') + '\n';
                    }
                });
            } else {
                this.usuariosData.forEach(function(u) {
                    var row = ['"' + escapeCsv(u.userName) + '"'];
                    preguntasArray.forEach(function(p) {
                        row.push(traducirColor(u.respuestas[p.id] || 'gris'));
                    });
                    var t = u.totales || {};
                    row.push('"' + (t.verdes || 0) + '/' + (t.total || 0) +
                        ' (' + Math.round(t.porcentaje || 0) + '%) - ' + traducirColor(t.color || 'gris') + '"');
                    csvContent += row.join(',') + '\n';
                });
            }

            var totalesRow = ['Totales'];
            preguntasArray.forEach(function(p) {
                var d = self.totalesPorPregunta[p.id] || {};
                totalesRow.push('"' + (d.verdes || 0) + '/' + (d.total || 0) +
                    ' (' + Math.round(d.porcentaje || 0) + '%) - ' + traducirColor(d.color || 'gris') + '"');
            });
            if (this.esReporteGeneralCasaNacional && this.totalesGenerales) {
                var tg = this.totalesGenerales;
                totalesRow.push('"' + (tg.verde || 0) + '/' + (tg.total || 0) +
                    ' (' + Math.round(tg.porcentaje || 0) + '%) - ' + traducirColor(tg.color || 'gris') + '"');
            } else {
                totalesRow.push('');
            }
            csvContent += totalesRow.join(',') + '\n';

            descargarArchivo(csvContent, this.tituloReporte + '.csv', 'text/csv;charset=utf-8;');
            Espo.Ui.success('Reporte CSV exportado exitosamente');
        } catch (e) {
            console.error(e);
            Espo.Ui.error('Error al exportar el reporte a CSV');
        }
    }

    function escapeCsv(str) {
        if (str === undefined || str === null) return '';
        return String(str).replace(/"/g, '""');
    }

    // ------------------------------------------------------------
    //  EXPORTACIÓN EXCEL (XML)
    // ------------------------------------------------------------
    function exportarExcel() {
        try {
            var self = this;
            var preguntasArray = this._getPreguntasArray();
            var esGeneral = this.esReporteGeneralCasaNacional;

            // Funciones auxiliares para generar celdas XML (ya escapan)
            function celdaTexto(texto, estiloId) {
                var estiloAttr = estiloId ? ' ss:StyleID="' + estiloId + '"' : '';
                return '<Cell' + estiloAttr + '><Data ss:Type="String">' + escapeXml(texto) + '</Data></Cell>';
            }

            function celdaNumero(num, estiloId) {
                var estiloAttr = estiloId ? ' ss:StyleID="' + estiloId + '"' : '';
                return '<Cell' + estiloAttr + '><Data ss:Type="Number">' + (num || 0) + '</Data></Cell>';
            }

            function celdaColor(color) {
                var texto = traducirColor(color);
                return '<Cell ss:StyleID="color_' + color + '"><Data ss:Type="String">' + escapeXml(texto) + '</Data></Cell>';
            }

            function celdaSumatoria(verdes, total, porcentaje, color) {
                var contenido = (verdes || 0) + '/' + (total || 0) + ' (' + Math.round(porcentaje || 0) + '%) - ' + traducirColor(color);
                return '<Cell ss:StyleID="color_' + color + '"><Data ss:Type="String">' + escapeXml(contenido) + '</Data></Cell>';
            }

            // Estilos
            var estilos = '<Styles>' +
                '<Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#B8A279" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF" ss:Bold="1"/></Style>' +
                '<Style ss:ID="totales"><Font ss:Bold="1"/><Interior ss:Color="#f5f5f5" ss:Pattern="Solid"/></Style>' +
                '<Style ss:ID="titulo"><Font ss:Bold="1" ss:Size="14"/></Style>' +
                '<Style ss:ID="color_verde"><Interior ss:Color="#4CAF50" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF"/></Style>' +
                '<Style ss:ID="color_amarillo"><Interior ss:Color="#FFC107" ss:Pattern="Solid"/></Style>' +
                '<Style ss:ID="color_rojo"><Interior ss:Color="#F44336" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF"/></Style>' +
                '<Style ss:ID="color_gris"><Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/></Style>' +
                '</Styles>';

            var filas = '';

            // Título
            filas += '<Row>' + celdaTexto(this.tituloReporte, 'titulo') + '</Row>';
            filas += '<Row></Row>';

            // Leyenda de criterios
            filas += '<Row>' +
                celdaTexto('Criterio:') +
                '<Cell ss:StyleID="color_verde"><Data ss:Type="String">Verde >= 80%</Data></Cell>' +
                '<Cell ss:StyleID="color_amarillo"><Data ss:Type="String">Amarillo 60-80%</Data></Cell>' +
                '<Cell ss:StyleID="color_rojo"><Data ss:Type="String">Rojo < 60%</Data></Cell>' +
                '</Row><Row></Row>';

            // Encabezados de columnas
            var headerRow = '<Row>' + celdaTexto(this.textoEncabezado, 'header');
            preguntasArray.forEach(function(p) {
                var titulo = p.categoria + ' - ' + p.subcategoria + ' - ' + p.texto;
                headerRow += celdaTexto(titulo, 'header');
            });
            headerRow += celdaTexto('Sumatoria', 'header') + '</Row>';
            filas += headerRow;

            // Filas de datos
            if (esGeneral) {
                this.oficinas.forEach(function(o) {
                    if (!o.totalesOficina || o.totalesOficina.total === 0) return;
                    var fila = '<Row>' + celdaTexto(o.name);
                    preguntasArray.forEach(function(p) {
                        var color = (o.totalesPorPregunta[p.id] || {}).color || 'gris';
                        fila += celdaColor(color);
                    });
                    var ot = o.totalesOficina;
                    fila += celdaSumatoria(ot.verde, ot.total, ot.porcentaje, ot.color);
                    fila += '</Row>';
                    filas += fila;
                });
            } else {
                this.usuariosData.forEach(function(u) {
                    var fila = '<Row>' + celdaTexto(u.userName || '');
                    preguntasArray.forEach(function(p) {
                        var color = u.respuestas[p.id] || 'gris';
                        fila += celdaColor(color);
                    });
                    var t = u.totales || {};
                    fila += celdaSumatoria(t.verdes, t.total, t.porcentaje, t.color);
                    fila += '</Row>';
                    filas += fila;
                });
            }

            // Fila de totales
            var totalFila = '<Row>' + celdaTexto('Totales', 'totales');
            preguntasArray.forEach(function(p) {
                var d = self.totalesPorPregunta[p.id] || {};
                totalFila += celdaSumatoria(d.verdes, d.total, d.porcentaje, d.color);
            });
            if (esGeneral && this.totalesGenerales) {
                var tg = this.totalesGenerales;
                totalFila += celdaSumatoria(tg.verde, tg.total, tg.porcentaje, tg.color);
            } else {
                totalFila += '<Cell></Cell>';
            }
            totalFila += '</Row>';
            filas += totalFila;

            // Opcional: número de columnas y filas para mejorar compatibilidad
            var numColumnas = preguntasArray.length + 2; // + columna nombre + columna sumatoria
            var numFilas = (esGeneral ? this.oficinas.length : this.usuariosData.length) + 5; // + cabeceras + totales

            var xml = '<?xml version="1.0" encoding="UTF-8"?>' +
                '<?mso-application progid="Excel.Sheet"?>' +
                '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
                'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" ' +
                'xmlns:x="urn:schemas-microsoft-com:office:excel">' +
                estilos +
                '<Worksheet ss:Name="Reporte">' +
                '<Table ss:ExpandedColumnCount="' + numColumnas + '" ss:ExpandedRowCount="' + numFilas + '">' +
                filas +
                '</Table>' +
                '</Worksheet>' +
                '</Workbook>';

            descargarArchivo(xml, this.tituloReporte + '.xls', 'application/vnd.ms-excel;charset=utf-8;');
            Espo.Ui.success('Reporte Excel exportado exitosamente');
        } catch (e) {
            console.error(e);
            Espo.Ui.error('Error al exportar el reporte a Excel');
        }
    }

    // ------------------------------------------------------------
    //  OBTENER LISTA PLANA DE PREGUNTAS (con orden)
    // ------------------------------------------------------------
    function _getPreguntasArray() {
        var arr = [];
        var agrupadas = this.preguntasAgrupadas || {};
        Object.keys(agrupadas).forEach(function(categoria) {
            Object.keys(agrupadas[categoria]).forEach(function(subcategoria) {
                agrupadas[categoria][subcategoria].forEach(function(p) {
                    arr.push({
                        id: p.id,
                        texto: p.texto,
                        categoria: categoria,
                        subcategoria: subcategoria
                    });
                });
            });
        });
        return arr;
    }

    // ------------------------------------------------------------
    //  EXPOSICIÓN PÚBLICA
    // ------------------------------------------------------------
    return {
        traducirColor: traducirColor,
        obtenerColorHex: obtenerColorHex,
        descargarArchivo: descargarArchivo,
        exportarCSV: exportarCSV,
        exportarExcel: exportarExcel,
        _getPreguntasArray: _getPreguntasArray
    };
});