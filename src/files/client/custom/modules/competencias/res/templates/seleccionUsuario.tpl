<div class="page-header">
    <h3>
        {{#if isGerente}}
            Gerentes - {{teamName}}
        {{else}}
            Asesores - {{teamName}}
        {{/if}}
    </h3>
</div>

<div class="row">
    <div class="col-md-6 col-md-offset-3">
        <div class="panel panel-default">
            <div class="panel-body">
                {{#if usuarios.length}}
                    {{#each usuarios}}
                    <div class="user-item" style="margin-bottom: 10px;">
                        <button class="btn btn-default btn-block text-left" data-action="selectUser" data-user-id="{{id}}" data-user-name="{{name}}">
                            <i class="fas fa-user"></i> {{name}}
                        </button>
                    </div>
                    {{/each}}
                {{else}}
                    <div class="text-center" style="padding: 20px;">
                        <p class="text-muted">No hay usuarios disponibles para este rol.</p>
                        <small>Verifica que existan usuarios asignados al equipo con el rol correspondiente.</small>
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