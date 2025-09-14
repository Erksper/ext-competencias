<div class="century21-header text-center" style="margin-bottom: 30px;">
    <h1 style="color: #D4AF37; font-size: 2.5em; font-weight: bold;">CENTURY 21</h1>
    <h2 style="color: #666; font-size: 1.5em;">Venezuela</h2>
</div>

<div class="survey-info panel panel-default" style="margin-bottom: 20px;">
    <div class="panel-body">
        <div class="row">
            <div class="col-md-6">
                <strong>Oficina:</strong> {{teamName}}
            </div>
            <div class="col-md-6">
                <strong>Usuario evaluado:</strong> {{userName}}
            </div>
        </div>
    </div>
</div>

<div class="survey-title text-center" style="margin-bottom: 20px;">
    <h3 style="background: #333; color: white; padding: 15px; margin: 0; border-radius: 8px;">
        ANÁLISIS DE COMPETENCIAS DEL EQUIPO
    </h3>
</div>

{{#each preguntas}}
<div class="category-section" style="margin-bottom: 10px;">
    <h4 class="category-header" data-action="toggleCategory">
        {{@key}}
        <i class="fas fa-chevron-down category-chevron"></i>
    </h4>
    <div class="category-content" style="display: none;">
        <div class="table-responsive">
            <table class="table table-bordered" style="border: 2px solid #000; margin-top: -1px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #000; width: 70%;">Competencia</th>
                        <th style="border: 1px solid #000; width: 10%; text-align: center;">Verde</th>
                        <th style="border: 1px solid #000; width: 10%; text-align: center;">Amarillo</th>
                        <th style="border: 1px solid #000; width: 10%; text-align: center;">Rojo</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each this}}
                    <tr>
                        <td style="border: 1px solid #000; padding: 15px; font-weight: 500;">
                            {{orden}}. {{texto}}
                        </td>
                        <td style="border: 1px solid #000; text-align: center; padding: 10px;">
                            <div class="color-option color-verde"
                                 data-action="selectColor" 
                                 data-pregunta-id="{{id}}" 
                                 data-color="verde">
                            </div>
                        </td>
                        <td style="border: 1px solid #000; text-align: center; padding: 10px;">
                            <div class="color-option color-amarillo"
                                 data-action="selectColor" 
                                 data-pregunta-id="{{id}}" 
                                 data-color="amarillo">
                            </div>
                        </td>
                        <td style="border: 1px solid #000; text-align: center; padding: 10px;">
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

<div class="survey-actions" style="margin-top: 30px;">
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

<style>
/* Estilo para el botón de guardar */
.survey-actions .btn-success[data-action="saveSurvey"] {
    background-color: #666;
    border-color: #555;
}

.survey-actions .btn-success[data-action="saveSurvey"]:hover,
.survey-actions .btn-success[data-action="saveSurvey"]:focus {
    background-color: #555;
    border-color: #444;
}

.category-header {
    background: #666;
    color: white;
    padding: 10px;
    margin: 0;
    cursor: pointer;
    position: relative;
    border-radius: 4px;
    transition: background-color 0.2s ease-in-out;
}

.category-header:hover {
    background-color: #555;
}

.category-chevron {
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%) rotate(0deg);
    transition: transform 0.3s ease;
}

.category-header.active .category-chevron {
    transform: translateY(-50%) rotate(180deg);
}

.color-option {
    position: relative;
    width: 25px;      /* Tamaño reducido */
    height: 25px;     /* Tamaño reducido */
    margin: 0 auto;
    border-radius: 6px; /* Radio de borde ajustado */
    border: 2px solid #ddd; /* Borde ajustado */
    cursor: pointer;
    background-color: #5a5a5a; /* Color de fondo oscuro por defecto */
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.color-option:hover {
    transform: scale(1.1);
    border-color: #999 !important;
}

.table-responsive .color-option.selected {
    border-color: #000 !important;
    border-width: 3px !important; /* Borde de selección ajustado */
    transform: scale(1.15);
    box-shadow: 0 0 0 1px #fff, 0 0 0 3px #000; /* Sombra ajustada */
    animation: pulse 0.4s ease-in-out;
}

/* Cambiar el color de fondo al seleccionar */
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
    font-size: 14px;  /* Tamaño de fuente del checkmark ajustado */
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
}

/* Efecto de pulso al seleccionar */
@keyframes pulse {
    0% { transform: scale(1.15); }
    50% { transform: scale(1.25); }
    100% { transform: scale(1.15); }
}
</style>