/**
 * PostgREST devuelve como máximo 1000 filas por consulta y NO avisa cuando corta.
 * Una consulta sin paginar sobre una tabla grande devuelve un subconjunto arbitrario
 * y el resto desaparece en silencio: si eso alimenta al scoring, los partidos que
 * quedaron afuera dejan de existir para el cálculo.
 *
 * Uso:
 *   const fixtures = await fetchAllRows((from, to) =>
 *     supabase.from('fixtures').select('id').eq('season', season).range(from, to))
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error?: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) {
      const message = (error as { message?: string })?.message ?? String(error)
      throw new Error(message)
    }
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < pageSize) break
  }
  return out
}
