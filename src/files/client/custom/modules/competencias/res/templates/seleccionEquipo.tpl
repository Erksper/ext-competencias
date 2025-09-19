<div class="page-header">
    <h3>Seleccionar oficina</h3>
</div>

<div class="row">
    <div class="col-md-6 col-md-offset-3">
        <div class="panel panel-default">
            <div class="panel-body">
                {{#if equipos.length}}
                <div class="form-group" style="margin-bottom: 20px;">
                    <input type="text" class="form-control" data-action="filterTeams" placeholder="Buscar oficina...">
                </div>
                {{/if}}
                {{#each equipos}}
                <div class="team-item" style="margin-bottom: 10px;">
                    <button class="btn btn-default btn-block text-left" data-action="selectTeam" data-team-id="{{id}}" data-team-name="{{name}}">
                        <i class="fas fa-building"></i> {{name}}
                    </button>
                </div>
                {{/each}}
                
                <hr>
                <button class="btn btn-link" data-action="back">
                    <i class="fas fa-arrow-left"></i> Volver al menú
                </button>
            </div>
        </div>
    </div>
</div>