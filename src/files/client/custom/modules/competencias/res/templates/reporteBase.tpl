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
        <div class="col-md-6 text-right">
            {{#if tienedatos}}
            <div class="btn-group">
                <button class="btn btn-success" data-action="exportarExcel">
                    <i class="fas fa-file-excel"></i> Exportar Excel
                </button>
                <button class="btn btn-info" data-action="exportarCSV">
                    <i class="fas fa-file-csv"></i> Exportar CSV
                </button>
            </div>
            {{/if}}
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
    <table class="report-matrix table table-bordered" style="min-width: 1200px; font-size: 11px;">
        <thead>
            <tr class="categoria-row header-row">
                <th class="th-main-header" rowspan="3" style="vertical-align: middle; text-align: center;">
                    <div class="logo-container" style="height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                        {{#if logoOficina}}
                        <div class="logo-top" style="flex: 1; display: flex; align-items: flex-start; justify-content: center; padding-top: 10px;">
                            <img src="{{logoOficina}}" alt="Logo" style="max-height: 60px; max-width: 120px; object-fit: contain;">
                        </div>
                        {{/if}}
                        <div class="texto-bottom" style="flex: 0; padding-bottom: 10px;">
                            <strong>{{textoEncabezado}}</strong>
                        </div>
                    </div>
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
            
            <tr class="subcategoria-row">
                {{#each @root.preguntas}}
                {{#each this}}
                <th colspan="{{this.length}}">
                    {{@key}}
                </th>
                {{/each}}
                {{/each}}
            </tr>
            
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
            <tbody>
                {{#each oficinas}}
                    {{#if totalesOficina.total}}
                    <tr class="usuario-row">
                        <td class="td-user-name"><strong>{{name}}</strong></td>
                        {{#each @root.preguntas}}
                            {{#each this}}
                                {{#each this}}
                                    <td class="celda-respuesta color-{{lookupColor ../../../totalesPorPregunta id}}"></td>
                                {{/each}}
                            {{/each}}
                        {{/each}}
                        <td class="celda-total color-{{totalesOficina.color}}">
                            {{totalesOficina.verdes}}/{{totalesOficina.total}}<br>
                            <small>{{formatPorcentaje totalesOficina.porcentaje}}%</small>
                        </td>
                    </tr>
                    {{/if}}
                {{/each}}
            </tbody>
        {{else}}
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
        
        <tfoot>
            <tr class="totales-row header-row">
                <td>
                    <strong>Totales</strong>
                </td>
                
                {{#each @root.preguntas}}
                {{#each this}}
                {{#each this}}
                {{#withLookup @root.totalesPorPregunta id}}
                <td class="celda-total color-{{color}}">
                    {{verdes}}/{{total}}<br>
                    <small>{{formatPorcentaje porcentaje}}%</small>
                </td>
                {{/withLookup}}
                {{/each}}
                {{/each}}
                {{/each}}
                
                {{#if esReporteGeneralCasaNacional}}
                    <td class="celda-total color-{{totalesGenerales.color}}">
                        {{totalesGenerales.verdes}}/{{totalesGenerales.total}}<br>
                        <small>{{formatPorcentaje totalesGenerales.porcentaje}}%</small>
                    </td>
                {{else}}
                    <td></td>
                {{/if}}
            </tr>
        </tfoot>
    </table>
</div>

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
        <p>No se encontraron encuestas de {{#if (eq rolObjetivo 'asesor')}}asesores{{else}}gerentes y directores{{/if}}.</p>
    </div>
</div>
{{/if}}

<style>
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

.th-main-header, .th-sumatoria {
    text-align: center;
    vertical-align: middle;
}
.th-main-header { 
    width: 150px; 
    height: 120px;
}
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
.preguntas-row th {
    height: 220px;
    padding: 5px 8px;
    width: auto; 
    vertical-align: middle;
    text-align: center;
}

.preguntas-row th div {
    display: inline-block;
    writing-mode: vertical-rl; 
    transform: rotate(180deg);
    white-space: normal;
    line-height: 1.1;
    color: black !important;
    font-weight: 500;
    font-size: 10px;
    text-align: center;
}
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

.logo-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
}
</style>