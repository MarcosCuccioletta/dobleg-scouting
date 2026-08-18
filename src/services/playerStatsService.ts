import { supabase } from '@/lib/supabase';
import type {
  PlayerWithScore,
  PlayerMatchStat,
  PlayerSeasonScore,
  PositionAverage,
  PositionMetricAverages,
  Position,
  LeagueInfo,
  RecentFormPlayer,
} from '@/types/scoring';

/**
 * Temporada(s) vigente(s) a incluir por defecto en las consultas de stats/scores.
 *
 * Las ligas de calendario europeo (ago-may: Primeira Liga, Bundesliga, Premier
 * League, etc.) numeran la temporada por el año en que arrancó — la 2025/26 es
 * `season = 2025` en `leagues` — mientras que las de calendario anual (Sudamérica,
 * MLS) usan el año en curso (`season = 2026`). No existe un único "año vigente" que
 * sirva para ambas convenciones a la vez.
 *
 * Antes esta función intentaba adivinar cuál de las dos aplicaba según el mes y
 * colapsaba a un solo año cuando coincidían — en agosto 2026 devolvía sólo [2026],
 * dejando afuera TODA fila de una liga europea (todavía en season=2025 porque la
 * 2026/27 recién arranca) y de cualquier otra que no haya rotado. Eso vaciaba el
 * score de jugadores en ligas enteras, no un caso puntual. Devolver siempre los dos
 * últimos años cubre ambas convenciones sin depender de en qué mes cambia cada una;
 * el resto del pipeline (dedup por partidos jugados / equipo) ya sabe quedarse con
 * la fila más representativa entre las que traiga.
 */
export function currentSeasons(): number[] {
  const year = new Date().getFullYear();
  return [year - 1, year];
}

export async function fetchPlayersList(filters: {
  positions?: Position[];
  league_id?: number;
  team_id?: number;
  min_score?: number;
  min_age?: number;
  max_age?: number;
  min_matches?: number;
  min_market_value?: number;
  max_market_value?: number;
  max_contract_months?: number;
  agents?: string[];
  search?: string;
  season?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ players: PlayerWithScore[]; count: number }> {
  const seasons = filters.season ? [filters.season] : currentSeasons();
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 50;

  // El colapso a 1 fila por jugador (sobre las múltiples filas posición/temporada/liga
  // de player_season_scores) se hace en el RPC fetch_players_list ANTES de paginar.
  // Así el contador es de JUGADORES únicos y un jugador no reaparece en varias páginas.
  const { data, error } = await supabase.rpc('fetch_players_list', {
    p_seasons: seasons,
    p_positions: filters.positions?.length ? filters.positions : null,
    p_league_id: filters.league_id ?? null,
    p_team_id: filters.team_id ?? null,
    p_min_score: filters.min_score ?? null,
    p_min_matches: filters.min_matches ?? null,
    p_min_age: filters.min_age ?? null,
    p_max_age: filters.max_age ?? null,
    p_min_market_value: filters.min_market_value ?? null,
    p_max_market_value: filters.max_market_value ?? null,
    p_max_contract_months: filters.max_contract_months ?? null,
    p_agents: filters.agents?.length ? filters.agents : null,
    p_search: filters.search ?? null,
    p_page: page,
    p_page_size: pageSize,
  });
  if (error) throw error;

  const result = (data ?? { count: 0, players: [] }) as {
    count: number;
    players: PlayerWithScore[];
  };
  return { players: result.players ?? [], count: result.count ?? 0 };
}

/**
 * `fetchPlayerDetail` trae las ultimas 2 temporadas (`currentSeasons()`) para no
 * perder jugadores de ligas con convencion de temporada distinta (ver el comentario
 * de `currentSeasons`) -- pero eso significa que un jugador con datos en ambas puede
 * traer 2 filas para la MISMA posicion (una por temporada). Sin deduplicar, "Score
 * por posicion" las mostraba como si fueran posiciones distintas (dos filas "EXT"
 * sin ninguna marca de que son anos distintos, indistinguible de un bug de
 * fragmentacion real) y el score principal de la ficha elegia la primera fila que
 * encontraba `.find()`, sin garantia de que fuera la temporada mas reciente.
 * Se queda con la fila de la temporada mas nueva para cada posicion.
 */
export function dedupeSeasonScoresByPosition(scores: PlayerSeasonScore[]): PlayerSeasonScore[] {
  const bestByPosition = new Map<string, PlayerSeasonScore>();
  for (const s of scores) {
    const existing = bestByPosition.get(s.position);
    if (!existing || s.season > existing.season) bestByPosition.set(s.position, s);
  }
  return [...bestByPosition.values()];
}

export async function fetchPlayerDetail(playerId: number, season?: number): Promise<{
  player: PlayerWithScore;
  matches: PlayerMatchStat[];
  allSeasonScores: PlayerSeasonScore[];
} | null> {
  const seasons = season ? [season] : currentSeasons();

  const [playerRes, scoresRes, matchesRes] = await Promise.all([
    supabase.from('players').select(`
      *, team:teams(id, name, logo, league_id)
    `).eq('id', playerId).single(),

    supabase.from('player_season_scores').select('*')
      .eq('player_id', playerId).in('season', seasons),

    supabase.from('player_match_stats').select(`
      *,
      fixture:fixtures(
        id, date, home_team_id, away_team_id, score_home, score_away, league_id,
        home_team:teams!fixtures_home_team_id_fkey(name),
        away_team:teams!fixtures_away_team_id_fkey(name)
      )
    `)
      .eq('player_id', playerId)
      .order('fixture(date)', { ascending: true }),
  ]);

  if (playerRes.error || !playerRes.data) return null;

  const seasonScores = dedupeSeasonScoresByPosition(scoresRes.data ?? []);
  const primaryScore = seasonScores.find(
    (s: any) => s.position === playerRes.data.primary_position
  );

  return {
    player: {
      ...playerRes.data,
      season_scores: seasonScores,
      primary_score: primaryScore?.avg_score ?? null,
      primary_percentile: primaryScore?.percentile ?? null,
    },
    matches: matchesRes.data ?? [],
    allSeasonScores: seasonScores,
  };
}

export async function fetchPositionAverages(
  season?: number
): Promise<PositionAverage[]> {
  const seasons = season ? [season] : currentSeasons();

  const { data, error } = await supabase
    .from('player_season_scores')
    .select('position, league_id, avg_score')
    .in('season', seasons)
    .not('avg_score', 'is', null);

  if (error) throw error;

  const groups = new Map<string, { scores: number[]; league_id: number; position: string }>();
  for (const row of data ?? []) {
    const key = `${row.position}|${row.league_id}`;
    if (!groups.has(key)) groups.set(key, { scores: [], league_id: row.league_id, position: row.position });
    groups.get(key)!.scores.push(row.avg_score);
  }

  return Array.from(groups.values()).map(g => ({
    position: g.position as Position,
    league_id: g.league_id,
    avg_score: Math.round((g.scores.reduce((a, b) => a + b, 0) / g.scores.length) * 10) / 10,
    player_count: g.scores.length,
  }));
}

export interface AgencyMarketValueRow {
  name: string;
  market_value_eur: number;
}

/**
 * Valor de mercado vivo de todo el roster Doble G, tal cual lo tiene `players`
 * (refrescado semanalmente desde Transfermarkt por el cron de `enrich-player`).
 * Se filtra por `agent = 'Doble G Sports Group'` — mismo campo, seteado por ese
 * mismo enrich, que ya se usa en la auditoría de roster para cruzar altas. Sirve
 * para pisar el valor de mercado cargado a mano en el Sheet/`agencyPlayers.ts`
 * de Scouting Interno, que nadie vuelve a actualizar una vez tiene un valor.
 */
export async function fetchAgencyMarketValues(): Promise<AgencyMarketValueRow[]> {
  const { data, error } = await supabase
    .from('players')
    .select('name, market_value_eur')
    .eq('agent', 'Doble G Sports Group')
    .not('market_value_eur', 'is', null);

  if (error) throw error;
  return (data ?? [])
    .filter((r: any) => typeof r.market_value_eur === 'number' && r.market_value_eur > 0)
    .map((r: any) => ({ name: r.name as string, market_value_eur: r.market_value_eur as number }));
}

export async function fetchDistinctAgents(): Promise<string[]> {
  const { data, error } = await supabase
    .from('players')
    .select('agent')
    .not('agent', 'is', null)
    .order('agent');

  if (error) throw error;
  const unique = [...new Set((data ?? []).map((r: any) => r.agent as string).filter(Boolean))];
  return unique;
}

export async function fetchLeagues(): Promise<LeagueInfo[]> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('has_player_stats', true)
    .order('tier', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface TeamInfo {
  id: number;
  name: string;
  logo: string | null;
  league_id: number;
}

export async function fetchTeamsByLeague(leagueId: number): Promise<TeamInfo[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, logo, league_id')
    .eq('league_id', leagueId)
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export interface ScoreLookupEntry {
  player_id: number;
  name: string;
  score: number;
  position: Position;
  percentile: number | null;
  matches_played: number;
}

export interface ScoreLookupRow {
  player_id: number;
  name: string;
  current_team_id: number | null;
  transfermarkt_id: number | null;
  birth_date: string | null;
  score: number;
  position: Position;
  percentile: number | null;
  matches_played: number;
  season: number;
}

/**
 * Identidad real de la persona, no de la fila: mismo criterio que `dedupePlayers()`
 * en Informes (transfermarkt_id si lo tiene — matcheado por nombre+club+edad contra
 * Transfermarkt — si no, nombre + fecha de nacimiento). Dos filas con el mismo id de
 * Transfermarkt SIEMPRE son la misma persona (API-Football y Sofascore duplicando al
 * mismo jugador, o un fragmento de 1 partido detectado en otra posición). Sin ninguno
 * de los dos datos, cada fila queda como su propia identidad — no se fusiona a ciegas
 * sólo por compartir nombre.
 */
function identityKey(row: ScoreLookupRow): string {
  const norm = (s: string) =>
    s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (row.transfermarkt_id) return `tm:${row.transfermarkt_id}`;
  if (row.birth_date) return `nb:${norm(row.name)}|${row.birth_date}`;
  return `row:${row.player_id}`;
}

/**
 * Arma el mapa nombre→score.
 *
 * 1) Agrupa las filas por identidad REAL (no por nombre): así un jugador duplicado
 *    entre API-Football y Sofascore, o con un fragmento de 1 partido mal detectado en
 *    otra posición, siempre se resuelve dentro de su propio grupo — gana quien jugó
 *    más partidos ahí adentro (caso real: José Paradela mostraba 4.2, el score de un
 *    fragmento de 1 partido, en vez de su 6.5 real de 31 partidos; ambas filas son la
 *    misma persona vía transfermarkt_id).
 * 2) Recién ahí arma el mapa por nombre. Si dos identidades REALES distintas
 *    comparten nombre (dos personas de verdad, no un duplicado), el jugador de la
 *    agencia con `apiTeamId` conocido desempata por equipo (caso real: "Julián López"
 *    de Defensa y Justicia vs. otro "Julián López" de una liga menor — con
 *    transfermarkt_id o fecha de nacimiento ya quedan en grupos separados solos; esto
 *    es sólo el resguardo final para cuando ninguno de los dos datos está disponible).
 */
export function buildScoreLookup(
  rows: ScoreLookupRow[],
  agencyPlayers: { fullName: string; shortName: string; apiTeamId: number | null }[],
): Map<string, ScoreLookupEntry> {
  const norm = (s: string) =>
    s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const toEntry = (row: ScoreLookupRow): ScoreLookupEntry => ({
    player_id: row.player_id,
    name: row.name,
    score: row.score,
    position: row.position,
    percentile: row.percentile,
    matches_played: row.matches_played,
  });

  // Equipo actual conocido por jugador de agencia (usado en el paso 1 de abajo).
  const apiTeamIdByName = new Map<string, number>();
  for (const ap of agencyPlayers) {
    if (ap.apiTeamId) apiTeamIdByName.set(norm(ap.fullName), ap.apiTeamId);
  }

  // Paso 1: una fila representante por identidad real. Por defecto gana la temporada
  // más nueva (mismo criterio que `dedupeSeasonScoresByPosition` para la ficha
  // individual) y, dentro de la misma temporada, la de más partidos jugados — salvo
  // que el jugador sea de agencia con equipo actual conocido: ahí gana la fila de ESE
  // equipo aunque tenga menos partidos o sea de una temporada más vieja. Sin el
  // desempate por equipo, un jugador recién transferido queda tapado por su equipo
  // viejo indefinidamente: el equipo nuevo casi siempre tiene menos partidos
  // acumulados que el viejo apenas después de un traspaso (caso real: Mauricio Vera a
  // Bhayangkara FC — 2 partidos/score 6.8 — tapado por Nacional en Sofascore — 4
  // partidos/score 3.9 — porque el paso 1 descartaba la fila de Bhayangkara antes de
  // que el desempate por equipo del paso 2 llegara a verla).
  //
  // Sin el desempate por temporada, dos filas del MISMO jugador/equipo en años
  // distintos (nada que ver con un traspaso) se resolvían por partidos jugados nomás
  // — y la ficha individual (`dedupeSeasonScoresByPosition`) sí prioriza la temporada
  // más nueva, así que la lista y la ficha podían mostrar scores distintos para la
  // misma persona (caso real: Julián López con 9 partidos/score 5.0 en 2025 pero sólo
  // 6 partidos/score 4.8 en 2026 — la lista mostraba el 5.0 viejo, la ficha el 4.8
  // correcto).
  const isNewerRepresentative = (row: ScoreLookupRow, existing: ScoreLookupRow): boolean =>
    row.season !== existing.season ? row.season > existing.season : row.matches_played > existing.matches_played;

  const byIdentity = new Map<string, ScoreLookupRow>();
  for (const row of rows) {
    if (!row.name) continue;
    const key = identityKey(row);
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, row);
      continue;
    }
    const knownTeamId = apiTeamIdByName.get(norm(row.name));
    const rowMatchesTeam = knownTeamId != null && row.current_team_id === knownTeamId;
    const existingMatchesTeam = knownTeamId != null && existing.current_team_id === knownTeamId;
    if (rowMatchesTeam && !existingMatchesTeam) {
      byIdentity.set(key, row);
    } else if (!(existingMatchesTeam && !rowMatchesTeam) && isNewerRepresentative(row, existing)) {
      byIdentity.set(key, row);
    }
  }
  const representatives = Array.from(byIdentity.values());

  // Paso 2: por nombre, entre las identidades representantes (no entre filas sueltas).
  const map = new Map<string, ScoreLookupEntry>();
  const winnerRow = new Map<string, ScoreLookupRow>();
  for (const row of representatives) {
    const key = norm(row.name);
    const existing = winnerRow.get(key);
    if (!existing || row.matches_played > existing.matches_played) {
      winnerRow.set(key, row);
      map.set(key, toEntry(row));
    }
  }

  // Desempate por equipo: sólo entre identidades reales distintas que comparten
  // nombre (ver punto 2 del comentario de arriba). Si el ganador ya es del equipo de
  // la agencia se lo respeta tal cual.
  const bestByMatches = (candidates: ScoreLookupRow[]): ScoreLookupRow =>
    candidates.reduce((best, r) => (r.matches_played > best.matches_played ? r : best));

  for (const ap of agencyPlayers) {
    const fullKey = norm(ap.fullName);
    if (ap.apiTeamId) {
      const currentWinner = winnerRow.get(fullKey);
      if (!currentWinner || currentWinner.current_team_id !== ap.apiTeamId) {
        const teamRows = representatives.filter(r => norm(r.name) === fullKey && r.current_team_id === ap.apiTeamId);
        if (teamRows.length > 0) {
          const best = bestByMatches(teamRows);
          winnerRow.set(fullKey, best);
          map.set(fullKey, toEntry(best));
        }
      }
    }
    const shortKey = norm(ap.shortName);
    const entry = map.get(fullKey);
    if (entry && shortKey !== fullKey) {
      map.set(shortKey, entry);
    }
  }

  return map;
}

export async function fetchScoreLookup(
  season?: number
): Promise<Map<string, ScoreLookupEntry>> {
  const seasons = season ? [season] : currentSeasons();

  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('player_season_scores')
      .select(`
        player_id, position, avg_score, percentile, matches_played, season,
        player:players!inner(name, current_team_id, transfermarkt_id, birth_date)
      `)
      .in('season', seasons)
      .not('avg_score', 'is', null)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const rows = data ?? [];
    allRows = allRows.concat(rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const rows: ScoreLookupRow[] = allRows.map(row => ({
    player_id: row.player_id,
    name: (row as any).player?.name as string,
    current_team_id: ((row as any).player?.current_team_id as number | null) ?? null,
    transfermarkt_id: ((row as any).player?.transfermarkt_id as number | null) ?? null,
    birth_date: ((row as any).player?.birth_date as string | null) ?? null,
    score: row.avg_score,
    position: row.position as Position,
    percentile: row.percentile,
    matches_played: row.matches_played,
    season: row.season,
  }));

  const { AGENCY_PLAYERS } = await import('@/constants/agencyPlayers');
  return buildScoreLookup(rows, AGENCY_PLAYERS);
}

export async function fetchPlayerMatchHistory(
  playerId: number,
  position?: Position,
): Promise<PlayerMatchStat[]> {
  let query = supabase
    .from('player_match_stats')
    .select(`
      *,
      fixture:fixtures(
        id, date, home_team_id, away_team_id, score_home, score_away, league_id,
        home_team:teams!fixtures_home_team_id_fkey(name),
        away_team:teams!fixtures_away_team_id_fkey(name)
      )
    `)
    .eq('player_id', playerId)
    .not('match_score', 'is', null);

  if (position) query = query.eq('detected_position', position);

  query = query.order('fixture(date)', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchPositionMetricAverages(
  season?: number
): Promise<PositionMetricAverages[]> {
  const seasons = season ? [season] : currentSeasons();

  const { data, error } = await supabase
    .from('position_metric_averages')
    .select('*')
    .in('season', seasons);

  if (error) throw error;
  return data ?? [];
}

export async function fetchRecentForm(opts: {
  windowMonths: number;
  minMatches?: number;
  fallbackMonths?: number;
  fallbackLimit?: number;
  cheapMaxValue?: number | null;
  contractMaxMonths?: number | null;
  positions?: string[];
  limit?: number;
}): Promise<RecentFormPlayer[]> {
  const { data, error } = await supabase.rpc('fetch_recent_form', {
    p_window_months: opts.windowMonths,
    p_min_matches: opts.minMatches ?? 3,
    p_fallback_months: opts.fallbackMonths ?? 6,
    p_fallback_limit: opts.fallbackLimit ?? 5,
    p_cheap_max_value: opts.cheapMaxValue ?? null,
    p_contract_max_months: opts.contractMaxMonths ?? null,
    p_positions: opts.positions?.length ? opts.positions : null,
    p_limit: opts.limit ?? 200,
  });
  if (error) throw error;
  return (data ?? []) as RecentFormPlayer[];
}

export interface MarketValueHistoryRow {
  player_id: number;
  recorded_at: string;
  value_eur: number;
  club_name: string | null;
}

export async function fetchMarketValueHistory(
  playerId: number
): Promise<MarketValueHistoryRow[]> {
  const { data, error } = await supabase
    .from('market_value_history')
    .select('player_id, recorded_at, value_eur, club_name')
    .eq('player_id', playerId)
    .order('recorded_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ── Jugadores duplicados (API-Football vs Sofascore) ──────────────────────────
// La base tiene el mismo jugador cargado dos veces: la fila de API-Football (foto
// media.api-sports.io) y la de Sofascore (foto api.sofascore.com). La de Sofascore
// tiene muchos menos partidos y su id NO existe en API-Football, así que traspasos
// y lesiones vuelven vacíos. Para todo lo que se lee por id conviene la de
// API-Football; se resuelve el "gemelo" por transfermarkt_id o por nombre+fecha.

export function isApiFootballPlayer(p: { photo?: string | null }): boolean {
  return (p.photo ?? '').includes('media.api-sports.io');
}

const preferredIdCache = new Map<number, number>();

export async function resolvePreferredPlayerId(playerId: number): Promise<number> {
  const cached = preferredIdCache.get(playerId);
  if (cached != null) return cached;

  const { data: me } = await supabase
    .from('players')
    .select('id, name, birth_date, transfermarkt_id, photo')
    .eq('id', playerId)
    .maybeSingle();

  let resolved = playerId;

  if (me && !isApiFootballPlayer(me)) {
    let query = supabase.from('players').select('id, photo');
    if (me.transfermarkt_id) {
      query = query.eq('transfermarkt_id', me.transfermarkt_id);
    } else if (me.name && me.birth_date) {
      query = query.eq('name', me.name).eq('birth_date', me.birth_date);
    } else {
      query = query.eq('id', playerId); // sin forma de identificarlo: se queda como está
    }
    const { data: twins } = await query;
    const twin = (twins ?? []).find(t => t.id !== playerId && isApiFootballPlayer(t));
    if (twin) resolved = twin.id;
  }

  preferredIdCache.set(playerId, resolved);
  return resolved;
}

// ── Informes / pestaña Impacto ────────────────────────────────────────────────
// fetchPlayerMatchHistory filtra por posición detectada y por match_score no nulo,
// lo que subcuenta partidos. Para contar continuidad hacen falta todas las filas.

export async function fetchPlayerAllMatches(playerId: number): Promise<PlayerMatchStat[]> {
  const { data, error } = await supabase
    .from('player_match_stats')
    .select(`
      *,
      fixture:fixtures(
        id, date, home_team_id, away_team_id, score_home, score_away, league_id,
        home_team:teams!fixtures_home_team_id_fkey(name),
        away_team:teams!fixtures_away_team_id_fkey(name)
      )
    `)
    .eq('player_id', playerId)
    .order('fixture(date)', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface TeamFixtureRow {
  id: number;
  date: string;
  league_id: number;
  home_team_id: number;
  away_team_id: number;
  score_home: number | null;
  score_away: number | null;
}

export async function fetchTeamFixtures(
  teamId: number,
  fromISO: string,
  toISO?: string,
): Promise<TeamFixtureRow[]> {
  let query = supabase
    .from('fixtures')
    .select('id, date, league_id, home_team_id, away_team_id, score_home, score_away')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .gte('date', fromISO)
    .order('date', { ascending: true });

  if (toISO) query = query.lte('date', `${toISO}T23:59:59`);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export interface SquadStatRow {
  player_id: number;
  minutes: number;
  goals: number;
  assists: number;
  passes_key: number;
  duels_won: number;
  duels_total: number;
  dribbles_success: number;
  dribbles_attempted: number;
  match_score: number | null;
  detected_position: string | null;
  fixture_id: number;
  player?: { name: string } | null;
  fixture?: { date: string } | null;
}

// PostgREST corta en 1000 filas. Un plantel de una temporada ya anda por las 900
// y el corte es silencioso: los rankings del informe saldrían con datos a medias.
// Por eso se pagina hasta traer todo.
const SQUAD_PAGE = 1000;

export async function fetchSquadMatchStats(
  teamId: number,
  fromISO: string,
  toISO?: string,
): Promise<SquadStatRow[]> {
  const out: SquadStatRow[] = [];

  for (let page = 0; ; page++) {
    let query = supabase
      .from('player_match_stats')
      .select(`
        player_id, fixture_id, minutes, goals, assists, passes_key,
        duels_won, duels_total, dribbles_success, dribbles_attempted,
        match_score, detected_position,
        player:players(name),
        fixture:fixtures!inner(date)
      `)
      .eq('team_id', teamId)
      .gte('fixture.date', fromISO)
      .order('fixture_id', { ascending: true })
      .range(page * SQUAD_PAGE, (page + 1) * SQUAD_PAGE - 1);

    if (toISO) query = query.lte('fixture.date', `${toISO}T23:59:59`);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as SquadStatRow[];
    out.push(...rows);
    if (rows.length < SQUAD_PAGE) break;
  }

  return out;
}
