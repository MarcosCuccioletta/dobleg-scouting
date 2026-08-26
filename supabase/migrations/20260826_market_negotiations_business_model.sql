-- Mercado: el modelo de negociacion original solo tenia un "contacto" generico,
-- pero una negociacion real tiene hasta 3 personas distintas: el representante
-- del jugador (agente, no es de la agencia), el director deportivo del club
-- ACTUAL del jugador (para sacarlo) y el del club AL QUE SE LO QUIERE LLEVAR
-- (para meterlo). team_id/team_name/team_logo ya representaban el club destino
-- -- se renombra el contacto existente para dejarlo explicito, y se agrega el
-- club actual (opcional: a veces no aplica, ej. juveniles sin club) y el agente.

ALTER TABLE public.market_negotiations
  RENAME COLUMN contact_name TO target_club_contact_name;
ALTER TABLE public.market_negotiations
  RENAME COLUMN contact_role TO target_club_contact_role;

ALTER TABLE public.market_negotiations
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS current_team_id BIGINT,
  ADD COLUMN IF NOT EXISTS current_team_name TEXT,
  ADD COLUMN IF NOT EXISTS current_team_logo TEXT,
  ADD COLUMN IF NOT EXISTS current_club_contact_name TEXT;

-- Objetivos: un club no busca "un" jugador, va evaluando varios candidatos
-- para el mismo puesto a medida que se los ofrecen ("le ofrecimos a X, despues
-- a Y para el mismo lateral"). Antes no habia forma de llevar esa lista.
CREATE TABLE IF NOT EXISTS public.market_need_candidates (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  need_id         BIGINT NOT NULL REFERENCES public.market_club_needs(id) ON DELETE CASCADE,
  player_name     TEXT NOT NULL,
  player_api_id   BIGINT,
  player_source   TEXT CHECK (player_source IN ('interno', 'externo')),
  status          TEXT NOT NULL DEFAULT 'propuesto' CHECK (status IN ('propuesto', 'en_negociacion', 'descartado', 'fichado')),
  added_by_id     UUID,
  added_by_name   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_need_candidates_need ON public.market_need_candidates(need_id);

ALTER TABLE public.market_need_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_market_need_candidates" ON public.market_need_candidates;
CREATE POLICY "read_market_need_candidates" ON public.market_need_candidates FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_market_need_candidates" ON public.market_need_candidates;
CREATE POLICY "write_market_need_candidates" ON public.market_need_candidates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
