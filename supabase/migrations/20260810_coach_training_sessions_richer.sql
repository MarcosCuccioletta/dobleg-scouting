-- Entrenamientos como bitacora: campos nuevos para calcular carga e insights.
-- `notes` ya existia en la tabla, sin usar en la UI hasta ahora.
ALTER TABLE public.coach_training_sessions
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER CHECK (duration_minutes > 0),
  ADD COLUMN IF NOT EXISTS intensity SMALLINT CHECK (intensity BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS focus_tags TEXT[] NOT NULL DEFAULT '{}'::text[];
