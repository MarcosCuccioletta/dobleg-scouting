-- Agenda de entrenamientos y notas de partidos por entrenador (sección Entrenadores).
CREATE TABLE IF NOT EXISTS public.coach_training_sessions (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key    TEXT NOT NULL,
  session_date DATE NOT NULL,
  session_time TIME,
  type         TEXT NOT NULL CHECK (type IN ('tactico','fisico','recuperacion','set_pieces','pre_rival','otro')),
  title        TEXT NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_training_sessions_coach_date ON public.coach_training_sessions(coach_key, session_date);

CREATE TABLE IF NOT EXISTS public.coach_match_notes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key   TEXT NOT NULL,
  fixture_id  BIGINT NOT NULL,
  note        TEXT NOT NULL,
  author      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_coach_match_notes ON public.coach_match_notes(coach_key, fixture_id);

ALTER TABLE public.coach_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_match_notes       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_coach_training_sessions" ON public.coach_training_sessions;
CREATE POLICY "read_coach_training_sessions" ON public.coach_training_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_training_sessions" ON public.coach_training_sessions;
CREATE POLICY "write_coach_training_sessions" ON public.coach_training_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_coach_match_notes" ON public.coach_match_notes;
CREATE POLICY "read_coach_match_notes" ON public.coach_match_notes FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_match_notes" ON public.coach_match_notes;
CREATE POLICY "write_coach_match_notes" ON public.coach_match_notes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
