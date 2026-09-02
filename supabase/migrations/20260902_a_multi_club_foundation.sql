-- Fundamento multi-club: perfil de usuario -> club, y función que lo expone a las policies de RLS.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Un usuario puede leer su propia fila (para que el front-end sepa su club_id tras loguearse).
DROP POLICY IF EXISTS "read_own_profile" ON public.user_profiles;
CREATE POLICY "read_own_profile" ON public.user_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Sin policy de INSERT/UPDATE/DELETE para `authenticated`: el alta de perfiles es manual,
-- hecha con la service_role key (que bypassea RLS) — nunca desde la app.

CREATE OR REPLACE FUNCTION public.current_club_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT club_id FROM public.user_profiles WHERE user_id = auth.uid()
$$;
