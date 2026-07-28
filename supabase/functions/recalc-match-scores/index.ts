// Recalcula `match_score` de los partidos ya guardados, sin volver a pedirle
// nada a la API.
//
// Hace falta porque `match_score` se calcula en el momento de la sincronización:
// los partidos sincronizados antes de corregir la precisión de pase (venía como
// cantidad de pases, no porcentaje) y la posición de los carrileros quedaron con
// un score viejo, aunque los datos crudos ya estén bien.
//
// Trabaja por tandas de fixtures para no pasarse del tiempo de ejecución.
// Body: { from_fixture_id?: number, limit?: number }
// Devuelve `last_fixture_id` para encadenar la tanda siguiente, y `done: true`
// cuando ya no quedan fixtures.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getSupabaseAdmin } from '../_shared/supabase-client.ts';
import { calculateMatchScore } from '../_shared/scoring.ts';
import type { PlayerMatchRow } from '../_shared/types.ts';

const DEFAULT_LIMIT = 300;

serve(async (req) => {
  const supabase = getSupabaseAdmin();

  let fromId = 0;
  let limit = DEFAULT_LIMIT;
  try {
    const body = await req.json();
    if (typeof body?.from_fixture_id === 'number') fromId = body.from_fixture_id;
    if (typeof body?.limit === 'number') limit = Math.min(1000, Math.max(1, body.limit));
  } catch {
    // sin body: arranca del principio
  }

  try {
    const { data: fixtures, error: fxErr } = await supabase
      .from('fixtures')
      .select('id')
      .gt('id', fromId)
      .order('id', { ascending: true })
      .limit(limit);

    if (fxErr) throw fxErr;
    if (!fixtures || fixtures.length === 0) {
      return new Response(
        JSON.stringify({ done: true, fixtures_processed: 0, rows_updated: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const ids = fixtures.map(f => f.id);

    // PostgREST corta en 1000 filas por consulta. Hay que paginar sí o sí: si un
    // partido queda con el plantel incompleto, el score se calcula contra menos
    // rivales de los que jugaron y sale mal.
    const rows: PlayerMatchRow[] = [];
    const PAGE = 1000;
    for (let offset = 0; ; offset += PAGE) {
      const { data: page, error: rowsErr } = await supabase
        .from('player_match_stats')
        .select('*')
        .in('fixture_id', ids)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE - 1);

      if (rowsErr) throw rowsErr;
      if (!page || page.length === 0) break;
      rows.push(...(page as PlayerMatchRow[]));
      if (page.length < PAGE) break;
    }

    const byFixture = new Map<number, PlayerMatchRow[]>();
    for (const r of rows) {
      const list = byFixture.get(r.fixture_id);
      if (list) list.push(r);
      else byFixture.set(r.fixture_id, [r]);
    }

    // Se reenvía la fila entera y no sólo `match_score`: un upsert con columnas
    // parciales arma un INSERT incompleto y falla contra las columnas NOT NULL,
    // aunque después resuelva por el camino del conflicto. Se sacan `id` (es
    // identidad generada, Postgres rechaza que se la mande) y `created_at`.
    const updates: Record<string, unknown>[] = [];

    for (const group of byFixture.values()) {
      for (const row of group) {
        const peers = group.filter(p => p.player_id !== row.player_id);
        const score = calculateMatchScore(row, peers);
        // Sólo se escribe lo que realmente cambió.
        if (score !== row.match_score) {
          const { id: _id, created_at: _createdAt, ...rest } =
            row as PlayerMatchRow & { id?: number; created_at?: string };
          updates.push({ ...rest, match_score: score });
        }
      }
    }

    // Se actualiza de a tandas para no armar un payload gigante.
    const CHUNK = 500;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const { error } = await supabase
        .from('player_match_stats')
        .upsert(updates.slice(i, i + CHUNK), { onConflict: 'player_id,fixture_id' });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        done: false,
        fixtures_processed: fixtures.length,
        rows_seen: rows.length,
        rows_updated: updates.length,
        last_fixture_id: ids[ids.length - 1],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
