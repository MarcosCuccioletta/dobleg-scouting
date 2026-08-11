-- supabase/migrations/20260810_coach_future_squads.sql
-- Plantel a futuro: un plan por entrenador (upsert por coach_key), con la cancha
-- (slots por posicion de formacion, plantel propio + altas de scouting) y una
-- lista de bajas planificadas. Sin CHECK sobre slots/bajas (JSONB libre), mismo
-- criterio que coach_tactical_boards -- la valida la capa de aplicacion.
CREATE TABLE IF NOT EXISTS public.coach_future_squads (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key       TEXT NOT NULL,
  formation_type  TEXT NOT NULL DEFAULT '4-3-3',
  slots           JSONB NOT NULL DEFAULT '[]'::jsonb,
  bajas           JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_coach_future_squads_coach ON public.coach_future_squads(coach_key);

ALTER TABLE public.coach_future_squads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_coach_future_squads" ON public.coach_future_squads;
CREATE POLICY "read_coach_future_squads" ON public.coach_future_squads FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_future_squads" ON public.coach_future_squads;
CREATE POLICY "write_coach_future_squads" ON public.coach_future_squads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
