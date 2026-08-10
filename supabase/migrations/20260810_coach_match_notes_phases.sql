-- Notas de partido divididas por fase de juego. `note` (una sola nota libre)
-- deja de escribirse desde la app pero se conserva; las notas ya cargadas se
-- migran a `observaciones` para no perder nada.
ALTER TABLE public.coach_match_notes
  ALTER COLUMN note DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS defensiva TEXT,
  ADD COLUMN IF NOT EXISTS ofensiva TEXT,
  ADD COLUMN IF NOT EXISTS transiciones TEXT,
  ADD COLUMN IF NOT EXISTS abp TEXT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

UPDATE public.coach_match_notes
SET observaciones = note
WHERE observaciones IS NULL AND note IS NOT NULL AND note <> '';
