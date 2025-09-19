<div class="century21-header text-center" style="margin-bottom: 30px;">
    <h1 style="color: #666; font-size: 1.5em;">Reportes de Competencias</h1>
</div>

<div class="reports-info panel panel-default" style="margin-bottom: 20px;">
    <div class="panel-body">
        <div class="row">
            <div class="col-md-6">
                <h4><strong>Usuario:</strong> {{usuario.name}}</h4>
            </div>
            <div class="col-md-6">
                <h4><strong>Tipo:</strong> {{usuario.type}}</h4>
            </div>
        </div>
        {{#if estadisticas}}
        <div class="row" style="margin-top: 15px;">
            <div class="col-md-12">
                <div class="alert alert-info">
                    <strong>Resumen:</strong> 
                    {{estadisticas.totalEncuestas}} encuestas realizadas
                    ({{estadisticas.encuestasAsesor}} asesores, {{estadisticas.encuestasGerente}} gerentes)
                </div>
            </div>
        </div>
        {{/if}}
    </div>
</div>

<div class="reports-title text-center" style="margin-bottom: 30px;">
    <h3 style="background: #333; color: white; padding: 15px; margin: 0; border-radius: 8px;">
        SELECCIONAR REPORTE A VISUALIZAR
    </h3>
</div>

{{#if tieneReportes}}
<div class="reports-grid" style="margin-bottom: 30px;">
    <div class="row">
        {{#each reportes}}
        {{#if disponible}}
        <div class="col-md-6" style="margin-bottom: 20px;">
            <div class="report-card panel panel-default" style="height: 200px; cursor: pointer; transition: all 0.3s ease; border: 2px solid #ddd;">
                <div class="panel-body text-center" data-action="reporte{{tipo}}" style="height: 100%; display: flex; flex-direction: column; justify-content: center;">
                    <div class="report-icon" style="font-size: 3em; margin-bottom: 15px; color: #D4AF37;">
                        <i class="fas {{icono}}"></i>
                    </div>
                    <h4 style="color: #333; font-weight: bold;">{{titulo}}</h4>
                    <p style="color: #666; margin-top: 10px;">{{descripcion}}</p>
                </div>
            </div>
        </div>
        {{/if}}
        {{/each}}
    </div>
</div>
{{else}}
<div class="no-reports text-center" style="margin: 50px 0;">
    <div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle" style="font-size: 2em; margin-bottom: 15px;"></i>
        <h4>No hay reportes disponibles</h4>
        <p>No se encontraron encuestas completadas o no tienes permisos para ver reportes.</p>
    </div>
</div>
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
/* Estilos para las tarjetas de reportes */
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

/* Animaciones */
.report-icon {
    transition: all 0.3s ease;
}

.report-card h4 {
    transition: color 0.3s ease;
}

/* Responsive design */
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