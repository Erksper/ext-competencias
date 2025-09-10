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
    <h3 style="background: #333; color: white; padding: 15px; margin: 0;">
        ANÁLISIS DE COMPETENCIAS DEL EQUIPO
    </h3>
</div>

{{#each preguntas}}
<div class="category-section" style="margin-bottom: 30px;">
    <h4 style="background: #666; color: white; padding: 10px; margin: 0;">{{@key}}</h4>
    
    <div class="table-responsive">
        <table class="table table-bordered" style="border: 2px solid #000;">
            <thead>
                <tr style="background: #f5f5f5;">
                    <th style="border: 1px solid #000; width: 60%;">Competencia</th>
                    <th style="border: 1px solid #000; width: 13%; background: #4CAF50; color: white;">Verde</th>
                    <th style="border: 1px solid #000; width: 13%; background: #FFC107; color: white;">Amarillo</th>
                    <th style="border: 1px solid #000; width: 13%; background: #F44336; color: white;">Rojo</th>
                </tr>
            </thead>
            <tbody>
                {{#each this}}
                <tr>
                    <td style="border: 1px solid #000; padding: 15px; font-weight: 500;">
                        {{orden}}. {{texto}}
                    </td>
                    <td style="border: 1px solid #000; text-align: center; padding: 10px;">
                        <button class="color-btn verde" 
                                data-action="selectColor" 
                                data-pregunta-id="{{id}}" 
                                data-color="verde"
                                style="width: 30px; height: 30px; border-radius: 50%; background: #4CAF50; border: 2px solid #000; cursor: pointer;">
                        </button>
                    </td>
                    <td style="border: 1px solid #000; text-align: center; padding: 10px;">
                        <button class="color-btn amarillo" 
                                data-action="selectColor" 
                                data-pregunta-id="{{id}}" 
                                data-color="amarillo"
                                style="width: 30px; height: 30px; border-radius: 50%; background: #FFC107; border: 2px solid #000; cursor: pointer;">
                        </button>
                    </td>
                    <td style="border: 1px solid #000; text-align: center; padding: 10px;">
                        <button class="color-btn rojo" 
                                data-action="selectColor" 
                                data-pregunta-id="{{id}}" 
                                data-color="rojo"
                                style="width: 30px; height: 30px; border-radius: 50%; background: #F44336; border: 2px solid #000; cursor: pointer;">
                        </button>
                    </td>
                </tr>
                {{/each}}
            </tbody>
        </table>
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
.color-btn.selected {
    transform: scale(1.2);
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
}

.color-btn:hover {
    opacity: 0.8;
}
</style>