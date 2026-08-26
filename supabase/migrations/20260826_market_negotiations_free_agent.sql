-- El club destino de una negociacion no siempre es conocido de entrada: a
-- veces el objetivo es directamente dejar libre al jugador de su club actual
-- (rescindirle) sin tener todavia un destino puntual. team_id/team_name eran
-- NOT NULL desde el modelo original (que asumia siempre un club destino
-- concreto) -- se relajan para permitir ese caso.
ALTER TABLE public.market_negotiations
  ALTER COLUMN team_id DROP NOT NULL,
  ALTER COLUMN team_name DROP NOT NULL;
