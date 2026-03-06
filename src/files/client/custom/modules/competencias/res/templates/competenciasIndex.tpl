<link rel="stylesheet" type="text/css" href="client/custom/modules/competencias/res/css/estilos.css">
<div class="ci-page-header">
    <div class="ci-header-icon">
        <i class="fas fa-star"></i>
    </div>
    <div>
        <h2 class="ci-page-title">Análisis de Competencias</h2>
        <p class="ci-page-sub">Gestión y evaluación de competencias del equipo</p>
    </div>
</div>

<div class="record-container">
    <div class="row">
        <div class="col-md-8 col-md-offset-2">

            {{#if tieneAccesoAlModulo}}

                {{#if esAdmin}}
                    {{#if preguntasRecienCreadas}}
                    <div class="ci-alert-card ci-alert-success">
                        <div class="ci-alert-body ci-alert-center">
                            <h4><i class="fas fa-check-circle"></i> Sistema Listo</h4>
                            <p>El sistema tiene <strong>{{totalPreguntas}} preguntas configuradas</strong> y está listo para realizar evaluaciones.</p>
                        </div>
                    </div>
                    {{/if}}
                {{else}}
                    {{#if sinPreguntas}}
                    <div class="ci-alert-card ci-alert-info">
                        <div class="ci-alert-body ci-alert-center">
                            <h4><i class="fas fa-info-circle"></i> Sistema en configuración</h4>
                            <p>El sistema de competencias está siendo configurado por el administrador. Los botones se habilitarán una vez completada la configuración.</p>
                        </div>
                    </div>
                    {{else}}
                        {{#if encuestaActiva}}
                        <div class="ci-periodo-band">
                            <i class="fas fa-calendar-check"></i>
                            Período de evaluación activo. Fecha de cierre: <strong>{{fechaCierre}}</strong>
                        </div>
                        {{/if}}
                    {{/if}}
                {{/if}}

                <div class="ci-main-card">
                    <div class="ci-main-card-body">

                        {{#if mostrarBotonActivar}}
                        <div class="ci-activar-row">
                            <button class="ci-btn ci-btn-primary ci-btn-lg ci-btn-block" data-action="activarEncuestas" disabled>
                                <i class="fas fa-play-circle"></i> Activar Período
                            </button>
                            <label for="fecha-cierre-input" class="sr-only">Seleccionar fecha de cierre</label>
                            <input type="date" id="fecha-cierre-input" class="ci-date-input">
                        </div>
                        {{/if}}

                        {{#if mostrarBotonIniciar}}
                        <button class="ci-btn ci-btn-primary ci-btn-lg ci-btn-block {{#if sinPreguntas}}ci-btn-disabled{{/if}}"
                                data-action="startSurvey">
                            <i class="fas fa-clipboard-list"></i> Evaluar Competencias
                            {{#if sinPreguntas}}<small>⚠️ Requiere preguntas configuradas</small>{{/if}}
                        </button>
                        {{/if}}

                        <button class="ci-btn ci-btn-primary ci-btn-lg ci-btn-block {{#if sinPreguntas}}ci-btn-disabled{{/if}}"
                                data-action="viewReports">
                            <i class="fas fa-chart-bar"></i> Reportes
                            {{#if sinPreguntas}}<small>⚠️ Requiere datos de evaluaciones</small>{{/if}}
                        </button>

                        {{#if mostrarBotonListaEdicion}}
                            {{#if esCasaNacional}}
                            <div class="ci-edicion-group">
                                <div class="ci-group-header">
                                    <i class="fas fa-history"></i>
                                    <h3>Editar Encuestas Anteriores</h3>
                                </div>
                                <div class="ci-lista-edicion-row">
                                    <select id="periodo-lista-input" class="ci-periodo-select">
                                        <option value="">— Selecciona un período —</option>
                                        {{#each periodos}}
                                        <option value="{{this.id}}">{{this.label}}</option>
                                        {{/each}}
                                    </select>
                                    <button class="ci-btn ci-btn-primary ci-btn-lg ci-btn-block"
                                            id="btn-lista-edicion"
                                            data-action="irListaEdicion"
                                            disabled>
                                        <i class="fas fa-list-ul"></i> Lista de Encuestas
                                    </button>
                                </div>
                            </div>
                            {{/if}}
                        {{/if}}

                    </div>
                </div>

            {{else}}
                <div class="ci-acceso-denegado">
                    <div class="ci-acceso-icon"><i class="fas fa-ban"></i></div>
                    <h4>Acceso Denegado</h4>
                    <p>Disculpe, no tiene los permisos para ver este módulo. Por favor, contacte con personal de la Casa Nacional.</p>
                </div>
            {{/if}}

        </div>
    </div>
</div>