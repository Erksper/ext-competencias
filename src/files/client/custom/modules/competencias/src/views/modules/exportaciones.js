// client/custom/modules/competencias/src/views/modules/exportaciones.js
define([], function () {

    // ------------------------------------------------------------
    //  UTILIDADES COMUNES
    // ------------------------------------------------------------
    function traducirColor(color) {
        var mapa = { 'verde': 'Verde', 'amarillo': 'Amarillo', 'rojo': 'Rojo', 'gris': 'Sin respuesta' };
        return mapa[color] || color;
    }

    function obtenerColorHex(color) {
        var mapa = { 'verde': 'FF4CAF50', 'amarillo': 'FFFFC107', 'rojo': 'FFF44336', 'gris': 'FF9E9E9E' };
        return mapa[color] || 'FF9E9E9E';
    }

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

    function escapeCsv(str) {
        if (str === undefined || str === null) return '';
        return String(str).replace(/"/g, '""');
    }

    // ------------------------------------------------------------
    //  Helper: leer campo 'verde' o 'verdes' según el backend
    // ------------------------------------------------------------
    function getVerdes(obj) {
        if (!obj) return 0;
        if (obj.verdes !== undefined) return obj.verdes || 0;
        if (obj.verde  !== undefined) return obj.verde  || 0;
        return 0;
    }

    // ------------------------------------------------------------
    //  DETERMINAR TIPO DE REPORTE Y PARÁMETROS
    //  (se leen desde la view host que usa este mixin)
    // ------------------------------------------------------------
    function _getExportParams() {
        var tipoReporte = this.tipoReporte || '';
        var esGeneral   = this.esReporteGeneralCasaNacional;

        var tipo = esGeneral ? 'general' : 'detallado';

        return {
            periodoId:   this.periodoId   || '',
            rolObjetivo: this.rolObjetivo  || 'gerente',
            tipoReporte: tipo,
            oficinaId:   this.oficinaIdParaFiltrar || this.oficinaId || '',
            usuarioId:   this.usuarioId   || ''
        };
    }

    // ------------------------------------------------------------
    //  EXPORTAR EXCEL — llama al servidor PHP (PhpSpreadsheet)
    // ------------------------------------------------------------
    function exportarExcel() {
        var self   = this;
        var params = _getExportParams.call(this);

        if (!params.periodoId) {
            Espo.Ui.warning('No se pudo determinar el período de evaluación.');
            return;
        }

        Espo.Ui.notify('Generando archivo Excel...', 'info', 0);

        // Construir la URL con los parámetros
        var queryString = Object.keys(params)
            .filter(function (k) { return params[k]; })
            .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
            .join('&');

        var url = 'api/v1/Competencias/action/exportarExcel?' + queryString;

        // Descargar via fetch para manejar el blob correctamente
        fetch(url, {
            method: 'GET',
            headers: {
                'X-Espo-Auth': this._getAuthHeader ? this._getAuthHeader() : '',
            },
            credentials: 'same-origin'
        })
        .then(function (response) {
            if (!response.ok) {
                return response.json().then(function (data) {
                    throw new Error(data.error || 'Error al generar el Excel');
                });
            }

            // Obtener nombre del archivo desde el header Content-Disposition
            var disposition = response.headers.get('Content-Disposition') || '';
            var filenameMatch = disposition.match(/filename="?([^"]+)"?/);
            var filename = filenameMatch ? filenameMatch[1] : 'Reporte.xlsx';

            return response.blob().then(function (blob) {
                return { blob: blob, filename: filename };
            });
        })
        .then(function (result) {
            Espo.Ui.notify(false);
            var link = document.createElement('a');
            link.href = URL.createObjectURL(result.blob);
            link.download = result.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            Espo.Ui.success('Reporte Excel generado exitosamente');
        })
        .catch(function (error) {
            Espo.Ui.notify(false);
            console.error('Error exportando Excel:', error);
            Espo.Ui.error('Error al generar el Excel: ' + error.message);
        });
    }

    // ------------------------------------------------------------
    //  EXPORTAR CSV — se mantiene del lado del cliente
    // ------------------------------------------------------------
    function exportarCSV() {
        try {
            var self = this;
            var csvContent = '\uFEFF'; // BOM UTF-8
            csvContent += this.tituloReporte + '\n\n';
            csvContent += 'Criterio:,Verde >=80%,Amarillo 60-80%,Rojo <60%\n\n';

            var preguntasArray = this._getPreguntasArray();

            // Cabeceras
            var headers = ['"' + escapeCsv(this.textoEncabezado) + '"'];
            preguntasArray.forEach(function (p) {
                headers.push('"' + escapeCsv(p.categoria + ' - ' + p.subcategoria + ' - ' + p.texto) + '"');
            });
            headers.push('"Sumatoria"');
            csvContent += headers.join(',') + '\n';

            // Filas de datos
            if (this.esReporteGeneralCasaNacional) {
                this.oficinas.forEach(function (o) {
                    if (!o.totalesOficina || o.totalesOficina.total === 0) return;
                    var row = ['"' + escapeCsv(o.name) + '"'];
                    preguntasArray.forEach(function (p) {
                        var color = (o.totalesPorPregunta[p.id] || {}).color || 'gris';
                        row.push(traducirColor(color));
                    });
                    var ot = o.totalesOficina;
                    row.push('"' + getVerdes(ot) + '/' + (ot.total || 0) +
                        ' (' + Math.round(ot.porcentaje || 0) + '%) - ' + traducirColor(ot.color) + '"');
                    csvContent += row.join(',') + '\n';
                });
            } else {
                this.usuariosData.forEach(function (u) {
                    var row = ['"' + escapeCsv(u.userName) + '"'];
                    preguntasArray.forEach(function (p) {
                        row.push(traducirColor(u.respuestas[p.id] || 'gris'));
                    });
                    var t = u.totales || {};
                    row.push('"' + getVerdes(t) + '/' + (t.total || 0) +
                        ' (' + Math.round(t.porcentaje || 0) + '%) - ' + traducirColor(t.color || 'gris') + '"');
                    csvContent += row.join(',') + '\n';
                });
            }

            // Fila de totales
            var totalesRow = ['"Totales"'];
            preguntasArray.forEach(function (p) {
                var d = self.totalesPorPregunta[p.id] || {};
                totalesRow.push('"' + getVerdes(d) + '/' + (d.total || 0) +
                    ' (' + Math.round(d.porcentaje || 0) + '%) - ' + traducirColor(d.color || 'gris') + '"');
            });
            if (this.esReporteGeneralCasaNacional && this.totalesGenerales) {
                var tg = this.totalesGenerales;
                totalesRow.push('"' + getVerdes(tg) + '/' + (tg.total || 0) +
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

    // ------------------------------------------------------------
    //  HELPER: aplanar preguntas en array ordenado
    // ------------------------------------------------------------
    function _getPreguntasArray() {
        var arr = [];
        var agrupadas = this.preguntasAgrupadas || {};
        Object.keys(agrupadas).forEach(function (categoria) {
            Object.keys(agrupadas[categoria]).forEach(function (subcategoria) {
                agrupadas[categoria][subcategoria].forEach(function (p) {
                    arr.push({
                        id:           p.id,
                        texto:        p.texto,
                        categoria:    categoria,
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
        traducirColor:      traducirColor,
        obtenerColorHex:    obtenerColorHex,
        descargarArchivo:   descargarArchivo,
        exportarExcel:      exportarExcel,
        exportarCSV:        exportarCSV,
        _getPreguntasArray: _getPreguntasArray
    };
});