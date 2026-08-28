-- Tabla de entrenadores de la agencia (Domingo, Stillitano, etc.)
CREATE TABLE IF NOT EXISTS public.agency_coaches (
  key TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status = ANY (ARRAY['activo', 'sin_club'])),
  club TEXT,
  api_team_id INT,
  reserve_api_team_id INT,
  league_api_id INT,
  league_name TEXT,
  league_season INT,
  coach_api_id INT,
  relationship TEXT NOT NULL DEFAULT 'propio' CHECK (relationship = ANY (ARRAY['propio', 'intermediado'])),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_coaches_active_idx ON public.agency_coaches(active);

ALTER TABLE public.agency_coaches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_agency_coaches" ON public.agency_coaches;
CREATE POLICY "read_agency_coaches" ON public.agency_coaches FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_agency_coaches" ON public.agency_coaches;
CREATE POLICY "write_agency_coaches" ON public.agency_coaches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.agency_coaches (key, full_name, photo_url, status, club, api_team_id, league_api_id, league_name, league_season, relationship)
VALUES ('domingo', 'Nicolás Domingo', '/coaches/domingo.png', 'activo', 'Temperley', 454, 129, 'Primera Nacional', 2026, 'propio')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.agency_coaches (key, full_name, photo_url, status, club, coach_api_id, relationship)
VALUES ('stillitano', 'Leandro Stillitano', '/coaches/stillitano.png', 'sin_club', NULL, 19200, 'propio')
ON CONFLICT (key) DO NOTHING;
