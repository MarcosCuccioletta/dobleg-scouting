-- Para que la campanita de alertas sepa realmente "de quien es" cada
-- negociacion (no por coincidencia de nombre, que se rompe con cualquier
-- variante de escritura), cada persona de la agencia puede vincularse a su
-- cuenta real de la app.
ALTER TABLE public.market_team_members
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Vincula a Marcos con su cuenta real y agrega a Matias, el otro admin con
-- permiso para vincular jugadores de la API (ver MARKET_LINK_ADMIN_EMAILS).
UPDATE public.market_team_members
SET user_id = (SELECT id FROM auth.users WHERE email = 'marcoscucho99@gmail.com')
WHERE name = 'Marcos';

INSERT INTO public.market_team_members (name, active, user_id)
SELECT 'Matías Roberti', true, id FROM auth.users WHERE email = 'matiassebastianroberti@gmail.com'
ON CONFLICT DO NOTHING;
