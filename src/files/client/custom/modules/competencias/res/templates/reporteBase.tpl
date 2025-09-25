<div class="century21-header text-center" style="margin-bottom: 20px;">
    <h1>{{tituloReporte}}</h1>
</div>

<div class="report-actions" style="margin-bottom: 15px;">
    <div class="row">
        <div class="col-md-6">
            <button class="btn btn-default" data-action="back">
                <i class="fas fa-arrow-left"></i> Volver a Reportes
            </button>
        </div>
    </div>
</div>

{{#if tienedatos}}
<div class="report-info alert alert-info" style="margin-bottom: 15px;">
    {{#if esReporteGeneralCasaNacional}}
        <strong>Reporte General por Oficinas</strong> |
    {{else}}
        <strong>Total de {{rolObjetivo}}s evaluados:</strong> {{totalUsuarios}} | 
    {{/if}}
    <strong>Criterio:</strong> Verde ≥80%, Amarillo 60-80%, Rojo <60%
</div>

<div class="report-matrix-container" style="overflow-x: auto; margin-bottom: 20px;">
    <!-- Tabla principal de la matriz -->
    <table class="report-matrix table table-bordered" style="min-width: 1200px; font-size: 11px;">
        <!-- Fila 1: Categorías -->
        <thead>
            <tr class="categoria-row header-row">
                <th class="th-main-header" rowspan="3" style="vertical-align: middle; text-align: center;">
                    <strong>
                        {{#if esReporteGeneralCasaNacional}}
                            Oficinas
                        {{else}}
                            Usuario
                        {{/if}}
                    </strong>
                </th>
                {{#each @root.preguntas}}
                <th colspan="{{getColumnCount this}}">
                    <strong>{{@key}}</strong>
                </th>
                {{/each}}
                <th class="th-sumatoria" rowspan="3" style="vertical-align: middle; text-align: center;">
                    <strong>Sumatoria<br>del equipo</strong>
                </th>
            </tr>
            
            <!-- Fila 2: Subcategorías -->
            <tr class="subcategoria-row">
                {{#each @root.preguntas}}
                {{#each this}}
                <th colspan="{{this.length}}">
                    {{@key}}
                </th>
                {{/each}}
                {{/each}}
            </tr>
            
            <!-- Fila 3: Preguntas -->
            <tr class="preguntas-row">
                {{#each @root.preguntas}}
                {{#each this}}
                {{#each this}}
                <th>
                    <div>
                        {{texto}}
                    </div>
                </th>
                {{/each}}
                {{/each}}
                {{/each}}
            </tr>
        </thead>
        
        {{#if esReporteGeneralCasaNacional}}
            <!-- Filas de oficinas para reporte general -->
            <tbody>
                {{#each oficinas}}
                    {{#with (lookup ../totalesPorOficina id)}}
                        {{#if totalesOficina.total}}
                        <tr class="usuario-row">
                            <td class="td-user-name"><strong>{{name}}</strong></td>
                            {{#each ../../preguntas}}
                                {{#each this}}
                                    {{#each this}}
                                        <td class="celda-respuesta color-{{getCeldaColorOficina ../../../id id}}"></td>
                                    {{/each}}
                                {{/each}}
                            {{/each}}
                            <td class="celda-total color-{{totalesOficina.color}}">
                                {{totalesOficina.verdes}}/{{totalesOficina.total}}<br>
                                <small>{{formatPorcentaje totalesOficina.porcentaje}}%</small>
                            </td>
                        </tr>
                        {{/if}}
                    {{/with}}
                {{/each}}
            </tbody>
        {{else}}
            <!-- Filas de usuarios para reporte detallado -->
            <tbody>
                {{#each usuarios}}
                <tr class="usuario-row">
                    <td class="td-user-name">
                        {{userName}}
                    </td>
                    {{#each @root.preguntas}}{{#each this}}{{#each this}}<td class="celda-respuesta color-{{getCeldaColor ../../../userId id}}"></td>{{/each}}{{/each}}{{/each}}
                    <td class="celda-total color-{{totales.color}}">
                        {{totales.verdes}}/{{totales.total}}<br>
                        <small>{{formatPorcentaje totales.porcentaje}}%</small>
                    </td>
                </tr>
                {{/each}}
            </tbody>
        {{/if}}
        
        <!-- Fila de totales por pregunta -->
        <tfoot>
            <tr class="totales-row header-row">
                <td>
                    <strong>Totales</strong>
                </td>
                
                {{#each @root.preguntas}}
                {{#each this}}
                {{#each this}}
                {{#with (lookup @root.totalesPorPregunta id)}}
                <td class="celda-total color-{{color}}">
                    {{verdes}}/{{total}}<br>
                    <small>{{formatPorcentaje porcentaje}}%</small>
                </td>
                {{/with}}
                {{/each}}
                {{/each}}
                {{/each}}
                
                {{#if esReporteGeneralCasaNacional}}
                    <td class="celda-total color-{{totalesGenerales.color}}">
                        {{totalesGenerales.verdes}}/{{totalesGenerales.total}}<br>
                        <small>{{formatPorcentaje totalesGenerales.porcentaje}}%</small>
                    </td>
                {{else}}
                    <!-- Celda vacía para la intersección -->
                    <td></td>
                {{/if}}
            </tr>
        </tfoot>
    </table>
</div>

<!-- Leyenda -->
<div class="report-legend" style="margin-top: 20px;">
    <div class="row">
        <div class="col-md-12">
            <div class="alert alert-default">
                <strong>Leyenda:</strong>
                <span class="legend-item">
                    <span class="legend-color" style="background: #4CAF50; width: 15px; height: 15px; display: inline-block; margin: 0 5px; border: 1px solid #000;"></span>
                    Verde (≥80%)
                </span>
                <span class="legend-item" style="margin-left: 15px;">
                    <span class="legend-color" style="background: #FFC107; width: 15px; height: 15px; display: inline-block; margin: 0 5px; border: 1px solid #000;"></span>
                    Amarillo (60-79%)
                </span>
                <span class="legend-item" style="margin-left: 15px;">
                    <span class="legend-color" style="background: #F44336; width: 15px; height: 15px; display: inline-block; margin: 0 5px; border: 1px solid #000;"></span>
                    Rojo (<60%)
                </span>
                <span class="legend-item" style="margin-left: 15px;">
                    <span class="legend-color" style="background: #9E9E9E; width: 15px; height: 15px; display: inline-block; margin: 0 5px; border: 1px solid #000;"></span>
                    Sin respuesta
                </span>
            </div>
        </div>
    </div>
</div>

{{else}}
<div class="no-data text-center" style="margin: 50px 0;">
    <div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle" style="font-size: 2em; margin-bottom: 15px;"></i>
        <h4>No hay datos para mostrar.</h4>
        <p>No se encontraron encuestas de {{#if (lookup ../this 'rolObjetivo') '==' 'asesor'}}asesores{{else}}gerentes y directores{{/if}}.</p>
    </div>
</div>
{{/if}}

<style>
/* Estilos para la matriz de reportes */
.report-matrix {
    border-collapse: collapse !important;
    border: 2px solid #000;
}

.header-row { background: #9E9E9E; }
.subcategoria-row { background: #BDC3C7; }
.preguntas-row { background: #ecf0f1; }

.report-matrix th,
.report-matrix td {
    border: 1px solid #000 !important;
    padding: 2px !important;
}

/* Estilos de encabezados y celdas especiales */
.th-main-header, .th-sumatoria {
    text-align: center;
    vertical-align: middle;
}
.th-main-header { width: 150px; }
.th-sumatoria { width: 100px; }

.report-matrix .categoria-row th,
.report-matrix .subcategoria-row th {
    text-align: center;
    vertical-align: middle;
    color: black;
}
.categoria-row th {
    padding: 8px;
}
.subcategoria-row th {
    padding: 6px;
    font-size: 10px;
}
.td-user-name {
    padding: 8px;
    background: #f5f5f5;
    font-weight: bold;
    text-align: center;
    vertical-align: middle;
}
.celda-respuesta {
    width: 30px;
    height: 30px;
}
.totales-row td:first-child {
    padding: 8px;
    font-weight: bold;
    text-align: center;
    color: black;
    vertical-align: middle;
}

/* Colores base (usados principalmente por celdas de totales) */
.color-verde {
    background-color: #4CAF50 !important;
}

.color-amarillo {
    background-color: #FFC107 !important;
}

.color-rojo {
    background-color: #F44336 !important;
}

.color-gris {
    background-color: #9E9E9E !important;
}

/* Los colores de las celdas de respuesta se aplican directamente a la celda TD */

/* Texto rotado para preguntas */
.preguntas-row th {
    height: 220px;
    padding: 5px 8px; /* Aumentar padding horizontal para evitar que el texto choque */
    width: auto; 
    /* Usamos alineación de tabla clásica para no romper el layout */
    vertical-align: middle;
    text-align: center;
}

.preguntas-row th div {
    /* Hacemos que el div se comporte como un elemento en línea para que text-align:center funcione */
    display: inline-block;
    writing-mode: vertical-rl;
    transform: rotate(180deg); /* Para que el texto fluya de abajo hacia arriba */
    white-space: normal;
    line-height: 1.1; /* Espacio entre líneas más compacto */
    color: black !important; /* Texto negro como se solicitó */
    font-weight: 500;
    font-size: 10px;
    text-align: center; /* Centra las líneas de texto si hay saltos de línea */
}
/* Responsividad */
@media (max-width: 768px) {
    .report-matrix-container {
        font-size: 10px;
    }
    
    .preguntas-row th {
        height: 100px;
    }
    
    .century21-header h1 {
        font-size: 1.5em !important;
    }
    
    .century21-header h2 {
        font-size: 1em !important;
    }
}

/* Colores de totales */
.celda-total {
    text-align: center;
    font-weight: bold;
    vertical-align: middle;
    padding: 8px;
}
.totales-row .celda-total {
    padding: 4px;
    font-size: 10px;
}
.celda-total.color-verde {
    background-color: #4CAF50 !important;
    color: white;
}

.celda-total.color-amarillo {
    background-color: #FFC107 !important;
    color: black;
}

.celda-total.color-rojo {
    background-color: #F44336 !important;
    color: white;
}

/* Logo container */
.logo-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
}
</style>
