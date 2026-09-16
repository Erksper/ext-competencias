<?php

namespace Espo\Modules\Competencias\Traits;

/**
 * Escribe entradas en la entidad 'SyncLog' (definida por el módulo
 * ext-sincronizacion). Se referencia solo por nombre de entidad, no por
 * namespace de esa extensión, así que esto no crea una dependencia dura
 * a nivel de código: si 'SyncLog' no existe (esa extensión no está
 * instalada), el log simplemente no se guarda ahí pero cae a
 * error_log y el job sigue funcionando con normalidad.
 *
 * Igual que el Loggable de ext-encuesta-de-liderazgo.
 *
 * entityType restringido por esa entidad a: User, Team, Role.
 * action restringido a: created, updated, disabled, info, error.
 */
trait Loggable
{
    protected function log(
        string $action,
        string $entityType,
        ?string $entityId,
        string $entityName,
        string $status,
        string $message
    ): void {
        try {
            $log = $this->entityManager->getNewEntity('SyncLog');
            $log->set([
                'name' => "{$entityType}: {$entityName}",
                'syncDate' => date('Y-m-d H:i:s'),
                'entityType' => $entityType,
                'entityId' => $entityId,
                'entityName' => $entityName,
                'action' => $action,
                'status' => $status,
                'message' => $message,
            ]);

            $this->entityManager->saveEntity($log);
        } catch (\Exception $e) {
            error_log("[Competencias Loggable] SyncLog no disponible, guardando en error_log: " . $e->getMessage());
            error_log("[Competencias Loggable] {$entityType} {$entityName} | {$action} | {$status} | {$message}");
        }
    }
}
