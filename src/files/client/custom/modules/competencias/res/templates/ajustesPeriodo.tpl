<link rel="stylesheet" type="text/css" href="client/custom/modules/competencias/res/css/estilos.css">

{{#if accesoDenegado}}
<div class="ci-acceso-denegado">
    <div class="ci-acceso-icon"><i class="fas fa-ban"></i></div>
    <h4>Acceso Denegado</h4>
    <p>Disculpe, no tiene los permisos para ver esta página. Solo Casa Nacional o administradores pueden acceder.</p>
</div>
{{else}}

<div class="container-fluid lista-edicion-container">
    <div class="row mb-4">
        <div class="col-md-12">
            <div class="page-header-card">
                <div class="d-flex justify-content-between align-items-start flex-wrap">
                    <div class="header-left" style="flex: 1;">
                        <div class="header-icon">
                            <i class="fas fa-sliders-h"></i>
                        </div>
                        <div class="header-content">
                            <h1 class="page-title">Ajustes de Período</h1>
                            <p class="page-subtitle">Gestión del período de evaluación activo y evaluaciones para períodos anteriores</p>
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

    <!-- Sección: Ajustar fecha de cierre del período activo -->
    <div class="row mb-4">
        <div class="col-md-12">
            <div class="filtro-card">
                <div class="filtro-header">
                    <div class="filtro-title-wrapper">
                        <i class="fas fa-calendar-alt filtro-title-icon"></i>
                        <h3 class="filtro-title">Ajustar Período Activo</h3>
                    </div>
                </div>
                <div class="filtro-body">
                    {{#if hayPeriodoActivo}}
                        <p>
                            Período activo actual: <strong>{{periodoActivo.label}}</strong>.
                            La fecha de inicio no puede modificarse; solo se puede acortar o extender la fecha de cierre,
                            siempre a partir de mañana y dentro del mismo año de inicio del período.
                        </p>
                        <div class="filtros-grid">
                            <div class="filter-group">
                                <label for="fecha-cierre-ajuste-input">Nueva fecha de cierre</label>
                                <input type="date" id="fecha-cierre-ajuste-input" class="form-control">
                            </div>
                        </div>
                        <div class="filtro-actions">
                            <button class="btn-primary" data-action="guardarFechaCierre" disabled>
                                <i class="fas fa-save"></i> Guardar nueva fecha de cierre
                            </button>
                        </div>
                    {{else}}
                        <div class="ci-alert-card ci-alert-info">
                            <div class="ci-alert-body ci-alert-center">
                                <h4><i class="fas fa-info-circle"></i> Sin período activo</h4>
                                <p>No hay ningún período de evaluación activo en este momento. Esta opción se habilita únicamente cuando existe uno.</p>
                            </div>
                        </div>
                    {{/if}}
                </div>
            </div>
        </div>
    </div>

    <!-- Sección: Crear evaluación para un período anterior -->
    <div class="row mb-4">
        <div class="col-md-12">
            <div class="filtro-card">
                <div class="filtro-header">
                    <div class="filtro-title-wrapper">
                        <i class="fas fa-history filtro-title-icon"></i>
                        <h3 class="filtro-title">Crear Evaluación para un Período Anterior</h3>
                    </div>
                </div>
                <div class="filtro-body">
                    <p>Seleccione el período, CLA, oficina y usuario para crear (o continuar) una evaluación individual dentro de ese período.</p>
                    <div class="filtros-grid">
                        <div class="filter-group">
                            <label for="periodo-anterior-select">Período</label>
                            <select id="periodo-anterior-select" class="form-control">
                                <option value="">— Seleccione un período —</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label for="cla-anterior-select">CLA</label>
                            <select id="cla-anterior-select" class="form-control">
                                <option value="">— Cargando CLAs... —</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label for="oficina-anterior-select">Oficina</label>
                            <select id="oficina-anterior-select" class="form-control" disabled>
                                <option value="">— Seleccione un CLA primero —</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label for="usuario-anterior-select">Usuario</label>
                            <select id="usuario-anterior-select" class="form-control" disabled>
                                <option value="">— Seleccione una oficina primero —</option>
                            </select>
                        </div>
                    </div>
                    <div class="filtro-actions">
                        <button class="btn-primary" data-action="crearEvaluacionAnterior" disabled>
                            <i class="fas fa-clipboard-list"></i> Crear / Continuar Evaluación
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

</div>
{{/if}}
