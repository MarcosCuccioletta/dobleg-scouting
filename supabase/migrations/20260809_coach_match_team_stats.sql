-- Estadisticas de equipo por partido (posesion, xG) cargadas a mano desde el
-- Excel "Team Stats" de Wyscout, porque la API no las tiene para esta liga.
CREATE TABLE IF NOT EXISTS public.coach_match_team_stats (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key       TEXT NOT NULL,
  fixture_id      BIGINT NOT NULL,
  possession_pct  NUMERIC,
  xg_for          NUMERIC,
  xg_against      NUMERIC,
  raw_metrics     JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_file     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_coach_match_team_stats ON public.coach_match_team_stats(coach_key, fixture_id);

ALTER TABLE public.coach_match_team_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_coach_match_team_stats" ON public.coach_match_team_stats;
CREATE POLICY "read_coach_match_team_stats" ON public.coach_match_team_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_match_team_stats" ON public.coach_match_team_stats;
CREATE POLICY "write_coach_match_team_stats" ON public.coach_match_team_stats
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
