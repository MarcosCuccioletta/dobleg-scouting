import fs from 'fs'
const path = 'src/constants/translations.ts'
let src = fs.readFileSync(path, 'utf8')

const blocks = {
  es: {
    anchor: "'nav.calendario': 'Calendario',",
    keys: {
      hoy: 'Hoy', mes: 'Mes', semana: 'Semana',
      buscarJugador: 'Buscar jugador...', sinResultados: 'Sin resultados',
      sinPartidos: 'Sin partidos', sinPartidosEsteDia: 'Sin partidos este día',
      masCount: '+{count} más', partidoSingular: 'partido', partidoPlural: 'partidos',
    },
  },
  en: {
    anchor: "'nav.calendario': 'Calendar',",
    keys: {
      hoy: 'Today', mes: 'Month', semana: 'Week',
      buscarJugador: 'Search player...', sinResultados: 'No results',
      sinPartidos: 'No matches', sinPartidosEsteDia: 'No matches this day',
      masCount: '+{count} more', partidoSingular: 'match', partidoPlural: 'matches',
    },
  },
  tr: {
    anchor: "'nav.calendario': 'Takvim',",
    keys: {
      hoy: 'Bugün', mes: 'Ay', semana: 'Hafta',
      buscarJugador: 'Oyuncu ara...', sinResultados: 'Sonuç yok',
      sinPartidos: 'Maç yok', sinPartidosEsteDia: 'Bu gün maç yok',
      masCount: '+{count} daha', partidoSingular: 'maç', partidoPlural: 'maç',
    },
  },
  it: {
    anchor: "'nav.panelInterno': 'Pannello Interno',\n    'nav.calendario': 'Calendario',",
    keys: {
      hoy: 'Oggi', mes: 'Mese', semana: 'Settimana',
      buscarJugador: 'Cerca giocatore...', sinResultados: 'Nessun risultato',
      sinPartidos: 'Nessuna partita', sinPartidosEsteDia: 'Nessuna partita in questo giorno',
      masCount: '+{count} altri', partidoSingular: 'partita', partidoPlural: 'partite',
    },
  },
  fr: {
    anchor: "'nav.calendario': 'Calendrier',",
    keys: {
      hoy: "Aujourd'hui", mes: 'Mois', semana: 'Semaine',
      buscarJugador: 'Rechercher un joueur...', sinResultados: 'Aucun résultat',
      sinPartidos: 'Aucun match', sinPartidosEsteDia: 'Aucun match ce jour',
      masCount: '+{count} de plus', partidoSingular: 'match', partidoPlural: 'matchs',
    },
  },
  de: {
    anchor: "'nav.calendario': 'Kalender',",
    keys: {
      hoy: 'Heute', mes: 'Monat', semana: 'Woche',
      buscarJugador: 'Spieler suchen...', sinResultados: 'Keine Ergebnisse',
      sinPartidos: 'Keine Spiele', sinPartidosEsteDia: 'Keine Spiele an diesem Tag',
      masCount: '+{count} weitere', partidoSingular: 'Spiel', partidoPlural: 'Spiele',
    },
  },
  ar: {
    anchor: "'nav.calendario': 'التقويم',",
    keys: {
      hoy: 'اليوم', mes: 'شهر', semana: 'أسبوع',
      buscarJugador: 'ابحث عن لاعب...', sinResultados: 'لا توجد نتائج',
      sinPartidos: 'لا توجد مباريات', sinPartidosEsteDia: 'لا توجد مباريات في هذا اليوم',
      masCount: '+{count} أخرى', partidoSingular: 'مباراة', partidoPlural: 'مباريات',
    },
  },
  zh: {
    anchor: "'nav.calendario': '日历',",
    keys: {
      hoy: '今天', mes: '月', semana: '周',
      buscarJugador: '搜索球员...', sinResultados: '没有结果',
      sinPartidos: '没有比赛', sinPartidosEsteDia: '这一天没有比赛',
      masCount: '+{count} 更多', partidoSingular: '场比赛', partidoPlural: '场比赛',
    },
  },
  ja: {
    anchor: "'nav.calendario': 'カレンダー',",
    keys: {
      hoy: '今日', mes: '月', semana: '週',
      buscarJugador: '選手を検索...', sinResultados: '結果がありません',
      sinPartidos: '試合がありません', sinPartidosEsteDia: 'この日は試合がありません',
      masCount: '+他{count}件', partidoSingular: '試合', partidoPlural: '試合',
    },
  },
}

let count = 0
for (const [lang, { anchor, keys }] of Object.entries(blocks)) {
  if (!src.includes(anchor)) { console.error('ANCHOR NOT FOUND for', lang, ':', anchor); continue }
  const lines = Object.entries(keys).map(([k, v]) => `    'calendario.${k}': ${JSON.stringify(v)},`).join('\n')
  src = src.replace(anchor, `${anchor}\n${lines}`)
  count++
}

fs.writeFileSync(path, src, 'utf8')
console.log('OK inserted for', count, 'languages')
