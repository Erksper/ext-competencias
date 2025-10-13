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
    <div class="page-header">
        <h3>
            {{#if isGerente}}
                {{teamName}} - Gerentes  
            {{else}}
                {{teamName}} - Asesores  
            {{/if}}
        </h3>
    </div>

    <div class="row">
        <div class="col-md-6 col-md-offset-3">
            <div class="panel panel-default">
                <div class="panel-body">
                    {{#if usuarios.length}}
                        <div class="form-group" style="margin-bottom: 20px;">
                            <input type="text" class="form-control" data-action="filterUsers" placeholder="Buscar usuario...">
                        </div>

                        <div class="legend-container">
                            <div class="legend-item">
                                <span class="legend-color-box" style="background-color: #f8d7da;"></span>
                                <span>El usuario no ha sido evaluado</span>
                            </div>
                            <div class="legend-item">
                                <span class="legend-color-box" style="background-color: #fff3cd;"></span>
                                <span>El usuario tiene una evaluacion incompleta</span>
                            </div>
                            <div class="legend-item">
                                <span class="legend-color-box" style="background-color: #d4edda;"></span>
                                <span>El usuario tiene una evaluacion en revisión</span>
                            </div>
                        </div>

                        <div class="users-list-container">
                            {{#each usuarios}}
                            <div class="user-item" style="margin-bottom: 10px;">
                                <button class="btn btn-default btn-block text-left" data-action="selectUser" data-user-id="{{id}}" data-user-name="{{name}}" style="background-color: {{color}}; border-color: #ccc;">
                                    <i class="fas fa-user"></i> {{name}}
                                </button>
                            </div>
                            {{/each}}
                        </div>
                    {{else}}
                        <div class="text-center" style="padding: 20px;">
                            <p class="text-muted">No hay usuarios disponibles para evaluar en esta oficina y rol.</p>
                            <small>Todos los usuarios elegibles ya han completado su evaluación, o no hay usuarios asignados con el rol requerido.</small>
                        </div>
                    {{/if}}
                    
                    <hr>
                    <button class="btn btn-link" data-action="back">
                        <i class="fas fa-arrow-left"></i> Volver
                    </button>
                </div>
            </div>
        </div>
    </div>
{{/if}}

<style>
.legend-container {
    text-align: left;
    padding: 10px 15px;
    background-color: #f9f9f9;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 20px;
    font-size: 0.9em;
}
.legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 5px;
}
.legend-item:last-child {
    margin-bottom: 0;
}
.legend-color-box {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 1px solid #888;
    border-radius: 3px;
    margin-right: 10px;
    flex-shrink: 0;
}
.users-list-container {
    max-height: 500px;
    overflow-y: auto;
    padding-right: 5px;
}
.users-list-container::-webkit-scrollbar {
    width: 8px;
}
.users-list-container::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
}
.users-list-container::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
}
.users-list-container::-webkit-scrollbar-thumb:hover {
    background: #555;
}
</style>