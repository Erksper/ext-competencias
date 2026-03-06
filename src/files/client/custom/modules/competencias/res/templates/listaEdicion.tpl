<link rel="stylesheet" type="text/css" href="client/custom/modules/competencias/res/css/estilos.css">

<div class="container-fluid lista-edicion-container">
    <!-- Header principal -->
    <div class="row mb-4">
        <div class="col-md-12">
            <div class="page-header-card">
                <div class="d-flex justify-content-between align-items-start flex-wrap">
                    <div class="header-left" style="flex: 1;">
                        <div class="header-icon">
                            <i class="fas fa-edit"></i>
                        </div>
                        <div class="header-content">
                            <h1 class="page-title">Lista de Encuestas</h1>
                            <p class="page-subtitle" id="periodo-subtitulo">
                                Edición de encuestas del período seleccionado
                            </p>
                        </div>
                    </div>
                    <div class="header-actions">
                        <button class="btn-primary" data-action="volver">
                            <i class="fas fa-arrow-left"></i>
                            <span>Volver</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Filtros -->
    <div class="row mb-4">
        <div class="col-md-12">
            <div class="filtro-card">
                <div class="filtro-header">
                    <div class="filtro-title-wrapper">
                        <i class="fas fa-filter filtro-title-icon"></i>
                        <h3 class="filtro-title">Filtrar Encuestas</h3>
                    </div>
                </div>
                <div class="filtro-body">
                    <div class="filtros-grid">
                        <div class="filter-group">
                            <label for="filtro-cla">CLA</label>
                            <select id="filtro-cla" class="form-control">
                                <option value="">Todos los CLAs</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label for="filtro-oficina">Oficina</label>
                            <select id="filtro-oficina" class="form-control" disabled>
                                <option value="">Seleccione un CLA primero</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label for="filtro-usuario">Usuario</label>
                            <select id="filtro-usuario" class="form-control" disabled>
                                <option value="">Seleccione una oficina primero</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label for="filtro-tipo">Tipo</label>
                            <select id="filtro-tipo" class="form-control">
                                <option value="">Todos</option>
                                <option value="asesor">Asesor</option>
                                <option value="gerente-director-coordinador">Gerente / Director / Coordinador</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label for="filtro-estado">Estado</label>
                            <select id="filtro-estado" class="form-control">
                                <option value="">Todos</option>
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
                <i class="fas fa-list-alt me-2"></i>
                <strong id="total-encuestas-mostradas">0</strong> encuestas encontradas
            </div>
        </div>
    </div>

    <!-- Leyenda de estados -->
    <div class="row mb-3">
        <div class="col-md-12">
            <div class="leyenda-estados">
                <span class="leyenda-titulo">
                    <i class="fas fa-question-circle me-2"></i>
                    <strong>Leyenda de Estados:</strong>
                </span>
                <div class="leyenda-items">
                    <span class="leyenda-badge" style="background: #e74c3c;" title="No todas las preguntas han sido respondidas">Incompleta</span>
                    <span class="leyenda-badge" style="background: #f39c12;" title="Todas las preguntas respondidas, pendiente aprobación">En revisión</span>
                    <span class="leyenda-badge" style="background: #27ae60;" title="Encuesta aprobada o guardada desde esta lista">Completada</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Contenido dinámico -->
    <div id="lista-edicion-container">
        <div class="text-center" style="padding: 80px 20px;">
            <div class="spinner-large"></div>
            <h4 class="loading-title">Cargando encuestas...</h4>
            <p class="loading-subtitle">Obteniendo datos del servidor</p>
        </div>
    </div>
</div>