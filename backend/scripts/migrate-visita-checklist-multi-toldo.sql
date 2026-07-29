-- ============================================================
-- migrate-visita-checklist-multi-toldo.sql
-- Soporta múltiples unidades de Toldo Vela por visita.
--
-- Ejecutar en Supabase SQL Editor. Es idempotente gracias a
-- IF NOT EXISTS / IF EXISTS.
-- ============================================================

-- 1. Columna cantidad_toldos en visitas
--    DEFAULT 1 → visitas existentes quedan intactas.
ALTER TABLE visitas
  ADD COLUMN IF NOT EXISTS cantidad_toldos INT NOT NULL DEFAULT 1;

-- 2. Columna unidad en visita_checklist
--    DEFAULT 1 → respuestas existentes quedan con unidad = 1.
ALTER TABLE visita_checklist
  ADD COLUMN IF NOT EXISTS unidad INT NOT NULL DEFAULT 1;

-- 3. Reemplazar unique constraint (visita_id, pregunta_id)
--    por (visita_id, pregunta_id, unidad) para permitir
--    upsert independiente por toldo.
--
--    El nombre auto-generado suele ser:
--      visita_checklist_visita_id_pregunta_id_key
--    Verifica en Supabase → Table Editor → visita_checklist
--    → Constraints si el DROP falla.
ALTER TABLE visita_checklist
  DROP CONSTRAINT IF EXISTS visita_checklist_visita_id_pregunta_id_key;

ALTER TABLE visita_checklist
  ADD CONSTRAINT visita_checklist_visita_id_pregunta_id_unidad_key
  UNIQUE (visita_id, pregunta_id, unidad);
