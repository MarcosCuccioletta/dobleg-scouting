-- Pizarra tactica: fichas arrastrables + anotaciones de dibujo sobre una cancha,
-- guardadas por entrenador. Sin CHECK sobre la forma de markers/annotations
-- (JSONB libre) -- la valida la capa de aplicacion, mismo criterio que
-- coach_match_team_stats.raw_metrics.
CREATE TABLE IF NOT EXISTS public.coach_tactical_boards (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key   TEXT NOT NULL,
  name        TEXT NOT NULL,
  markers     JSONB NOT NULL DEFAULT '[]'::jsonb,
  annotations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_tactical_boards_coach ON public.coach_tactical_boards(coach_key);

ALTER TABLE public.coach_tactical_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_coach_tactical_boards" ON public.coach_tactical_boards;
CREATE POLICY "read_coach_tactical_boards" ON public.coach_tactical_boards FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_tactical_boards" ON public.coach_tactical_boards;
CREATE POLICY "write_coach_tactical_boards" ON public.coach_tactical_boards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
