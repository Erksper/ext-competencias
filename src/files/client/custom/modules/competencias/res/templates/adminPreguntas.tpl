<div class="page-header">
    <div class="row">
        <div class="col-sm-7">
            <h3>
                <span style="color: #D4AF37; font-weight: bold;">CENTURY 21</span>
                <small>Administración de Preguntas</small>
            </h3>
        </div>
    </div>
</div>

<div class="record-container">
    <div class="row">
        <div class="col-md-8 col-md-offset-2">

            <div class="panel panel-info">
                <div class="panel-heading">
                    <h4 class="panel-title">📊 Estadísticas del Sistema</h4>
                </div>
                <div class="panel-body">
                    <div class="row text-center">
                        <div class="col-md-4">
                            <h3 style="color: #5cb85c; margin: 0;">{{estadisticas.preguntas}}</h3>
                            <p>Preguntas</p>
                        </div>
                        <div class="col-md-4">
                            <h3 style="color: #f0ad4e; margin: 0;">{{estadisticas.encuestas}}</h3>
                            <p>Encuestas</p>
                        </div>
                        <div class="col-md-4">
                            <h3 style="color: #5bc0de; margin: 0;">{{estadisticas.respuestas}}</h3>
                            <p>Respuestas</p>
                        </div>
                    </div>
                    <div class="text-center" style="margin-top: 15px;">
                        <button class="btn btn-default btn-sm" data-action="contarPreguntas">
                            <i class="fas fa-sync-alt"></i> Actualizar
                        </button>
                    </div>
                </div>
            </div>

            <div class="panel panel-default">
                <div class="panel-heading">
                    <h4 class="panel-title">🛠️ Acciones de Administración</h4>
                </div>
                <div class="panel-body">

                    <div style="margin-bottom: 20px;">
                        <h5><i class="fas fa-plus-circle text-success"></i> Crear Preguntas</h5>
                        <p class="text-muted">
                            Crea todas las preguntas predefinidas del sistema para asesores y gerentes.
                        </p>
                        <button class="btn btn-success" data-action="crearPreguntas">
                            <i class="fas fa-magic"></i> Crear Preguntas por Defecto
                        </button>
                        <div style="margin-top: 10px;">
                            <small class="text-info">
                                <i class="fas fa-info-circle"></i> 
                                Se crearán aproximadamente 10 preguntas organizadas por categorías.
                            </small>
                        </div>
                    </div>

                    <hr>

                    <div style="margin-bottom: 20px;">
                        <h5><i class="fas fa-trash-alt text-danger"></i> Limpiar Datos</h5>
                        <p class="text-muted">
                            <strong>⚠️ CUIDADO:</strong> Elimina todas las preguntas, encuestas y respuestas del sistema.
                        </p>
                        <button class="btn btn-danger" data-action="limpiarPreguntas">
                            <i class="fas fa-exclamation-triangle"></i> Limpiar Todo el Sistema
                        </button>
                        <div style="margin-top: 10px;">
                            <small class="text-danger">
                                <i class="fas fa-exclamation-triangle"></i> 
                                Esta acción NO se puede deshacer. Úsala solo en desarrollo.
                            </small>
                        </div>
                    </div>

                </div>
            </div>

            <div class="panel panel-default">
                <div class="panel-heading">
                    <h4 class="panel-title">📋 Información</h4>
                </div>
                <div class="panel-body">
                    <h5>Estructura de las Preguntas</h5>
                    <ul>
                        <li><strong>Asesores:</strong> Personalidad (4) + Competencias Técnicas (4) + Planificación (2)</li>
                        <li><strong>Gerentes:</strong> Personalidad (4) + Competencias Técnicas (4) + Planificación (2)</li>
                        <li><strong>Total:</strong> ~10 preguntas por rol</li>
                    </ul>
                    
                    <h5 style="margin-top: 20px;">Categorías</h5>
                    <ul>
                        <li><strong>Personalidad:</strong> Competencias blandas y habilidades interpersonales</li>
                        <li><strong>Competencias Técnicas:</strong> Conocimientos específicos del sector</li>
                        <li><strong>Planificación:</strong> Organización y establecimiento de objetivos</li>
                    </ul>
                </div>
            </div>

        </div>
    </div>
</div>

<style>
.panel-body .btn[data-action="crearPreguntas"] {
    background-color: #5cb85c;
    border-color: #4cae4c;
}

.panel-body .btn[data-action="crearPreguntas"]:hover {
    background-color: #449d44;
    border-color: #398439;
}

.panel-body .btn[data-action="limpiarPreguntas"] {
    background-color: #d9534f;
    border-color: #d43f3a;
}

.panel-body .btn[data-action="limpiarPreguntas"]:hover {
    background-color: #c9302c;
    border-color: #ac2925;
}
</style>