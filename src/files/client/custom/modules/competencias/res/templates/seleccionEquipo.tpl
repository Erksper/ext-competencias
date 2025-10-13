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
        <h3>Seleccionar oficina</h3>
    </div>

    <div class="row">
        <div class="col-md-6 col-md-offset-3">
            {{#if accesoDenegado}}
                <div class="alert alert-danger text-center" style="margin-top: 20px;">
                    <h4><i class="fas fa-ban"></i> Acceso Denegado</h4>
                    <p>Disculpe, no tiene los permisos para realizar esta acción. Por favor, contacte con personal de la Casa Nacional.</p>
                </div>
                <hr>
                <button class="btn btn-link" data-action="back">
                    <i class="fas fa-arrow-left"></i> Volver al menú
                </button>
            {{else if sinOficinaAsignada}}
                <div class="alert alert-warning text-center" style="margin-top: 20px;">
                    <h4><i class="fas fa-exclamation-triangle"></i> Sin Oficina Asignada</h4>
                    <p>No posee una oficina asignada en el sistema. Por favor, contacte con personal de la Casa Nacional para que se le asigne a un equipo.</p>
                </div>
                <hr>
                <button class="btn btn-link" data-action="back">
                    <i class="fas fa-arrow-left"></i> Volver al menú
                </button>
            {{else}}
                <div class="panel panel-default">
                    <div class="panel-body">
                        {{#if equipos.length}}
                            <div class="form-group" style="margin-bottom: 20px;">
                                <input type="text" class="form-control" data-action="filterTeams" placeholder="Buscar oficina...">
                            </div>
                            {{#if esCasaNacional}}
                                <div class="legend-container">
                                    <div class="legend-item">
                                        <span class="legend-color-box" style="background-color: #d4edda;"></span>
                                        <span>Con Evaluaciones por Revisión</span>
                                    </div>
                                </div>
                            {{/if}}
                        {{/if}}

                        <div class="teams-list-container">
                            {{#each equipos}}
                            <div class="team-item" style="margin-bottom: 10px;">
                                <button class="btn btn-default btn-block text-left" data-action="selectTeam" data-team-id="{{id}}" data-team-name="{{name}}" style="background-color: {{color}}; border-color: #ccc;">
                                    <i class="fas fa-building"></i> {{name}}
                                </button>
                            </div>
                            {{else}}
                                <p class="text-center text-muted">No hay oficinas disponibles para seleccionar.</p>
                            {{/each}}
                        </div>
                        
                        <hr>
                        <button class="btn btn-link" data-action="back">
                            <i class="fas fa-arrow-left"></i> Volver al menú
                        </button>
                    </div>
                </div>
            {{/if}}
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
.teams-list-container {
    max-height: 500px;
    overflow-y: auto;
    padding-right: 5px;
}
.teams-list-container::-webkit-scrollbar {
    width: 8px;
}
.teams-list-container::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
}
.teams-list-container::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
}
.teams-list-container::-webkit-scrollbar-thumb:hover {
    background: #555;
}
</style>