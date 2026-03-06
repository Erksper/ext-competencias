<link rel="stylesheet" type="text/css" href="client/custom/modules/competencias/res/css/estilos.css">

{{#if noHayPeriodos}}
<div class="rep-no-periodos">
    <h4><i class="fas fa-calendar-times"></i> No hay Períodos de Evaluación</h4>
    <p>No se ha configurado ningún período de evaluación en el sistema.</p>
</div>
{{else}}

<div class="rep-page-header">
    <div class="rep-header-icon"><i class="fas fa-chart-bar"></i></div>
    <div>
        <h1 class="rep-page-title">Reportes de Análisis de Competencias</h1>
        <p class="rep-page-sub">Visualización y exportación de evaluaciones por período</p>
    </div>
</div>

<div class="rep-info-card">
    <div class="rep-card-body">
        <div class="row">
            <div class="col-md-6">
                <h4><strong>Usuario:</strong> {{usuario.name}}</h4>
            </div>
            <div class="col-md-6">
                <h4><strong>Rol:</strong>
                    {{#if esCasaNacional}}Casa Nacional
                    {{else if esGerenteODirector}}Gerente / Director / Coordinador
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
        </div>

        <div class="rep-filtro-oficina-panel">
            <div class="rep-filtro-titulo">
                <i class="fas fa-filter"></i> Buscar reporte por oficina
            </div>
            <div class="rep-filtro-campos">
                <div class="rep-filtro-grupo filtro-grupo-cla">
                    <label class="rep-filtro-label">CLA</label>
                    <select id="filtro-cla-reportes" class="rep-filtro-select">
                        <option value="">— Cargando... —</option>
                    </select>
                </div>
                <div class="rep-filtro-grupo">
                    <label class="rep-filtro-label">Oficina</label>
                    <select id="filtro-oficina-reportes" class="rep-filtro-select" disabled>
                        <option value="">— Seleccionar CLA primero —</option>
                    </select>
                </div>
            </div>
            <p class="rep-filtro-hint"><i class="fas fa-info-circle"></i> Seleccione un CLA y luego la oficina. Los reportes disponibles se mostrarán automáticamente.</p>
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

<div class="rep-section-title">
    <i class="fas fa-th-large"></i>
    <h3>SELECCIONAR REPORTE A VISUALIZAR</h3>
</div>

{{#if tieneReportes}}{{#unless esAsesor}}
    {{#if sinReporteGerente}}
    <div class="rep-aviso"><i class="fas fa-info-circle"></i> No se encontraron datos para generar reportes de <strong>Gerentes, Directores y Coordinadores</strong> en el período evaluado.</div>
    {{/if}}
    {{#if sinReporteAsesor}}
    <div class="rep-aviso"><i class="fas fa-info-circle"></i> No se encontraron datos para generar reportes de <strong>Asesores</strong> en el período evaluado.</div>
    {{/if}}
{{/unless}}{{/if}}

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
    <button class="btn-primary" data-action="back">
        <i class="fas fa-arrow-left"></i> Volver al Inicio
    </button>
</div>