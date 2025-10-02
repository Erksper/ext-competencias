<div class="page-header">
    <h3>Oficina: {{teamName}}</h3>
    <h4>Seleccionar tipo de evaluación</h4>
</div>

<div class="row">
    <div class="col-md-6 col-md-offset-3">
        <div class="panel panel-default">
            <div class="panel-body">
                <div style="margin-bottom: 20px;">
                    <button class="btn btn-primary btn-lg btn-block" data-action="selectRole" data-role="gerente">
                        <i class="fas fa-user-tie"></i> Evaluación de Gerentes y Directores
                    </button>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <button class="btn btn-primary btn-lg btn-block" data-action="selectRole" data-role="asesor">
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

.panel-body .btn.btn-primary:hover,
.panel-body .btn.btn-primary:focus,
.panel-body .btn.btn-primary:active {
    background-color: #a89b78;
    border-color: #948766;
    color: #fff;
}
</style>