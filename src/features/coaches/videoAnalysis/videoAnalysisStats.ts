import type { ParsedInstance } from './parseNacsportXml'
import { classifyPhase, inferZoneRect, type ActionPhase } from './videoAnalysisTagging'

export interface StatsMatch {
  match_date: string
  instances: ParsedInstance[]
}

function allInstances(matches: StatsMatch[]): ParsedInstance[] {
  return matches.flatMap(m => m.instances)
}

export function countByCode(matches: StatsMatch[]): { code: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const inst of allInstances(matches)) {
    counts.set(inst.code, (counts.get(inst.code) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
}

export function countByPhase(matches: StatsMatch[]): Record<ActionPhase, number> {
  const result: Record<ActionPhase, number> = { defensiva: 0, ofensiva: 0, transicion: 0, abp: 0, otro: 0 }
  for (const inst of allInstances(matches)) {
    result[classifyPhase(inst.code)]++
  }
  return result
}

export function evolutionByMatch(matches: StatsMatch[], code: string): { matchDate: string; count: number }[] {
  return [...matches]
    .sort((a, b) => a.match_date.localeCompare(b.match_date))
    .map(m => ({ matchDate: m.match_date, count: m.instances.filter(i => i.code === code).length }))
}

export function pitchPoints(
  matches: StatsMatch[],
  code: string,
): { exact: { x: number; y: number }[]; zones: { x1: number; y1: number; x2: number; y2: number }[] } {
  const exact: { x: number; y: number }[] = []
  let hasZonelessInstance = false
  for (const inst of allInstances(matches)) {
    if (inst.code !== code) continue
    if (inst.x !== null && inst.y !== null) {
      exact.push({ x: inst.x, y: inst.y })
    } else {
      hasZonelessInstance = true
    }
  }
  // inferZoneRect depende solo de `code`, no de cada instancia individual -- todas las
  // instancias de este grupo comparten el mismo codigo, asi que la zona inferida (si existe)
  // es identica para todas. Calcularla una sola vez fuera del loop evita apilar el mismo
  // rectangulo N veces (lo que en VideoAnalysisPitch se veria como una capa opaca, no
  // translucida).
  const zone = hasZonelessInstance ? inferZoneRect(code) : null
  const zones = zone ? [zone] : []
  return { exact, zones }
}
