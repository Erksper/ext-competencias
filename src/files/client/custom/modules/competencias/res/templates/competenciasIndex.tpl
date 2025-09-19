<!-- Actualiza: src/files/client/custom/modules/competencias/res/templates/competenciasIndex.tpl -->
<div class="page-header text-center">
    <h2>
        Encuestas de análisis de competencias
    </h2>
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
            {{#if preguntasRecienCreadas}}
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
            {{else}}
            <!-- Mensaje para usuarios no admin cuando no hay preguntas -->
            {{#if sinPreguntas}}
            <div class="alert alert-info" style="margin-bottom: 20px;">
                <div class="row">
                    <div class="col-md-12 text-center">
                        <h4><i class="fas fa-info-circle"></i> Sistema en configuración</h4>
                        <p>El sistema de competencias está siendo configurado por el administrador. Los botones se habilitarán una vez completada la configuración.</p>
                    </div>
                </div>
            </div>
            {{/if}}
            {{/if}}

            <!-- Panel Principal -->
            <div class="panel panel-default">
                <div class="panel-body">
                    <div class="row">
                        <div class="col-md-6 col-md-offset-3 text-center">
                            <div style="margin: 30px 0 40px 0;">
                                <button class="btn btn-primary btn-lg btn-block {{#if sinPreguntas}}btn-disabled{{/if}}" 
                                        data-action="startSurvey" 
                                        style="margin-bottom: 20px;">
                                    <i class="fas fa-clipboard-list"></i> Iniciar Evaluación
                                    {{#if sinPreguntas}}<small style="display: block; font-size: 0.8em; margin-top: 5px;">⚠️ Requiere preguntas configuradas</small>{{/if}}
                                </button>
                                <button class="btn btn-primary btn-lg btn-block {{#if sinPreguntas}}btn-disabled{{/if}}" 
                                        data-action="viewReports">
                                    <i class="fas fa-chart-bar"></i> Reportes
                                    {{#if sinPreguntas}}<small style="display: block; font-size: 0.8em; margin-top: 5px;">⚠️ Requiere datos de evaluaciones</small>{{/if}}
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
/* Botones deshabilitados */
.panel-body .btn.btn-disabled {
    background-color: #f5f5f5 !important;
    border-color: #ddd !important;
    color: #999 !important;
    cursor: not-allowed !important;
    opacity: 0.6;
    pointer-events: auto; /* Permitir hover para mostrar tooltip */
}

.panel-body .btn.btn-disabled:hover {
    background-color: #f5f5f5 !important;
    border-color: #ddd !important;
    color: #999 !important;
    transform: none;
}

.panel-body .btn.btn-disabled small {
    color: #d9534f;
    font-weight: normal;
}

/* Estilo para el botón de crear preguntas DEL CENTRO */
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

.btn[data-action="crearPreguntas"].disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

.alert-info {
    border-color: #5bc0de;
    background-color: #d9edf7;
}
</style>