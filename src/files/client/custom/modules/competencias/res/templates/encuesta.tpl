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
                                        <h4>{{orden}}. {{texto}}</h4>
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
    color: black; /* Texto en negro como solicitado */
    text-align: center;
    font-size: 15px; /* Aumentado para mejor visibilidad */
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

.pregunta-row h4 {
    font-size: 16px; /* Aumentado para mejor visibilidad */
    margin: 0;
}

.survey-actions {
    margin-top: 30px;
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
    right: 40px; /* Espacio a la izquierda del chevron */
    top: 50%;
    transform: translateY(-50%);
}

.estado-completitud.completo {
    background-color: #4CAF50; /* Verde */
}
.estado-completitud.incompleto {
    background-color: #FFC107; /* Amarillo */
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
    font-size: 1.1em; /* Aumentado para mejor visibilidad */
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
</style>