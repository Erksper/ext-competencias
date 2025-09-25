<div class="century21-header text-center" style="margin-bottom: 30px;">
    <h1 style="color: #666; font-size: 1.5em;">Reportes de Competencias</h1>
</div>

{{#if noHayPeriodos}}
    <div class="alert alert-warning text-center">
        <h4 style="margin-bottom: 15px;"><i class="fas fa-calendar-times"></i> No hay Períodos de Evaluación</h4>
        <p>No se ha configurado ningún período de evaluación en el sistema.</p>
    </div>
{{else}}

    {{#if esCasaNacional}}
    <div class="reports-info panel panel-default" style="margin-bottom: 20px;">
        <div class="panel-body">
            <div class="row">
                <div class="col-md-6">
                    <h4><strong>Usuario:</strong> {{usuario.name}}</h4>
                </div>
                <div class="col-md-6">
                    <h4><strong>Rol:</strong> Casa Nacional</h4>
                </div>
            </div>
            {{#unless isPeriodoActivo}}
            <div class="alert alert-secondary text-center" style="margin-top: 15px; padding: 10px;">
                <i class="fas fa-info-circle"></i> Mostrando datos del último período cerrado: <strong>{{periodoMostrado}}</strong>.
            </div>
            {{/unless}}

            {{#if estadisticas}}
            <div class="row" style="margin-top: 15px;">
                <div class="col-md-12">
                    <div class="alert alert-info">
                        <strong>Resumen del Período Actual:</strong> 
                        {{estadisticas.totalEncuestas}} encuestas en total.
                        <span class="label label-success" style="margin-left: 10px;">Completadas: {{estadisticas.encuestasCompletas}}</span>
                        <span class="label label-warning">En Revisión: {{estadisticas.encuestasRevision}}</span>
                        <span class="label label-danger">Incompletas: {{estadisticas.encuestasIncompletas}}</span>
                    </div>
                </div>
            </div>
            <div class="row" style="margin-top: 10px;">
                <div class="col-md-12">
                    <label for="oficina">Filtrar por Oficina</label>
                    <select name="oficina" class="form-control">
                        <option value=""></option>
                        {{#each oficinas}}
                            <option value="{{id}}">{{name}}</option>
                        {{/each}}
                    </select>
                </div>
            </div>
            {{/if}}
        </div>
    </div>
    {{/if}}

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

@media (max-width: 768px) {
    .col-md-6 {
        margin-bottom: 15px;
    }
    
    .report-card {
        height: 150px !important;
    }
    
    .report-icon {
        font-size: 2.5em !important;
        margin-bottom: 10px !important;
    }
    
    .century21-header h1 {
        font-size: 2em !important;
    }
    
    .century21-header h2 {
        font-size: 1.2em !important;
    }
}
</style>