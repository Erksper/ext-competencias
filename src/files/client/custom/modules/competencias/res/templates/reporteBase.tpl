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
    <button class="btn-primary" data-action="back">
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
    <span>Criterio: <strong>Verde</strong> — 80% o más de respuestas verdes &nbsp;·&nbsp; <strong>Amarillo</strong> — entre 60% y 79% verdes, o entre 40% y 59% verdes siempre que amarillo sea mayor o igual que rojo &nbsp;·&nbsp; <strong>Rojo</strong> — menos del 40% verdes, o rojo supera a amarillo</span>
</div>

<div class="reporte-matrix-wrapper">
    <div class="reporte-matrix-scroll">
        <!-- La tabla se renderizará aquí desde JavaScript -->
    </div>
</div>

<div class="reporte-leyenda">
    <span class="leyenda-titulo"><i class="fas fa-circle-info" style="margin-right:5px;"></i>Leyenda de semáforo:</span>
    <div class="leyenda-items">
        <span class="legend-item">
            <span class="legend-color" style="background:#4CAF50;"></span>
            <span><strong>Verde</strong> — 80% o más de respuestas verdes</span>
        </span>
        <span class="legend-item">
            <span class="legend-color" style="background:#FFC107;"></span>
            <span><strong>Amarillo</strong> — entre 60% y 79% verdes, o entre 40% y 59% verdes siempre que amarillo sea mayor o igual que rojo</span>
        </span>
        <span class="legend-item">
            <span class="legend-color" style="background:#F44336;"></span>
            <span><strong>Rojo</strong> — menos del 40% verdes, o rojo supera a amarillo</span>
        </span>
        <span class="legend-item">
            <span class="legend-color" style="background:#9E9E9E;"></span>
            <span><strong>Gris</strong> — sin respuesta registrada</span>
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