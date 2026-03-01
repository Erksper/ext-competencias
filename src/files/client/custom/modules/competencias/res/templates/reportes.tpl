<link rel="stylesheet" type="text/css" href="client/custom/modules/competencias/res/css/estilos.css">

{{#if noHayPeriodos}}
<div class="rep-no-periodos">
    <h4><i class="fas fa-calendar-times"></i> No hay Períodos de Evaluación</h4>
    <p>No se ha configurado ningún período de evaluación en el sistema.</p>
</div>
{{else}}

<!-- Header de página -->
<div class="rep-page-header">
    <div class="rep-header-icon"><i class="fas fa-chart-bar"></i></div>
    <div>
        <h1 class="rep-page-title">Reportes de Análisis de Competencias</h1>
        <p class="rep-page-sub">Visualización y exportación de evaluaciones por período</p>
    </div>
</div>

<!-- Panel info del usuario -->
<div class="rep-info-card">
    <div class="rep-card-body">
        <div class="row">
            <div class="col-md-6">
                <h4><strong>Usuario:</strong> {{usuario.name}}</h4>
            </div>
            <div class="col-md-6">
                <h4><strong>Rol:</strong>
                    {{#if esCasaNacional}}Casa Nacional
                    {{else if esGerenteODirector}}Gerente/Director
                    {{else if esAsesor}}Asesor
                    {{/if}}
                </h4>
            </div>
        </div>

        {{#if esCasaNacional}}
        <div class="rep-periodo-band">
            <i class="fas fa-info-circle"></i>
            Mostrando datos del período: <strong>{{periodoMostrado}}</strong>
        </div>

        {{#if estadisticas}}
        <div class="rep-estadisticas">
            <div class="rep-estadisticas-contenido">
                <div class="rep-estadisticas-texto"><strong>Resumen del Período Actual:</strong></div>
                <div class="rep-estadisticas-total">{{estadisticas.totalEncuestas}} encuestas en total.</div>
                <div class="rep-estadisticas-labels">
                    <span class="rep-badge-stat completadas">Completadas: {{estadisticas.encuestasCompletas}}</span>
                    <span class="rep-badge-stat revision">En Revisión: {{estadisticas.encuestasRevision}}</span>
                    <span class="rep-badge-stat incompletas">Incompletas: {{estadisticas.encuestasIncompletas}}</span>
                </div>
            </div>
        </div>
        {{/if}}

        <div class="row">
            <div class="col-md-6">
                <div class="rep-form-group">
                    <label>Seleccionar Período:</label>
                    <select name="periodo" class="periodo-select">
                        {{#each periodos}}<option value="{{id}}">{{name}}</option>{{/each}}
                    </select>
                </div>
            </div>
            <div class="col-md-6">
                <div class="rep-form-group">
                    <label>Filtrar por Oficina (Opcional):</label>
                    <select name="oficina" class="oficina-select">
                        <option value="">Todas las oficinas</option>
                        {{#each oficinas}}<option value="{{id}}">{{name}}</option>{{/each}}
                    </select>
                </div>
            </div>
        </div>
        {{/if}}

        {{#if esGerenteODirector}}{{#unless esCasaNacional}}
        <div class="rep-periodo-band">
            <i class="fas fa-info-circle"></i>
            Mostrando datos del período: <strong>{{periodoMostrado}}</strong>
        </div>
        <div class="row">
            <div class="col-md-6 col-md-offset-3">
                <div class="rep-form-group">
                    <label>Seleccionar Período:</label>
                    <select name="periodo" class="periodo-select">
                        {{#each periodos}}<option value="{{id}}">{{name}}</option>{{/each}}
                    </select>
                </div>
            </div>
        </div>
        {{/unless}}{{/if}}

        {{#if esAsesor}}{{#unless esCasaNacional}}{{#unless esGerenteODirector}}
        <div class="rep-periodo-band">
            <i class="fas fa-info-circle"></i>
            Mostrando datos del período: <strong>{{periodoMostrado}}</strong>
        </div>
        {{/unless}}{{/unless}}{{/if}}
    </div>
</div>

<!-- Título sección -->
<div class="rep-section-title">
    <i class="fas fa-th-large"></i>
    <h3>SELECCIONAR REPORTE A VISUALIZAR</h3>
</div>

<!-- Avisos sin datos -->
{{#if tieneReportes}}{{#unless esAsesor}}
    {{#if sinReporteGerente}}
    <div class="rep-aviso"><i class="fas fa-info-circle"></i> No se encontraron datos para generar reportes de <strong>Gerentes</strong> en el período evaluado.</div>
    {{/if}}
    {{#if sinReporteAsesor}}
    <div class="rep-aviso"><i class="fas fa-info-circle"></i> No se encontraron datos para generar reportes de <strong>Asesores</strong> en el período evaluado.</div>
    {{/if}}
{{/unless}}{{/if}}

<!-- Grid de tarjetas -->
{{#if tieneReportes}}
<div class="rep-grid">
    {{#each reportes}}
    <div class="rep-card" data-report-type="{{tipo}}" data-action="{{tipo}}" {{#unless disponible}}style="display:none"{{/unless}}>
        <div class="rep-card-icon"><i class="fas {{icono}}"></i></div>
        <h4>{{titulo}}</h4>
        <p>{{descripcion}}</p>
    </div>
    {{/each}}
</div>
{{else}}
<div class="rep-empty">
    <div class="rep-empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
    <h4>No hay reportes disponibles</h4>
    <p>No se encontraron evaluaciones en el último período para los roles que puedes visualizar.</p>
</div>
{{/if}}

{{/if}}

<div class="rep-actions">
    <button class="rep-btn-back" data-action="back">
        <i class="fas fa-arrow-left"></i> Volver al Inicio
    </button>
</div>
