# Fundamento Multi-Club en Supabase (Doble G / Independiente) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar el proyecto Supabase compartido (`qgwmxjjumauortbwvivu`) para que dos plataformas (Scout Platform / Doble G, y la futura plataforma de Independiente) convivan sin mezclar datos internos, sin romper nada del comportamiento actual de Scout Platform.

**Architecture:** Se agrega una tabla `user_profiles` (usuario → club) y una función SQL `current_club_id()`. Todas las tablas "internas" (propiedad de un club: plantel, entrenadores, negociaciones, GPS, video análisis, clasificaciones de agencia) suman una columna `club_id` con `DEFAULT 'dobleg'` — así el backfill de las filas existentes es automático y Scout Platform no cambia una sola línea de código de la app. Las políticas RLS de esas tablas pasan de "cualquiera lee, cualquier logueado escribe" a "solo lee/escribe quien está logueado y su `club_id` coincide". Las tablas de scouting externo/mercado (compartidas, no pertenecen a un club) quedan sin tocar. Se crea también `club_squads`, tabla nueva para el plantel de un club (no confundir con `agency_players`, que es la cartera de representados de Doble G — ver spec).

**Tech Stack:** PostgreSQL / Supabase (RLS, `auth.uid()`), Supabase CLI (`supabase db push`), SQL migrations versionadas en `supabase/migrations/`.

**Spec:** `docs/superpowers/specs/2026-09-02-independiente-platform-design.md`

## Global Constraints

- `club_id` es siempre `TEXT`, valores conocidos por ahora: `'dobleg'`, `'independiente'`. No es un enum — cualquier club nuevo futuro es solo un valor de texto más, sin migración de schema.
- Toda tabla "interna" nueva debe llevar `club_id NOT NULL` desde su creación (no `DEFAULT`, salvo que ya tenga filas de Doble G que backfillear).
- Ninguna policy hardcodea un club — todas comparan contra `public.current_club_id()`.
- Este plan no toca código de `src/` — es 100% schema SQL. Scout Platform (esta app) sigue funcionando exactamente igual siempre que sus usuarios tengan fila en `user_profiles` con `club_id = 'dobleg'` (Task 5).
- Después de este plan, las tablas internas dejan de ser legibles por usuarios anónimos (hoy lo eran) — solo por `authenticated` con `club_id` que matchea. Es intencional (ver spec, sección 2) y se verifica explícitamente en Task 6.
- Todas las migraciones se aplican al proyecto remoto compartido con `supabase db push` (mismo mecanismo ya usado en este repo, ver `supabase/config.toml`, `project_id = "primer-appcloud"`). Si el CLI pide login, avisar al usuario en vez de pedirle que corra el comando — probar primero si ya hay sesión activa con `npx supabase projects list`.

---

### Task 1: `user_profiles` + `current_club_id()`

**Files:**
- Create: `supabase/migrations/20260902_a_multi_club_foundation.sql`

**Interfaces:**
- Produces: tabla `public.user_profiles(user_id uuid primary key, club_id text not null, created_at timestamptz)`; función `public.current_club_id() returns text` — usada por las policies de las Tasks 3 y 4.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260902_a_multi_club_foundation.sql
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
-- hecha con la service_role key (que bypassea RLS) — nunca desde la app. Ver Task 5.

CREATE OR REPLACE FUNCTION public.current_club_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT club_id FROM public.user_profiles WHERE user_id = auth.uid()
$$;
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase db push`
Expected: la migración se aplica sin errores contra el proyecto remoto (`project_id = "primer-appcloud"`).

- [ ] **Step 3: Verificar en el dashboard de Supabase**

Confirmar en Table Editor que `user_profiles` existe con las columnas esperadas y RLS habilitado, y en Database → Functions que `current_club_id` existe.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260902_a_multi_club_foundation.sql
git commit -m "feat(multi-club): agrega user_profiles y current_club_id()"
```

---

### Task 2: Columna `club_id` en las tablas internas existentes

**Files:**
- Create: `supabase/migrations/20260902_b_club_id_columns.sql`

**Interfaces:**
- Consumes: nada (no depende de `current_club_id()`, solo agrega columnas).
- Produces: columna `club_id TEXT NOT NULL DEFAULT 'dobleg'` en las 19 tablas internas listadas abajo — consumida por las policies de Task 4.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260902_b_club_id_columns.sql
-- Cada tabla "interna" (propiedad de un club, no del pool de scouting/mercado compartido)
-- suma club_id. DEFAULT 'dobleg' hace que las filas existentes (todas de Doble G) queden
-- clasificadas solas, y que Scout Platform siga funcionando sin cambiar código de la app.

ALTER TABLE public.agency_classifications        ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.agency_classification_history  ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.agency_players                  ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.agency_coaches                  ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.agency_manual_fixtures          ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_future_squads             ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_match_notes               ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_match_team_stats          ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_tactical_boards           ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_training_sessions         ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_video_analysis_buckets    ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_video_analysis_matches    ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.market_negotiations             ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.market_negotiation_notes        ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.market_club_needs               ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.market_need_candidates          ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.market_team_members             ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.gps_entries                     ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.player_videos                   ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';

CREATE INDEX IF NOT EXISTS idx_agency_classifications_club       ON public.agency_classifications(club_id);
CREATE INDEX IF NOT EXISTS idx_agency_classification_history_club ON public.agency_classification_history(club_id);
CREATE INDEX IF NOT EXISTS idx_agency_players_club                ON public.agency_players(club_id);
CREATE INDEX IF NOT EXISTS idx_agency_coaches_club                ON public.agency_coaches(club_id);
CREATE INDEX IF NOT EXISTS idx_agency_manual_fixtures_club        ON public.agency_manual_fixtures(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_future_squads_club           ON public.coach_future_squads(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_match_notes_club             ON public.coach_match_notes(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_match_team_stats_club        ON public.coach_match_team_stats(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_tactical_boards_club         ON public.coach_tactical_boards(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_training_sessions_club       ON public.coach_training_sessions(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_video_analysis_buckets_club  ON public.coach_video_analysis_buckets(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_video_analysis_matches_club  ON public.coach_video_analysis_matches(club_id);
CREATE INDEX IF NOT EXISTS idx_market_negotiations_club           ON public.market_negotiations(club_id);
CREATE INDEX IF NOT EXISTS idx_market_negotiation_notes_club      ON public.market_negotiation_notes(club_id);
CREATE INDEX IF NOT EXISTS idx_market_club_needs_club             ON public.market_club_needs(club_id);
CREATE INDEX IF NOT EXISTS idx_market_need_candidates_club        ON public.market_need_candidates(club_id);
CREATE INDEX IF NOT EXISTS idx_market_team_members_club           ON public.market_team_members(club_id);
CREATE INDEX IF NOT EXISTS idx_gps_entries_club                   ON public.gps_entries(club_id);
CREATE INDEX IF NOT EXISTS idx_player_videos_club                 ON public.player_videos(club_id);
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase db push`
Expected: aplica sin errores. Ninguna tabla tiene filas nuevas ni pierde filas — solo suma una columna con default.

- [ ] **Step 3: Verificar en el dashboard de Supabase**

Elegir 2-3 de las tablas (ej. `market_negotiations`, `gps_entries`) en Table Editor y confirmar que todas las filas existentes tienen `club_id = 'dobleg'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260902_b_club_id_columns.sql
git commit -m "feat(multi-club): agrega club_id (default dobleg) a las tablas internas"
```

---

### Task 3: Tabla `club_squads` (plantel de un club — nueva, no confundir con `agency_players`)

**Files:**
- Create: `supabase/migrations/20260902_c_club_squads.sql`

**Interfaces:**
- Consumes: `public.current_club_id()` (Task 1).
- Produces: tabla `public.club_squads(id, club_id, category, source, full_name, short_name, position, birth_date, api_player_id, supabase_player_id, image, created_at, updated_at)` — la va a usar la plataforma de Independiente (fuera de este plan) para su plantel por categoría.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260902_c_club_squads.sql
-- Plantel de un club por categoría (primera/reserva/inferiores/femenino/...). Distinto de
-- agency_players, que es la cartera de representados de Doble G (jugadores en clubes ajenos).
-- Tabla nueva, sin filas previas: club_id es NOT NULL sin DEFAULT.

CREATE TABLE IF NOT EXISTS public.club_squads (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id            TEXT NOT NULL,
  category           TEXT NOT NULL,
  source             TEXT NOT NULL CHECK (source IN ('api_football', 'manual')),
  full_name          TEXT NOT NULL,
  short_name         TEXT,
  position           TEXT,
  birth_date         DATE,
  api_player_id      INTEGER,
  supabase_player_id INTEGER REFERENCES public.players(id),
  image              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_squads_club_category ON public.club_squads(club_id, category);

ALTER TABLE public.club_squads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_club_squads" ON public.club_squads;
CREATE POLICY "read_club_squads" ON public.club_squads
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());

DROP POLICY IF EXISTS "write_club_squads" ON public.club_squads;
CREATE POLICY "write_club_squads" ON public.club_squads
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase db push`
Expected: aplica sin errores.

- [ ] **Step 3: Verificar en el dashboard de Supabase**

Confirmar en Table Editor que `club_squads` existe, vacía, con RLS habilitado y las dos policies visibles en la pestaña Policies.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260902_c_club_squads.sql
git commit -m "feat(multi-club): agrega tabla club_squads para plantel por club/categoria"
```

---

### Task 4: Políticas RLS por club en las 19 tablas internas

**Files:**
- Create: `supabase/migrations/20260902_d_club_scoped_rls.sql`

**Interfaces:**
- Consumes: `public.current_club_id()` (Task 1), columna `club_id` de las 19 tablas (Task 2).
- Produces: reemplaza las policies permisivas de esas tablas — a partir de acá solo `authenticated` con `club_id` propio puede leer/escribir cada una.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260902_d_club_scoped_rls.sql
-- Reemplaza las policies permisivas ("cualquiera lee, cualquier logueado escribe") de las
-- tablas internas por policies que exigen club_id = current_club_id(). A partir de acá,
-- un usuario sin login o con el club_id equivocado no ve ni puede escribir estas filas.

-- agency_classifications
DROP POLICY IF EXISTS "read_agency_classifications" ON public.agency_classifications;
CREATE POLICY "read_agency_classifications" ON public.agency_classifications
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_agency_classifications" ON public.agency_classifications;
CREATE POLICY "write_agency_classifications" ON public.agency_classifications
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- agency_classification_history
DROP POLICY IF EXISTS "read_agency_classification_history" ON public.agency_classification_history;
CREATE POLICY "read_agency_classification_history" ON public.agency_classification_history
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_agency_classification_history" ON public.agency_classification_history;
CREATE POLICY "write_agency_classification_history" ON public.agency_classification_history
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- agency_players
DROP POLICY IF EXISTS "read_agency_players" ON public.agency_players;
CREATE POLICY "read_agency_players" ON public.agency_players
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_agency_players" ON public.agency_players;
CREATE POLICY "write_agency_players" ON public.agency_players
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- agency_coaches
DROP POLICY IF EXISTS "read_agency_coaches" ON public.agency_coaches;
CREATE POLICY "read_agency_coaches" ON public.agency_coaches
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_agency_coaches" ON public.agency_coaches;
CREATE POLICY "write_agency_coaches" ON public.agency_coaches
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- agency_manual_fixtures
DROP POLICY IF EXISTS "read_agency_manual_fixtures" ON public.agency_manual_fixtures;
CREATE POLICY "read_agency_manual_fixtures" ON public.agency_manual_fixtures
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_agency_manual_fixtures" ON public.agency_manual_fixtures;
CREATE POLICY "write_agency_manual_fixtures" ON public.agency_manual_fixtures
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_future_squads
DROP POLICY IF EXISTS "read_coach_future_squads" ON public.coach_future_squads;
CREATE POLICY "read_coach_future_squads" ON public.coach_future_squads
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_coach_future_squads" ON public.coach_future_squads;
CREATE POLICY "write_coach_future_squads" ON public.coach_future_squads
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_match_notes
DROP POLICY IF EXISTS "read_coach_match_notes" ON public.coach_match_notes;
CREATE POLICY "read_coach_match_notes" ON public.coach_match_notes
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_coach_match_notes" ON public.coach_match_notes;
CREATE POLICY "write_coach_match_notes" ON public.coach_match_notes
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_match_team_stats
DROP POLICY IF EXISTS "read_coach_match_team_stats" ON public.coach_match_team_stats;
CREATE POLICY "read_coach_match_team_stats" ON public.coach_match_team_stats
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_coach_match_team_stats" ON public.coach_match_team_stats;
CREATE POLICY "write_coach_match_team_stats" ON public.coach_match_team_stats
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_tactical_boards
DROP POLICY IF EXISTS "read_coach_tactical_boards" ON public.coach_tactical_boards;
CREATE POLICY "read_coach_tactical_boards" ON public.coach_tactical_boards
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_coach_tactical_boards" ON public.coach_tactical_boards;
CREATE POLICY "write_coach_tactical_boards" ON public.coach_tactical_boards
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_training_sessions
DROP POLICY IF EXISTS "read_coach_training_sessions" ON public.coach_training_sessions;
CREATE POLICY "read_coach_training_sessions" ON public.coach_training_sessions
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_coach_training_sessions" ON public.coach_training_sessions;
CREATE POLICY "write_coach_training_sessions" ON public.coach_training_sessions
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_video_analysis_buckets
DROP POLICY IF EXISTS "read_cvab" ON public.coach_video_analysis_buckets;
CREATE POLICY "read_cvab" ON public.coach_video_analysis_buckets
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_cvab" ON public.coach_video_analysis_buckets;
CREATE POLICY "write_cvab" ON public.coach_video_analysis_buckets
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_video_analysis_matches
DROP POLICY IF EXISTS "read_cvam" ON public.coach_video_analysis_matches;
CREATE POLICY "read_cvam" ON public.coach_video_analysis_matches
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_cvam" ON public.coach_video_analysis_matches;
CREATE POLICY "write_cvam" ON public.coach_video_analysis_matches
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- market_negotiations
DROP POLICY IF EXISTS "read_market_negotiations" ON public.market_negotiations;
CREATE POLICY "read_market_negotiations" ON public.market_negotiations
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_market_negotiations" ON public.market_negotiations;
CREATE POLICY "write_market_negotiations" ON public.market_negotiations
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- market_negotiation_notes
DROP POLICY IF EXISTS "read_market_negotiation_notes" ON public.market_negotiation_notes;
CREATE POLICY "read_market_negotiation_notes" ON public.market_negotiation_notes
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_market_negotiation_notes" ON public.market_negotiation_notes;
CREATE POLICY "write_market_negotiation_notes" ON public.market_negotiation_notes
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- market_club_needs
DROP POLICY IF EXISTS "read_market_club_needs" ON public.market_club_needs;
CREATE POLICY "read_market_club_needs" ON public.market_club_needs
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_market_club_needs" ON public.market_club_needs;
CREATE POLICY "write_market_club_needs" ON public.market_club_needs
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- market_need_candidates
DROP POLICY IF EXISTS "read_market_need_candidates" ON public.market_need_candidates;
CREATE POLICY "read_market_need_candidates" ON public.market_need_candidates
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_market_need_candidates" ON public.market_need_candidates;
CREATE POLICY "write_market_need_candidates" ON public.market_need_candidates
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- market_team_members
DROP POLICY IF EXISTS "read_market_team_members" ON public.market_team_members;
CREATE POLICY "read_market_team_members" ON public.market_team_members
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_market_team_members" ON public.market_team_members;
CREATE POLICY "write_market_team_members" ON public.market_team_members
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- gps_entries
DROP POLICY IF EXISTS "read_gps_entries" ON public.gps_entries;
CREATE POLICY "read_gps_entries" ON public.gps_entries
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_gps_entries" ON public.gps_entries;
CREATE POLICY "write_gps_entries" ON public.gps_entries
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- player_videos
DROP POLICY IF EXISTS "read_player_videos" ON public.player_videos;
CREATE POLICY "read_player_videos" ON public.player_videos
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_player_videos" ON public.player_videos;
CREATE POLICY "write_player_videos" ON public.player_videos
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase db push`
Expected: aplica sin errores.

- [ ] **Step 3: Verificar en el dashboard de Supabase**

En Authentication → Policies, para 3-4 de estas tablas (ej. `market_negotiations`, `gps_entries`, `coach_tactical_boards`), confirmar que las policies de SELECT/ALL muestran la condición `club_id = current_club_id()` y no `true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260902_d_club_scoped_rls.sql
git commit -m "feat(multi-club): RLS de tablas internas filtra por club_id en vez de ser publica"
```

---

### Task 5: Alta manual de los usuarios de Doble G en `user_profiles`

**Files:** ninguno (paso operativo, corrido a mano contra Supabase con la `service_role` key — nunca se commitea una service key al repo).

**Interfaces:**
- Consumes: tabla `user_profiles` (Task 1). Requiere la lista real de emails del equipo de Doble G que hoy usa Scout Platform — pedírsela al usuario antes de este paso si no la tenés.

- [ ] **Step 1: Pedir al usuario la lista de emails del equipo de Doble G que loguea en Scout Platform hoy**

(Son los únicos que necesitan fila en `user_profiles` para seguir viendo datos internos después de este plan — ver el constraint global sobre lectura pública.)

- [ ] **Step 2: Insertar cada uno con `club_id = 'dobleg'`**

Correr en el SQL Editor del dashboard de Supabase (como `postgres`, bypassea RLS) — reemplazar `<email>` por cada email real:

```sql
INSERT INTO public.user_profiles (user_id, club_id)
SELECT id, 'dobleg' FROM auth.users WHERE email = '<email>'
ON CONFLICT (user_id) DO UPDATE SET club_id = EXCLUDED.club_id;
```

- [ ] **Step 3: Verificar**

```sql
SELECT u.email, p.club_id FROM public.user_profiles p JOIN auth.users u ON u.id = p.user_id;
```

Expected: una fila por cada email de Doble G dado de alta, todas con `club_id = 'dobleg'`.

No hay commit en este task (no genera archivos).

---

### Task 6: Verificación de regresión de Scout Platform

**Files:** ninguno.

**Interfaces:** ninguna — task de verificación pura.

- [ ] **Step 1: Correr la suite de tests existente**

Run: `npm test`
Expected: PASS, sin regresiones (este plan no tocó `src/`, así que no debería haber cambios en absoluto en los resultados respecto de antes del plan).

- [ ] **Step 2: Smoke test logueado**

Correr `npm run dev`, loguearse con una de las cuentas dadas de alta en Task 5, y confirmar que las siguientes pantallas muestran los mismos datos que antes del plan: `/interno` (Scouting Interno), `/entrenadores` (lista y ficha de un entrenador), `/mercado` (negociaciones), `/carga-gps` seguido de `/seguimiento-datos`, `/clasificacion-interna`.

- [ ] **Step 3: Smoke test deslogueado**

Cerrar sesión (o abrir una ventana de incógnito) y confirmar que esas mismas pantallas ahora aparecen vacías o con el estado de "sin datos" del componente `EmptyState` — no rompen ni tiran error de consola, simplemente no muestran las filas de Doble G (comportamiento nuevo esperado, ver Global Constraints).

- [ ] **Step 4: Confirmar scouting externo/mercado compartido sin cambios**

Con la sesión deslogueada, confirmar que `/scouting` (Scouting Externo) sigue mostrando datos igual que siempre — esas tablas no se tocaron en este plan.

No hay commit en este task (no genera archivos; si algo falla, se abre un fix como parte de las tasks anteriores, no acá).
