
export interface SeasonScoreRow {
  player_id: number;
  season: number;
  position: string;
  league_id: number;
  matches_played: number;
  avg_rating: number | null;
  total_goals: number;
  total_assists: number;
  tackles_p90: number | null;
  interceptions_p90: number | null;
  blocks_p90: number | null;
  duels_won_pct: number | null;
  passes_accuracy: number | null;
  passes_key_p90: number | null;
  passes_total_p90: number | null;
  dribbles_success_p90: number | null;
  dribbles_pct: number | null;
  shots_on_p90: number | null;
  shots_pct: number | null;
  goals_p90: number | null;
  assists_p90: number | null;
  fouls_drawn_p90: number | null;
  saves_p90: number | null;
  goals_conceded_p90: number | null;
  penalty_saved_avg: number | null;
  clean_sheet_pct: number | null;
  updated_at: string;
}

const WEIGHTED_AVG_FIELDS: (keyof SeasonScoreRow)[] = [
  'avg_rating', 'tackles_p90', 'interceptions_p90', 'blocks_p90',
  'duels_won_pct', 'passes_accuracy', 'passes_key_p90', 'passes_total_p90',
  'dribbles_success_p90', 'dribbles_pct', 'shots_on_p90', 'shots_pct',
  'goals_p90', 'assists_p90', 'fouls_drawn_p90', 'saves_p90',
  'goals_conceded_p90', 'penalty_saved_avg', 'clean_sheet_pct',
];

// Fusiona filas fragmentadas por competencia (mismo player_id+position, distinto
// league_id) en una sola fila por jugador+posicion. Sin esto, un jugador que jugo
// la misma posicion en dos competencias la misma temporada queda con dos filas
// "iguales" en player_season_scores, con distinto matches_played/avg_rating --
// el bug real detras de ver "EXT 6 PJ 6.1" y "EXT 7 PJ 5.4" en la ficha.
//
// PRECONDICIÓN: Asume que todas las filas de `rows` pertenecen a la misma
// temporada (`season`). No se incluye `season` en la clave de agrupamiento porque
// el único caller (recalc-scores/index.ts) siempre invoca esta función con las
// filas de una sola temporada a la vez, dentro de un bucle `for (const season of...)`.
export function mergeSeasonScoreFragments(rows: SeasonScoreRow[]): SeasonScoreRow[] {
  const byKey = new Map<string, SeasonScoreRow[]>();
  for (const r of rows) {
    const key = `${r.player_id}|${r.position}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(r);
  }

  const merged: SeasonScoreRow[] = [];
  for (const fragments of byKey.values()) {
    if (fragments.length === 1) {
      merged.push(fragments[0]);
      continue;
    }

    const totalMatches = fragments.reduce((s, f) => s + (f.matches_played ?? 0), 0);
    const weightedAvg = (field: keyof SeasonScoreRow): number | null => {
      let num = 0;
      let den = 0;
      for (const f of fragments) {
        const v = f[field] as number | null | undefined;
        if (v === null || v === undefined) continue;
        const w = f.matches_played ?? 0;
        num += v * w;
        den += w;
      }
      return den === 0 ? null : Math.round((num / den) * 100) / 100;
    };

    // La liga con mas partidos queda como league_id de referencia (informativo:
    // ya no forma parte de la clave unica de la tabla, ver Task 2).
    const mainFragment = [...fragments].sort((a, b) => (b.matches_played ?? 0) - (a.matches_played ?? 0))[0];

    const mergedRow: SeasonScoreRow = {
      ...mainFragment,
      matches_played: totalMatches,
      total_goals: fragments.reduce((s, f) => s + (f.total_goals ?? 0), 0),
      total_assists: fragments.reduce((s, f) => s + (f.total_assists ?? 0), 0),
    };
    for (const field of WEIGHTED_AVG_FIELDS) {
      (mergedRow as unknown as Record<string, number | null>)[field] = weightedAvg(field);
    }
    merged.push(mergedRow);
  }

  return merged;
}
