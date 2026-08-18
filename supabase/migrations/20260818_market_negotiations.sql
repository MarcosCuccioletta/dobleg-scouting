-- Mercado: seguimiento de objetivos de clubes y negociaciones de jugadores,
-- para que dos personas de la agencia no se pisen ofreciendo el mismo jugador
-- al mismo club, y no se pierda el "volveme a llamar en 10 dias".

CREATE TABLE IF NOT EXISTS public.market_team_members (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.market_club_needs (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id             BIGINT NOT NULL,
  team_name           TEXT NOT NULL,
  team_logo           TEXT,
  position_label      TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'cerrado')),
  assigned_to_id      BIGINT REFERENCES public.market_team_members(id),
  assigned_to_name    TEXT,
  next_followup_date  DATE,
  created_by_id       UUID,
  created_by_name     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.market_negotiations (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id             BIGINT NOT NULL,
  team_name           TEXT NOT NULL,
  team_logo           TEXT,
  player_name         TEXT NOT NULL,
  player_api_id       BIGINT,
  player_source       TEXT CHECK (player_source IN ('interno', 'externo')),
  contact_name        TEXT,
  contact_role        TEXT,
  status              TEXT NOT NULL DEFAULT 'contactado'
                        CHECK (status IN ('contactado', 'reunion', 'oferta_enviada', 'en_espera', 'cerrado_exitoso', 'cerrado_rechazado')),
  assigned_to_id      BIGINT REFERENCES public.market_team_members(id),
  assigned_to_name    TEXT,
  next_followup_date  DATE,
  created_by_id       UUID,
  created_by_name     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.market_negotiation_notes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negotiation_id  BIGINT REFERENCES public.market_negotiations(id) ON DELETE CASCADE,
  need_id         BIGINT REFERENCES public.market_club_needs(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  is_meeting      BOOLEAN NOT NULL DEFAULT false,
  is_system       BOOLEAN NOT NULL DEFAULT false,
  author_id       UUID,
  author_name     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT market_negotiation_notes_one_parent CHECK (
    (negotiation_id IS NOT NULL AND need_id IS NULL) OR
    (negotiation_id IS NULL AND need_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_market_negotiation_notes_negotiation ON public.market_negotiation_notes(negotiation_id);
CREATE INDEX IF NOT EXISTS idx_market_negotiation_notes_need ON public.market_negotiation_notes(need_id);
CREATE INDEX IF NOT EXISTS idx_market_negotiations_assigned ON public.market_negotiations(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_market_club_needs_assigned ON public.market_club_needs(assigned_to_id);

ALTER TABLE public.market_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_club_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_negotiation_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_market_team_members" ON public.market_team_members;
CREATE POLICY "read_market_team_members" ON public.market_team_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_market_team_members" ON public.market_team_members;
CREATE POLICY "write_market_team_members" ON public.market_team_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_market_club_needs" ON public.market_club_needs;
CREATE POLICY "read_market_club_needs" ON public.market_club_needs FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_market_club_needs" ON public.market_club_needs;
CREATE POLICY "write_market_club_needs" ON public.market_club_needs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_market_negotiations" ON public.market_negotiations;
CREATE POLICY "read_market_negotiations" ON public.market_negotiations FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_market_negotiations" ON public.market_negotiations;
CREATE POLICY "write_market_negotiations" ON public.market_negotiations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_market_negotiation_notes" ON public.market_negotiation_notes;
CREATE POLICY "read_market_negotiation_notes" ON public.market_negotiation_notes FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_market_negotiation_notes" ON public.market_negotiation_notes;
CREATE POLICY "write_market_negotiation_notes" ON public.market_negotiation_notes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
