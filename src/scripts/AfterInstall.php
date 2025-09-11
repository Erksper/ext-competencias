<?php

class AfterInstall
{
    protected $container;

    public function run($container)
    {
        $this->container = $container;
        $this->clearCache();
        $this->rebuildDatabase();
    }

    protected function clearCache()
    {
        try {
            $this->container->get('dataManager')->clearCache();
            $this->container->get('dataManager')->rebuild();
        } catch (\Exception $e) {
            error_log("Error clearing cache: " . $e->getMessage());
        }
    }

    protected function rebuildDatabase()
    {
        try {
            $this->container->get('dataManager')->rebuildDatabase();
        } catch (\Exception $e) {
            error_log("Error rebuilding database: " . $e->getMessage());
        }
    }
}