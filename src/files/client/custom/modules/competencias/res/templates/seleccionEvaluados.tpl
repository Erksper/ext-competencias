<!-- client/custom/modules/competencias/res/templates/seleccionEvaluados.tpl -->
<link rel="stylesheet" type="text/css" href="client/custom/modules/competencias/res/css/estilos.css">

<div class="container-fluid seleccion-evaluados-container">
    <!-- Header principal -->
    <div class="row mb-4">
        <div class="col-md-12">
            <div class="page-header-card">
                <div class="d-flex justify-content-between align-items-start flex-wrap">
                    <div class="header-left" style="flex: 1;">
                        <div class="header-icon">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="header-content">
                            <h1 class="page-title">Seleccionar Usuario a Evaluar</h1>
                            <p class="page-subtitle" id="periodo-subtitulo">
                                {{#if periodoActivo}}
                                    Período activo: <strong>{{fechaInicio}} al {{fechaCierre}}</strong>
                                {{else}}
                                    <span class="text-warning">No hay período de evaluación activo</span>
                                {{/if}}
                            </p>
                        </div>
                    </div>
                    <div class="header-actions">
                        <button class="btn-primary" data-action="volver">
                            <i class="fas fa-arrow-left"></i>
                            <span>Volver al Inicio</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    {{#if periodoActivo}}
    <!-- Filtros -->
    <div class="row mb-4">
        <div class="col-md-12">
            <div class="filtro-card">
                <div class="filtro-header">
                    <div class="filtro-title-wrapper">
                        <i class="fas fa-filter filtro-title-icon"></i>
                        <h3 class="filtro-title">Filtrar Usuarios</h3>
                    </div>
                </div>
                <div class="filtro-body">
                    <div class="filtros-grid">
                        {{#if esCasaNacional}}
                        <!-- CLA - Solo visible para Casa Nacional -->
                        <div class="filter-group filtro-cla-row">
                            <label for="filtro-cla">CLA</label>
                            <select id="filtro-cla" class="form-control">
                                <option value="">Todos los CLAs</option>
                            </select>
                        </div>
                        
                        <!-- Oficina - Solo visible para Casa Nacional (se habilita al seleccionar CLA) -->
                        <div class="filter-group filtro-oficina-row">
                            <label for="filtro-oficina">Oficina</label>
                            <select id="filtro-oficina" class="form-control" disabled>
                                <option value="">Seleccione un CLA primero</option>
                            </select>
                        </div>
                        {{else}}
                        <!-- Para Gerentes/Directores/Coordinadores, la oficina está fija pero no visible -->
                        <input type="hidden" id="filtro-oficina" value="{{oficinaUsuario}}">
                        {{/if}}
                        
                        <!-- Tipo - Visible para todos (Casa Nacional y Gerentes) -->
                        <div class="filter-group filtro-tipo-row">
                            <label for="filtro-tipo">Tipo</label>
                            <select id="filtro-tipo" class="form-control">
                                <option value="">Todos</option>
                                <option value="asesor">Asesor</option>
                                <option value="gerente">Gerente / Director / Coordinador</option>
                            </select>
                        </div>
                        
                        <!-- Estado - Visible para todos -->
                        <div class="filter-group filtro-estado-row">
                            <label for="filtro-estado">Estado</label>
                            <select id="filtro-estado" class="form-control">
                                <option value="">Todos</option>
                                <option value="sin_evaluacion">Sin evaluación</option>
                                <option value="incompleta">Incompleta</option>
                                <option value="revision">En revisión</option>
                                <option value="completada">Completada</option>
                            </select>
                        </div>
                    </div>
                    <div class="filtro-actions">
                        <button class="btn-primary btn-action" data-action="aplicar-filtros">
                            <i class="fas fa-search"></i>
                            <span>Buscar</span>
                        </button>
                        <button class="btn-primary btn-action" data-action="limpiar-filtros">
                            <i class="fas fa-times"></i>
                            <span>Limpiar</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Contador -->
    <div class="row mb-3">
        <div class="col-md-12">
            <div class="contador-encuestas">
                <i class="fas fa-user-check me-2"></i>
                <strong id="total-usuarios-mostradas">0</strong> usuarios encontrados
            </div>
        </div>
    </div>

    <!-- Leyenda de estados -->
    <div class="row mb-3">
        <div class="col-md-12">
            <div class="leyenda-estados">
                <span class="leyenda-titulo">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Leyenda de Estados:</strong>
                </span>
                <div class="leyenda-items">
                    <span class="leyenda-badge" style="background: #6c757d;">Sin evaluación</span>
                    <span class="leyenda-badge" style="background: #e74c3c;">Incompleta</span>
                    <span class="leyenda-badge" style="background: #f39c12;">En revisión</span>
                    <span class="leyenda-badge" style="background: #27ae60;">Completada</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Contenido dinámico -->
    <div id="lista-usuarios-container">
        <div class="text-center" style="padding: 80px 20px;">
            <div class="spinner-large"></div>
            <h4 class="loading-title">Cargando usuarios...</h4>
            <p class="loading-subtitle">Obteniendo datos del servidor</p>
        </div>
    </div>

    {{else}}
    <!-- Mensaje de período inactivo -->
    <div class="row">
        <div class="col-md-12">
            <div class="no-data-card">
                <div class="no-data-icon">
                    <i class="fas fa-calendar-times"></i>
                </div>
                <h3 class="no-data-title">Período Inactivo</h3>
                <p class="no-data-text">
                    No hay un período de evaluación activo. 
                    Por favor, contacte a Casa Nacional para activar un período.
                </p>
                <button class="btn-primary" data-action="volver" style="margin-top: 20px;">
                    <i class="fas fa-arrow-left"></i> Volver al Inicio
                </button>
            </div>
        </div>
    </div>
    {{/if}}
</div>