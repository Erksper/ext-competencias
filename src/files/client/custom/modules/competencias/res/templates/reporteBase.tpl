<div class="century21-header text-center" style="margin-bottom: 20px;">
    <h1>{{tituloReporte}}</h1>
    {{#if fechaInicio}}
    <h2 class="periodo-subtitulo" style="color: #666; margin-top: 5px; font-size: 1.2em;">
        Período evaluado: {{fechaInicio}} al {{fechaCierre}}
    </h2>
    {{/if}}
</div>

<div class="report-actions" style="margin-bottom: 15px;">
    <div class="row">
        <div class="col-md-6 col-xs-12">
            <button class="btn btn-default btn-block-mobile" data-action="back">
                <i class="fas fa-arrow-left"></i> Volver a Reportes
            </button>
        </div>
        <div class="col-md-6 col-xs-12 text-right-desktop">
            {{#if tienedatos}}
            <div class="action-buttons-container">
                <button class="btn btn-success btn-lg btn-action" data-action="exportarExcel">
                    <i class="fas fa-file-excel"></i> Exportar Excel
                </button>
                <button class="btn btn-success btn-lg btn-action" data-action="exportarCSV">
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
                <th class="th-main-header" rowspan="3" style="vertical-align: bottom; text-align: center;">
                    <div class="header-content">
                        {{#if logoOficina}}
                        <div class="logo-expanded" style="margin-bottom: 100px; width: 100%;">
                            <img src="{{logoOficina}}" alt="Logo" 
                                 style="max-height: 120px; max-width: 100%; width: auto; height: auto; object-fit: contain;"
                                 onerror="this.style.display='none'">
                        </div>
                        {{/if}}
                        <div class="header-text" style="position: relative; top: -5%;">
                            <strong>{{textoEncabezado}}</strong>
                        </div>
                    </div>
                </th>
                {{#each @root.preguntas}}
                <th colspan="{{getColumnCount this}}">
                    <strong>{{@key}}</strong>
                </th>
                {{/each}}
                <th class="th-sumatoria" rowspan="3" style="vertical-align: bottom; text-align: center;">
                    <div class="sumatoria-content" style="position: relative; top: -5%;">
                        <strong>
                            {{#if esReporteGeneralCasaNacional}}
                            Sumatoria<br>del equipo
                            {{else}}
                            Sumatoria<br>del usuario
                            {{/if}}
                        </strong>
                    </div>
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

{{#unless esReporteGeneralCasaNacional}}
    <div id="seccion-planes-accion"></div>
{{/unless}}

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
    vertical-align: bottom;
}
.th-main-header { 
    width: 250px;
    min-width: 200px;
    height: 180px;
}
.th-sumatoria { 
    width: 100px;
    vertical-align: bottom !important;
}

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
    min-width: 200px;
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

.report-actions .btn-success[data-action="exportarExcel"],
.report-actions .btn-success[data-action="exportarCSV"] {
    background-color: #666;
    border-color: #555;
}

.report-actions .btn-success[data-action="exportarExcel"]:hover,
.report-actions .btn-success[data-action="exportarExcel"]:focus,
.report-actions .btn-success[data-action="exportarCSV"]:hover,
.report-actions .btn-success[data-action="exportarCSV"]:focus {
    background-color: #555;
    border-color: #444;
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
.header-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    position: relative;
}

.logo-expanded {
    flex-shrink: 0;
    margin-bottom: 15px;
}

.logo-expanded img {
    border: 1px solid #ccc;
    border-radius: 3px;
    padding: 5px;
    background: white;
    max-height: 120px;
    max-width: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
}

.header-text {
    position: relative;
    top: -25%; /* 1/4 del alto desde el fondo */
    flex-shrink: 0;
    margin-bottom: 10px;
}

.sumatoria-content {
    position: relative;
    top: -25%; /* 1/4 del alto desde el fondo */
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    height: 100%;
}

.periodo-subtitulo {
    font-size: 1.2em;
    font-weight: normal;
    color: #666;
}

.action-buttons-container {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.btn-action {
    min-width: 180px;
}

.btn-block-mobile {
    width: 100%;
    margin-bottom: 10px;
}

.text-right-desktop {
    text-align: right;
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
    
    .logo-expanded img {
        max-height: 80px !important;
    }
    
    .th-main-header {
        width: 180px;
        height: 140px;
        min-width: 150px;
    }
    
    .td-user-name {
        min-width: 150px;
    }
    
    .header-text,
    .sumatoria-content {
        top: -20%; /* Ajuste para móviles */
    }

    .report-actions {
        margin-top: 20px;
    }

    .action-buttons-container {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .btn-action {
        width: 100%;
        min-width: auto;
    }

    .btn-block-mobile {
        width: 100%;
        margin-bottom: 10px;
    }

    .text-right-desktop {
        text-align: left !important;
    }

    .report-actions .btn-success[data-action="exportarCSV"] {
        margin-left: 0 !important;
    }
}

@media (max-width: 480px) {
    .btn-action {
        font-size: 14px;
        padding: 10px 15px;
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

.td-user-name {
    white-space: normal;
    word-wrap: break-word;
    max-width: 300px;
}
</style>