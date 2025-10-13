<div class="century21-header text-center" style="margin-bottom: 30px;">
    <h1 style="color: #666; font-size: 1.5em;">Reportes de Análisis de Competencias</h1>
</div>

{{#if noHayPeriodos}}
    <div class="alert alert-warning text-center">
        <h4 style="margin-bottom: 15px;"><i class="fas fa-calendar-times"></i> No hay Períodos de Evaluación</h4>
        <p>No se ha configurado ningún período de evaluación en el sistema.</p>
    </div>
{{else}}

        <!-- Panel de información para todos los usuarios -->
    <div class="reports-info panel panel-default" style="margin-bottom: 20px;">
        <div class="panel-body">
            <div class="row">
                <div class="col-md-6">
                    <h4><strong>Usuario:</strong> {{usuario.name}}</h4>
                </div>
                <div class="col-md-6">
                    <h4><strong>Rol:</strong> 
                        {{#if esCasaNacional}}
                            Casa Nacional
                        {{else if esGerenteODirector}}
                            Gerente/Director
                        {{else if esAsesor}}
                            Asesor
                        {{/if}}
                    </h4>
                </div>
            </div>

            {{#if esCasaNacional}}
            <!-- Resumen de estadísticas solo para Casa Nacional -->
            <div class="alert alert-secondary text-center" style="margin-top: 15px; padding: 10px;">
                <i class="fas fa-info-circle"></i> Mostrando datos del período: <strong>{{periodoMostrado}}</strong>.
            </div>

            {{#if estadisticas}}
                <div class="row" style="margin-top: 15px;">
                    <div class="col-md-12">
                        <div class="alert alert-info estadisticas-periodo">
                            <div class="estadisticas-contenido">
                                <div class="estadisticas-texto">
                                    <strong>Resumen del Período Actual:</strong> 
                                </div>
                                <div class="estadisticas-total">
                                    {{estadisticas.totalEncuestas}} encuestas en total.
                                </div>
                                <div class="estadisticas-labels">
                                    <span class="label label-success estadistica-badge">Completadas: {{estadisticas.encuestasCompletas}}</span>
                                    <span class="label label-warning estadistica-badge">En Revisión: {{estadisticas.encuestasRevision}}</span>
                                    <span class="label label-danger estadistica-badge">Incompletas: {{estadisticas.encuestasIncompletas}}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            {{/if}}

            <!-- Selectores para Casa Nacional -->
            <div class="row" style="margin-top: 15px;">
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Seleccionar Período:</label>
                        <select name="periodo" class="form-control periodo-select">
                            {{#each periodos}}
                                <option value="{{id}}">{{name}}</option>
                            {{/each}}
                        </select>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Filtrar por Oficina (Opcional):</label>
                        <select name="oficina" class="form-control oficina-select">
                            <option value="">Todas las oficinas</option>
                            {{#each oficinas}}
                                <option value="{{id}}">{{name}}</option>
                            {{/each}}
                        </select>
                    </div>
                </div>
            </div>
            {{/if}}

            {{#if esGerenteODirector}}
            {{#unless esCasaNacional}}
            <!-- Selector de período para Gerentes/Directores -->
            <div class="alert alert-secondary text-center" style="margin-top: 15px; padding: 10px;">
                <i class="fas fa-info-circle"></i> Mostrando datos del período: <strong>{{periodoMostrado}}</strong>.
            </div>
            <div class="row" style="margin-top: 15px;">
                <div class="col-md-6 col-md-offset-3">
                    <div class="form-group">
                        <label>Seleccionar Período:</label>
                        <select name="periodo" class="form-control periodo-select">
                            {{#each periodos}}
                                <option value="{{id}}">{{name}}</option>
                            {{/each}}
                        </select>
                    </div>
                </div>
            </div>
            {{/unless}}
            {{/if}}

            {{#if esAsesor}}
            {{#unless esCasaNacional}}
            {{#unless esGerenteODirector}}
            <!-- Información del período para Asesores (sin selector) -->
            <div class="alert alert-secondary text-center" style="margin-top: 15px; padding: 10px;">
                <i class="fas fa-info-circle"></i> Mostrando datos del período: <strong>{{periodoMostrado}}</strong>.
            </div>
            {{/unless}}
            {{/unless}}
            {{/if}}

        </div>
    </div>

<div class="reports-title text-center" style="margin-bottom: 30px;">
    <h3 style="background: #333; color: white; padding: 15px; margin: 0; border-radius: 8px;">
        SELECCIONAR REPORTE A VISUALIZAR
    </h3>
</div>

{{#if tieneReportes}}
    {{#unless esAsesor}}
        {{#if sinReporteGerente}}
            <div class="alert alert-warning text-center" style="margin-bottom: 20px;"><i class="fas fa-info-circle"></i> No se encontraron datos para generar reportes de <strong>Gerentes</strong> en el período evaluado.</div>
        {{/if}}
        {{#if sinReporteAsesor}}
            <div class="alert alert-warning text-center" style="margin-bottom: 20px;"><i class="fas fa-info-circle"></i> No se encontraron datos para generar reportes de <strong>Asesores</strong> en el período evaluado.</div>
        {{/if}}
    {{/unless}}
{{/if}}

{{#if tieneReportes}}
<div class="reports-grid" style="margin-bottom: 30px;">
    <div class="row reports-container">
        {{#each reportes}}
        <div class="col-md-6 report-item-container" data-report-type="{{tipo}}" style="margin-bottom: 20px; {{#unless disponible}}display: none;{{/unless}}">
            <div class="report-card panel panel-default" style="height: 200px; cursor: pointer; transition: all 0.3s ease; border: 2px solid #ddd;">
                <div class="panel-body text-center" data-action="{{tipo}}" style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <div class="report-icon" style="font-size: 3em; margin-bottom: 15px; color: #D4AF37;">
                        <i class="fas {{icono}}"></i>
                    </div>
                    <h4 style="color: #333; font-weight: bold;">{{titulo}}</h4>
                    <p style="color: #666; margin-top: 10px;">{{descripcion}}</p>
                </div>
            </div>
        </div>
        {{/each}}
    </div>
</div>
{{else}}
<div class="no-reports text-center" style="margin: 50px 0;">
    <div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle" style="font-size: 2em; margin-bottom: 15px;"></i>
        <h4>No hay reportes disponibles</h4>
        <p>No se encontraron evaluaciones en el último período para los roles que puedes visualizar.</p>
    </div>
</div>
{{/if}}

{{/if}}

<div class="reports-actions" style="margin-top: 30px;">
    <div class="row">
        <div class="col-md-12 text-center">
            <button class="btn btn-default btn-lg" data-action="back">
                <i class="fas fa-arrow-left"></i> Volver al Inicio
            </button>
        </div>
    </div>
</div>

<style>
.report-card:hover {
    border-color: #D4AF37 !important;
    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
    transform: translateY(-2px);
}

.report-card [data-action] {
    width: 100%;
    height: 100%;
    border: none;
    background: none;
    padding: 0;
}

.report-card:hover .report-icon {
    color: #B8941F !important;
    transform: scale(1.1);
}

.report-card:hover h4 {
    color: #D4AF37 !important;
}

.report-icon {
    transition: all 0.3s ease;
}

.report-card h4 {
    transition: color 0.3s ease;
}

.estadisticas-periodo {
    padding: 15px;
    margin-bottom: 0;
}

.estadisticas-contenido {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}

.estadisticas-texto {
    font-size: 1.1em;
    text-align: center;
}

.estadisticas-total {
    font-size: 1em;
    text-align: center;
}

.estadisticas-labels {
    display: flex;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
}

.estadistica-badge {
    font-size: 0.95em;
    padding: 6px 12px;
    flex: 1;
    min-width: 150px;
    text-align: center;
}

@media (max-width: 768px) {
    .col-md-6 {
        margin-bottom: 15px;
    }
    
    .report-card {
        height: 150px !important;
    }
    
    .report-icon {
        display: none !important;
    }
    
    .report-card .panel-body {
        justify-content: center !important;
        padding: 15px !important;
    }
    
    .report-card h4 {
        font-size: 16px !important;
        margin-bottom: 8px !important;
        line-height: 1.3 !important;
    }
    
    .report-card p {
        font-size: 13px !important;
        margin-bottom: 0 !important;
        line-height: 1.4 !important;
    }
    
    .century21-header h1 {
        font-size: 1.3em !important;
    }

    /* Responsive para estadísticas en móvil */
    .estadisticas-labels {
        flex-direction: column;
        width: 100%;
    }

    .estadistica-badge {
        width: 100%;
        min-width: auto;
        margin-bottom: 5px;
        display: block;
    }

    .estadisticas-texto {
        font-size: 1em;
    }

    .estadisticas-total {
        font-size: 0.95em;
    }
}

@media (max-width: 480px) {
    .report-card {
        height: 140px !important;
        min-height: 140px;
    }
    
    .report-card h4 {
        font-size: 15px !important;
    }
    
    .report-card p {
        font-size: 12px !important;
    }

    .century21-header h1 {
        font-size: 1.1em !important;
    }
}

.periodo-select, .oficina-select {
    width: 100%; 
}
</style>