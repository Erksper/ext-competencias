define(['controller'], function (Controller) {
    console.log('Controlador Competencias cargado!');
    
    return Controller.extend({
        
        checkAccess: function () {
            return true;
        },
        
        index: function () {
            console.log('Acción index ejecutada!');

            this.entire('CompetenciasIndex', {}, function (view) {
                view.render();
            });
        }
    });
});