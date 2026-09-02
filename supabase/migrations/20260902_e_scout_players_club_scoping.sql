-- Hueco encontrado en el aislamiento por club: scout_players / scout_players_status son el
-- pipeline interno de seguimiento de Doble G sobre jugadores externos (Seguimiento GG) —
-- nunca tuvieron migración en el repo (se crearon a mano en el dashboard), así que quedaron
-- fuera del alcance del fundamento multi-club original. Mismo patrón que el resto: club_id
-- con default 'dobleg' para no romper Scout Platform, y RLS filtrado por club.

ALTER TABLE public.scout_players ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.scout_players_status ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';

CREATE INDEX IF NOT EXISTS idx_scout_players_club ON public.scout_players(club_id);
CREATE INDEX IF NOT EXISTS idx_scout_players_status_club ON public.scout_players_status(club_id);

DROP POLICY IF EXISTS "Authenticated users can read scout_players" ON public.scout_players;
DROP POLICY IF EXISTS "Authenticated users can insert scout_players" ON public.scout_players;
DROP POLICY IF EXISTS "Authenticated users can update scout_players" ON public.scout_players;
DROP POLICY IF EXISTS "Authenticated users can delete scout_players" ON public.scout_players;

CREATE POLICY "read_scout_players" ON public.scout_players
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
CREATE POLICY "write_scout_players" ON public.scout_players
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

DROP POLICY IF EXISTS "Authenticated users can read scout_players_status" ON public.scout_players_status;
DROP POLICY IF EXISTS "Authenticated users can insert scout_players_status" ON public.scout_players_status;

CREATE POLICY "read_scout_players_status" ON public.scout_players_status
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
CREATE POLICY "insert_scout_players_status" ON public.scout_players_status
  FOR INSERT TO authenticated WITH CHECK (club_id = public.current_club_id());
