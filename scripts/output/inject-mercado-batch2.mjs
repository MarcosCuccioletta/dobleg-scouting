import fs from 'fs'

const path = 'src/constants/translations.ts'
let src = fs.readFileSync(path, 'utf8')

// 1) Rename tab label "Búsquedas" -> "Búsquedas de clubes" (full rename, per language)
const tabRenames = [
  ["'mercado.tabObjetivos': \"Búsquedas\",", "'mercado.tabObjetivos': \"Búsquedas de clubes\","],
  ["'mercado.tabObjetivos': \"Club searches\",", "'mercado.tabObjetivos': \"Club searches\","],
  ["'mercado.tabObjetivos': \"Kulüp aramaları\",", "'mercado.tabObjetivos': \"Kulüp aramaları\","],
  ["'mercado.tabObjetivos': \"Ricerche club\",", "'mercado.tabObjetivos': \"Ricerche club\","],
  ["'mercado.tabObjetivos': \"Recherches des clubs\",", "'mercado.tabObjetivos': \"Recherches des clubs\","],
  ["'mercado.tabObjetivos': \"Vereinssuchen\",", "'mercado.tabObjetivos': \"Vereinssuchen\","],
  ["'mercado.tabObjetivos': \"عمليات بحث الأندية\",", "'mercado.tabObjetivos': \"عمليات بحث الأندية\","],
  ["'mercado.tabObjetivos': \"俱乐部搜索\",", "'mercado.tabObjetivos': \"俱乐部搜索\","],
  ["'mercado.tabObjetivos': \"クラブの探索\",", "'mercado.tabObjetivos': \"クラブの探索\","],
]
// Only the ES one actually changes text; others already say "club searches" which
// already conveys "de clubes" — leave them, just confirm they exist.
for (const [oldStr] of tabRenames) {
  if (!src.includes(oldStr)) console.error('TAB NOT FOUND:', oldStr)
}
src = src.replace("'mercado.tabObjetivos': \"Búsquedas\",", "'mercado.tabObjetivos': \"Búsquedas de clubes\",")

// 2) New keys: urgencia (vencido/proximo), todosRepresentantes — inserted after 'mercado.todosResponsables'
const rows = [
  { anchor: "'mercado.todosResponsables': \"Todos los responsables\",", todosRepresentantes: "Todos los representantes", vencido: "Vencido", proximo: "Próximo" },
  { anchor: "'mercado.todosResponsables': \"All owners\",", todosRepresentantes: "All agents", vencido: "Overdue", proximo: "Upcoming" },
  { anchor: "'mercado.todosResponsables': \"Tüm sorumlular\",", todosRepresentantes: "Tüm temsilciler", vencido: "Gecikmiş", proximo: "Yaklaşan" },
  { anchor: "'mercado.todosResponsables': \"Tutti i responsabili\",", todosRepresentantes: "Tutti gli agenti", vencido: "Scaduto", proximo: "In arrivo" },
  { anchor: "'mercado.todosResponsables': \"Tous les responsables\",", todosRepresentantes: "Tous les agents", vencido: "En retard", proximo: "À venir" },
  { anchor: "'mercado.todosResponsables': \"Alle Verantwortlichen\",", todosRepresentantes: "Alle Agenten", vencido: "Überfällig", proximo: "Bevorstehend" },
  { anchor: "'mercado.todosResponsables': \"جميع المسؤولين\",", todosRepresentantes: "جميع الوكلاء", vencido: "متأخر", proximo: "قادم" },
  { anchor: "'mercado.todosResponsables': \"所有负责人\",", todosRepresentantes: "所有代理人", vencido: "已逾期", proximo: "即将到期" },
  { anchor: "'mercado.todosResponsables': \"すべての担当者\",", todosRepresentantes: "すべてのエージェント", vencido: "期限超過", proximo: "近日" },
]

let count = 0
for (const { anchor, todosRepresentantes, vencido, proximo } of rows) {
  if (!src.includes(anchor)) { console.error('NOT FOUND:', anchor); continue }
  const insertion = `${anchor}\n    'mercado.todosRepresentantes': "${todosRepresentantes}",\n    'mercado.urgenciaVencido': "${vencido}",\n    'mercado.urgenciaProximo': "${proximo}",`
  src = src.replace(anchor, insertion)
  count++
}

fs.writeFileSync(path, src, 'utf8')
console.log('OK inserted', count)
