<!-- Actualiza: src/files/client/custom/modules/competencias/res/templates/competenciasIndex.tpl -->
<div class="page-header">
    <div class="row">
        <div class="col-sm-7">
            <h3>
                <span style="color: #D4AF37; font-weight: bold;">CENTURY 21</span>
                <small>Sistema de Competencias</small>
            </h3>
        </div>
        {{#if esAdmin}}
        <div class="col-sm-5 text-right">
            {{#if mostrarBotonCrear}}
            <button class="btn btn-warning btn-sm" data-action="crearPreguntas" title="Crear preguntas del sistema">
                <i class="fas fa-plus-circle"></i> Crear Preguntas
            </button>
            {{else}}
            <small class="text-muted">
                <i class="fas fa-check-circle text-success"></i> 
                Sistema inicializado ({{totalPreguntas}} preguntas)
            </small>
            {{/if}}
        </div>
        {{/if}}
    </div>
</div>

<div class="record-container">
    <div class="row">
        <div class="col-md-8 col-md-offset-2">
            
            {{#if esAdmin}}
            {{#if mostrarBotonCrear}}
            <!-- Alerta para admin cuando no hay preguntas -->
            <div class="alert alert-warning" style="margin-bottom: 20px;">
                <div class="row">
                    <div class="col-md-8">
                        <h4><i class="fas fa-exclamation-triangle"></i> Sistema no inicializado</h4>
                        <p><strong>No hay preguntas configuradas.</strong> Para usar el sistema de competencias, primero debes crear las preguntas predeterminadas.</p>
                    </div>
                    <div class="col-md-4 text-right">
                        <button class="btn btn-warning" data-action="crearPreguntas">
                            <i class="fas fa-magic"></i> Inicializar Sistema
                        </button>
                    </div>
                </div>
            </div>
            {{else}}
            <!-- Confirmación cuando el sistema está listo -->
            <div class="alert alert-success" style="margin-bottom: 20px;">
                <div class="row">
                    <div class="col-md-12 text-center">
                        <h4><i class="fas fa-check-circle"></i> Sistema Listo</h4>
                        <p>El sistema tiene <strong>{{totalPreguntas}} preguntas configuradas</strong> y está listo para realizar evaluaciones.</p>
                    </div>
                </div>
            </div>
            {{/if}}
            {{/if}}

            <!-- Panel Principal -->
            <div class="panel panel-default">
                <div class="panel-heading">
                    <h4 class="panel-title">Análisis de Competencias</h4>
                </div>
                <div class="panel-body">
                    <div class="row">
                        <div class="col-md-6 col-md-offset-3 text-center">
                            <div style="margin: 30px 0 40px 0;">
                                <button class="btn btn-lg btn-block" data-action="startSurvey" style="margin-bottom: 20px;">
                                    <i class="fas fa-clipboard-list"></i> Iniciar Evaluación
                                </button>
                                <button class="btn btn-lg btn-block" data-action="viewReports">
                                    <i class="fas fa-chart-bar"></i> Reportes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
.panel-body .btn[data-action="startSurvey"],
.panel-body .btn[data-action="viewReports"] {
    background-color: #666;
    border-color: #555;
    color: #fff;
}

.panel-body .btn[data-action="startSurvey"]:hover,
.panel-body .btn[data-action="viewReports"]:hover {
    background-color: #555;
    border-color: #444;
    color: #fff;
}

/* Estilo para el botón de crear preguntas */
.btn[data-action="crearPreguntas"] {
    background-color: #f0ad4e;
    border-color: #eea236;
    color: #fff;
}

.btn[data-action="crearPreguntas"]:hover {
    background-color: #ec971f;
    border-color: #d58512;
    color: #fff;
}

/* Estilos para las alertas */
.alert-warning {
    border-color: #f0ad4e;
    background-color: #fcf8e3;
}

.alert-success {
    border-color: #5cb85c;
    background-color: #dff0d8;
}
</style>