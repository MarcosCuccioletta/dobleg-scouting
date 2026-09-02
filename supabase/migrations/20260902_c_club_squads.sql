-- Plantel de un club por categoría (primera/reserva/inferiores/femenino/...). Distinto de
-- agency_players, que es la cartera de representados de Doble G (jugadores en clubes ajenos).
-- Tabla nueva, sin filas previas: club_id es NOT NULL sin DEFAULT.

CREATE TABLE IF NOT EXISTS public.club_squads (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id            TEXT NOT NULL,
  category           TEXT NOT NULL,
  source             TEXT NOT NULL CHECK (source IN ('api_football', 'manual')),
  full_name          TEXT NOT NULL,
  short_name         TEXT,
  position           TEXT,
  birth_date         DATE,
  api_player_id      INTEGER,
  supabase_player_id INTEGER REFERENCES public.players(id),
  image              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_squads_club_category ON public.club_squads(club_id, category);

ALTER TABLE public.club_squads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_club_squads" ON public.club_squads;
CREATE POLICY "read_club_squads" ON public.club_squads
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());

DROP POLICY IF EXISTS "write_club_squads" ON public.club_squads;
CREATE POLICY "write_club_squads" ON public.club_squads
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());
