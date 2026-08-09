import type { ApiResponse, ApiFixture, AgencyFixture, ApiFixtureLineup, ApiFixtureEvent } from '@/types/footballApi'
import { getPlayersByTeamId, getUniqueTeamIds } from '@/constants/agencyPlayers'

// Las llamadas a API-Football pasan por /api/football (proxy server-side:
// netlify/functions/football.js en prod, proxy de vite.config.ts en dev) para
// que la key nunca viaje al bundle del browser.
const PROXY_URL = '/api/football'
const CACHE_KEY = 'dg-fixtures-cache-v2'
const CACHE_TTL = 4 * 60 * 60 * 1000
const AR_TZ = 'America/Argentina/Buenos_Aires'

async function apiFetch<T>(endpoint: string, params: Record<string, string>): Promise<ApiResponse<T>> {
  const url = new URL(PROXY_URL, window.location.origin)
  url.searchParams.set('endpoint', endpoint)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString())

  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = await res.json()

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API: ${JSON.stringify(data.errors)}`)
  }

  return data
}

async function getTeamFixtures(teamId: number): Promise<ApiFixture[]> {
  const [upcoming, past] = await Promise.all([
    apiFetch<ApiFixture[]>('/fixtures', {
      team: String(teamId),
      next: '20',
      timezone: AR_TZ,
    }).catch(() => null),
    apiFetch<ApiFixture[]>('/fixtures', {
      team: String(teamId),
      last: '10',
      timezone: AR_TZ,
    }).catch(() => null),
  ])

  return [
    ...(upcoming?.response || []),
    ...(past?.response || []),
  ]
}

function mapFixture(fixture: ApiFixture, teamId: number): AgencyFixture {
  const players = getPlayersByTeamId(teamId)
  const isHome = fixture.teams.home.id === teamId

  return {
    fixtureId: fixture.fixture.id,
    date: fixture.fixture.date,
    timestamp: fixture.fixture.timestamp,
    venue: fixture.fixture.venue.name,
    city: fixture.fixture.venue.city,
    status: fixture.fixture.status.long,
    statusShort: fixture.fixture.status.short,
    elapsed: fixture.fixture.status.elapsed,
    leagueName: fixture.league.name,
    leagueLogo: fixture.league.logo,
    leagueCountry: fixture.league.country,
    leagueFlag: fixture.league.flag ?? null,
    round: fixture.league.round,
    homeTeam: {
      id: fixture.teams.home.id,
      name: fixture.teams.home.name,
      logo: fixture.teams.home.logo,
    },
    awayTeam: {
      id: fixture.teams.away.id,
      name: fixture.teams.away.name,
      logo: fixture.teams.away.logo,
    },
    goalsHome: fixture.goals.home,
    goalsAway: fixture.goals.away,
    isHome,
    players: players.map(p => ({
      shortName: p.shortName,
      fullName: p.fullName,
      image: p.image,
    })),
  }
}

function getCachedGeneric<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const cached: { data: T; timestamp: number } = JSON.parse(raw)
    if (Date.now() - cached.timestamp > ttl) {
      localStorage.removeItem(key)
      return null
    }
    return cached.data
  } catch {
    return null
  }
}

function setCacheGeneric<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch { /* quota exceeded */ }
}

export async function fetchAllAgencyFixtures(forceRefresh = false): Promise<AgencyFixture[]> {
  if (!forceRefresh) {
    const cached = getCachedGeneric<AgencyFixture[]>(CACHE_KEY, CACHE_TTL)
    if (cached) return cached
  }

  const teamIds = getUniqueTeamIds()
  const batchSize = 5
  const allFixtures: AgencyFixture[] = []
  let hasAnyResults = false

  for (let i = 0; i < teamIds.length; i += batchSize) {
    const batch = teamIds.slice(i, i + batchSize)
    const results = await Promise.all(batch.map(id => getTeamFixtures(id)))
    for (let j = 0; j < batch.length; j++) {
      if (results[j].length > 0) hasAnyResults = true
      for (const fixture of results[j]) {
        allFixtures.push(mapFixture(fixture, batch[j]))
      }
    }
  }

  if (!hasAnyResults && allFixtures.length === 0) {
    throw new Error('No se pudieron obtener fixtures. Verificá la API key y la conexión.')
  }

  const fixtureMap = new Map<number, AgencyFixture>()
  for (const f of allFixtures) {
    const existing = fixtureMap.get(f.fixtureId)
    if (existing) {
      const newPlayers = f.players.filter(
        p => !existing.players.some(ep => ep.fullName === p.fullName)
      )
      existing.players.push(...newPlayers)
    } else {
      fixtureMap.set(f.fixtureId, { ...f })
    }
  }

  const merged = Array.from(fixtureMap.values()).sort((a, b) => a.timestamp - b.timestamp)
  setCacheGeneric(CACHE_KEY, merged)
  return merged
}

const TEAM_FIXTURES_CACHE_PREFIX = 'dg-team-fixtures-cache'
const TEAM_FIXTURES_CACHE_TTL = 4 * 60 * 60 * 1000 // 4h, igual que el cache general

export async function fetchTeamFixtures(teamId: number, forceRefresh = false): Promise<AgencyFixture[]> {
  const cacheKey = `${TEAM_FIXTURES_CACHE_PREFIX}:${teamId}`
  if (!forceRefresh) {
    const cached = getCachedGeneric<AgencyFixture[]>(cacheKey, TEAM_FIXTURES_CACHE_TTL)
    if (cached) return cached
  }
  const raw = await getTeamFixtures(teamId)
  const fixtures = raw.map(f => mapFixture(f, teamId))
  // No cachear resultados vacíos: getTeamFixtures traga sus propios errores y
  // devuelve [] ante una falla transitoria de la API. Cachear ese [] por 4h
  // dejaría Resumen/Calendario/Notas en blanco sin forma de reintentar.
  if (fixtures.length > 0) setCacheGeneric(cacheKey, fixtures)
  return fixtures
}

export function toArDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('sv-SE', { timeZone: AR_TZ }).format(d)
}

export function getFixturesForDate(fixtures: AgencyFixture[], date: Date): AgencyFixture[] {
  const target = toArDateKey(date)
  return fixtures.filter(f => toArDateKey(f.date) === target)
}

export function groupFixturesByDate(fixtures: AgencyFixture[]): Map<string, AgencyFixture[]> {
  const groups = new Map<string, AgencyFixture[]>()
  for (const f of fixtures) {
    const key = toArDateKey(f.date)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(f)
  }
  return groups
}

// ─── PLAYER ID LOOKUP ────────────────────────────────────────────────────────

const PLAYER_ID_CACHE_KEY = 'dg-playerid-cache'
const PLAYER_ID_CACHE_TTL = 7 * 24 * 60 * 60 * 1000

export async function searchApiPlayerId(playerName: string, teamId: number): Promise<number | null> {
  const cacheKey = `${PLAYER_ID_CACHE_KEY}:${playerName}:${teamId}`
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Date.now() - cached.timestamp < PLAYER_ID_CACHE_TTL) return cached.data
    }
  } catch { /* ignore */ }

  try {
    const res = await apiFetch<Array<{ player: { id: number; name: string } }>>('/players/squads', { team: String(teamId) })
    const squad = res.response?.[0] as any
    if (!squad?.players) return null

    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const target = normalize(playerName)

    let match: number | null = null
    for (const p of squad.players) {
      const name = normalize(p.name ?? '')
      if (name === target) { match = p.id; break }
      const targetParts = target.split(' ')
      const nameParts = name.split(' ')
      const targetLast = targetParts[targetParts.length - 1]
      const nameLast = nameParts[nameParts.length - 1]
      if (targetLast === nameLast && targetParts[0]?.[0] === nameParts[0]?.[0]) {
        match = p.id
      }
    }

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data: match, timestamp: Date.now() }))
    } catch { /* quota */ }
    return match
  } catch {
    return null
  }
}

// ─── INJURIES ───────────────────────────────────────────────────────────────

export interface PlayerInjury {
  player: { id: number; name: string; photo: string }
  team: { id: number; name: string; logo: string }
  fixture: { id: number; date: string } | null
  league: { name: string; country: string; flag: string | null } | null
  type: string
  reason: string
}

export interface PlayerSidelined {
  type: string
  start: string
  end: string | null
}

const INJURY_CACHE_KEY = 'dg-injuries-cache'
const INJURY_CACHE_TTL = 12 * 60 * 60 * 1000

export async function fetchPlayerInjuries(playerId: number): Promise<PlayerSidelined[]> {
  const cacheKey = `${INJURY_CACHE_KEY}:${playerId}`
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Date.now() - cached.timestamp < INJURY_CACHE_TTL) return cached.data
    }
  } catch { /* ignore */ }

  try {
    const res = await apiFetch<PlayerSidelined[]>('/sidelined', { player: String(playerId) })
    const injuries = res.response ?? []
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data: injuries, timestamp: Date.now() }))
    } catch { /* quota */ }
    return injuries
  } catch {
    return []
  }
}

// ─── TRANSFERS ──────────────────────────────────────────────────────────────

export interface PlayerTransfer {
  date: string
  type: string
  teams: {
    in: { id: number; name: string; logo: string }
    out: { id: number; name: string; logo: string }
  }
  fee: string | null
}

const TRANSFER_CACHE_KEY = 'dg-transfers-cache'
const TRANSFER_CACHE_TTL = 24 * 60 * 60 * 1000

export async function fetchPlayerTransfers(playerId: number): Promise<PlayerTransfer[]> {
  const cacheKey = `${TRANSFER_CACHE_KEY}:${playerId}`
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Date.now() - cached.timestamp < TRANSFER_CACHE_TTL) return cached.data
    }
  } catch { /* ignore */ }

  try {
    const res = await apiFetch<Array<{ player: any; update: string; transfers: Array<{ date: string; type: string; teams: PlayerTransfer['teams'] }> }>>('/transfers', { player: String(playerId) })
    const raw = res.response?.[0]?.transfers ?? []
    const transfers: PlayerTransfer[] = raw.map(t => ({
      date: t.date,
      type: t.type,
      teams: t.teams,
      fee: (t as any).fee ?? null,
    }))
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data: transfers, timestamp: Date.now() }))
    } catch { /* quota */ }
    return transfers
  } catch {
    return []
  }
}

export interface AgencyTransfer extends PlayerTransfer {
  playerName: string
  playerImage: string | null
}

const AGENCY_TRANSFERS_CACHE_KEY = 'dg-agency-transfers'
const AGENCY_TRANSFERS_CACHE_TTL = 24 * 60 * 60 * 1000

const SQUAD_CACHE_KEY = 'dg-squad-cache'
const SQUAD_CACHE_TTL = 7 * 24 * 60 * 60 * 1000

export interface SquadPlayer {
  id: number
  name: string
  age: number | null
  number: number | null
  position: string | null
  photo: string | null
}

export async function fetchSquadCached(teamId: number): Promise<SquadPlayer[]> {
  const cacheKey = `${SQUAD_CACHE_KEY}:${teamId}`
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Date.now() - cached.timestamp < SQUAD_CACHE_TTL) return cached.data
    }
  } catch { /* ignore */ }

  try {
    const res = await apiFetch<any>('/players/squads', { team: String(teamId) })
    const squad = res.response?.[0]
    const players: SquadPlayer[] = (squad?.players ?? []).map((p: any) => ({
      id: p.id as number,
      name: (p.name ?? '') as string,
      age: (p.age ?? null) as number | null,
      number: (p.number ?? null) as number | null,
      position: (p.position ?? null) as string | null,
      photo: (p.photo ?? null) as string | null,
    }))
    try { localStorage.setItem(cacheKey, JSON.stringify({ data: players, timestamp: Date.now() })) } catch { /* quota */ }
    return players
  } catch {
    return []
  }
}

function resolvePlayerInSquad(playerName: string, squad: Array<{ id: number; name: string }>): number | null {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const target = norm(playerName)
  for (const p of squad) {
    const name = norm(p.name)
    if (name === target) return p.id
    const tParts = target.split(' ')
    const nParts = name.split(' ')
    if (tParts[tParts.length - 1] === nParts[nParts.length - 1] && tParts[0]?.[0] === nParts[0]?.[0]) return p.id
  }
  return null
}

export async function fetchAgencyTransfers(onProgress?: (done: number, total: number) => void): Promise<AgencyTransfer[]> {
  try {
    const raw = localStorage.getItem(AGENCY_TRANSFERS_CACHE_KEY)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Date.now() - cached.timestamp < AGENCY_TRANSFERS_CACHE_TTL) return cached.data
    }
  } catch { /* ignore */ }

  const { AGENCY_PLAYERS } = await import('@/constants/agencyPlayers')
  const active = AGENCY_PLAYERS.filter(p => !p.isReserve && p.apiTeamId)

  // Group by team to share squad API calls
  const byTeam = new Map<number, typeof active>()
  for (const p of active) {
    const list = byTeam.get(p.apiTeamId!) ?? []
    list.push(p)
    byTeam.set(p.apiTeamId!, list)
  }

  // Phase 1: Resolve API-Football IDs (1 squad call per team)
  const playerApiIds = new Map<string, number>()
  const teams = Array.from(byTeam.entries())
  for (let i = 0; i < teams.length; i += 3) {
    const batch = teams.slice(i, i + 3)
    await Promise.all(batch.map(async ([teamId, players]) => {
      const squad = await fetchSquadCached(teamId)
      for (const player of players) {
        const apiId = resolvePlayerInSquad(player.fullName, squad)
        if (apiId) playerApiIds.set(player.fullName, apiId)
      }
    }))
    if (i + 3 < teams.length) await new Promise(r => setTimeout(r, 800))
  }

  // Phase 2: Fetch transfers (cached individually for 24h)
  const resolved = active.filter(p => playerApiIds.has(p.fullName))
  const allTransfers: AgencyTransfer[] = []
  let done = 0

  for (let i = 0; i < resolved.length; i += 5) {
    const batch = resolved.slice(i, i + 5)
    const results = await Promise.all(
      batch.map(async (player) => {
        const apiId = playerApiIds.get(player.fullName)!
        const transfers = await fetchPlayerTransfers(apiId)
        done++
        onProgress?.(done, resolved.length)
        return transfers.map(t => ({ ...t, playerName: player.shortName, playerImage: player.image }))
      })
    )
    allTransfers.push(...results.flat())
    if (i + 5 < resolved.length) await new Promise(r => setTimeout(r, 800))
  }

  allTransfers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  try {
    localStorage.setItem(AGENCY_TRANSFERS_CACHE_KEY, JSON.stringify({ data: allTransfers, timestamp: Date.now() }))
  } catch { /* quota */ }

  return allTransfers
}


export interface ResolvedTeam { teamId: number; teamName: string }

/** Resuelve el equipo actual de un jugador por su id API-Football (best-effort). */
export async function resolvePlayerTeam(apiPlayerId: number): Promise<ResolvedTeam | null> {
  const season = String(new Date().getFullYear())
  try {
    const res = await apiFetch<any[]>('/players', { id: String(apiPlayerId), season })
    const stats = (res.response?.[0] as any)?.statistics
    if (!stats || stats.length === 0) return null
    // Tomar el primer equipo con id (suele ser el de la temporada en curso)
    const withTeam = stats.find((s: any) => s?.team?.id)
    if (!withTeam) return null
    return { teamId: withTeam.team.id, teamName: withTeam.team.name }
  } catch (e) {
    console.error('resolvePlayerTeam error:', e)
    return null
  }
}

// ─── STANDINGS ──────────────────────────────────────────────────────────────

export interface StandingRow {
  rank: number
  teamId: number
  teamName: string
  teamLogo: string
  points: number
  goalsDiff: number
  form: string
  played: number
  win: number
  draw: number
  lose: number
  goalsFor: number
  goalsAgainst: number
  group: string
}

export function mapStandingsResponse(raw: any): StandingRow[][] {
  const groups: any[][] = raw?.response?.[0]?.league?.standings ?? []
  return groups.map(group =>
    group.map((row: any): StandingRow => ({
      rank: row.rank,
      teamId: row.team.id,
      teamName: row.team.name,
      teamLogo: row.team.logo,
      points: row.points,
      goalsDiff: row.goalsDiff,
      form: row.form ?? '',
      played: row.all.played,
      win: row.all.win,
      draw: row.all.draw,
      lose: row.all.lose,
      goalsFor: row.all.goals.for,
      goalsAgainst: row.all.goals.against,
      group: row.group,
    })),
  )
}

const STANDINGS_CACHE_PREFIX = 'dg-standings-cache'
const STANDINGS_CACHE_TTL = 6 * 60 * 60 * 1000 // 6h

export async function fetchLeagueStandings(leagueId: number, season: number, forceRefresh = false): Promise<StandingRow[][]> {
  const cacheKey = `${STANDINGS_CACHE_PREFIX}:${leagueId}:${season}`
  if (!forceRefresh) {
    const cached = getCachedGeneric<StandingRow[][]>(cacheKey, STANDINGS_CACHE_TTL)
    if (cached) return cached
  }
  const raw = await apiFetch<any>('/standings', { league: String(leagueId), season: String(season) })
  const groups = mapStandingsResponse(raw)
  setCacheGeneric(cacheKey, groups)
  return groups
}

const FIXTURE_DETAIL_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // partido ya jugado no cambia: cache largo

export async function fetchFixtureLineups(fixtureId: number): Promise<ApiFixtureLineup[]> {
  const cacheKey = `dg-fixture-lineups-cache:${fixtureId}`
  const cached = getCachedGeneric<ApiFixtureLineup[]>(cacheKey, FIXTURE_DETAIL_CACHE_TTL)
  if (cached) return cached
  const res = await apiFetch<ApiFixtureLineup[]>('/fixtures/lineups', { fixture: String(fixtureId) }).catch(() => null)
  const lineups = res?.response ?? []
  if (lineups.length > 0) setCacheGeneric(cacheKey, lineups)
  return lineups
}

export async function fetchFixtureEvents(fixtureId: number): Promise<ApiFixtureEvent[]> {
  const cacheKey = `dg-fixture-events-cache:${fixtureId}`
  const cached = getCachedGeneric<ApiFixtureEvent[]>(cacheKey, FIXTURE_DETAIL_CACHE_TTL)
  if (cached) return cached
  const res = await apiFetch<ApiFixtureEvent[]>('/fixtures/events', { fixture: String(fixtureId) }).catch(() => null)
  const events = res?.response ?? []
  if (events.length > 0) setCacheGeneric(cacheKey, events)
  return events
}
