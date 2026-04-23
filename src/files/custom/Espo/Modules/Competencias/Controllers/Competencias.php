<?php

namespace Espo\Modules\Competencias\Controllers;

use Espo\Core\Controllers\Record;

// PhpSpreadsheet - ya incluido en el vendor de EspoCRM
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Font;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Color;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

class Competencias extends Record
{
    protected function checkAccess(): bool
    {
        return $this->getUser()->isAdmin() || $this->getUser()->isRegular();
    }

    // =========================================================
    //  Helper para convertir col+row a coordenada (ej: 1,1 -> A1)
    // =========================================================
    private function _coordinate($col, $row) {
        return Coordinate::stringFromColumnIndex($col) . $row;
    }

    // =========================================================
    //  EXPORTAR EXCEL
    // =========================================================
    public function getActionExportarExcel($params, $data, $request)
    {
        try {
            $periodoId   = $request->get('periodoId');
            $rolObjetivo = $request->get('rolObjetivo');   // 'gerente' | 'asesor'
            $tipoReporte = $request->get('tipoReporte');   // 'general' | 'detallado'
            $oficinaId   = $request->get('oficinaId');     // solo para detallado
            $usuarioId   = $request->get('usuarioId');     // solo para asesor individual

            if (!$periodoId || !$rolObjetivo) {
                return ['success' => false, 'error' => 'Faltan parámetros requeridos'];
            }

            $entityManager = $this->getEntityManager();

            // ── Cargar período ────────────────────────────────
            $periodo = $entityManager->getEntity('Competencias', $periodoId);
            if (!$periodo) {
                return ['success' => false, 'error' => 'Período no encontrado'];
            }
            $fechaInicio    = $periodo->get('fechaInicio');
            $fechaCierre    = $periodo->get('fechaCierre');
            $fechaCierreMax = $fechaCierre . ' 23:59:59';

            // ── Cargar preguntas (con búsqueda flexible) ──────
            $preguntas = $this->_cargarPreguntas($rolObjetivo);
            if (empty($preguntas)) {
                return ['success' => false, 'error' => 'No hay preguntas configuradas para este rol'];
            }
            $preguntasAgrupadas = $this->_agruparPreguntas($preguntas);
            $preguntasPlanas    = $this->_aplanarPreguntas($preguntasAgrupadas);

            // ── Cargar datos según tipo de reporte ────────────
            if ($tipoReporte === 'general') {
                $datos = $this->_cargarDatosGeneral($rolObjetivo, $fechaInicio, $fechaCierreMax, $preguntasPlanas);
            } else {
                $datos = $this->_cargarDatosDetallado($rolObjetivo, $fechaInicio, $fechaCierreMax, $preguntasPlanas, $oficinaId, $usuarioId);
            }

            // ── Construir título ──────────────────────────────
            $tituloReporte = $tipoReporte === 'general'
                ? 'Reporte General - ' . ($rolObjetivo === 'gerente' ? 'Gerentes, Directores y Coordinadores' : 'Asesores')
                : 'Reporte de ' . ($rolObjetivo === 'gerente' ? 'Gerentes, Directores y Coordinadores' : 'Asesores');

            $textoEncabezado = $rolObjetivo === 'gerente'
                ? 'Gerentes / Directores / Coordinadores'
                : 'Asesores';

            // ── Generar Excel ─────────────────────────────────
            $spreadsheet = $this->_generarSpreadsheet(
                $preguntasAgrupadas,
                $preguntasPlanas,
                $datos,
                $tituloReporte,
                $textoEncabezado,
                $tipoReporte
            );

            // ── Enviar archivo al navegador ───────────────────
            $filename = $tituloReporte . ' - ' . $fechaInicio . ' al ' . $fechaCierre . '.xlsx';
            $filename = preg_replace('/[^a-zA-Z0-9\-\_\. ]/', '', $filename);

            $writer = new Xlsx($spreadsheet);

            ob_start();
            $writer->save('php://output');
            $content = ob_get_clean();

            header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Content-Length: ' . strlen($content));
            header('Cache-Control: max-age=0');

            echo $content;
            exit;

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // =========================================================
    //  GENERAR SPREADSHEET
    // =========================================================
    private function _generarSpreadsheet(
        array $preguntasAgrupadas,
        array $preguntasPlanas,
        array $datos,
        string $tituloReporte,
        string $textoEncabezado,
        string $tipoReporte
    ): Spreadsheet {

        $spreadsheet = new Spreadsheet();
        $sheet       = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Reporte');

        // ── Colores ───────────────────────────────────────────
        $COLOR_DORADO      = 'B8A279';
        $COLOR_DORADO_DARK = '9D8B5F';
        $COLOR_GRIS_HEAD   = '9E9B9C';
        $COLOR_BLANCO      = 'FFFFFF';
        $COLOR_VERDE       = '4CAF50';
        $COLOR_AMARILLO    = 'FFC107';
        $COLOR_ROJO        = 'F44336';
        $COLOR_GRIS_CELDA  = 'E0E0E0';
        $COLOR_GRIS_FILA   = 'F5F5F5';

        // ── Estructura de columnas ────────────────────────────
        // Col A  = nombre del evaluado/oficina
        // Col B+ = una por pregunta
        // Última = Sumatoria

        $totalPreguntas = count($preguntasPlanas);
        $colNombre      = 1;                       // A
        $colInicio      = 2;                       // B
        $colFin         = $colInicio + $totalPreguntas - 1;
        $colSumatoria   = $colFin + 1;

        // ── FILA 1: Título del reporte ────────────────────────
        $sheet->setCellValue($this->_coordinate($colNombre, 1), $tituloReporte);
        $sheet->mergeCells($this->_coordinate($colNombre, 1) . ':' . $this->_coordinate($colSumatoria, 1));
        $sheet->getStyle($this->_coordinate($colNombre, 1) . ':' . $this->_coordinate($colSumatoria, 1))->applyFromArray([
            'font'      => ['bold' => true, 'size' => 14, 'color' => ['argb' => 'FF' . $COLOR_DORADO_DARK]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(28);

        // ── FILAS DE HEADER (filas 3, 4, 5) ──────────────────
        // Fila 3 = Categorías (merge por cantidad de preguntas)
        // Fila 4 = Subcategorías (merge por cantidad de preguntas)
        // Fila 5 = Preguntas (texto vertical)

        $filaCategoria    = 3;
        $filaSubcategoria = 4;
        $filaPreguntas    = 5;

        // Celda de esquina (nombre) — merge de filas 3-5
        $sheet->setCellValue($this->_coordinate($colNombre, $filaCategoria), $textoEncabezado);
        $sheet->mergeCells($this->_coordinate($colNombre, $filaCategoria) . ':' . $this->_coordinate($colNombre, $filaPreguntas));
        $sheet->getStyle($this->_coordinate($colNombre, $filaCategoria) . ':' . $this->_coordinate($colNombre, $filaPreguntas))->applyFromArray([
            'font'      => ['bold' => true, 'color' => ['argb' => 'FF' . $COLOR_BLANCO]],
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF' . $COLOR_DORADO]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_BOTTOM, 'wrapText' => true],
            'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFFFFFFF']]],
        ]);

        // Celda de Sumatoria — merge de filas 3-5
        $sheet->setCellValue($this->_coordinate($colSumatoria, $filaCategoria), 'Sumatoria');
        $sheet->mergeCells($this->_coordinate($colSumatoria, $filaCategoria) . ':' . $this->_coordinate($colSumatoria, $filaPreguntas));
        $sheet->getStyle($this->_coordinate($colSumatoria, $filaCategoria) . ':' . $this->_coordinate($colSumatoria, $filaPreguntas))->applyFromArray([
            'font'      => ['bold' => true, 'color' => ['argb' => 'FF' . $COLOR_BLANCO]],
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF' . $COLOR_GRIS_HEAD]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
            'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFFFFFFF']]],
        ]);

        // Recorrer categorías y subcategorías para hacer merge y poner headers
        $colActual = $colInicio;
        foreach ($preguntasAgrupadas as $categoria => $subcategorias) {
            $colInicioCategoria = $colActual;

            foreach ($subcategorias as $subcategoria => $pregs) {
                $colInicioSubcat = $colActual;
                $countSubcat     = count($pregs);

                // ── Subcategoría (fila 4) ─────────────────────
                $sheet->setCellValue($this->_coordinate($colInicioSubcat, $filaSubcategoria), $subcategoria);
                if ($countSubcat > 1) {
                    $sheet->mergeCells($this->_coordinate($colInicioSubcat, $filaSubcategoria) . ':' . $this->_coordinate($colInicioSubcat + $countSubcat - 1, $filaSubcategoria));
                }
                $sheet->getStyle($this->_coordinate($colInicioSubcat, $filaSubcategoria) . ':' . $this->_coordinate($colInicioSubcat + $countSubcat - 1, $filaSubcategoria))->applyFromArray([
                    'font'      => ['bold' => true, 'color' => ['argb' => 'FF' . $COLOR_BLANCO], 'size' => 9],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF' . $COLOR_GRIS_HEAD]],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
                    'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFFFFFFF']]],
                ]);

                // ── Preguntas (fila 5) — texto vertical ───────
                foreach ($pregs as $pregunta) {
                    $sheet->setCellValue($this->_coordinate($colActual, $filaPreguntas), $pregunta['texto']);
                    $sheet->getStyle($this->_coordinate($colActual, $filaPreguntas))->applyFromArray([
                        'font'      => ['size' => 9, 'color' => ['argb' => 'FF333333']],
                        'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF5F5F5']],
                        'alignment' => [
                            'horizontal'  => Alignment::HORIZONTAL_CENTER,
                            'vertical'    => Alignment::VERTICAL_BOTTOM,
                            'textRotation' => 90,
                            'wrapText'    => false,
                        ],
                        'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE0E0E0']]],
                    ]);
                    $colActual++;
                }
            }

            $colFinCategoria = $colActual - 1;
            $countCategoria  = $colFinCategoria - $colInicioCategoria + 1;

            // ── Categoría (fila 3) ────────────────────────────
            $sheet->setCellValue($this->_coordinate($colInicioCategoria, $filaCategoria), $categoria);
            if ($countCategoria > 1) {
                $sheet->mergeCells($this->_coordinate($colInicioCategoria, $filaCategoria) . ':' . $this->_coordinate($colFinCategoria, $filaCategoria));
            }
            $sheet->getStyle($this->_coordinate($colInicioCategoria, $filaCategoria) . ':' . $this->_coordinate($colFinCategoria, $filaCategoria))->applyFromArray([
                'font'      => ['bold' => true, 'color' => ['argb' => 'FF' . $COLOR_BLANCO]],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF' . $COLOR_DORADO]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
                'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFFFFFFF']]],
            ]);
        }

        // ── Alturas de filas de header ────────────────────────
        $sheet->getRowDimension($filaCategoria)->setRowHeight(22);
        $sheet->getRowDimension($filaSubcategoria)->setRowHeight(22);
        $sheet->getRowDimension($filaPreguntas)->setRowHeight(160);

        // ── FILAS DE DATOS ────────────────────────────────────
        $filaActual = $filaPreguntas + 1;
        $filaInicio = $filaActual;

        foreach ($datos['filas'] as $idx => $fila) {
            $esPar    = ($idx % 2 === 0);
            $bgNombre = $esPar ? 'FFFFFFFF' : 'FFF9F9F9';

            // Columna nombre
            $sheet->setCellValue($this->_coordinate($colNombre, $filaActual), $fila['nombre']);
            $sheet->getStyle($this->_coordinate($colNombre, $filaActual))->applyFromArray([
                'font'      => ['bold' => true, 'size' => 10],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => $bgNombre]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
                'borders'   => [
                    'right'  => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['argb' => 'FF' . $COLOR_DORADO]],
                    'bottom' => ['borderStyle' => Border::BORDER_THIN,   'color' => ['argb' => 'FFE0E0E0']],
                ],
            ]);

            // Celdas de respuesta (solo color de fondo)
            foreach ($fila['respuestas'] as $colOffset => $color) {
                $col    = $colInicio + $colOffset;
                $bgArgb = $this->_colorToArgb($color);
                $sheet->setCellValue($this->_coordinate($col, $filaActual), '');
                $sheet->getStyle($this->_coordinate($col, $filaActual))->applyFromArray([
                    'fill'    => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => $bgArgb]],
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFFFFFFF']]],
                ]);
            }

            // Celda sumatoria
            $sumTexto = $fila['sumatoria'];
            $sumColor = $fila['sumatoriaColor'];
            $sheet->setCellValue($this->_coordinate($colSumatoria, $filaActual), $sumTexto);
            $sheet->getStyle($this->_coordinate($colSumatoria, $filaActual))->applyFromArray([
                'font'      => ['bold' => true, 'size' => 10, 'color' => ['argb' => $this->_colorTextArgb($sumColor)]],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => $this->_colorToArgb($sumColor)]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFFFFFFF']]],
            ]);

            $sheet->getRowDimension($filaActual)->setRowHeight(22);
            $filaActual++;
        }

        // ── FILA DE TOTALES ───────────────────────────────────
        $sheet->setCellValue($this->_coordinate($colNombre, $filaActual), 'Totales');
        $sheet->getStyle($this->_coordinate($colNombre, $filaActual))->applyFromArray([
            'font'      => ['bold' => true],
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF0F0F0']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders'   => ['top' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['argb' => 'FF' . $COLOR_DORADO]]],
        ]);

        foreach ($datos['totalesPorPregunta'] as $colOffset => $total) {
            $col    = $colInicio + $colOffset;
            $texto  = ($total['verdes'] ?? 0) . '/' . ($total['total'] ?? 0);
            $color  = $total['color'] ?? 'gris';
            $bgArgb = $this->_colorToArgb($color);
            $sheet->setCellValue($this->_coordinate($col, $filaActual), $texto);
            $sheet->getStyle($this->_coordinate($col, $filaActual))->applyFromArray([
                'font'      => ['bold' => true, 'size' => 9, 'color' => ['argb' => $this->_colorTextArgb($color)]],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => $bgArgb]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                'borders'   => [
                    'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFFFFFFF']],
                    'top'        => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['argb' => 'FF' . $COLOR_DORADO]],
                ],
            ]);
        }

        // Celda sumatoria de totales
        if (!empty($datos['totalGeneral'])) {
            $tg     = $datos['totalGeneral'];
            $texto  = ($tg['verdes'] ?? 0) . '/' . ($tg['total'] ?? 0) . ' (' . round($tg['porcentaje'] ?? 0) . '%)';
            $color  = $tg['color'] ?? 'gris';
            $sheet->setCellValue($this->_coordinate($colSumatoria, $filaActual), $texto);
            $sheet->getStyle($this->_coordinate($colSumatoria, $filaActual))->applyFromArray([
                'font'      => ['bold' => true, 'color' => ['argb' => $this->_colorTextArgb($color)]],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => $this->_colorToArgb($color)]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                'borders'   => ['top' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['argb' => 'FF' . $COLOR_DORADO]]],
            ]);
        }

        $sheet->getRowDimension($filaActual)->setRowHeight(22);

        // ── ANCHOS DE COLUMNA usando método compatible ─────────
        // Columna nombre: fija
        $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($colNombre))->setWidth(28);
        // Columnas de preguntas: fijas angostas (el texto es vertical)
        for ($c = $colInicio; $c <= $colFin; $c++) {
            $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($c))->setWidth(4);
        }
        // Columna sumatoria
        $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($colSumatoria))->setWidth(14);

        // ── FILA 2: separador vacío ───────────────────────────
        $sheet->getRowDimension(2)->setRowHeight(6);

        // ── Freeze panes (congelar header) usando método compatible ──
        $sheet->freezePane($this->_coordinate($colInicio, $filaPreguntas + 1));

        // ── Propiedades del documento ─────────────────────────
        $spreadsheet->getProperties()
            ->setTitle('Reporte Competencias')
            ->setCreator('EspoCRM - Módulo Competencias');

        return $spreadsheet;
    }

    // =========================================================
    //  HELPERS DE COLOR
    // =========================================================
    private function _colorToArgb(string $color): string
    {
        $mapa = [
            'verde'   => 'FF4CAF50',
            'amarillo'=> 'FFFFC107',
            'rojo'    => 'FFF44336',
            'gris'    => 'FFE0E0E0',
        ];
        return $mapa[$color] ?? 'FFE0E0E0';
    }

    private function _colorTextArgb(string $color): string
    {
        // amarillo y gris → texto oscuro; verde y rojo → texto blanco
        return in_array($color, ['amarillo', 'gris']) ? 'FF333333' : 'FFFFFFFF';
    }

    private function _calcularColor(int $verde, int $amarillo, int $rojo, int $total): string
    {
        if ($total === 0) return 'gris';
        $pV = ($verde   / $total) * 100;
        $pA = ($amarillo / $total) * 100;
        $pR = ($rojo    / $total) * 100;
        if ($pV >= 80) return 'verde';
        if ($pV >= 60) return 'amarillo';
        if ($pV >= 40) {
            if ($pR === 0)     return 'amarillo';
            if ($pA >= $pR)    return 'amarillo';
            return 'rojo';
        }
        return 'rojo';
    }

    // =========================================================
    //  CARGAR Y PROCESAR DATOS
    // =========================================================
    private function _cargarPreguntas(string $rolObjetivo): array
    {
        $pdo = $this->getEntityManager()->getPDO();
        $sql = "SELECT id, categoria, sub_categoria, orden, texto_pregunta as texto
                FROM pregunta
                WHERE esta_activa = 1
                  AND deleted = 0
                  AND rol_objetivo LIKE :patron
                ORDER BY categoria, sub_categoria, orden";
        $sth = $pdo->prepare($sql);
        // Buscar el rol como subcadena (sin exigir comillas dobles)
        $sth->bindValue(':patron', '%' . $rolObjetivo . '%');
        $sth->execute();
        return $sth->fetchAll(\PDO::FETCH_ASSOC);
    }

    private function _agruparPreguntas(array $preguntas): array
    {
        $agrupadas = [];
        foreach ($preguntas as $p) {
            $cat = $p['categoria']     ?? 'Sin Categoría';
            $sub = $p['sub_categoria'] ?? 'General';
            if (!isset($agrupadas[$cat]))       $agrupadas[$cat]       = [];
            if (!isset($agrupadas[$cat][$sub])) $agrupadas[$cat][$sub] = [];
            $agrupadas[$cat][$sub][] = ['id' => $p['id'], 'texto' => $p['texto'], 'orden' => $p['orden'] ?? 0];
        }
        return $agrupadas;
    }

    private function _aplanarPreguntas(array $agrupadas): array
    {
        $planas = [];
        foreach ($agrupadas as $cat => $subcats) {
            foreach ($subcats as $sub => $pregs) {
                foreach ($pregs as $p) {
                    $planas[] = ['id' => $p['id'], 'texto' => $p['texto'], 'categoria' => $cat, 'subcategoria' => $sub];
                }
            }
        }
        return $planas;
    }

    private function _cargarDatosGeneral(string $rolObjetivo, string $fechaInicio, string $fechaCierreMax, array $preguntasPlanas): array
    {
        $pdo = $this->getEntityManager()->getPDO();

        // Encuestas del período
        $sql = "SELECT e.id, e.equipo_id as equipoId, t.name as equipoName
                FROM encuesta e
                LEFT JOIN team t ON e.equipo_id = t.id AND t.deleted = 0
                WHERE e.rol_usuario = :rol
                  AND e.fecha_creacion >= :fi
                  AND e.fecha_creacion <= :fc
                  AND e.deleted = 0";
        $sth = $pdo->prepare($sql);
        $sth->bindValue(':rol', $rolObjetivo);
        $sth->bindValue(':fi',  $fechaInicio);
        $sth->bindValue(':fc',  $fechaCierreMax);
        $sth->execute();
        $encuestas = $sth->fetchAll(\PDO::FETCH_ASSOC);

        if (empty($encuestas)) {
            return ['filas' => [], 'totalesPorPregunta' => [], 'totalGeneral' => null];
        }

        $encuestasIds = array_column($encuestas, 'id');
        $respuestas   = $this->_cargarRespuestas($pdo, $encuestasIds);

        // Agrupar respuestas por encuesta
        $respPorEncuesta = [];
        foreach ($respuestas as $r) {
            $respPorEncuesta[$r['encuestaId']][$r['preguntaId']] = $r['respuesta'];
        }

        // Agrupar encuestas por oficina
        $oficinas = [];
        foreach ($encuestas as $e) {
            $oid = $e['equipoId'];
            if (!isset($oficinas[$oid])) {
                $oficinas[$oid] = ['nombre' => $e['equipoName'] ?? $oid, 'encuestasIds' => []];
            }
            $oficinas[$oid]['encuestasIds'][] = $e['id'];
        }

        $preguntasIds       = array_column($preguntasPlanas, 'id');
        $totalesPorPregunta = array_fill(0, count($preguntasIds), ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0]);
        $totalGeneral       = ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0];

        $filas = [];
        foreach ($oficinas as $oid => $oData) {
            // Calcular totales por pregunta para esta oficina
            $oficinaTotales = array_fill(0, count($preguntasIds), ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0]);
            foreach ($oData['encuestasIds'] as $eid) {
                foreach ($preguntasIds as $pidx => $pid) {
                    $color = $respPorEncuesta[$eid][$pid] ?? null;
                    if ($color) {
                        $oficinaTotales[$pidx][$color]++;
                        $oficinaTotales[$pidx]['total']++;
                        $totalesPorPregunta[$pidx][$color]++;
                        $totalesPorPregunta[$pidx]['total']++;
                        $totalGeneral[$color]++;
                        $totalGeneral['total']++;
                    }
                }
            }

            // Omitir oficinas sin datos
            $tieneData = array_sum(array_column($oficinaTotales, 'total')) > 0;
            if (!$tieneData) continue;

            // Color de cada celda = color semáforo de la oficina para esa pregunta
            $respuestasOficina = [];
            $verdesOficina = 0; $totalOficina = 0;
            foreach ($oficinaTotales as $t) {
                $color = $this->_calcularColor($t['verde'], $t['amarillo'], $t['rojo'], $t['total']);
                $respuestasOficina[] = $color;
                $verdesOficina += $t['verde'];
                $totalOficina  += $t['total'];
            }

            $pct          = $totalOficina > 0 ? round(($verdesOficina / $totalOficina) * 100) : 0;
            $colorGeneral = $this->_calcularColor($verdesOficina, 0, 0, $totalOficina > 0 ? $totalOficina : 1);

            $filas[] = [
                'nombre'         => $oData['nombre'],
                'respuestas'     => $respuestasOficina,
                'sumatoria'      => $verdesOficina . '/' . $totalOficina . ' (' . $pct . '%)',
                'sumatoriaColor' => $this->_calcularColor(
                    array_sum(array_column($oficinaTotales, 'verde')),
                    array_sum(array_column($oficinaTotales, 'amarillo')),
                    array_sum(array_column($oficinaTotales, 'rojo')),
                    $totalOficina
                ),
            ];
        }

        // Formatear totales por pregunta
        $totalesFormateados = [];
        foreach ($totalesPorPregunta as $t) {
            $totalesFormateados[] = [
                'verdes'     => $t['verde'],
                'total'      => $t['total'],
                'porcentaje' => $t['total'] > 0 ? round(($t['verde'] / $t['total']) * 100) : 0,
                'color'      => $this->_calcularColor($t['verde'], $t['amarillo'], $t['rojo'], $t['total']),
            ];
        }

        $tgVerdes = $totalGeneral['verde'];
        $tgTotal  = $totalGeneral['total'];
        $tgColor  = $this->_calcularColor($totalGeneral['verde'], $totalGeneral['amarillo'], $totalGeneral['rojo'], $tgTotal);

        return [
            'filas'              => $filas,
            'totalesPorPregunta' => $totalesFormateados,
            'totalGeneral'       => [
                'verdes'     => $tgVerdes,
                'total'      => $tgTotal,
                'porcentaje' => $tgTotal > 0 ? round(($tgVerdes / $tgTotal) * 100) : 0,
                'color'      => $tgColor,
            ],
        ];
    }

    private function _cargarDatosDetallado(string $rolObjetivo, string $fechaInicio, string $fechaCierreMax, array $preguntasPlanas, ?string $oficinaId, ?string $usuarioId): array
    {
        $pdo = $this->getEntityManager()->getPDO();

        $where  = "e.rol_usuario = :rol AND e.fecha_creacion >= :fi AND e.fecha_creacion <= :fc AND e.deleted = 0";
        $params = [':rol' => $rolObjetivo, ':fi' => $fechaInicio, ':fc' => $fechaCierreMax];

        if ($oficinaId) {
            $where .= " AND e.equipo_id = :oid";
            $params[':oid'] = $oficinaId;
        }
        if ($usuarioId) {
            $where .= " AND e.usuario_evaluado_id = :uid";
            $params[':uid'] = $usuarioId;
        }

        $sql = "SELECT e.id,
                       CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,'')) as nombre,
                       e.usuario_evaluado_id as usuarioId
                FROM encuesta e
                LEFT JOIN user u ON e.usuario_evaluado_id = u.id AND u.deleted = 0
                WHERE $where
                ORDER BY nombre";
        $sth = $pdo->prepare($sql);
        foreach ($params as $k => $v) $sth->bindValue($k, $v);
        $sth->execute();
        $encuestas = $sth->fetchAll(\PDO::FETCH_ASSOC);

        if (empty($encuestas)) {
            return ['filas' => [], 'totalesPorPregunta' => [], 'totalGeneral' => null];
        }

        $encuestasIds = array_column($encuestas, 'id');
        $respuestas   = $this->_cargarRespuestas($pdo, $encuestasIds);

        $respPorEncuesta = [];
        foreach ($respuestas as $r) {
            $respPorEncuesta[$r['encuestaId']][$r['preguntaId']] = $r['respuesta'];
        }

        $preguntasIds       = array_column($preguntasPlanas, 'id');
        $totalesPorPregunta = array_fill(0, count($preguntasIds), ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0]);
        $totalGeneral       = ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0];

        $filas = [];
        foreach ($encuestas as $enc) {
            $eid        = $enc['id'];
            $respuestas_usuario = [];
            $verdes = 0; $amarillos = 0; $rojos = 0; $total = 0;

            foreach ($preguntasIds as $pidx => $pid) {
                $color = $respPorEncuesta[$eid][$pid] ?? 'gris';
                $respuestas_usuario[] = $color;
                if ($color !== 'gris') {
                    $totalesPorPregunta[$pidx][$color]++;
                    $totalesPorPregunta[$pidx]['total']++;
                    $totalGeneral[$color]++;
                    $totalGeneral['total']++;
                    $total++;
                    if ($color === 'verde')   $verdes++;
                    if ($color === 'amarillo') $amarillos++;
                    if ($color === 'rojo')     $rojos++;
                }
            }

            $pct   = $total > 0 ? round(($verdes / $total) * 100) : 0;
            $color = $this->_calcularColor($verdes, $amarillos, $rojos, $total);
            $nombre = trim($enc['nombre']);
            if (empty($nombre)) $nombre = 'Usuario ' . substr($enc['usuarioId'], 0, 8);

            $filas[] = [
                'nombre'         => $nombre,
                'respuestas'     => $respuestas_usuario,
                'sumatoria'      => $verdes . '/' . $total . ' (' . $pct . '%)',
                'sumatoriaColor' => $color,
            ];
        }

        $totalesFormateados = [];
        foreach ($totalesPorPregunta as $t) {
            $totalesFormateados[] = [
                'verdes'     => $t['verde'],
                'total'      => $t['total'],
                'porcentaje' => $t['total'] > 0 ? round(($t['verde'] / $t['total']) * 100) : 0,
                'color'      => $this->_calcularColor($t['verde'], $t['amarillo'], $t['rojo'], $t['total']),
            ];
        }

        $tgVerdes = $totalGeneral['verde'];
        $tgTotal  = $totalGeneral['total'];

        return [
            'filas'              => $filas,
            'totalesPorPregunta' => $totalesFormateados,
            'totalGeneral'       => [
                'verdes'     => $tgVerdes,
                'total'      => $tgTotal,
                'porcentaje' => $tgTotal > 0 ? round(($tgVerdes / $tgTotal) * 100) : 0,
                'color'      => $this->_calcularColor($totalGeneral['verde'], $totalGeneral['amarillo'], $totalGeneral['rojo'], $tgTotal),
            ],
        ];
    }

    private function _cargarRespuestas(\PDO $pdo, array $encuestasIds): array
    {
        if (empty($encuestasIds)) return [];
        $placeholders = implode(',', array_fill(0, count($encuestasIds), '?'));
        $sql = "SELECT encuesta_id as encuestaId, pregunta_id as preguntaId, respuesta
                FROM respuesta_encuesta
                WHERE encuesta_id IN ($placeholders) AND deleted = 0";
        $sth = $pdo->prepare($sql);
        $sth->execute($encuestasIds);
        return $sth->fetchAll(\PDO::FETCH_ASSOC);
    }

    // =========================================================
    //  RESTO DE MÉTODOS EXISTENTES (sin cambios)
    // =========================================================

    public function getActionGetAsesoresByOficina($params, $data, $request)
    {
        try {
            $oficinaId = $request->get('oficinaId');
            if (!$oficinaId) {
                return ['success' => false, 'error' => 'ID de oficina no proporcionado'];
            }
            $pdo = $this->getEntityManager()->getPDO();
            $sql = "SELECT DISTINCT u.id, u.user_name, u.first_name, u.last_name,
                        GROUP_CONCAT(DISTINCT LOWER(r.name)) as roles
                    FROM user u
                    INNER JOIN team_user tu ON u.id = tu.user_id
                    LEFT JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                    LEFT JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                    WHERE tu.team_id = ? AND u.deleted = 0 AND u.is_active = 1
                    GROUP BY u.id
                    ORDER BY u.first_name, u.last_name, u.user_name";
            $sth = $pdo->prepare($sql);
            $sth->execute([$oficinaId]);
            $usuarios = [];
            $rolesBusqueda = ['asesor', 'gerente', 'director', 'coordinador'];
            while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
                $firstName = $row['first_name'] ?? '';
                $lastName  = $row['last_name']  ?? '';
                $userName  = $row['user_name']  ?? '';
                $fullName  = trim($firstName . ' ' . $lastName);
                if (empty($fullName)) $fullName = $userName;
                if (empty($fullName)) $fullName = 'Usuario #' . substr($row['id'], 0, 8);
                $roles = $row['roles'] ? explode(',', strtolower($row['roles'])) : [];
                $tieneRolValido = false;
                foreach ($rolesBusqueda as $rol) {
                    if (in_array($rol, $roles)) { $tieneRolValido = true; break; }
                }
                if ($tieneRolValido) {
                    $usuarios[] = ['id' => $row['id'], 'name' => $fullName, 'userName' => $userName, 'roles' => $roles];
                }
            }
            return ['success' => true, 'data' => $usuarios, 'total' => count($usuarios)];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function getActionGetEncuestasByPeriodo($params, $data, $request)
    {
        try {
            $periodoId = $request->get('periodoId');
            $oficinaId = $request->get('oficinaId');
            if (!$periodoId) return ['success' => false, 'error' => 'ID de período no proporcionado'];
            $entityManager = $this->getEntityManager();
            $periodo = $entityManager->getEntity('Competencias', $periodoId);
            if (!$periodo) return ['success' => false, 'error' => 'Período no encontrado'];
            $fechaInicio    = $periodo->get('fechaInicio');
            $fechaCierre    = $periodo->get('fechaCierre');
            $fechaCierreMax = $fechaCierre . ' 23:59:59';
            $where = ['fechaCreacion>=' => $fechaInicio, 'fechaCreacion<=' => $fechaCierreMax, 'deleted' => 0];
            if ($oficinaId) $where['equipoId'] = $oficinaId;
            $encuestas = $entityManager->getRepository('Encuesta')
                ->where($where)
                ->select(['id', 'usuarioEvaluadoId', 'estado', 'fechaEncuesta', 'porcentajeCompletado'])
                ->find();
            $resultado = [];
            foreach ($encuestas as $encuesta) {
                $resultado[] = [
                    'id'                  => $encuesta->get('id'),
                    'usuarioEvaluadoId'   => $encuesta->get('usuarioEvaluadoId'),
                    'estado'              => $encuesta->get('estado'),
                    'fechaEncuesta'       => $encuesta->get('fechaEncuesta'),
                    'porcentajeCompletado'=> $encuesta->get('porcentajeCompletado'),
                ];
            }
            return ['success' => true, 'data' => $resultado, 'total' => count($resultado)];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function getActionGetReporteGeneral($params, $data, $request)
    {
        try {
            $periodoId   = $request->get('periodoId');
            $rolObjetivo = $request->get('rolObjetivo');
            if (!$periodoId || !$rolObjetivo) return ['success' => false, 'error' => 'Faltan parámetros requeridos'];
            $entityManager = $this->getEntityManager();
            $pdo = $entityManager->getPDO();
            $periodo = $entityManager->getEntity('Competencias', $periodoId);
            if (!$periodo) return ['success' => false, 'error' => 'Período no encontrado'];
            $fechaInicio    = $periodo->get('fechaInicio');
            $fechaCierre    = $periodo->get('fechaCierre');
            $fechaCierreMax = $fechaCierre . ' 23:59:59';
            $preguntas = $this->_cargarPreguntas($rolObjetivo);
            $sqlOficinas = "SELECT DISTINCT t.id, t.name FROM team t
                            WHERE t.id NOT LIKE 'CLA%' AND LOWER(t.id) != 'venezuela'
                            AND LOWER(t.name) != 'venezuela' AND t.deleted = 0 ORDER BY t.name";
            $sth = $pdo->prepare($sqlOficinas);
            $sth->execute();
            $oficinas = $sth->fetchAll(\PDO::FETCH_ASSOC);
            $sqlEncuestas = "SELECT e.id, e.equipo_id as equipoId, t.name as equipoName,
                                e.usuario_evaluado_id as usuarioEvaluadoId,
                                CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,'')) as usuarioEvaluadoName
                             FROM encuesta e
                             LEFT JOIN team t ON e.equipo_id = t.id AND t.deleted = 0
                             LEFT JOIN user u ON e.usuario_evaluado_id = u.id AND u.deleted = 0
                             WHERE e.rol_usuario = :rolUsuario AND e.fecha_creacion >= :fechaInicio
                             AND e.fecha_creacion <= :fechaCierre AND e.deleted = 0 ORDER BY e.fecha_creacion DESC";
            $sth = $pdo->prepare($sqlEncuestas);
            $sth->bindValue(':rolUsuario', $rolObjetivo);
            $sth->bindValue(':fechaInicio', $fechaInicio);
            $sth->bindValue(':fechaCierre', $fechaCierreMax);
            $sth->execute();
            $encuestas = $sth->fetchAll(\PDO::FETCH_ASSOC);
            if (empty($encuestas)) {
                return ['success' => true, 'preguntas' => $this->_agruparPreguntas($preguntas), 'oficinas' => [], 'totalesPorPregunta' => [], 'totalesGenerales' => ['verdes' => 0, 'total' => 0, 'porcentaje' => 0, 'color' => 'gris']];
            }
            $encuestasIds = array_column($encuestas, 'id');
            $respuestas = empty($encuestasIds) ? [] : (function() use ($pdo, $encuestasIds) {
                $placeholders = implode(',', array_fill(0, count($encuestasIds), '?'));
                $sth = $pdo->prepare("SELECT encuesta_id as encuestaId, pregunta_id as preguntaId, respuesta FROM respuesta_encuesta WHERE encuesta_id IN ($placeholders) AND deleted = 0");
                $sth->execute($encuestasIds);
                return $sth->fetchAll(\PDO::FETCH_ASSOC);
            })();
            $resultado = $this->_procesarDatosReporteGeneral($preguntas, $oficinas, $encuestas, $respuestas);
            return ['success' => true, 'preguntas' => $this->_agruparPreguntas($preguntas), 'oficinas' => $resultado['oficinas'], 'totalesPorPregunta' => $resultado['totalesPorPregunta'], 'totalesGenerales' => $resultado['totalesGenerales']];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function _procesarDatosReporteGeneral($preguntas, $oficinas, $encuestas, $respuestas)
    {
        $encuestasMap = [];
        foreach ($encuestas as $e) $encuestasMap[$e['id']] = $e;
        $preguntasIds = array_column($preguntas, 'id');
        $oficinasMap  = [];
        $totalesPorPregunta = [];
        $totalesGenerales   = ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0];
        foreach ($oficinas as $o) {
            $oficinasMap[$o['id']] = ['id' => $o['id'], 'name' => $o['name'], 'totalesPorPregunta' => [], 'totalesOficina' => ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0]];
            foreach ($preguntasIds as $pid) $oficinasMap[$o['id']]['totalesPorPregunta'][$pid] = ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0];
        }
        foreach ($preguntasIds as $pid) $totalesPorPregunta[$pid] = ['verde' => 0, 'amarillo' => 0, 'rojo' => 0, 'total' => 0];
        foreach ($respuestas as $r) {
            $eid = $r['encuestaId']; $pid = $r['preguntaId']; $color = $r['respuesta'];
            if (!isset($encuestasMap[$eid]) || !isset($totalesPorPregunta[$pid])) continue;
            $oid = $encuestasMap[$eid]['equipoId'];
            if (!isset($oficinasMap[$oid])) continue;
            if (isset($oficinasMap[$oid]['totalesPorPregunta'][$pid])) {
                $oficinasMap[$oid]['totalesPorPregunta'][$pid]['total']++;
                $oficinasMap[$oid]['totalesPorPregunta'][$pid][$color]++;
                $oficinasMap[$oid]['totalesOficina']['total']++;
                $oficinasMap[$oid]['totalesOficina'][$color]++;
            }
            $totalesPorPregunta[$pid]['total']++; $totalesPorPregunta[$pid][$color]++;
            $totalesGenerales['total']++; $totalesGenerales[$color]++;
        }
        foreach ($oficinasMap as &$oficina) {
            foreach ($oficina['totalesPorPregunta'] as $pid => &$p) {
                $p['porcentaje'] = $p['total'] > 0 ? round(($p['verde'] / $p['total']) * 100, 1) : 0;
                $p['color'] = $this->_calcularColor($p['verde'], $p['amarillo'], $p['rojo'], $p['total']);
            }
            $ot = &$oficina['totalesOficina'];
            $ot['porcentaje'] = $ot['total'] > 0 ? round(($ot['verde'] / $ot['total']) * 100, 1) : 0;
            $ot['color'] = $this->_calcularColor($ot['verde'], $ot['amarillo'], $ot['rojo'], $ot['total']);
        }
        foreach ($totalesPorPregunta as $pid => &$p) {
            $p['verdes'] = $p['verde'];
            $p['porcentaje'] = $p['total'] > 0 ? round(($p['verde'] / $p['total']) * 100, 1) : 0;
            $p['color'] = $this->_calcularColor($p['verde'], $p['amarillo'], $p['rojo'], $p['total']);
        }
        $tg = &$totalesGenerales;
        $tg['verdes'] = $tg['verde'];
        $tg['porcentaje'] = $tg['total'] > 0 ? round(($tg['verde'] / $tg['total']) * 100, 1) : 0;
        $tg['color'] = $this->_calcularColor($tg['verde'], $tg['amarillo'], $tg['rojo'], $tg['total']);
        $oficinasConDatos = array_values(array_filter($oficinasMap, fn($o) => $o['totalesOficina']['total'] > 0));
        return ['oficinas' => $oficinasConDatos, 'totalesPorPregunta' => $totalesPorPregunta, 'totalesGenerales' => $totalesGenerales];
    }

    public function getActionGetUserInfo($params, $data, $request)
    {
        try {
            $user   = $this->getUser();
            $userId = $user->get('id');
            $pdo    = $this->getEntityManager()->getPDO();
            $sql = "SELECT u.id, u.type, u.user_name as userName, u.first_name as firstName, u.last_name as lastName,
                        GROUP_CONCAT(DISTINCT LOWER(r.name)) as roles
                    FROM user u
                    LEFT JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                    LEFT JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                    WHERE u.id = ? AND u.deleted = 0 GROUP BY u.id";
            $sth = $pdo->prepare($sql);
            $sth->execute([$userId]);
            $userData = $sth->fetch(\PDO::FETCH_ASSOC);
            if (!$userData) return ['success' => false, 'error' => 'Usuario no encontrado'];
            $roles = $userData['roles'] ? explode(',', $userData['roles']) : [];
            $sqlTeams = "SELECT t.id, t.name FROM team t INNER JOIN team_user tu ON t.id = tu.team_id
                         WHERE tu.user_id = ? AND tu.deleted = 0 AND t.deleted = 0";
            $sthTeams = $pdo->prepare($sqlTeams);
            $sthTeams->execute([$userId]);
            $teamIds   = []; $teamNames = []; $claPattern = '/^CLA\d+$/i'; $claId = null; $oficinaId = null;
            while ($row = $sthTeams->fetch(\PDO::FETCH_ASSOC)) {
                $teamIds[] = $row['id']; $teamNames[$row['id']] = $row['name'];
                if (preg_match($claPattern, $row['id'])) { $claId = $row['id']; }
                elseif (strtolower($row['id']) !== 'venezuela' && strtolower($row['name']) !== 'venezuela') { if (!$oficinaId) $oficinaId = $row['id']; }
            }
            return ['success' => true, 'data' => [
                'id' => $userId, 'type' => $userData['type'] ?? 'regular',
                'name' => trim($userData['firstName'] . ' ' . $userData['lastName']) ?: $userData['userName'],
                'userName' => $userData['userName'], 'roles' => $roles,
                'teamIds' => $teamIds, 'teamNames' => $teamNames,
                'claId' => $claId, 'oficinaId' => $oficinaId,
                'esCasaNacional' => in_array('casa nacional', $roles),
                'esGerente' => in_array('gerente', $roles) || in_array('director', $roles) || in_array('coordinador', $roles),
                'esAsesor' => in_array('asesor', $roles),
            ]];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function getActionGetOficinasByCLA($params, $data, $request)
    {
        try {
            $claId = $request->get('claId');
            if (!$claId) return ['success' => false, 'error' => 'ID de CLA no proporcionado'];
            $pdo = $this->getEntityManager()->getPDO();
            $sqlUsuarios = "SELECT DISTINCT user_id FROM team_user WHERE team_id = :claId AND deleted = 0";
            $sthUsuarios = $pdo->prepare($sqlUsuarios);
            $sthUsuarios->bindValue(':claId', $claId);
            $sthUsuarios->execute();
            $usuariosDelCLA = [];
            while ($row = $sthUsuarios->fetch(\PDO::FETCH_ASSOC)) $usuariosDelCLA[] = $row['user_id'];
            if (empty($usuariosDelCLA)) return ['success' => true, 'data' => []];
            $placeholders = implode(',', array_fill(0, count($usuariosDelCLA), '?'));
            $sqlOficinas = "SELECT DISTINCT t.id, t.name FROM team_user tu INNER JOIN team t ON tu.team_id = t.id
                            WHERE tu.user_id IN ($placeholders) AND t.id NOT LIKE 'CLA%'
                            AND LOWER(t.id) != 'venezuela' AND LOWER(t.name) != 'venezuela'
                            AND tu.deleted = 0 AND t.deleted = 0 ORDER BY t.name";
            $sthOficinas = $pdo->prepare($sqlOficinas);
            $sthOficinas->execute($usuariosDelCLA);
            $oficinas = [];
            while ($row = $sthOficinas->fetch(\PDO::FETCH_ASSOC)) $oficinas[] = ['id' => $row['id'], 'name' => $row['name']];
            return ['success' => true, 'data' => $oficinas, 'total' => count($oficinas)];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function getActionGetCLAs($params, $data, $request)
    {
        try {
            $pdo = $this->getEntityManager()->getPDO();
            $sql = "SELECT id, name FROM team WHERE id LIKE 'CLA%' AND deleted = 0 ORDER BY name";
            $sth = $pdo->prepare($sql);
            $sth->execute();
            $clas = [];
            while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) $clas[] = ['id' => $row['id'], 'name' => $row['name']];
            return ['success' => true, 'data' => $clas];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}