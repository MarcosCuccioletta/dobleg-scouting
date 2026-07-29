-- Datos físicos (GPS) cargados desde la app. Reemplaza al Google Sheet GPS_Data.
-- El catálogo de métricas es extensible: cada club manda nombres distintos y se
-- resuelven una vez vía gps_metric_aliases.

CREATE TABLE IF NOT EXISTS gps_metrics (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key             TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,
  unit            TEXT NOT NULL DEFAULT '',
  decimals        INT  NOT NULL DEFAULT 0,
  category        TEXT NOT NULL DEFAULT 'otro',
  sort_order      INT  NOT NULL DEFAULT 999,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID,
  created_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gps_metric_aliases (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  metric_id  BIGINT NOT NULL REFERENCES gps_metrics(id) ON DELETE CASCADE,
  alias      TEXT NOT NULL UNIQUE,
  source     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gps_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_key      TEXT NOT NULL,
  player_name     TEXT NOT NULL,
  match_date      DATE NOT NULL,
  equipo          TEXT,
  rival           TEXT,
  competencia     TEXT,
  resultado       TEXT,
  minutos         NUMERIC,
  metrics         JSONB NOT NULL DEFAULT '{}'::jsonb,
  source          TEXT NOT NULL DEFAULT 'manual',
  file_name       TEXT,
  created_by      UUID,
  created_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gps_entries_player_key ON gps_entries(player_key);
CREATE INDEX IF NOT EXISTS idx_gps_entries_match_date ON gps_entries(match_date);
-- Identidad de una carga: jugador + fecha + rival. El rival hace falta porque hay
-- datos donde la fecha es la de carga y no la del partido (Echeverría tiene cinco
-- partidos distintos con la misma fecha en el Sheet viejo).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gps_entries_player_date_rival
  ON gps_entries(player_key, match_date, lower(coalesce(rival, '')));

-- RLS: lectura pública + escritura para authenticated (igual que player_videos)
ALTER TABLE public.gps_metrics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_metric_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_entries        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_gps_metrics" ON public.gps_metrics;
CREATE POLICY "read_gps_metrics" ON public.gps_metrics FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_gps_metrics" ON public.gps_metrics;
CREATE POLICY "write_gps_metrics" ON public.gps_metrics
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_gps_aliases" ON public.gps_metric_aliases;
CREATE POLICY "read_gps_aliases" ON public.gps_metric_aliases FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_gps_aliases" ON public.gps_metric_aliases;
CREATE POLICY "write_gps_aliases" ON public.gps_metric_aliases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_gps_entries" ON public.gps_entries;
CREATE POLICY "read_gps_entries" ON public.gps_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_gps_entries" ON public.gps_entries;
CREATE POLICY "write_gps_entries" ON public.gps_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Semilla: las 17 métricas que hoy son columnas del Sheet GPS_Data ───────────
INSERT INTO gps_metrics (key, label, unit, decimals, category, sort_order) VALUES
  ('distancia_total',     'Distancia Total',      'm',     0, 'locomotor',  10),
  ('metros_por_min',      'Mts/min',              'm/min', 1, 'locomotor',  20),
  ('dist_16_21',          'Dist 16-21 km/h',      'm',     0, 'locomotor',  30),
  ('dist_21_24',          'Dist 21-24 km/h',      'm',     0, 'locomotor',  40),
  ('dist_over_24',        'Dist >24 km/h',        'm',     0, 'locomotor',  50),
  ('hsr',                 'HSR >21 km/h',         'm',     0, 'locomotor',  60),
  ('vel_max',             'Vel Máx',              'km/h',  1, 'locomotor',  70),
  ('sprints',             'Sprints',              '',      0, 'locomotor',  80),
  ('alta_intensidad_pct', '% Alta Intensidad',    '%',     1, 'locomotor',  90),
  ('acc_over_2',          'Acc >2 m/s²',          '',      0, 'mecanico',  100),
  ('dec_over_2',          'Dec >2 m/s²',          '',      0, 'mecanico',  110),
  ('acc_over_3',          'Acc >3 m/s²',          '',      0, 'mecanico',  120),
  ('dec_over_3',          'Dec >3 m/s²',          '',      0, 'mecanico',  130),
  ('acc_over_4',          'Acc >4 m/s²',          '',      0, 'mecanico',  140),
  ('dec_over_4',          'Dec >4 m/s²',          '',      0, 'mecanico',  150),
  ('player_load',         'Player Load',          '',      0, 'mecanico',  160),
  ('rhie_bouts',          'RHIE Bouts',           '',      0, 'mecanico',  170)
ON CONFLICT (key) DO NOTHING;

-- Alias iniciales: las cabeceras exactas del Sheet viejo (normalizadas: minúsculas,
-- sin acentos, espacios colapsados) + variantes obvias.
INSERT INTO gps_metric_aliases (metric_id, alias, source)
SELECT m.id, a.alias, 'sheet_gps_data'
FROM (VALUES
  ('distancia_total',     'distancia (m)'),
  ('distancia_total',     'distancia'),
  ('distancia_total',     'dist total'),
  ('metros_por_min',      'mts/min'),
  ('metros_por_min',      'm/min'),
  ('dist_16_21',          'dist 16-21 km/h'),
  ('dist_21_24',          'dist 21-24 km/h'),
  ('dist_over_24',        'dist >24 km/h'),
  ('hsr',                 'hsr >21 km/h'),
  ('hsr',                 'hsr'),
  ('vel_max',             'vel max (km/h)'),
  ('vel_max',             'vel max'),
  ('vel_max',             'v max'),
  ('sprints',             'sprints'),
  ('alta_intensidad_pct', '% alta intensidad'),
  ('acc_over_2',          'acc >2 m/s'),
  ('dec_over_2',          'dec >2 m/s'),
  ('acc_over_3',          'acc >3 m/s²'),
  ('dec_over_3',          'dec >3 m/s²'),
  ('acc_over_4',          'acc >4 m/s'),
  ('dec_over_4',          'dec >4 m/s'),
  ('player_load',         'player load'),
  ('rhie_bouts',          'rhie bouts')
) AS a(metric_key, alias)
JOIN gps_metrics m ON m.key = a.metric_key
ON CONFLICT (alias) DO NOTHING;
