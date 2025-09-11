define(['views/list'], function (ListView) {
    return ListView.extend({
        setup: function () {
            setTimeout(function() {
                window.location.hash = '#CompetenciasApp';
            }, 100);
        }
    });
});