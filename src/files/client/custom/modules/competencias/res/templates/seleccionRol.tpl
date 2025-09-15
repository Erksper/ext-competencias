<div class="page-header">
    <h3>Equipo: {{teamName}}</h3>
    <h4>Seleccionar tipo de evaluación</h4>
</div>

<div class="row">
    <div class="col-md-6 col-md-offset-3">
        <div class="panel panel-default">
            <div class="panel-body">
                <div style="margin-bottom: 20px;">
                    <button class="btn btn-lg btn-block" data-action="selectRole" data-role="gerente">
                        <i class="fas fa-user-tie"></i> Evaluación de Gerentes y Directores
                    </button>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <button class="btn btn-info btn-lg btn-block" data-action="selectRole" data-role="asesor">
                        <i class="fas fa-user"></i> Evaluación de Asesores
                    </button>
                </div>
                
                <hr>
                <button class="btn btn-link" data-action="back">
                    <i class="fas fa-arrow-left"></i> Volver
                </button>
            </div>
        </div>
    </div>
</div>

<style>
.panel-body .btn[data-action="selectRole"] {
    background-color: #666;
    border-color: #555;
    color: #fff;
}

.panel-body .btn[data-action="selectRole"]:hover,
.panel-body .btn[data-action="selectRole"]:focus {
    background-color: #555;
    border-color: #444;
    color: #fff;
}
</style>