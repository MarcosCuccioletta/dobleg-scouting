export const TROPHY_CATALOG: { key: string; label: string; imageUrl: string }[] = [
  { key: 'sudamericana', label: 'Copa Sudamericana', imageUrl: '/trophies/sudamericana.png' },
  { key: 'recopa', label: 'Recopa Sudamericana', imageUrl: '/trophies/recopa.png' },
  { key: 'suruga-bank', label: 'Copa Suruga Bank', imageUrl: '/trophies/suruga-bank.png' },
  { key: 'copa-argentina', label: 'Copa Argentina', imageUrl: '/trophies/copa-argentina.png' },
  { key: 'campeon-argentina', label: 'Campeón de Argentina / Liga Profesional', imageUrl: '/trophies/campeon-argentina.png' },
  { key: 'primera-nacional', label: 'Primera Nacional', imageUrl: '/trophies/primera-nacional.png' },
  { key: 'generico', label: 'Otro título', imageUrl: '/trophies/generico.png' },
]

export function trophyImageUrl(key: string): string {
  return TROPHY_CATALOG.find(t => t.key === key)?.imageUrl ?? '/trophies/generico.png'
}
