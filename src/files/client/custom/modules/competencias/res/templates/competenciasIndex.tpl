<!-- Versión más integrada con EspoCRM -->
<div class="page-header">
    <div class="row">
        <div class="col-sm-7">
            <h3>
                <span style="color: #D4AF37; font-weight: bold;">CENTURY 21</span>
                <small>Sistema de Competencias</small>
            </h3>
        </div>
    </div>
</div>

<div class="record-container">
    <div class="row">
        <div class="col-md-8 col-md-offset-2">
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
</style>