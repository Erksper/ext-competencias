<div class="page-header">
    <h3>{{#if (eq role 'gerente')}}Gerentes{{else}}Asesores{{/if}} - {{teamName}}</h3>
</div>

<div class="row">
    <div class="col-md-6 col-md-offset-3">
        <div class="panel panel-default">
            <div class="panel-body">
                {{#each usuarios}}
                <div class="user-item" style="margin-bottom: 10px;">
                    <button class="btn btn-default btn-block text-left" data-action="selectUser" data-user-id="{{id}}" data-user-name="{{name}}">
                        <i class="fas fa-user"></i> {{name}}
                    </button>
                </div>
                {{/each}}
                
                <hr>
                <button class="btn btn-link" data-action="back">
                    <i class="fas fa-arrow-left"></i> Volver
                </button>
            </div>
        </div>
    </div>
</div>