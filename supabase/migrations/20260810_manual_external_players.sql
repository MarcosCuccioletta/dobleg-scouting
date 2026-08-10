-- Fichas creadas al vuelo desde el plantel de un entrenador, cuando un jugador
-- no tiene fila todavia en el Sheet legacy de Scouting Externo (de solo lectura
-- desde el browser). Se fusiona con `external` en DataContext.tsx, mismo patron
-- que el overlay de agencyPlayers sobre `internal`.
CREATE TABLE IF NOT EXISTS public.manual_external_players (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  api_player_id   BIGINT NOT NULL,
  full_name       TEXT NOT NULL,
  team            TEXT NOT NULL,
  position        TEXT NOT NULL,
  age             INTEGER,
  photo           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_manual_external_players_api_id ON public.manual_external_players(api_player_id);

ALTER TABLE public.manual_external_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_manual_external_players" ON public.manual_external_players;
CREATE POLICY "read_manual_external_players" ON public.manual_external_players FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_manual_external_players" ON public.manual_external_players;
CREATE POLICY "write_manual_external_players" ON public.manual_external_players
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
