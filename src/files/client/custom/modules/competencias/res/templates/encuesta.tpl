<link rel="stylesheet" type="text/css" href="client/custom/modules/competencias/res/css/estilos.css">

{{#if accesoDenegado}}
    <div class="alert alert-danger text-center">
        <h4 style="margin-bottom: 15px;"><i class="fas fa-ban"></i> Acceso Denegado</h4>
        <p>No tienes los permisos necesarios para acceder a esta página.</p>
    </div>
    <div class="text-center">
        <button class="btn btn-primary" data-action="backToHome"><i class="fas fa-home"></i> Volver al Inicio</button>
    </div>
{{else if encuestaInactiva}}
    <div class="alert alert-warning text-center">
        <h4 style="margin-bottom: 15px;"><i class="fas fa-calendar-times"></i> Período de Evaluación Inactivo</h4>
        <p>Actualmente no hay un período de evaluación activo. No se pueden crear ni modificar encuestas.</p>
    </div>
    <div class="text-center">
        <button class="btn btn-primary" data-action="backToHome"><i class="fas fa-home"></i> Volver al Inicio</button>
    </div>
{{else}}
    <div class="encuesta-page-header">
        <div class="encuesta-header-icon">
            <i class="fas fa-clipboard-check"></i>
        </div>
        <div>
            <h2 class="encuesta-page-title">Evaluación de Competencias</h2>
            <p class="encuesta-page-sub">Complete la evaluación del usuario seleccionado</p>
        </div>
    </div>

    <div class="encuesta-info-card">
        <div class="encuesta-card-body">
            <div class="encuesta-info-grid">
                <div class="encuesta-info-item">
                    <span class="encuesta-info-label">Oficina:</span>
                    <span class="encuesta-info-value">{{teamName}}</span>
                </div>
                <div class="encuesta-info-item">
                    <span class="encuesta-info-label">Usuario evaluado:</span>
                    <span class="encuesta-info-value">{{userName}}</span>
                </div>
                <div class="encuesta-info-item">
                    <span class="encuesta-info-label">Tipo:</span>
                    <span class="encuesta-info-value">
                        {{#if (eq role 'asesor')}}
                            Asesor
                        {{else}}
                            Gerente / Director / Coordinador
                        {{/if}}
                    </span>
                </div>
            </div>
        </div>
    </div>

    <div class="encuesta-section-title">
        <i class="fas fa-tasks"></i>
        <h3>ANÁLISIS DE COMPETENCIAS</h3>
    </div>

    <div class="encuesta-mobile-legend">
        <div class="encuesta-legend-item">
            <span class="encuesta-legend-dot completo"></span>
            <span>Completo</span>
        </div>
        <div class="encuesta-legend-item">
            <span class="encuesta-legend-dot incompleto"></span>
            <span>Incompleto</span>
        </div>
    </div>

    <div class="encuesta-preguntas-container">
        {{#each preguntas}}
        <div class="encuesta-categoria">
            <div class="encuesta-categoria-header" data-action="toggleCategoria" data-categoria-nombre="{{@key}}">
                <div class="encuesta-categoria-titulo">
                    <i class="fas fa-folder"></i>
                    <span>{{@key}}</span>
                </div>
                <div class="encuesta-categoria-estado">
                    <span class="estado-completitud"></span>
                    <i class="fas fa-chevron-down encuesta-categoria-chevron"></i>
                </div>
            </div>
            
            <div class="encuesta-categoria-content" data-categoria-nombre="{{@key}}">
                {{#each this}}
                <div class="encuesta-subcategoria">
                    <div class="encuesta-subcategoria-header" data-action="toggleSubcategoria" data-subcategoria-nombre="{{@key}}">
                        <div class="encuesta-subcategoria-titulo">
                            <i class="fas fa-folder-open"></i>
                            <span>{{@key}}</span>
                        </div>
                        <div class="encuesta-subcategoria-estado">
                            <span class="estado-completitud"></span>
                            <i class="fas fa-chevron-down encuesta-subcategoria-chevron"></i>
                        </div>
                    </div>
                    
                    <div class="encuesta-subcategoria-content" data-subcategoria-nombre="{{@key}}">
                        <div class="encuesta-tabla-container">
                            <table class="encuesta-tabla">
                                <thead>
                                    <tr>
                                        <th>Competencia</th>
                                        <th><span class="encuesta-color-badge verde">Verde</span></th>
                                        <th><span class="encuesta-color-badge amarillo">Amarillo</span></th>
                                        <th><span class="encuesta-color-badge rojo">Rojo</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {{#each this}}
                                    <tr class="encuesta-pregunta-row">
                                        <td>
                                            <div class="encuesta-pregunta-container">
                                                {{#if info}}
                                                <i class="fas fa-info-circle encuesta-info-icon" 
                                                   data-action="showInfo"
                                                   data-info="{{info}}"
                                                   data-pregunta-texto="{{orden}}. {{texto}}"
                                                   title="Ver información adicional"></i>
                                                {{/if}}
                                                <span class="encuesta-pregunta-texto">{{orden}}. {{texto}}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div class="encuesta-color-opcion color-verde"
                                                data-action="selectColor" 
                                                data-pregunta-id="{{id}}" 
                                                data-color="verde"
                                                title="Verde - Competente">
                                            </div>
                                        </td>
                                        <td>
                                            <div class="encuesta-color-opcion color-amarillo"
                                                data-action="selectColor" 
                                                data-pregunta-id="{{id}}" 
                                                data-color="amarillo"
                                                title="Amarillo - En desarrollo">
                                            </div>
                                        </td>
                                        <td>
                                            <div class="encuesta-color-opcion color-rojo"
                                                data-action="selectColor" 
                                                data-pregunta-id="{{id}}" 
                                                data-color="rojo"
                                                title="Rojo - Requiere mejora">
                                            </div>
                                        </td>
                                    </tr>
                                    {{/each}}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                {{/each}}
            </div>
        </div>
        {{/each}}
    </div>

    <div class="encuesta-acciones">
        <div class="encuesta-acciones-grid">
            <div class="encuesta-acciones-izquierda">
                <button class="btn-primary" data-action="back">
                    <i class="fas fa-arrow-left"></i> Volver
                </button>
            </div>
            <div class="encuesta-acciones-derecha">
                {{#unless fromListaEdicion}}
                <button class="btn-primary" data-action="saveSurvey">
                    <i class="fas fa-save"></i> Guardar Encuesta
                </button>
                {{/unless}}
                <button class="btn-primary" data-action="completeSurvey">
                    {{#if fromListaEdicion}}
                        <i class="fas fa-save"></i> Guardar Cambios
                    {{else}}
                        <i class="fas fa-check-circle"></i> Completar Encuesta
                    {{/if}}
                </button>
            </div>
        </div>
    </div>
{{/if}}

<div class="modal fade" id="infoModal" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content encuesta-modal-content">
            <div class="modal-header encuesta-modal-header">
                <button type="button" class="close" data-dismiss="modal">
                    <span aria-hidden="true">&times;</span>
                </button>
                <h4 class="modal-title">
                    <i class="fas fa-info-circle"></i> Información de la Pregunta
                </h4>
            </div>
            <div class="modal-body encuesta-modal-body">
                <div class="encuesta-modal-pregunta">
                    <h5>Pregunta:</h5>
                    <p class="info-pregunta-texto"></p>
                </div>
                <div class="encuesta-modal-info">
                    <h5>Información adicional:</h5>
                    <div class="info-contenido-texto"></div>
                </div>
            </div>
            <div class="modal-footer encuesta-modal-footer">
                <button type="button" class="btn-primary" data-dismiss="modal">Cerrar</button>
            </div>
        </div>
    </div>
</div>