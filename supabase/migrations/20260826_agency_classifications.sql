-- Clasificacion interna de jugadores de la agencia (Clase A / B / C), nueva
-- sub-pagina "Clasificacion Interna" en Scout Interno. player_key es el mismo
-- identityKey() (nombre normalizado sin acentos) que ya usa mergeAgencyIntoInternal
-- en DataContext.tsx para matchear jugadores de agencyPlayers.ts contra el resto
-- de la plataforma -- misma clave, una sola fuente de verdad de identidad.

CREATE TABLE IF NOT EXISTS public.agency_classifications (
  player_key   TEXT PRIMARY KEY,
  player_name  TEXT NOT NULL,
  class        TEXT NOT NULL CHECK (class IN ('A', 'B', 'C')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_name TEXT
);

-- Historial de cambios de clase: permite calcular movimiento neto (cuantos
-- subieron/bajaron de Clase A en los ultimos N dias) para el widget de Panel
-- Interno, sin necesidad de reconstruir snapshots del pasado.
CREATE TABLE IF NOT EXISTS public.agency_classification_history (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_key      TEXT NOT NULL,
  player_name     TEXT NOT NULL,
  previous_class  TEXT CHECK (previous_class IN ('A', 'B', 'C')),
  new_class       TEXT NOT NULL CHECK (new_class IN ('A', 'B', 'C')),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_agency_classification_history_changed_at ON public.agency_classification_history(changed_at);

ALTER TABLE public.agency_classifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_classification_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_agency_classifications" ON public.agency_classifications;
CREATE POLICY "read_agency_classifications" ON public.agency_classifications FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_agency_classifications" ON public.agency_classifications;
CREATE POLICY "write_agency_classifications" ON public.agency_classifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_agency_classification_history" ON public.agency_classification_history;
CREATE POLICY "read_agency_classification_history" ON public.agency_classification_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_agency_classification_history" ON public.agency_classification_history;
CREATE POLICY "write_agency_classification_history" ON public.agency_classification_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
