<link rel="stylesheet" type="text/css" href="client/custom/modules/competencias/res/css/estilos.css">

<div class="reporte-header">
    <h1>{{tituloReporte}}</h1>
    {{#if fechaInicio}}
    <p class="periodo-subtitulo">
        <i class="fas fa-calendar-alt" style="margin-right:5px;color:var(--color-primary);"></i>
        Período evaluado: {{fechaInicio}} al {{fechaCierre}}
    </p>
    {{/if}}
</div>

<div class="reporte-acciones">
    <button class="btn-volver" data-action="back">
        <i class="fas fa-arrow-left"></i> Volver a Reportes
    </button>
    {{#if tienedatos}}
    <div class="export-group">
        <button class="btn-exportar" data-action="exportarExcel">
            <i class="fas fa-file-excel"></i> Exportar Excel
        </button>
        <button class="btn-exportar" data-action="exportarCSV">
            <i class="fas fa-file-csv"></i> Exportar CSV
        </button>
    </div>
    {{/if}}
</div>

{{#if tienedatos}}

<div class="reporte-info-band">
    <i class="fas fa-info-circle"></i>
    {{#if esReporteGeneralCasaNacional}}
        <strong>Reporte General por Oficinas</strong>&nbsp;&nbsp;|&nbsp;&nbsp;
    {{else}}
        <strong>Total de {{rolObjetivo}}s evaluados:</strong>&nbsp;{{totalUsuarios}}&nbsp;&nbsp;|&nbsp;&nbsp;
    {{/if}}
    <span>Criterio: <strong>Verde</strong> ≥80% verde &nbsp;·&nbsp; <strong>Amarillo</strong> ≥60%, o ≥40% con amarillo ≥ rojo &nbsp;·&nbsp; <strong>Rojo</strong> &lt;40%, o rojo domina</span>
</div>

<div class="reporte-matrix-wrapper">
    <div class="reporte-matrix-scroll">
        <table class="report-matrix">
            <thead>
                <tr class="categoria-row">
                    <th class="th-main-header" rowspan="3">
                        <div class="header-content">
                            {{#if logoOficina}}
                            <div class="logo-expanded">
                                <img src="{{logoOficina}}" alt="Logo" onerror="this.style.display='none'">
                            </div>
                            {{/if}}
                            <div class="header-text"><strong>{{textoEncabezado}}</strong></div>
                        </div>
                    </th>
                    {{#each @root.preguntas}}
                    <th colspan="{{getColumnCount this}}"><strong>{{@key}}</strong></th>
                    {{/each}}
                    <th class="th-sumatoria" rowspan="3">
                        <div class="sumatoria-content">
                            <strong>
                                {{#if esReporteGeneralCasaNacional}}Sumatoria<br>del equipo
                                {{else}}Sumatoria<br>del usuario{{/if}}
                            </strong>
                        </div>
                    </th>
                </tr>

                <tr class="subcategoria-row">
                    {{#each @root.preguntas}}{{#each this}}
                    <th colspan="{{this.length}}">{{@key}}</th>
                    {{/each}}{{/each}}
                </tr>

                <tr class="preguntas-row">
                    {{#each @root.preguntas}}{{#each this}}{{#each this}}
                    <th><div>{{texto}}</div></th>
                    {{/each}}{{/each}}{{/each}}
                </tr>
            </thead>

            {{#if esReporteGeneralCasaNacional}}
            <tbody>
                {{#each oficinas}}{{#if totalesOficina.total}}
                <tr class="usuario-row">
                    <td class="td-user-name"><strong>{{name}}</strong></td>
                    {{#each @root.preguntas}}{{#each this}}{{#each this}}
                    <td class="celda-respuesta color-{{lookupColor ../../../totalesPorPregunta id}}"></td>
                    {{/each}}{{/each}}{{/each}}
                    <td class="celda-total color-{{totalesOficina.color}}">
                        {{totalesOficina.verdes}}/{{totalesOficina.total}}<br>
                        <small>{{formatPorcentaje totalesOficina.porcentaje}}%</small>
                    </td>
                </tr>
                {{/if}}{{/each}}
            </tbody>
            {{else}}
            <tbody>
                {{#each usuarios}}
                <tr class="usuario-row">
                    <td class="td-user-name">{{userName}}</td>
                    {{#each @root.preguntas}}{{#each this}}{{#each this}}
                    <td class="celda-respuesta color-{{getCeldaColor ../../../userId id}}"></td>
                    {{/each}}{{/each}}{{/each}}
                    <td class="celda-total color-{{totales.color}}">
                        {{totales.verdes}}/{{totales.total}}<br>
                        <small>{{formatPorcentaje totales.porcentaje}}%</small>
                    </td>
                </tr>
                {{/each}}
            </tbody>
            {{/if}}

            {{#unless mostrarSoloGerentes}}
            <tfoot>
                <tr class="totales-row">
                    <td><strong>Totales</strong></td>
                    {{#each @root.preguntas}}{{#each this}}{{#each this}}
                    {{#withLookup @root.totalesPorPregunta id}}
                    <td class="celda-total color-{{color}}">
                        {{verdes}}/{{total}}<br>
                        <small>{{formatPorcentaje porcentaje}}%</small>
                    </td>
                    {{/withLookup}}
                    {{/each}}{{/each}}{{/each}}
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
            {{/unless}}
        </table>
    </div>
</div>

<div class="reporte-leyenda">
    <span class="leyenda-titulo"><i class="fas fa-circle-info" style="margin-right:5px;"></i>Leyenda de semáforo:</span>
    <div class="leyenda-items">
        <span class="legend-item"><span class="legend-color" style="background:#4CAF50;"></span>
            <span><strong>Verde</strong> — ≥80% verde</span>
        </span>
        <span class="legend-item"><span class="legend-color" style="background:#FFC107;"></span>
            <span><strong>Amarillo</strong> — ≥60% verde, o ≥40% verde con amarillo ≥ rojo</span>
        </span>
        <span class="legend-item"><span class="legend-color" style="background:#F44336;"></span>
            <span><strong>Rojo</strong> — &lt;40% verde, o rojo domina sobre amarillo</span>
        </span>
        <span class="legend-item"><span class="legend-color" style="background:#9E9E9E;"></span>
            <span><strong>Gris</strong> — Sin respuesta</span>
        </span>
    </div>
</div>

{{else}}

<div class="reporte-sin-datos">
    <i class="fas fa-clipboard-list"></i>
    <h4>No hay datos para mostrar</h4>
    <p>No se encontraron encuestas de {{#if (eq rolObjetivo 'asesor')}}asesores{{else}}gerentes y directores{{/if}}.</p>
</div>

{{/if}}

{{#unless esReporteGeneralCasaNacional}}
<div id="seccion-planes-accion"></div>
{{/unless}}
