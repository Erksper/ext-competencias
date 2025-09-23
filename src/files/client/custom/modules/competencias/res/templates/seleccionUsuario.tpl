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

                        <div style="margin-bottom: 15px; font-size: 0.9em; text-align: center;">
                            <span style="display: inline-block; width: 12px; height: 12px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 3px; vertical-align: middle; margin-right: 5px;"></span> No evaluado
                            <span style="display: inline-block; width: 12px; height: 12px; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 3px; vertical-align: middle; margin-left: 15px; margin-right: 5px;"></span> Incompleto
                            <span style="display: inline-block; width: 12px; height: 12px; background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 3px; vertical-align: middle; margin-left: 15px; margin-right: 5px;"></span> En Revisión
                        </div>

                        {{#each usuarios}}
                        <div class="user-item" style="margin-bottom: 10px;">
                            <button class="btn btn-default btn-block text-left" data-action="selectUser" data-user-id="{{id}}" data-user-name="{{name}}" style="background-color: {{color}}; border-color: #ccc;">
                                <i class="fas fa-user"></i> {{name}}
                            </button>
                        </div>
                        {{/each}}
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