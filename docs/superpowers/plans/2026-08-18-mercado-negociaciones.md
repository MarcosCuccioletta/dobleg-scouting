# Mercado (Negociaciones y Objetivos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Mercado" page where the agency tracks club needs ("Objetivos") and player-to-club negotiations ("Negociaciones"), with a responsible-per-item assignment, a chronological notes/meetings timeline, and client-computed follow-up alerts (navbar badge + on-page banner).

**Architecture:** Three new Supabase tables (`market_team_members`, `market_club_needs`, `market_negotiations`) plus a shared notes table (`market_negotiation_notes`) that belongs to either a need or a negotiation. Clubs are looked up from the existing `teams` table (already synced from API-Football) — no new club catalog. Player photos come from the existing `media.api-sports.io/football/players/{id}.png` URL convention once a negotiation is linked to a `player_api_id`; linking can happen at creation or any time later via the detail view. Alerts are computed client-side from `next_followup_date` + `status`, no cron/email.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, Supabase (Postgres + RLS), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-18-mercado-negociaciones-design.md`

## Global Constraints

- Cards, not dense tables — the page is used by non-technical staff on desktop, tablet, and mobile equally.
- Club shields render via the existing `TeamLogo` component with a `drop-shadow-md` class — every club-identifying UI element in this feature must show the shield, not just the name.
- Player photos only render when `player_api_id` is set on the negotiation; the field is optional at creation and must remain editable afterward from the detail view (this is explicitly the main day-to-day workflow the user described: entering later to add the API player link).
- No email/push/cron for alerts — computed client-side from data already loaded, exactly like the rest of this app's data flow.
- RLS pattern for all four new tables: `FOR SELECT USING (true)`, `FOR ALL TO authenticated USING (true) WITH CHECK (true)` — same as `manual_external_players` (existing precedent in `supabase/migrations/20260810_manual_external_players.sql`).
- `assigned_to_id`/`assigned_to_name` and `created_by_id`/`created_by_name` follow the existing snapshot-name convention used by `agency_players` (`added_by`/`added_by_name`) — the id for lookups, the name frozen so history reads correctly even if the referenced row is later renamed or removed.
- Reassigning a negotiation or need must insert an automatic `is_system = true` note recording the handoff — this is how "no se pisen" stays auditable without extra UI.

---

### Task 1: Database schema

**Files:**
- Create: `supabase/migrations/20260818_market_negotiations.sql`

**Interfaces:**
- Produces: tables `market_team_members(id, name, active, created_at)`, `market_club_needs(id, team_id, team_name, team_logo, position_label, status, assigned_to_id, assigned_to_name, next_followup_date, created_by_id, created_by_name, created_at, updated_at)`, `market_negotiations(id, team_id, team_name, team_logo, player_name, player_api_id, player_source, contact_name, contact_role, status, assigned_to_id, assigned_to_name, next_followup_date, created_by_id, created_by_name, created_at, updated_at)`, `market_negotiation_notes(id, negotiation_id, need_id, body, is_meeting, is_system, author_id, author_name, created_at)`. Task 2 (`marketService.ts`) reads/writes these tables by these exact column names.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260818_market_negotiations.sql`:

```sql
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
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` (or the project's established migration-apply command — check `package.json` scripts for a `db:push`/`migrate` script first and prefer that if one exists; if genuinely unsure which command this project uses, check how the most recent prior migration, `supabase/migrations/20260811_merge_season_score_fragments.sql`, was applied by checking for related shell history or scripts in `scripts/`, but the Supabase CLI push command above is the standard path and should work directly against the linked project).

Expected: command reports the new migration applied, no errors.

- [ ] **Step 3: Verify the tables exist**

Run a quick read-only check with the anon key (same technique used elsewhere in this session):

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/market_team_members?select=id" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
```

Expected: `[]` (empty array, not a 404/permission error) for all four tables (`market_team_members`, `market_club_needs`, `market_negotiations`, `market_negotiation_notes`).

- [ ] **Step 4: Seed the team members table with at least the current user**

This table starts empty and nothing in the UI can assign a negotiation until at least one row exists. Insert one row for whoever is running this plan, via the Supabase SQL editor or a one-off `curl` POST:

```bash
curl -s -X POST "$VITE_SUPABASE_URL/rest/v1/market_team_members" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"name": "Marcos"}'
```

Expected: 201 with the created row. (More names can be added later from the app itself once Task 6's form exists — this step only unblocks manual testing of the tasks before that.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260818_market_negotiations.sql
git commit -m "feat(mercado): tablas de negociaciones, objetivos, notas y miembros del equipo"
```

---

### Task 2: Types, data access, and alert logic

**Files:**
- Create: `src/types/market.ts`
- Create: `src/services/marketService.ts`
- Create: `src/utils/marketAlerts.ts`
- Create: `src/utils/marketAlerts.test.ts`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`.
- Produces: types `TeamMember`, `NeedStatus`, `NegotiationStatus`, `ClubNeed`, `Negotiation`, `MarketNote`, `MarketTeamSearchResult` (all exported from `src/types/market.ts`); functions `fetchTeamMembers`, `searchMarketTeams`, `fetchClubNeeds`, `fetchNegotiations`, `createClubNeed`, `createNegotiation`, `updateNeedStatus`, `updateNegotiationStatus`, `linkNegotiationPlayer`, `reassignNeed`, `reassignNegotiation`, `fetchNotesFor`, `addNoteTo` (all exported from `src/services/marketService.ts`); `computeAlerts`, `countMeetings`, `buildPlayerPhotoUrl` (all exported from `src/utils/marketAlerts.ts`). Tasks 3-8 import from these three files only — no task after this one talks to Supabase directly.

- [ ] **Step 1: Create the type definitions**

Create `src/types/market.ts`:

```ts
export interface TeamMember {
  id: number
  name: string
  active: boolean
}

export type NeedStatus = 'abierto' | 'cerrado'
export type NegotiationStatus = 'contactado' | 'reunion' | 'oferta_enviada' | 'en_espera' | 'cerrado_exitoso' | 'cerrado_rechazado'

export interface ClubNeed {
  id: number
  team_id: number
  team_name: string
  team_logo: string | null
  position_label: string
  status: NeedStatus
  assigned_to_id: number | null
  assigned_to_name: string | null
  next_followup_date: string | null
  created_by_id: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface Negotiation {
  id: number
  team_id: number
  team_name: string
  team_logo: string | null
  player_name: string
  player_api_id: number | null
  player_source: 'interno' | 'externo' | null
  contact_name: string | null
  contact_role: string | null
  status: NegotiationStatus
  assigned_to_id: number | null
  assigned_to_name: string | null
  next_followup_date: string | null
  created_by_id: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface MarketNote {
  id: number
  negotiation_id: number | null
  need_id: number | null
  body: string
  is_meeting: boolean
  is_system: boolean
  author_id: string | null
  author_name: string | null
  created_at: string
}

export interface MarketTeamSearchResult {
  id: number
  name: string
  logo: string | null
}
```

- [ ] **Step 2: Write the failing tests for the pure alert logic**

Create `src/utils/marketAlerts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeAlerts, countMeetings, buildPlayerPhotoUrl, type AlertableItem } from './marketAlerts'

function item(over: Partial<AlertableItem> & Pick<AlertableItem, 'id' | 'kind'>): AlertableItem {
  return { status: 'contactado', assigned_to_id: null, next_followup_date: null, ...over }
}

describe('computeAlerts', () => {
  const today = new Date('2026-08-18')

  it('marca "vencido" un seguimiento con fecha de hoy o anterior', () => {
    const items = [item({ id: 1, kind: 'negotiation', next_followup_date: '2026-08-18' }), item({ id: 2, kind: 'negotiation', next_followup_date: '2026-08-10' })]
    const alerts = computeAlerts(items, today)
    expect(alerts.map(a => a.urgency)).toEqual(['vencido', 'vencido'])
  })

  it('marca "proximo" un seguimiento entre mañana y 3 días', () => {
    const items = [item({ id: 1, kind: 'need', next_followup_date: '2026-08-20' })]
    const alerts = computeAlerts(items, today)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].urgency).toBe('proximo')
  })

  it('no incluye seguimientos a mas de 3 dias', () => {
    const items = [item({ id: 1, kind: 'need', next_followup_date: '2026-08-25' })]
    expect(computeAlerts(items, today)).toHaveLength(0)
  })

  it('no incluye items sin fecha de seguimiento', () => {
    const items = [item({ id: 1, kind: 'negotiation', next_followup_date: null })]
    expect(computeAlerts(items, today)).toHaveLength(0)
  })

  it('excluye negociaciones y objetivos cerrados aunque tengan fecha vencida', () => {
    const items = [
      item({ id: 1, kind: 'negotiation', status: 'cerrado_exitoso', next_followup_date: '2026-08-01' }),
      item({ id: 2, kind: 'negotiation', status: 'cerrado_rechazado', next_followup_date: '2026-08-01' }),
      item({ id: 3, kind: 'need', status: 'cerrado', next_followup_date: '2026-08-01' }),
    ]
    expect(computeAlerts(items, today)).toHaveLength(0)
  })

  it('ordena vencidos antes que proximos', () => {
    const items = [
      item({ id: 1, kind: 'need', next_followup_date: '2026-08-20' }),
      item({ id: 2, kind: 'negotiation', next_followup_date: '2026-08-15' }),
    ]
    const alerts = computeAlerts(items, today)
    expect(alerts.map(a => a.id)).toEqual([2, 1])
  })
})

describe('countMeetings', () => {
  it('cuenta solo las notas marcadas como reunion', () => {
    const notes = [{ is_meeting: true }, { is_meeting: false }, { is_meeting: true }]
    expect(countMeetings(notes)).toBe(2)
  })

  it('con una lista vacia, devuelve 0', () => {
    expect(countMeetings([])).toBe(0)
  })
})

describe('buildPlayerPhotoUrl', () => {
  it('construye la URL de API-Football a partir del id', () => {
    expect(buildPlayerPhotoUrl(5917)).toBe('https://media.api-sports.io/football/players/5917.png')
  })

  it('sin id, devuelve null', () => {
    expect(buildPlayerPhotoUrl(null)).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/utils/marketAlerts.test.ts`
Expected: FAIL — cannot find module `./marketAlerts`.

- [ ] **Step 4: Implement `marketAlerts.ts`**

Create `src/utils/marketAlerts.ts`:

```ts
export interface AlertableItem {
  id: number
  kind: 'negotiation' | 'need'
  status: string
  assigned_to_id: number | null
  next_followup_date: string | null
}

export interface MarketAlert extends AlertableItem {
  urgency: 'vencido' | 'proximo'
}

const CLOSED_STATUSES = new Set(['cerrado', 'cerrado_exitoso', 'cerrado_rechazado'])
const UPCOMING_WINDOW_DAYS = 3

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((to.getTime() - from.getTime()) / msPerDay)
}

/**
 * Vencido: fecha de seguimiento hoy o anterior. Proximo: entre mañana y
 * `UPCOMING_WINDOW_DAYS` días. Se excluyen los items cerrados aunque tengan
 * fecha vencida — cerrar una negociación/objetivo apaga su alerta.
 */
export function computeAlerts(items: AlertableItem[], today: Date): MarketAlert[] {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const alerts: MarketAlert[] = []
  for (const item of items) {
    if (CLOSED_STATUSES.has(item.status)) continue
    if (!item.next_followup_date) continue
    const [y, m, d] = item.next_followup_date.split('-').map(Number)
    const dueDate = new Date(y, m - 1, d)
    const diff = daysBetween(todayMidnight, dueDate)
    if (diff > UPCOMING_WINDOW_DAYS) continue
    alerts.push({ ...item, urgency: diff <= 0 ? 'vencido' : 'proximo' })
  }

  return alerts.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'vencido' ? -1 : 1
    return (a.next_followup_date ?? '').localeCompare(b.next_followup_date ?? '')
  })
}

export function countMeetings(notes: { is_meeting: boolean }[]): number {
  return notes.filter(n => n.is_meeting).length
}

export function buildPlayerPhotoUrl(playerApiId: number | null): string | null {
  if (!playerApiId) return null
  return `https://media.api-sports.io/football/players/${playerApiId}.png`
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/utils/marketAlerts.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 6: Implement `marketService.ts`**

Create `src/services/marketService.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { TeamMember, ClubNeed, Negotiation, MarketNote, MarketTeamSearchResult, NeedStatus, NegotiationStatus } from '@/types/market'

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('market_team_members')
    .select('id, name, active')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function searchMarketTeams(query: string): Promise<MarketTeamSearchResult[]> {
  if (!query.trim()) return []
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, logo')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function fetchClubNeeds(): Promise<ClubNeed[]> {
  const { data, error } = await supabase
    .from('market_club_needs')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchNegotiations(): Promise<Negotiation[]> {
  const { data, error } = await supabase
    .from('market_negotiations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export interface CreateClubNeedInput {
  team_id: number
  team_name: string
  team_logo: string | null
  position_label: string
  assigned_to_id: number | null
  assigned_to_name: string | null
  next_followup_date: string | null
}

export async function createClubNeed(input: CreateClubNeedInput, createdById: string | null, createdByName: string): Promise<ClubNeed | null> {
  const { data, error } = await supabase
    .from('market_club_needs')
    .insert({ ...input, created_by_id: createdById, created_by_name: createdByName })
    .select()
    .single()
  if (error) { console.error('createClubNeed error:', error); return null }
  return data
}

export interface CreateNegotiationInput {
  team_id: number
  team_name: string
  team_logo: string | null
  player_name: string
  player_api_id: number | null
  player_source: 'interno' | 'externo' | null
  contact_name: string | null
  contact_role: string | null
  assigned_to_id: number | null
  assigned_to_name: string | null
  next_followup_date: string | null
}

export async function createNegotiation(input: CreateNegotiationInput, createdById: string | null, createdByName: string): Promise<Negotiation | null> {
  const { data, error } = await supabase
    .from('market_negotiations')
    .insert({ ...input, created_by_id: createdById, created_by_name: createdByName })
    .select()
    .single()
  if (error) { console.error('createNegotiation error:', error); return null }
  return data
}

export async function updateNeedStatus(id: number, status: NeedStatus): Promise<boolean> {
  const { error } = await supabase.from('market_club_needs').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('updateNeedStatus error:', error); return false }
  return true
}

export async function updateNegotiationStatus(id: number, status: NegotiationStatus): Promise<boolean> {
  const { error } = await supabase.from('market_negotiations').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('updateNegotiationStatus error:', error); return false }
  return true
}

export async function linkNegotiationPlayer(id: number, playerApiId: number, playerSource: 'interno' | 'externo' | null): Promise<boolean> {
  const { error } = await supabase
    .from('market_negotiations')
    .update({ player_api_id: playerApiId, player_source: playerSource, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('linkNegotiationPlayer error:', error); return false }
  return true
}

/** Reasigna y deja una nota automática con el historial del cambio. */
export async function reassignNeed(id: number, newAssigneeId: number, newAssigneeName: string, actingUserName: string): Promise<boolean> {
  const { data: current } = await supabase.from('market_club_needs').select('assigned_to_name').eq('id', id).single()
  const { error } = await supabase
    .from('market_club_needs')
    .update({ assigned_to_id: newAssigneeId, assigned_to_name: newAssigneeName, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('reassignNeed error:', error); return false }
  const fromName = current?.assigned_to_name ?? 'sin responsable'
  await supabase.from('market_negotiation_notes').insert({
    need_id: id,
    body: `${actingUserName} reasignó de ${fromName} a ${newAssigneeName}.`,
    is_system: true,
    author_name: actingUserName,
  })
  return true
}

export async function reassignNegotiation(id: number, newAssigneeId: number, newAssigneeName: string, actingUserName: string): Promise<boolean> {
  const { data: current } = await supabase.from('market_negotiations').select('assigned_to_name').eq('id', id).single()
  const { error } = await supabase
    .from('market_negotiations')
    .update({ assigned_to_id: newAssigneeId, assigned_to_name: newAssigneeName, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('reassignNegotiation error:', error); return false }
  const fromName = current?.assigned_to_name ?? 'sin responsable'
  await supabase.from('market_negotiation_notes').insert({
    negotiation_id: id,
    body: `${actingUserName} reasignó de ${fromName} a ${newAssigneeName}.`,
    is_system: true,
    author_name: actingUserName,
  })
  return true
}

export async function fetchNotesFor(target: { negotiationId?: number; needId?: number }): Promise<MarketNote[]> {
  let query = supabase.from('market_negotiation_notes').select('*')
  query = target.negotiationId != null ? query.eq('negotiation_id', target.negotiationId) : query.eq('need_id', target.needId!)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Agrega una nota y, si trae fecha de seguimiento, la refleja en el padre (negociación u objetivo) en el mismo paso. */
export async function addNoteTo(
  target: { negotiationId?: number; needId?: number },
  body: string,
  isMeeting: boolean,
  nextFollowupDate: string | null,
  authorId: string | null,
  authorName: string,
): Promise<MarketNote | null> {
  const { data, error } = await supabase
    .from('market_negotiation_notes')
    .insert({
      negotiation_id: target.negotiationId ?? null,
      need_id: target.needId ?? null,
      body,
      is_meeting: isMeeting,
      author_id: authorId,
      author_name: authorName,
    })
    .select()
    .single()
  if (error) { console.error('addNoteTo error:', error); return null }

  if (nextFollowupDate) {
    const table = target.negotiationId != null ? 'market_negotiations' : 'market_club_needs'
    const id = target.negotiationId ?? target.needId!
    await supabase.from(table).update({ next_followup_date: nextFollowupDate, updated_at: new Date().toISOString() }).eq('id', id)
  }

  return data
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors in `src/types/market.ts`, `src/services/marketService.ts`, `src/utils/marketAlerts.ts`.

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new `marketAlerts.test.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/types/market.ts src/services/marketService.ts src/utils/marketAlerts.ts src/utils/marketAlerts.test.ts
git commit -m "feat(mercado): tipos, acceso a datos y logica de alertas"
```

---

### Task 3: Navbar — agrega "Mercado", anida "Entrenadores" bajo "Scout Interno"

**Files:**
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/App.tsx`
- Create: `src/pages/MarketPage.tsx` (placeholder, replaced fully in Task 8 — created here only so the route doesn't 404 while this task is reviewed in isolation)

**Interfaces:**
- Consumes: nothing new.
- Produces: route `/mercado`. Task 8 replaces `MarketPage.tsx`'s body entirely; this task's version is a minimal placeholder so the nav link and route are independently testable.

- [ ] **Step 1: Create the placeholder page**

Create `src/pages/MarketPage.tsx`:

```tsx
export default function MarketPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold text-apple-gray-800 dark:text-white">Mercado</h1>
    </div>
  )
}
```

- [ ] **Step 2: Add the route**

In `src/App.tsx`, add the lazy import after `const GpsUploadPage = lazy(...)`:

```ts
const MarketPage = lazy(() => import('@/pages/MarketPage'))
```

Add the route after `<Route path="/carga-gps" element={<GpsUploadPage />} />`:

```tsx
<Route path="/mercado" element={<MarketPage />} />
```

- [ ] **Step 3: Restructure the nav config in `Navbar.tsx`**

Replace the `directLinks` array and add a new `scoutInternoGroup`. Currently:

```ts
const directLinks: NavItem[] = [
  { to: '/scouting', labelKey: 'nav.scoutExterno', icon: 'globe' },
  { to: '/interno', labelKey: 'nav.scoutInterno', icon: 'users' },
  { to: '/entrenadores', labelKey: 'nav.entrenadores', icon: 'whistle' },
]
```

becomes:

```ts
const mercadoLink: NavItem = { to: '/mercado', labelKey: 'nav.mercado', icon: 'briefcase' }

const scoutInternoGroup: NavGroup = {
  labelKey: 'nav.scoutInterno',
  icon: 'users',
  to: '/interno',
  items: [
    { to: '/interno', labelKey: 'nav.scoutInterno', icon: 'users' },
    { to: '/entrenadores', labelKey: 'nav.entrenadores', icon: 'whistle' },
  ],
}

const directLinks: NavItem[] = [
  { to: '/scouting', labelKey: 'nav.scoutExterno', icon: 'globe' },
]
```

- [ ] **Step 4: Add the `briefcase` icon**

In `NavIcon`'s `icons` map, add (alongside the existing entries, e.g. right after `whistle`):

```ts
briefcase: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7h-3V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2H4a1 1 0 00-1 1v11a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1zM9 5h6v2H9V5z" />,
```

- [ ] **Step 5: Add the translation key**

In `src/constants/translations.ts`, add `'nav.mercado'` to each of the 9 language blocks, right next to `'nav.scoutExterno'` (same insertion point in every block — find `'nav.scoutExterno':` in each language and add the line immediately after it):

```
es: 'nav.mercado': 'Mercado',
en: 'nav.mercado': 'Market',
tr: 'nav.mercado': 'Piyasa',
it: 'nav.mercado': 'Mercato',
fr: 'nav.mercado': 'Marché',
de: 'nav.mercado': 'Markt',
ar: 'nav.mercado': 'السوق',
zh: 'nav.mercado': '市场',
ja: 'nav.mercado': 'マーケット',
```

(Each is one new line inside its language's object, formatted the same as the surrounding `'nav.*'` entries — e.g. for `es`: `    'nav.mercado': 'Mercado',` right after `    'nav.scoutExterno': 'Scout Externo',`.)

- [ ] **Step 6: Wire the new nav items into the desktop nav**

In `Navbar.tsx`'s desktop `<nav>` block, the current order is: Inicio dropdown, `directLinks.map(...)`, Seguimiento dropdown, Búsqueda de Talento dropdown, Reporte. Insert the Mercado link and swap the old `directLinks`-driven "Scout Interno" plain link for the new `scoutInternoGroup` dropdown:

Replace:
```tsx
            <DesktopDropdown
              group={inicioGroup}
              isOpen={openDropdown === 'inicio'}
              onToggle={() => toggleDropdown('inicio')}
              dropdownRef={inicioRef}
              location={location}
              t={t}
            />

            {/* Direct links */}
            {directLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-green text-gray-900 shadow-sm'
                      : 'text-apple-gray-600 dark:text-apple-gray-300 hover:text-apple-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-apple-gray-700/50'
                  }`
                }
              >
                {t(link.labelKey)}
              </NavLink>
            ))}
```

with:
```tsx
            <DesktopDropdown
              group={inicioGroup}
              isOpen={openDropdown === 'inicio'}
              onToggle={() => toggleDropdown('inicio')}
              dropdownRef={inicioRef}
              location={location}
              t={t}
            />

            <NavLink
              to={mercadoLink.to}
              className={({ isActive }) =>
                `px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-green text-gray-900 shadow-sm'
                    : 'text-apple-gray-600 dark:text-apple-gray-300 hover:text-apple-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-apple-gray-700/50'
                }`
              }
            >
              {t(mercadoLink.labelKey)}
            </NavLink>

            {/* Direct links */}
            {directLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-green text-gray-900 shadow-sm'
                      : 'text-apple-gray-600 dark:text-apple-gray-300 hover:text-apple-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-apple-gray-700/50'
                  }`
                }
              >
                {t(link.labelKey)}
              </NavLink>
            ))}

            <DesktopDropdown
              group={scoutInternoGroup}
              isOpen={openDropdown === 'scoutInterno'}
              onToggle={() => toggleDropdown('scoutInterno')}
              dropdownRef={scoutInternoRef}
              location={location}
              t={t}
            />
```

Add the new ref next to the other dropdown refs:
```ts
  const scoutInternoRef = useRef<HTMLDivElement>(null)
```
(right after `const inicioRef = useRef<HTMLDivElement>(null)`)

Add `scoutInternoRef` to the outside-click-close check (the `useEffect` that currently checks `inicioRef.current && !inicioRef.current.contains(target) && seguimientoRef.current && ... && talentRef.current && ...` — add `&& scoutInternoRef.current && !scoutInternoRef.current.contains(target)` to that same chain).

- [ ] **Step 7: Wire the new nav items into the mobile menu**

In the mobile `<nav>` block, "Entrenadores" currently renders as a flat item inside the `directLinks.map(...)` mobile loop. Since `directLinks` no longer contains it (Step 3 removed it), the mobile loop naturally stops rendering it — but it needs to reappear nested under Scout Interno, matching the desktop change. Add a new collapsible section for Scout Interno, modeled exactly on the existing Seguimiento section, placed right after the "Direct links" mobile block and before the "Seguimiento Section" block:

```tsx
          {/* Scout Interno Section */}
          <div className="mt-4 pt-4 border-t border-apple-gray-200 dark:border-apple-gray-800">
            <button
              onClick={() => toggleMobile('scoutInterno')}
              className={`flex items-center justify-between w-full px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                isScoutInternoRoute
                  ? 'bg-brand-green/10 text-brand-green'
                  : 'text-apple-gray-700 dark:text-apple-gray-300 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <NavIcon icon="users" className="w-5 h-5" />
                {t('nav.scoutInterno')}
              </div>
              <svg className={`w-4 h-4 transition-transform ${mobileExpanded === 'scoutInterno' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {(mobileExpanded === 'scoutInterno' || isScoutInternoRoute) && (
              <div className="ml-4 mt-1 space-y-1">
                {scoutInternoGroup.items.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-brand-green text-gray-900'
                          : 'text-apple-gray-500 dark:text-apple-gray-400 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800'
                      }`
                    }
                  >
                    <NavIcon icon={link.icon} className="w-4 h-4" />
                    {t(link.labelKey)}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Mercado */}
          <div className="mt-4 pt-4 border-t border-apple-gray-200 dark:border-apple-gray-800">
            <NavLink
              to={mercadoLink.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-green text-gray-900'
                    : 'text-apple-gray-700 dark:text-apple-gray-300 hover:bg-apple-gray-100 dark:hover:bg-apple-gray-800'
                }`
              }
            >
              <NavIcon icon={mercadoLink.icon} className="w-5 h-5" />
              {t(mercadoLink.labelKey)}
            </NavLink>
          </div>
```

Add `isScoutInternoRoute` next to the other route checks (`isSeguimientoRoute`, `isTalentRoute`):
```ts
  const isScoutInternoRoute = scoutInternoGroup.items.some(l => location.pathname === l.to)
```

- [ ] **Step 8: Typecheck and full test suite**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "Navbar.tsx|App.tsx|MarketPage.tsx|translations.ts"`
Expected: no output.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 9: Manual browser check**

Run the dev server. Confirm: "Mercado" appears between "Inicio" and "Scout Externo" on desktop and navigates to a page showing the "Mercado" heading; "Scout Interno" is now a dropdown containing "Scout Interno" and "Entrenadores"; on mobile (resize/device toolbar), the same structure appears as a collapsible section plus a flat "Mercado" link. Switch language to English and confirm "Mercado" becomes "Market".

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/Navbar.tsx src/App.tsx src/pages/MarketPage.tsx src/constants/translations.ts
git commit -m "feat(mercado): agrega Mercado al navbar, anida Entrenadores bajo Scout Interno"
```

---

### Task 4: Reusable form building blocks — `AssigneeSelect`, `TeamSearchSelect`, `PlayerLinkField`

**Files:**
- Create: `src/components/market/AssigneeSelect.tsx`
- Create: `src/components/market/TeamSearchSelect.tsx`
- Create: `src/components/market/PlayerLinkField.tsx`

**Interfaces:**
- Consumes: `fetchTeamMembers`, `searchMarketTeams` (Task 2); `buildPlayerPhotoUrl` (Task 2); `useScoreLookup` (existing hook, `@/hooks/usePlayerStats`); `normalizeName` (existing, `@/utils/scoring`); `PlayerPhoto` (existing, `@/components/ui/PlayerPhoto`).
- Produces: `export default function AssigneeSelect({ value, onChange }: { value: number | null; onChange: (id: number, name: string) => void })`; `export default function TeamSearchSelect({ value, onChange }: { value: { id: number; name: string; logo: string | null } | null; onChange: (team: { id: number; name: string; logo: string | null }) => void })`; `export default function PlayerLinkField({ playerName, playerApiId, onChange }: { playerName: string; playerApiId: number | null; onChange: (id: number | null) => void })`. Tasks 6-7 import all three.

- [ ] **Step 1: `AssigneeSelect.tsx`**

Create `src/components/market/AssigneeSelect.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { fetchTeamMembers } from '@/services/marketService'
import type { TeamMember } from '@/types/market'

export default function AssigneeSelect({ value, onChange }: { value: number | null; onChange: (id: number, name: string) => void }) {
  const [members, setMembers] = useState<TeamMember[]>([])

  useEffect(() => {
    fetchTeamMembers().then(setMembers).catch(() => setMembers([]))
  }, [])

  return (
    <select
      value={value ?? ''}
      onChange={e => {
        const id = Number(e.target.value)
        const member = members.find(m => m.id === id)
        if (member) onChange(member.id, member.name)
      }}
      className="input-apple text-sm w-full"
    >
      <option value="" disabled>Elegir responsable...</option>
      {members.map(m => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  )
}
```

- [ ] **Step 2: `TeamSearchSelect.tsx`**

Create `src/components/market/TeamSearchSelect.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { searchMarketTeams } from '@/services/marketService'
import { TeamLogo } from '@/components/ui/PlayerPhoto'
import type { MarketTeamSearchResult } from '@/types/market'

export default function TeamSearchSelect({
  value,
  onChange,
}: {
  value: MarketTeamSearchResult | null
  onChange: (team: MarketTeamSearchResult) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MarketTeamSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    let active = true
    searchMarketTeams(query).then(r => { if (active) setResults(r) }).catch(() => { if (active) setResults([]) })
    return () => { active = false }
  }, [query])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        {value && !open ? (
          <button
            type="button"
            onClick={() => { setOpen(true); setQuery('') }}
            className="input-apple text-sm w-full flex items-center gap-2 text-left"
          >
            <TeamLogo src={value.logo} className="w-5 h-5 drop-shadow-md" />
            <span className="truncate">{value.name}</span>
          </button>
        ) : (
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar club..."
            className="input-apple text-sm w-full"
          />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-800 shadow-lg">
          {results.map(team => (
            <button
              key={team.id}
              type="button"
              onClick={() => { onChange(team); setOpen(false); setQuery('') }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-apple-gray-50 dark:hover:bg-apple-gray-700/50 transition-colors"
            >
              <TeamLogo src={team.logo} className="w-6 h-6 drop-shadow-md" />
              <span className="text-sm text-apple-gray-800 dark:text-white truncate">{team.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `PlayerLinkField.tsx`**

Create `src/components/market/PlayerLinkField.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useScoreLookup } from '@/hooks/usePlayerStats'
import { normalizeName } from '@/utils/scoring'
import { buildPlayerPhotoUrl } from '@/utils/marketAlerts'
import { PlayerPhoto } from '@/components/ui/PlayerPhoto'

export default function PlayerLinkField({
  playerName,
  playerApiId,
  onChange,
}: {
  playerName: string
  playerApiId: number | null
  onChange: (id: number | null) => void
}) {
  const { lookup } = useScoreLookup()
  const [manualInput, setManualInput] = useState(playerApiId != null ? String(playerApiId) : '')

  const suggestion = useMemo(() => {
    if (!playerName.trim()) return null
    const entry = lookup.get(normalizeName(playerName))
    if (!entry || entry.player_id === playerApiId) return null
    return entry
  }, [lookup, playerName, playerApiId])

  const photoUrl = buildPlayerPhotoUrl(playerApiId)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <PlayerPhoto src={photoUrl} name={playerName} size="sm" />
        <input
          type="number"
          value={manualInput}
          onChange={e => {
            setManualInput(e.target.value)
            const n = parseInt(e.target.value, 10)
            onChange(Number.isFinite(n) ? n : null)
          }}
          placeholder="ID de jugador en la API (opcional)"
          className="input-apple text-sm flex-1"
        />
      </div>
      {suggestion && (
        <button
          type="button"
          onClick={() => { onChange(suggestion.player_id); setManualInput(String(suggestion.player_id)) }}
          className="text-xs text-brand-green hover:text-emerald-600 font-medium"
        >
          ¿Es {suggestion.name}, {suggestion.position}? Usar este jugador de la API
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "AssigneeSelect.tsx|TeamSearchSelect.tsx|PlayerLinkField.tsx"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/market/AssigneeSelect.tsx src/components/market/TeamSearchSelect.tsx src/components/market/PlayerLinkField.tsx
git commit -m "feat(mercado): selectores reutilizables de responsable, club y jugador API"
```

---

### Task 5: Presentational components — `NeedCard`, `NegotiationCard`, `AlertsStrip`

**Files:**
- Create: `src/components/market/NeedCard.tsx`
- Create: `src/components/market/NegotiationCard.tsx`
- Create: `src/components/market/AlertsStrip.tsx`

**Interfaces:**
- Consumes: `ClubNeed`, `Negotiation` (Task 2 types); `computeAlerts`, `MarketAlert`, `buildPlayerPhotoUrl` (Task 2); `TeamLogo`, `PlayerPhoto` (existing).
- Produces: `export default function NeedCard({ need, onClick }: { need: ClubNeed; onClick: () => void })`; `export default function NegotiationCard({ negotiation, onClick }: { negotiation: Negotiation; onClick: () => void })`; `export default function AlertsStrip({ alerts, onSelectAlert }: { alerts: MarketAlert[]; onSelectAlert: (alert: MarketAlert) => void })`. Task 8 renders all three.

- [ ] **Step 1: Status badge helpers (shared, defined once in `NegotiationCard.tsx`, re-exported for `AlertsStrip.tsx`)**

At the top of `src/components/market/NegotiationCard.tsx`, before the component:

```tsx
import { TeamLogo, PlayerPhoto } from '@/components/ui/PlayerPhoto'
import { buildPlayerPhotoUrl } from '@/utils/marketAlerts'
import type { Negotiation, NegotiationStatus } from '@/types/market'

export const NEGOTIATION_STATUS_LABEL: Record<NegotiationStatus, string> = {
  contactado: 'Contactado',
  reunion: 'Reunión',
  oferta_enviada: 'Oferta enviada',
  en_espera: 'En espera',
  cerrado_exitoso: 'Cerrado (éxito)',
  cerrado_rechazado: 'Cerrado (rechazado)',
}

export const NEGOTIATION_STATUS_COLOR: Record<NegotiationStatus, string> = {
  contactado: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  reunion: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  oferta_enviada: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  en_espera: 'bg-apple-gray-100 text-apple-gray-600 dark:bg-apple-gray-700 dark:text-apple-gray-300',
  cerrado_exitoso: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cerrado_rechazado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}
```

- [ ] **Step 2: `NegotiationCard.tsx`**

Continue in the same file, after the exports from Step 1:

```tsx
export default function NegotiationCard({ negotiation, onClick }: { negotiation: Negotiation; onClick: () => void }) {
  const photoUrl = buildPlayerPhotoUrl(negotiation.player_api_id)

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-4 hover:shadow-apple-md dark:hover:shadow-apple-dark-md transition-all"
    >
      <div className="flex items-center gap-3 mb-3">
        <TeamLogo src={negotiation.team_logo} className="w-10 h-10 drop-shadow-md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-apple-gray-800 dark:text-white truncate">{negotiation.team_name}</p>
          {negotiation.assigned_to_name && (
            <p className="text-xs text-apple-gray-400">Responsable: {negotiation.assigned_to_name}</p>
          )}
        </div>
        <span className={`px-2 py-1 rounded-full text-2xs font-semibold flex-shrink-0 ${NEGOTIATION_STATUS_COLOR[negotiation.status]}`}>
          {NEGOTIATION_STATUS_LABEL[negotiation.status]}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <PlayerPhoto src={photoUrl} name={negotiation.player_name} size="sm" />
        <span className="text-sm font-medium text-apple-gray-700 dark:text-apple-gray-200">{negotiation.player_name}</span>
      </div>
      {(negotiation.contact_name || negotiation.next_followup_date) && (
        <div className="mt-3 pt-3 border-t border-apple-gray-100 dark:border-apple-gray-700 flex items-center justify-between text-xs text-apple-gray-500">
          <span>{negotiation.contact_name}{negotiation.contact_role ? ` · ${negotiation.contact_role}` : ''}</span>
          {negotiation.next_followup_date && <span>Seguimiento: {negotiation.next_followup_date}</span>}
        </div>
      )}
    </button>
  )
}
```

- [ ] **Step 3: `NeedCard.tsx`**

Create `src/components/market/NeedCard.tsx`:

```tsx
import { TeamLogo } from '@/components/ui/PlayerPhoto'
import type { ClubNeed } from '@/types/market'

const NEED_STATUS_LABEL: Record<ClubNeed['status'], string> = {
  abierto: 'Abierto',
  cerrado: 'Cerrado',
}

const NEED_STATUS_COLOR: Record<ClubNeed['status'], string> = {
  abierto: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  cerrado: 'bg-apple-gray-100 text-apple-gray-600 dark:bg-apple-gray-700 dark:text-apple-gray-300',
}

export default function NeedCard({ need, onClick }: { need: ClubNeed; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-4 hover:shadow-apple-md dark:hover:shadow-apple-dark-md transition-all"
    >
      <div className="flex items-center gap-3 mb-2">
        <TeamLogo src={need.team_logo} className="w-10 h-10 drop-shadow-md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-apple-gray-800 dark:text-white truncate">{need.team_name}</p>
          {need.assigned_to_name && (
            <p className="text-xs text-apple-gray-400">Responsable: {need.assigned_to_name}</p>
          )}
        </div>
        <span className={`px-2 py-1 rounded-full text-2xs font-semibold flex-shrink-0 ${NEED_STATUS_COLOR[need.status]}`}>
          {NEED_STATUS_LABEL[need.status]}
        </span>
      </div>
      <p className="text-sm font-medium text-apple-gray-700 dark:text-apple-gray-200">{need.position_label}</p>
      {need.next_followup_date && (
        <div className="mt-3 pt-3 border-t border-apple-gray-100 dark:border-apple-gray-700 text-xs text-apple-gray-500">
          Seguimiento: {need.next_followup_date}
        </div>
      )}
    </button>
  )
}
```

- [ ] **Step 4: `AlertsStrip.tsx`**

Create `src/components/market/AlertsStrip.tsx`:

```tsx
import { useState } from 'react'
import type { MarketAlert } from '@/utils/marketAlerts'

export default function AlertsStrip({ alerts, onSelectAlert }: { alerts: MarketAlert[]; onSelectAlert: (alert: MarketAlert) => void }) {
  const [collapsed, setCollapsed] = useState(false)

  if (alerts.length === 0) return null

  const vencidos = alerts.filter(a => a.urgency === 'vencido')
  const proximos = alerts.filter(a => a.urgency === 'proximo')

  return (
    <div className="mb-5 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {vencidos.length > 0 && `${vencidos.length} vencido${vencidos.length !== 1 ? 's' : ''}`}
          {vencidos.length > 0 && proximos.length > 0 && ' · '}
          {proximos.length > 0 && `${proximos.length} por vencer`}
        </span>
        <svg className={`w-4 h-4 text-amber-600 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 space-y-1.5">
          {alerts.map(alert => (
            <button
              key={`${alert.kind}-${alert.id}`}
              onClick={() => onSelectAlert(alert)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/60 dark:bg-apple-gray-800/40 hover:bg-white dark:hover:bg-apple-gray-800 transition-colors text-left"
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${alert.urgency === 'vencido' ? 'bg-red-500' : 'bg-amber-500'}`} />
              <span className="text-xs text-apple-gray-700 dark:text-apple-gray-300">
                {alert.kind === 'negotiation' ? 'Negociación' : 'Objetivo'} #{alert.id} — {alert.next_followup_date}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "NeedCard.tsx|NegotiationCard.tsx|AlertsStrip.tsx"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/market/NeedCard.tsx src/components/market/NegotiationCard.tsx src/components/market/AlertsStrip.tsx
git commit -m "feat(mercado): tarjetas de objetivo/negociacion y franja de alertas"
```

---

### Task 6: Creation forms — `NewNeedForm`, `NewNegotiationForm`

**Files:**
- Create: `src/components/market/NewNeedForm.tsx`
- Create: `src/components/market/NewNegotiationForm.tsx`

**Interfaces:**
- Consumes: `MobileSheet` (existing, `@/components/ui/MobileSheet`); `AssigneeSelect`, `TeamSearchSelect`, `PlayerLinkField` (Task 4); `createClubNeed`, `createNegotiation` (Task 2); `useAuth` (existing).
- Produces: `export default function NewNeedForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (need: ClubNeed) => void })`; `export default function NewNegotiationForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (negotiation: Negotiation) => void })`. Task 8 renders both.

- [ ] **Step 1: `NewNeedForm.tsx`**

Create `src/components/market/NewNeedForm.tsx`:

```tsx
import { useState } from 'react'
import MobileSheet from '@/components/ui/MobileSheet'
import TeamSearchSelect from './TeamSearchSelect'
import AssigneeSelect from './AssigneeSelect'
import { createClubNeed } from '@/services/marketService'
import { useAuth } from '@/context/AuthContext'
import type { ClubNeed, MarketTeamSearchResult } from '@/types/market'

export default function NewNeedForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (need: ClubNeed) => void }) {
  const { user, userDisplayName } = useAuth()
  const [team, setTeam] = useState<MarketTeamSearchResult | null>(null)
  const [positionLabel, setPositionLabel] = useState('')
  const [assigneeId, setAssigneeId] = useState<number | null>(null)
  const [assigneeName, setAssigneeName] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSave = team != null && positionLabel.trim().length > 0

  const handleSave = async () => {
    if (!team || !positionLabel.trim()) return
    setSaving(true)
    setError('')
    const result = await createClubNeed(
      {
        team_id: team.id,
        team_name: team.name,
        team_logo: team.logo,
        position_label: positionLabel.trim(),
        assigned_to_id: assigneeId,
        assigned_to_name: assigneeName || null,
        next_followup_date: followupDate || null,
      },
      user?.id ?? null,
      userDisplayName || 'Usuario',
    )
    setSaving(false)
    if (!result) { setError('No se pudo guardar. Probá de nuevo.'); return }
    onCreated(result)
    setTeam(null)
    setPositionLabel('')
    setAssigneeId(null)
    setAssigneeName('')
    setFollowupDate('')
    onClose()
  }

  return (
    <MobileSheet open={open} onClose={onClose} title="Nuevo objetivo">
      <div className="space-y-4 p-4">
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Club</label>
          <TeamSearchSelect value={team} onChange={setTeam} />
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">¿Qué busca?</label>
          <input
            type="text"
            value={positionLabel}
            onChange={e => setPositionLabel(e.target.value)}
            placeholder="Ej: Lateral derecho"
            className="input-apple text-sm w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Responsable</label>
          <AssigneeSelect value={assigneeId} onChange={(id, name) => { setAssigneeId(id); setAssigneeName(name) }} />
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Volver a hablar el (opcional)</label>
          <input
            type="date"
            value={followupDate}
            onChange={e => setFollowupDate(e.target.value)}
            className="input-apple text-sm w-full"
          />
        </div>
        {error && <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-brand-green hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? 'Guardando...' : 'Guardar objetivo'}
        </button>
      </div>
    </MobileSheet>
  )
}
```

- [ ] **Step 2: `NewNegotiationForm.tsx`**

Create `src/components/market/NewNegotiationForm.tsx`:

```tsx
import { useState } from 'react'
import MobileSheet from '@/components/ui/MobileSheet'
import TeamSearchSelect from './TeamSearchSelect'
import AssigneeSelect from './AssigneeSelect'
import PlayerLinkField from './PlayerLinkField'
import { createNegotiation } from '@/services/marketService'
import { useAuth } from '@/context/AuthContext'
import type { Negotiation, MarketTeamSearchResult } from '@/types/market'

export default function NewNegotiationForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (negotiation: Negotiation) => void }) {
  const { user, userDisplayName } = useAuth()
  const [team, setTeam] = useState<MarketTeamSearchResult | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [playerApiId, setPlayerApiId] = useState<number | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactRole, setContactRole] = useState('')
  const [assigneeId, setAssigneeId] = useState<number | null>(null)
  const [assigneeName, setAssigneeName] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSave = team != null && playerName.trim().length > 0

  const handleSave = async () => {
    if (!team || !playerName.trim()) return
    setSaving(true)
    setError('')
    const result = await createNegotiation(
      {
        team_id: team.id,
        team_name: team.name,
        team_logo: team.logo,
        player_name: playerName.trim(),
        player_api_id: playerApiId,
        player_source: playerApiId != null ? 'interno' : null,
        contact_name: contactName || null,
        contact_role: contactRole || null,
        assigned_to_id: assigneeId,
        assigned_to_name: assigneeName || null,
        next_followup_date: followupDate || null,
      },
      user?.id ?? null,
      userDisplayName || 'Usuario',
    )
    setSaving(false)
    if (!result) { setError('No se pudo guardar. Probá de nuevo.'); return }
    onCreated(result)
    setTeam(null)
    setPlayerName('')
    setPlayerApiId(null)
    setContactName('')
    setContactRole('')
    setAssigneeId(null)
    setAssigneeName('')
    setFollowupDate('')
    onClose()
  }

  return (
    <MobileSheet open={open} onClose={onClose} title="Nueva negociación">
      <div className="space-y-4 p-4">
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Club</label>
          <TeamSearchSelect value={team} onChange={setTeam} />
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Jugador</label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Nombre del jugador"
            className="input-apple text-sm w-full mb-2"
          />
          <PlayerLinkField playerName={playerName} playerApiId={playerApiId} onChange={setPlayerApiId} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Contacto</label>
            <input
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Nombre"
              className="input-apple text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Cargo</label>
            <input
              type="text"
              value={contactRole}
              onChange={e => setContactRole(e.target.value)}
              placeholder="Ej: Director deportivo"
              className="input-apple text-sm w-full"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Responsable</label>
          <AssigneeSelect value={assigneeId} onChange={(id, name) => { setAssigneeId(id); setAssigneeName(name) }} />
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Volver a hablar el (opcional)</label>
          <input
            type="date"
            value={followupDate}
            onChange={e => setFollowupDate(e.target.value)}
            className="input-apple text-sm w-full"
          />
        </div>
        {error && <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-brand-green hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? 'Guardando...' : 'Guardar negociación'}
        </button>
      </div>
    </MobileSheet>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "NewNeedForm.tsx|NewNegotiationForm.tsx"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/market/NewNeedForm.tsx src/components/market/NewNegotiationForm.tsx
git commit -m "feat(mercado): formularios de alta de objetivo y negociacion"
```

---

### Task 7: Detail views — `NeedDetail`, `NegotiationDetail`

**Files:**
- Create: `src/components/market/NeedDetail.tsx`
- Create: `src/components/market/NegotiationDetail.tsx`

**Interfaces:**
- Consumes: `MobileSheet`; `AssigneeSelect`, `PlayerLinkField` (Task 4); `fetchNotesFor`, `addNoteTo`, `reassignNeed`, `reassignNegotiation`, `updateNeedStatus`, `updateNegotiationStatus`, `linkNegotiationPlayer` (Task 2); `NEGOTIATION_STATUS_LABEL` (Task 5, exported from `NegotiationCard.tsx`); `useAuth`.
- Produces: `export default function NeedDetail({ need, open, onClose, onUpdated }: { need: ClubNeed; open: boolean; onClose: () => void; onUpdated: (need: ClubNeed) => void })`; `export default function NegotiationDetail({ negotiation, open, onClose, onUpdated }: { negotiation: Negotiation; open: boolean; onClose: () => void; onUpdated: (negotiation: Negotiation) => void })`. Task 8 renders both.

- [ ] **Step 1: `NegotiationDetail.tsx`**

Create `src/components/market/NegotiationDetail.tsx`:

```tsx
import { useEffect, useState } from 'react'
import MobileSheet from '@/components/ui/MobileSheet'
import AssigneeSelect from './AssigneeSelect'
import PlayerLinkField from './PlayerLinkField'
import { NEGOTIATION_STATUS_LABEL } from './NegotiationCard'
import { fetchNotesFor, addNoteTo, reassignNegotiation, updateNegotiationStatus, linkNegotiationPlayer } from '@/services/marketService'
import { countMeetings } from '@/utils/marketAlerts'
import { useAuth } from '@/context/AuthContext'
import type { Negotiation, MarketNote, NegotiationStatus } from '@/types/market'

const STATUS_OPTIONS: NegotiationStatus[] = ['contactado', 'reunion', 'oferta_enviada', 'en_espera', 'cerrado_exitoso', 'cerrado_rechazado']

export default function NegotiationDetail({
  negotiation,
  open,
  onClose,
  onUpdated,
}: {
  negotiation: Negotiation
  open: boolean
  onClose: () => void
  onUpdated: (negotiation: Negotiation) => void
}) {
  const { user, userDisplayName } = useAuth()
  const [notes, setNotes] = useState<MarketNote[]>([])
  const [noteBody, setNoteBody] = useState('')
  const [isMeeting, setIsMeeting] = useState(false)
  const [followupDate, setFollowupDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [reassigning, setReassigning] = useState(false)

  const loadNotes = () => {
    fetchNotesFor({ negotiationId: negotiation.id }).then(setNotes).catch(() => setNotes([]))
  }

  useEffect(() => {
    if (open) loadNotes()
  }, [open, negotiation.id])

  const handleAddNote = async () => {
    if (!noteBody.trim()) return
    setSaving(true)
    const result = await addNoteTo(
      { negotiationId: negotiation.id },
      noteBody.trim(),
      isMeeting,
      followupDate || null,
      user?.id ?? null,
      userDisplayName || 'Usuario',
    )
    setSaving(false)
    if (result) {
      setNoteBody('')
      setIsMeeting(false)
      if (followupDate) onUpdated({ ...negotiation, next_followup_date: followupDate })
      setFollowupDate('')
      loadNotes()
    }
  }

  const handleStatusChange = async (status: NegotiationStatus) => {
    const ok = await updateNegotiationStatus(negotiation.id, status)
    if (ok) onUpdated({ ...negotiation, status })
  }

  const handleReassign = async (id: number, name: string) => {
    setReassigning(true)
    const ok = await reassignNegotiation(negotiation.id, id, name, userDisplayName || 'Usuario')
    setReassigning(false)
    if (ok) { onUpdated({ ...negotiation, assigned_to_id: id, assigned_to_name: name }); loadNotes() }
  }

  const handleLinkPlayer = async (playerApiId: number | null) => {
    if (playerApiId == null) return
    const ok = await linkNegotiationPlayer(negotiation.id, playerApiId, 'interno')
    if (ok) onUpdated({ ...negotiation, player_api_id: playerApiId, player_source: 'interno' })
  }

  return (
    <MobileSheet open={open} onClose={onClose} title={`${negotiation.player_name} → ${negotiation.team_name}`}>
      <div className="space-y-5 p-4">
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Vincular jugador de la API</label>
          <PlayerLinkField playerName={negotiation.player_name} playerApiId={negotiation.player_api_id} onChange={handleLinkPlayer} />
        </div>

        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Estado</label>
          <select
            value={negotiation.status}
            onChange={e => handleStatusChange(e.target.value as NegotiationStatus)}
            className="input-apple text-sm w-full"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{NEGOTIATION_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Responsable</label>
          <AssigneeSelect value={negotiation.assigned_to_id} onChange={handleReassign} />
          {reassigning && <p className="text-xs text-apple-gray-400 mt-1">Reasignando...</p>}
        </div>

        <div className="pt-3 border-t border-apple-gray-200 dark:border-apple-gray-700">
          <p className="text-xs font-semibold text-apple-gray-500 uppercase tracking-wider mb-2">
            Notas ({notes.length}) · {countMeetings(notes)} reunión{countMeetings(notes) !== 1 ? 'es' : ''}
          </p>

          <div className="space-y-3 mb-3">
            <textarea
              value={noteBody}
              onChange={e => setNoteBody(e.target.value)}
              placeholder="Agregar una nota..."
              rows={3}
              className="input-apple text-sm w-full resize-none"
            />
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-apple-gray-600 dark:text-apple-gray-300">
                <input type="checkbox" checked={isMeeting} onChange={e => setIsMeeting(e.target.checked)} />
                Fue una reunión
              </label>
              <label className="flex items-center gap-2 text-sm text-apple-gray-600 dark:text-apple-gray-300">
                Volver a hablar el
                <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)} className="input-apple text-xs" />
              </label>
            </div>
            <button
              onClick={handleAddNote}
              disabled={!noteBody.trim() || saving}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-brand-green hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? 'Guardando...' : 'Agregar nota'}
            </button>
          </div>

          <div className="space-y-2">
            {notes.map(note => (
              <div key={note.id} className={`p-3 rounded-lg text-sm ${note.is_system ? 'bg-apple-gray-50 dark:bg-apple-gray-800/50 text-apple-gray-400 italic' : 'bg-apple-gray-50 dark:bg-apple-gray-800/50 text-apple-gray-700 dark:text-apple-gray-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{note.author_name}{note.is_meeting && ' · Reunión'}</span>
                  <span className="text-2xs text-apple-gray-400">{new Date(note.created_at).toLocaleDateString('es-AR')}</span>
                </div>
                {note.body}
              </div>
            ))}
          </div>
        </div>
      </div>
    </MobileSheet>
  )
}
```

- [ ] **Step 2: `NeedDetail.tsx`**

Create `src/components/market/NeedDetail.tsx`:

```tsx
import { useEffect, useState } from 'react'
import MobileSheet from '@/components/ui/MobileSheet'
import AssigneeSelect from './AssigneeSelect'
import { fetchNotesFor, addNoteTo, reassignNeed, updateNeedStatus } from '@/services/marketService'
import { countMeetings } from '@/utils/marketAlerts'
import { useAuth } from '@/context/AuthContext'
import type { ClubNeed, MarketNote, NeedStatus } from '@/types/market'

export default function NeedDetail({
  need,
  open,
  onClose,
  onUpdated,
}: {
  need: ClubNeed
  open: boolean
  onClose: () => void
  onUpdated: (need: ClubNeed) => void
}) {
  const { user, userDisplayName } = useAuth()
  const [notes, setNotes] = useState<MarketNote[]>([])
  const [noteBody, setNoteBody] = useState('')
  const [isMeeting, setIsMeeting] = useState(false)
  const [followupDate, setFollowupDate] = useState('')
  const [saving, setSaving] = useState(false)

  const loadNotes = () => {
    fetchNotesFor({ needId: need.id }).then(setNotes).catch(() => setNotes([]))
  }

  useEffect(() => {
    if (open) loadNotes()
  }, [open, need.id])

  const handleAddNote = async () => {
    if (!noteBody.trim()) return
    setSaving(true)
    const result = await addNoteTo(
      { needId: need.id },
      noteBody.trim(),
      isMeeting,
      followupDate || null,
      user?.id ?? null,
      userDisplayName || 'Usuario',
    )
    setSaving(false)
    if (result) {
      setNoteBody('')
      setIsMeeting(false)
      if (followupDate) onUpdated({ ...need, next_followup_date: followupDate })
      setFollowupDate('')
      loadNotes()
    }
  }

  const handleStatusChange = async (status: NeedStatus) => {
    const ok = await updateNeedStatus(need.id, status)
    if (ok) onUpdated({ ...need, status })
  }

  const handleReassign = async (id: number, name: string) => {
    const ok = await reassignNeed(need.id, id, name, userDisplayName || 'Usuario')
    if (ok) { onUpdated({ ...need, assigned_to_id: id, assigned_to_name: name }); loadNotes() }
  }

  return (
    <MobileSheet open={open} onClose={onClose} title={`${need.position_label} — ${need.team_name}`}>
      <div className="space-y-5 p-4">
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Estado</label>
          <select
            value={need.status}
            onChange={e => handleStatusChange(e.target.value as NeedStatus)}
            className="input-apple text-sm w-full"
          >
            <option value="abierto">Abierto</option>
            <option value="cerrado">Cerrado</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-apple-gray-500 mb-1.5">Responsable</label>
          <AssigneeSelect value={need.assigned_to_id} onChange={handleReassign} />
        </div>

        <div className="pt-3 border-t border-apple-gray-200 dark:border-apple-gray-700">
          <p className="text-xs font-semibold text-apple-gray-500 uppercase tracking-wider mb-2">
            Notas ({notes.length}) · {countMeetings(notes)} reunión{countMeetings(notes) !== 1 ? 'es' : ''}
          </p>

          <div className="space-y-3 mb-3">
            <textarea
              value={noteBody}
              onChange={e => setNoteBody(e.target.value)}
              placeholder="Agregar una nota..."
              rows={3}
              className="input-apple text-sm w-full resize-none"
            />
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-apple-gray-600 dark:text-apple-gray-300">
                <input type="checkbox" checked={isMeeting} onChange={e => setIsMeeting(e.target.checked)} />
                Fue una reunión
              </label>
              <label className="flex items-center gap-2 text-sm text-apple-gray-600 dark:text-apple-gray-300">
                Volver a hablar el
                <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)} className="input-apple text-xs" />
              </label>
            </div>
            <button
              onClick={handleAddNote}
              disabled={!noteBody.trim() || saving}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-brand-green hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? 'Guardando...' : 'Agregar nota'}
            </button>
          </div>

          <div className="space-y-2">
            {notes.map(note => (
              <div key={note.id} className={`p-3 rounded-lg text-sm ${note.is_system ? 'bg-apple-gray-50 dark:bg-apple-gray-800/50 text-apple-gray-400 italic' : 'bg-apple-gray-50 dark:bg-apple-gray-800/50 text-apple-gray-700 dark:text-apple-gray-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{note.author_name}{note.is_meeting && ' · Reunión'}</span>
                  <span className="text-2xs text-apple-gray-400">{new Date(note.created_at).toLocaleDateString('es-AR')}</span>
                </div>
                {note.body}
              </div>
            ))}
          </div>
        </div>
      </div>
    </MobileSheet>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "NeedDetail.tsx|NegotiationDetail.tsx"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/market/NeedDetail.tsx src/components/market/NegotiationDetail.tsx
git commit -m "feat(mercado): vista de detalle con notas, reasignacion y vinculo de jugador"
```

---

### Task 8: `MarketPage.tsx` — junta todo

**Files:**
- Modify: `src/pages/MarketPage.tsx` (replaces the Task 3 placeholder entirely)

**Interfaces:**
- Consumes: everything from Tasks 2, 4, 5, 6, 7, plus `NEGOTIATION_STATUS_LABEL` (exported from `NegotiationCard.tsx` in Task 5) for the status filter's options.
- Produces: the finished page, including club/responsable/estado/"solo vencidos" filters (spec requirement, applied client-side over the already-loaded lists — no new queries). Task 9 only adds the navbar badge and does final verification — nothing after this task imports from `MarketPage.tsx`.

- [ ] **Step 1: Replace `MarketPage.tsx`**

Replace the entire contents of `src/pages/MarketPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { fetchClubNeeds, fetchNegotiations, fetchTeamMembers } from '@/services/marketService'
import { computeAlerts, type AlertableItem, type MarketAlert } from '@/utils/marketAlerts'
import NeedCard from '@/components/market/NeedCard'
import NegotiationCard from '@/components/market/NegotiationCard'
import AlertsStrip from '@/components/market/AlertsStrip'
import NewNeedForm from '@/components/market/NewNeedForm'
import NewNegotiationForm from '@/components/market/NewNegotiationForm'
import NeedDetail from '@/components/market/NeedDetail'
import NegotiationDetail from '@/components/market/NegotiationDetail'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { NEGOTIATION_STATUS_LABEL } from '@/components/market/NegotiationCard'
import type { ClubNeed, Negotiation, TeamMember, NegotiationStatus, NeedStatus } from '@/types/market'

type Tab = 'negociaciones' | 'objetivos'

export default function MarketPage() {
  const [tab, setTab] = useState<Tab>('negociaciones')
  const [needs, setNeeds] = useState<ClubNeed[]>([])
  const [negotiations, setNegotiations] = useState<Negotiation[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewNeed, setShowNewNeed] = useState(false)
  const [showNewNegotiation, setShowNewNegotiation] = useState(false)
  const [selectedNeed, setSelectedNeed] = useState<ClubNeed | null>(null)
  const [selectedNegotiation, setSelectedNegotiation] = useState<Negotiation | null>(null)

  // Filtros: por club (texto libre sobre team_name), por responsable, por
  // estado (las opciones dependen de la pestaña activa) y "solo vencidos".
  const [clubFilter, setClubFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState<number | 'all'>('all')
  const [negotiationStatusFilter, setNegotiationStatusFilter] = useState<NegotiationStatus | 'all'>('all')
  const [needStatusFilter, setNeedStatusFilter] = useState<NeedStatus | 'all'>('all')
  const [onlyOverdue, setOnlyOverdue] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([fetchClubNeeds(), fetchNegotiations(), fetchTeamMembers()])
      .then(([n, neg, m]) => { setNeeds(n); setNegotiations(neg); setMembers(m) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const alerts = useMemo<MarketAlert[]>(() => {
    const items: AlertableItem[] = [
      ...needs.map(n => ({ id: n.id, kind: 'need' as const, status: n.status, assigned_to_id: n.assigned_to_id, next_followup_date: n.next_followup_date })),
      ...negotiations.map(n => ({ id: n.id, kind: 'negotiation' as const, status: n.status, assigned_to_id: n.assigned_to_id, next_followup_date: n.next_followup_date })),
    ]
    return computeAlerts(items, new Date())
  }, [needs, negotiations])

  const overdueNegotiationIds = useMemo(
    () => new Set(alerts.filter(a => a.kind === 'negotiation' && a.urgency === 'vencido').map(a => a.id)),
    [alerts],
  )
  const overdueNeedIds = useMemo(
    () => new Set(alerts.filter(a => a.kind === 'need' && a.urgency === 'vencido').map(a => a.id)),
    [alerts],
  )

  const filteredNegotiations = useMemo(() => {
    return negotiations.filter(n => {
      if (clubFilter.trim() && !n.team_name.toLowerCase().includes(clubFilter.trim().toLowerCase())) return false
      if (assigneeFilter !== 'all' && n.assigned_to_id !== assigneeFilter) return false
      if (negotiationStatusFilter !== 'all' && n.status !== negotiationStatusFilter) return false
      if (onlyOverdue && !overdueNegotiationIds.has(n.id)) return false
      return true
    })
  }, [negotiations, clubFilter, assigneeFilter, negotiationStatusFilter, onlyOverdue, overdueNegotiationIds])

  const filteredNeeds = useMemo(() => {
    return needs.filter(n => {
      if (clubFilter.trim() && !n.team_name.toLowerCase().includes(clubFilter.trim().toLowerCase())) return false
      if (assigneeFilter !== 'all' && n.assigned_to_id !== assigneeFilter) return false
      if (needStatusFilter !== 'all' && n.status !== needStatusFilter) return false
      if (onlyOverdue && !overdueNeedIds.has(n.id)) return false
      return true
    })
  }, [needs, clubFilter, assigneeFilter, needStatusFilter, onlyOverdue, overdueNeedIds])

  const handleSelectAlert = (alert: MarketAlert) => {
    if (alert.kind === 'need') {
      const need = needs.find(n => n.id === alert.id)
      if (need) setSelectedNeed(need)
    } else {
      const negotiation = negotiations.find(n => n.id === alert.id)
      if (negotiation) setSelectedNegotiation(negotiation)
    }
  }

  if (loading) return <LoadingSpinner fullScreen message="Cargando Mercado..." />

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-apple-gray-800 dark:text-white">Mercado</h1>
        <button
          onClick={() => (tab === 'negociaciones' ? setShowNewNegotiation(true) : setShowNewNeed(true))}
          className="px-4 py-2 rounded-xl bg-brand-green hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
        >
          + {tab === 'negociaciones' ? 'Nueva negociación' : 'Nuevo objetivo'}
        </button>
      </div>

      <AlertsStrip alerts={alerts} onSelectAlert={handleSelectAlert} />

      <div className="flex gap-2 mb-5 border-b border-apple-gray-200 dark:border-apple-gray-700">
        <button
          onClick={() => setTab('negociaciones')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'negociaciones' ? 'border-brand-green text-brand-green' : 'border-transparent text-apple-gray-500 hover:text-apple-gray-700 dark:hover:text-apple-gray-300'
          }`}
        >
          Negociaciones ({negotiations.length})
        </button>
        <button
          onClick={() => setTab('objetivos')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'objetivos' ? 'border-brand-green text-brand-green' : 'border-transparent text-apple-gray-500 hover:text-apple-gray-700 dark:hover:text-apple-gray-300'
          }`}
        >
          Objetivos ({needs.length})
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input
          type="text"
          value={clubFilter}
          onChange={e => setClubFilter(e.target.value)}
          placeholder="Filtrar por club..."
          className="input-apple text-sm w-full sm:w-48"
        />
        <select
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="input-apple text-sm"
        >
          <option value="all">Todos los responsables</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {tab === 'negociaciones' ? (
          <select
            value={negotiationStatusFilter}
            onChange={e => setNegotiationStatusFilter(e.target.value as NegotiationStatus | 'all')}
            className="input-apple text-sm"
          >
            <option value="all">Todos los estados</option>
            {(Object.keys(NEGOTIATION_STATUS_LABEL) as NegotiationStatus[]).map(s => (
              <option key={s} value={s}>{NEGOTIATION_STATUS_LABEL[s]}</option>
            ))}
          </select>
        ) : (
          <select
            value={needStatusFilter}
            onChange={e => setNeedStatusFilter(e.target.value as NeedStatus | 'all')}
            className="input-apple text-sm"
          >
            <option value="all">Todos los estados</option>
            <option value="abierto">Abierto</option>
            <option value="cerrado">Cerrado</option>
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-apple-gray-600 dark:text-apple-gray-300">
          <input type="checkbox" checked={onlyOverdue} onChange={e => setOnlyOverdue(e.target.checked)} />
          Solo vencidos
        </label>
      </div>

      {tab === 'negociaciones' ? (
        filteredNegotiations.length === 0 ? (
          <p className="text-center py-12 text-sm text-apple-gray-400">
            {negotiations.length === 0 ? 'Todavía no hay negociaciones registradas.' : 'Ninguna negociación coincide con los filtros.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNegotiations.map(n => (
              <NegotiationCard key={n.id} negotiation={n} onClick={() => setSelectedNegotiation(n)} />
            ))}
          </div>
        )
      ) : filteredNeeds.length === 0 ? (
        <p className="text-center py-12 text-sm text-apple-gray-400">
          {needs.length === 0 ? 'Todavía no hay objetivos registrados.' : 'Ningún objetivo coincide con los filtros.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNeeds.map(n => (
            <NeedCard key={n.id} need={n} onClick={() => setSelectedNeed(n)} />
          ))}
        </div>
      )}

      <NewNeedForm open={showNewNeed} onClose={() => setShowNewNeed(false)} onCreated={n => setNeeds(prev => [n, ...prev])} />
      <NewNegotiationForm open={showNewNegotiation} onClose={() => setShowNewNegotiation(false)} onCreated={n => setNegotiations(prev => [n, ...prev])} />

      {selectedNeed && (
        <NeedDetail
          need={selectedNeed}
          open={true}
          onClose={() => setSelectedNeed(null)}
          onUpdated={updated => {
            setSelectedNeed(updated)
            setNeeds(prev => prev.map(n => (n.id === updated.id ? updated : n)))
          }}
        />
      )}
      {selectedNegotiation && (
        <NegotiationDetail
          negotiation={selectedNegotiation}
          open={true}
          onClose={() => setSelectedNegotiation(null)}
          onUpdated={updated => {
            setSelectedNegotiation(updated)
            setNegotiations(prev => prev.map(n => (n.id === updated.id ? updated : n)))
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "MarketPage.tsx"`
Expected: no output.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 4: Manual browser check**

Run the dev server, navigate to `/mercado`:
- Create a new need (club search must show shields with shadow; save; card appears in "Objetivos").
- Create a new negotiation for a DG roster player whose name matches an existing Score GG entry — confirm the "¿Es X? Usar este jugador de la API" suggestion appears and clicking it shows the player's photo.
- Open the negotiation detail, add a note with "Fue una reunión" checked and a follow-up date 2 days out — confirm it appears in the AlertsStrip as "por vencer" after reloading.
- Reassign the negotiation to a different team member (needs at least 2 rows in `market_team_members` — add one via SQL/curl if only one exists) — confirm a system note appears in the timeline.
- Resize to mobile width — confirm cards stack in a single column and the create-forms render as bottom sheets, not centered desktop modals.
- Type a club name into the "Filtrar por club" input — confirm the grid narrows to matching cards only, on whichever tab is active. Pick a responsable in the filter — confirm it narrows to that assignee. Toggle "Solo vencidos" — confirm it narrows to the same ids the AlertsStrip flagged as vencido for that tab's kind.

- [ ] **Step 5: Commit**

```bash
git add src/pages/MarketPage.tsx
git commit -m "feat(mercado): pagina completa con pestanas, alertas, alta y detalle"
```

---

### Task 9: Navbar alert badge + final verification

**Files:**
- Create: `src/components/layout/MarketAlertBadge.tsx`
- Modify: `src/components/layout/Navbar.tsx`

**Interfaces:**
- Consumes: `fetchClubNeeds`, `fetchNegotiations` (Task 2); `computeAlerts` (Task 2); `useAuth` (existing).
- Produces: `export default function MarketAlertBadge()` — no props, mounted once in `Navbar.tsx`. Nothing after this task depends on it.

- [ ] **Step 1: Create `MarketAlertBadge.tsx`**

This needs to resolve the current user's `market_team_members.id` from their auth identity to filter "my" alerts. Since `market_team_members` has no link to `auth.users` (it's a simple name list per the spec — team members aren't necessarily all app users), match by display name: find the `market_team_members` row whose `name` matches the logged-in user's `userDisplayName` (case-insensitive). If there's no match (the logged-in user isn't in the team-members list yet), show the team-wide count instead of a personal one — this degrades gracefully rather than always showing 0.

Create `src/components/layout/MarketAlertBadge.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchClubNeeds, fetchNegotiations, fetchTeamMembers } from '@/services/marketService'
import { computeAlerts, type AlertableItem } from '@/utils/marketAlerts'
import { useAuth } from '@/context/AuthContext'

export default function MarketAlertBadge() {
  const { userDisplayName } = useAuth()
  const navigate = useNavigate()
  const [count, setCount] = useState(0)

  useEffect(() => {
    Promise.all([fetchClubNeeds(), fetchNegotiations(), fetchTeamMembers()])
      .then(([needs, negotiations, members]) => {
        const items: AlertableItem[] = [
          ...needs.map(n => ({ id: n.id, kind: 'need' as const, status: n.status, assigned_to_id: n.assigned_to_id, next_followup_date: n.next_followup_date })),
          ...negotiations.map(n => ({ id: n.id, kind: 'negotiation' as const, status: n.status, assigned_to_id: n.assigned_to_id, next_followup_date: n.next_followup_date })),
        ]
        const alerts = computeAlerts(items, new Date())
        const me = members.find(m => m.name.toLowerCase() === userDisplayName.toLowerCase())
        const mine = me ? alerts.filter(a => a.assigned_to_id === me.id) : alerts
        setCount(mine.length)
      })
      .catch(() => setCount(0))
  }, [userDisplayName])

  return (
    <button
      onClick={() => navigate('/mercado')}
      aria-label="Alertas de Mercado"
      className="relative p-2 rounded-lg bg-apple-gray-100 dark:bg-apple-gray-800 hover:bg-apple-gray-200 dark:hover:bg-apple-gray-700 transition-all duration-200 ease-apple group"
    >
      <svg className="w-5 h-5 text-apple-gray-600 dark:text-apple-gray-300 group-hover:text-apple-gray-800 dark:group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-2xs font-bold flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Mount it in `Navbar.tsx`**

Add the import next to the other layout component imports:

```ts
import MarketAlertBadge from './MarketAlertBadge'
```

In the "Right side" `<div className="flex items-center gap-2">` block, add it right before `<LanguageToggle />`:

```tsx
            <PDFBuilderFloatingButton />
            <MarketAlertBadge />
            <LanguageToggle />
            <ThemeToggle />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors anywhere in the repo.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Full manual pass**

With at least 2 rows in `market_team_members` and one negotiation assigned to each:
- Confirm the navbar badge shows a count matching the logged-in user's own assigned overdue/upcoming items only (not the team-wide total) when their display name matches a team-member row.
- Click the badge, confirm it navigates to `/mercado`.
- Repeat the full desktop/tablet/mobile pass from Task 8 Step 4 once more end-to-end now that the badge is live, to confirm nothing regressed.
- Confirm `git log` shows every commit from Tasks 1-9 present on the current branch.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/MarketAlertBadge.tsx src/components/layout/Navbar.tsx
git commit -m "feat(mercado): campanita de alertas en el navbar"
```
