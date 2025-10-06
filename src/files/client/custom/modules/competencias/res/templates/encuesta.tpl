{{#if accesoDenegado}}
    <div class="alert alert-danger text-center">
        <h4 style="margin-bottom: 15px;"><i class="fas fa-ban"></i> Acceso Denegado</h4>
        <p>No tienes los permisos necesarios para acceder a esta página.</p>
    </div>
    <div class="text-center">
        <button class="btn btn-default" data-action="backToHome"><i class="fas fa-home"></i> Volver al Inicio</button>
    </div>
{{else if encuestaInactiva}}
    <div class="alert alert-warning text-center">
        <h4 style="margin-bottom: 15px;"><i class="fas fa-calendar-times"></i> Período de Evaluación Inactivo</h4>
        <p>Actualmente no hay un período de evaluación activo. No se pueden crear ni modificar encuestas.</p>
    </div>
    <div class="text-center">
        <button class="btn btn-default" data-action="backToHome"><i class="fas fa-home"></i> Volver al Inicio</button>
    </div>
{{else}}
    <div class="century21-header text-center">
    </div>

    <div class="survey-info panel panel-default">
        <div class="panel-body">
            <div class="row">
                <div class="col-md-6">
                    <h3><strong>Oficina:</strong> {{teamName}}</h3>
                </div>
                <div class="col-md-6">
                    <h3><strong>Usuario evaluado:</strong> {{userName}}</h3>
                </div>
            </div>
        </div>
    </div>

    <div class="survey-title text-center">
        <h3>
            ANÁLISIS DE COMPETENCIAS
        </h3>
    </div>

    {{#each preguntas}}
    <div class="categoria-principal">
        <h3 class="categoria-header" data-action="toggleCategoria" data-categoria-nombre="{{@key}}">
            <span>{{@key}}</span>
            <span class="estado-completitud"></span>
            <i class="fas fa-chevron-down categoria-chevron"></i>
        </h3>
        
        <div class="categoria-content" data-categoria-nombre="{{@key}}">
            {{#each this}}
            <div class="subcategoria-section">
                <h3 class="subcategoria-header" data-action="toggleSubcategoria" data-subcategoria-nombre="{{@key}}">
                    <span><i class="fas fa-folder-open"></i> {{@key}}</span>
                    <span class="estado-completitud"></span>
                    <i class="fas fa-chevron-down subcategoria-chevron"></i>
                </h3>
                
                <div class="subcategoria-content" data-subcategoria-nombre="{{@key}}">
                    <div class="table-responsive">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>Competencia</th>
                                    <th><i class="fas fa-circle icon-verde"></i>Verde</th>
                                    <th><i class="fas fa-circle icon-amarillo"></i>Amarillo</th>
                                    <th><i class="fas fa-circle icon-rojo"></i>Rojo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {{#each this}}
                                <tr class="pregunta-row">
                                    <td>
                                        <div class="pregunta-texto-container">
                                            <span class="pregunta-icon-space">
                                                {{#if info}}
                                                <i class="fas fa-info-circle info-icon" 
                                                   data-action="showInfo"
                                                   data-toggle="tooltip" 
                                                   data-html="true"
                                                   data-info="{{info}}"
                                                   data-pregunta-texto="{{orden}}. {{texto}}"
                                                   title="<small>Click para ver información completa</small>"></i>
                                                {{/if}}
                                            </span>
                                            <h4>{{orden}}. {{texto}}</h4>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="color-option color-verde"
                                            data-action="selectColor" 
                                            data-pregunta-id="{{id}}" 
                                            data-color="verde">
                                        </div>
                                    </td>
                                    <td>
                                        <div class="color-option color-amarillo"
                                            data-action="selectColor" 
                                            data-pregunta-id="{{id}}" 
                                            data-color="amarillo">
                                        </div>
                                    </td>
                                    <td>
                                        <div class="color-option color-rojo"
                                            data-action="selectColor" 
                                            data-pregunta-id="{{id}}" 
                                            data-color="rojo">
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

    <div class="survey-actions">
        <div class="row">
            <div class="col-md-6">
                <button class="btn btn-default" data-action="back">
                    <i class="fas fa-arrow-left"></i> Volver
                </button>
            </div>
            <div class="col-md-6 text-right">
                <button class="btn btn-success btn-lg" data-action="saveSurvey">
                    <i class="fas fa-save"></i> Guardar Encuesta
                </button>
                {{#if esCasaNacional}}
                <button class="btn btn-primary btn-lg" data-action="completeSurvey" style="margin-left: 10px;">
                    <i class="fas fa-check-circle"></i> Completar Encuesta
                </button>
                {{/if}}
            </div>
        </div>
    </div>
{{/if}}
<style>
.century21-header {
    margin-bottom: 30px;
}

.survey-info {
    margin-bottom: 20px;
}

.survey-title {
    margin-bottom: 20px;
}

.survey-title h3 {
    background: #333;
    color: white;
    padding: 15px;
    margin: 0;
    border-radius: 8px;
}

.categoria-principal {
    margin-bottom: 15px;
}

.subcategoria-section {
    margin-bottom: 15px;
}

.subcategoria-content .table {
    border: 2px solid #000;
    margin-top: 5px;
}

.subcategoria-content table thead tr {
    background: #f5f5f5;
}

.subcategoria-content table thead th {
    border: 1px solid #000;
    color: black;
    text-align: center;
    font-size: 15px;
    width: 10%;
}

.subcategoria-content table thead th:first-child {
    width: 70%;
    text-align: left;
}

.subcategoria-content table thead th .fa-circle {
    margin-right: 5px;
}

.subcategoria-content table thead th .icon-verde {
    color: #4CAF50;
}

.subcategoria-content table thead th .icon-amarillo {
    color: #FFC107;
}

.subcategoria-content table thead th .icon-rojo {
    color: #F44336;
}

.subcategoria-content table tbody td {
    border: 1px solid #000;
    padding: 10px;
    text-align: center;
}

.subcategoria-content table tbody .pregunta-row td:first-child {
    padding: 15px;
    font-weight: 500;
    text-align: left;
}

.pregunta-texto-container {
    display: flex;
    align-items: flex-start;
}

.pregunta-icon-space {
    display: inline-block;
    width: 25px;
    flex-shrink: 0;
    text-align: left;
}

.info-icon {
    color: #17a2b8;
    font-size: 16px;
    cursor: pointer;
    margin-right: 5px;
    transition: color 0.2s ease, transform 0.2s ease;
}

.info-icon:hover {
    color: #138496;
    transform: scale(1.1);
}

.pregunta-row h4 {
    font-size: 16px;
    margin: 0;
    flex: 1;
}

.survey-actions {
    margin-top: 30px;
}

.survey-actions .btn-primary[data-action="completeSurvey"] {
    background-color: #007bff;
    border-color: #007bff;
}

.survey-actions .btn-primary[data-action="completeSurvey"]:hover,
.survey-actions .btn-primary[data-action="completeSurvey"]:focus {
    background-color: #0056b3;
    border-color: #004085;
}

.estado-completitud {
    font-size: 11px;
    font-weight: bold;
    padding: 3px 8px;
    border-radius: 10px;
    margin-left: 15px;
    color: white;
    vertical-align: middle;
}

.categoria-header .estado-completitud,
.subcategoria-header .estado-completitud {
    position: absolute;
    right: 40px;
    top: 50%;
    transform: translateY(-50%);
}

.estado-completitud.completo {
    background-color: #4CAF50;
}

.estado-completitud.incompleto {
    background-color: #FFC107;
    color: #333;
}

.categoria-header {
    background: #666;
    color: white;
    padding: 15px;
    margin: 0;
    cursor: pointer;
    position: relative;
    border-radius: 6px;
    transition: background-color 0.2s ease-in-out;
    font-size: 1.2em;
    font-weight: bold;
}

.categoria-header:hover {
    background-color: #555;
}

.categoria-chevron {
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%) rotate(0deg);
    transition: transform 0.3s ease;
}

.categoria-header.active .categoria-chevron {
    transform: translateY(-50%) rotate(180deg);
}

.subcategoria-header {
    background: #f8f9fa;
    color: #333;
    padding: 12px 15px;
    margin: 10px 0 0 0;
    cursor: pointer;
    position: relative;
    border: 1px solid #ddd;
    border-radius: 4px;
    transition: background-color 0.2s ease-in-out;
    font-size: 1.1em;
    font-weight: 600;
}

.subcategoria-header:hover {
    background-color: #e9ecef;
}

.subcategoria-chevron {
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%) rotate(0deg);
    transition: transform 0.3s ease;
    font-size: 0.8em;
}

.subcategoria-header.active .subcategoria-chevron {
    transform: translateY(-50%) rotate(180deg);
}

.survey-actions .btn-success[data-action="saveSurvey"] {
    background-color: #666;
    border-color: #555;
}

.survey-actions .btn-success[data-action="saveSurvey"]:hover,
.survey-actions .btn-success[data-action="saveSurvey"]:focus {
    background-color: #555;
    border-color: #444;
}

.color-option {
    position: relative;
    width: 25px;
    height: 25px;
    margin: 0 auto;
    border-radius: 6px;
    border: 2px solid #ddd;
    cursor: pointer;
    background-color: transparent;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.color-option:hover {
    transform: scale(1.1);
    border-color: #999 !important;
}

.table-responsive .color-option.selected {
    border-color: #000 !important;
    border-width: 3px !important;
    transform: scale(1.15);
    box-shadow: 0 0 0 1px #fff, 0 0 0 3px #000;
    animation: pulse 0.4s ease-in-out;
}

.table-responsive .color-option.color-verde.selected {
    background-color: #4CAF50 !important;
}

.table-responsive .color-option.color-amarillo.selected {
    background-color: #FFC107 !important;
}

.table-responsive .color-option.color-rojo.selected {
    background-color: #F44336 !important;
}

.table-responsive .color-option.selected::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 14px;
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
}

@keyframes pulse {
    0% { transform: scale(1.15); }
    50% { transform: scale(1.25); }
    100% { transform: scale(1.15); }
}

.categoria-content {
    display: none;
    padding: 15px;
    background: #fafafa;
    border: 1px solid #ddd;
    border-top: none;
    border-radius: 0 0 6px 6px;
}

.subcategoria-content {
    display: none;
    margin: 5px 0 10px 0;
}

/* Estilos para el tooltip */
.tooltip-inner {
    max-width: 350px;
    text-align: left;
    padding: 10px 15px;
    background-color: #333;
    font-size: 13px;
    line-height: 1.5;
}

.tooltip.top .tooltip-arrow {
    border-top-color: #333;
}

.tooltip.bottom .tooltip-arrow {
    border-bottom-color: #333;
}

.tooltip.left .tooltip-arrow {
    border-left-color: #333;
}

.tooltip.right .tooltip-arrow {
    border-right-color: #333;
}

/* Estilos para el modal de información */
#infoModal .modal-dialog {
    margin: 50px auto !important;
}

#infoModal .modal-content {
    border-radius: 6px;
    overflow: hidden;
}

#infoModal .modal-header {
    background-color: var(--btn-primary-bg);
    color: white;
    border-radius: 0;
    position: relative;
    padding: 15px 20px;
}

#infoModal .modal-header .close {
    color: white;
    opacity: 0.8;
    position: absolute;
    top: 15px;
    right: 20px;
    font-size: 28px;
    font-weight: 300;
    line-height: 1;
    margin: 0;
    padding: 0;
    background: transparent;
    border: 0;
}

#infoModal .modal-header .close:hover {
    opacity: 1;
}

#infoModal .modal-header .modal-title {
    font-weight: bold;
    padding-right: 30px;
}

#infoModal .modal-body {
    max-height: 60vh;
    overflow-y: auto;
    padding: 20px;
}

#infoModal .info-pregunta-container {
    background-color: #f8f9fa;
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 20px;
    border-left: 4px solid var(--btn-primary-bg);
}

#infoModal .info-pregunta-titulo {
    color: var(--btn-primary-bg);
    font-weight: bold;
    margin-bottom: 10px;
    font-size: 14px;
    text-transform: uppercase;
}

#infoModal .info-pregunta-texto {
    color: #333;
    font-size: 15px;
    margin: 0;
    line-height: 1.6;
}

#infoModal .info-contenido-container {
    padding: 15px;
    background-color: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
}

#infoModal .info-contenido-titulo {
    color: #495057;
    font-weight: bold;
    margin-bottom: 15px;
    font-size: 14px;
    text-transform: uppercase;
}

#infoModal .info-contenido-texto {
    color: #333;
    font-size: 14px;
    line-height: 1.8;
    white-space: pre-wrap;
    word-wrap: break-word;
}

#infoModal .modal-footer {
    border-top: 1px solid #dee2e6;
}

/* Scrollbar personalizado para el modal */
#infoModal .modal-body::-webkit-scrollbar {
    width: 8px;
}

#infoModal .modal-body::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
}

#infoModal .modal-body::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 10px;
}

#infoModal .modal-body::-webkit-scrollbar-thumb:hover {
    background: #555;
}
</style>