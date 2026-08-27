import fs from 'fs'

const file = 'src/constants/translations.ts'
let src = fs.readFileSync(file, 'utf8')

const anchors = {
  es: `'coachDetail.ligaError': "No se pudo cargar la tabla de posiciones.",`,
  en: `'coachDetail.ligaError': "Couldn't load the standings table.",`,
  tr: `'coachDetail.ligaError': "Puan durumu tablosu yüklenemedi.",`,
  it: `'coachDetail.ligaError': "Impossibile caricare la classifica.",`,
  fr: `'coachDetail.ligaError': "Impossible de charger le classement.",`,
  de: `'coachDetail.ligaError': "Die Tabelle konnte nicht geladen werden.",`,
  ar: `'coachDetail.ligaError': "تعذّر تحميل جدول الترتيب.",`,
  zh: `'coachDetail.ligaError': "无法加载积分榜。",`,
  ja: `'coachDetail.ligaError': "順位表を読み込めませんでした。",`,
}

const keysByLang = {
  es: {
    'standings.equipo': "Equipo",
    'standings.pj': "PJ",
    'standings.pg': "PG",
    'standings.pe': "PE",
    'standings.pp': "PP",
    'standings.gf': "GF",
    'standings.gc': "GC",
    'standings.dg': "DG",
    'standings.pts': "Pts",
    'standings.racha': "Racha",
    'standings.zona': "Zona {letter}",
    'standings.ordenarPuntos': "Ordenar por puntos",
    'standings.ordenarGolesFavor': "Ordenar por goles a favor",
    'standings.ordenarGolesContra': "Ordenar por goles en contra",
  },
  en: {
    'standings.equipo': "Team",
    'standings.pj': "MP",
    'standings.pg': "W",
    'standings.pe': "D",
    'standings.pp': "L",
    'standings.gf': "GF",
    'standings.gc': "GA",
    'standings.dg': "GD",
    'standings.pts': "Pts",
    'standings.racha': "Form",
    'standings.zona': "Zone {letter}",
    'standings.ordenarPuntos': "Sort by points",
    'standings.ordenarGolesFavor': "Sort by goals for",
    'standings.ordenarGolesContra': "Sort by goals against",
  },
  tr: {
    'standings.equipo': "Takım",
    'standings.pj': "O",
    'standings.pg': "G",
    'standings.pe': "B",
    'standings.pp': "M",
    'standings.gf': "AG",
    'standings.gc': "YG",
    'standings.dg': "AV",
    'standings.pts': "Puan",
    'standings.racha': "Form",
    'standings.zona': "Grup {letter}",
    'standings.ordenarPuntos': "Puana göre sırala",
    'standings.ordenarGolesFavor': "Atılan gole göre sırala",
    'standings.ordenarGolesContra': "Yenilen gole göre sırala",
  },
  it: {
    'standings.equipo': "Squadra",
    'standings.pj': "PG",
    'standings.pg': "V",
    'standings.pe': "N",
    'standings.pp': "P",
    'standings.gf': "GF",
    'standings.gc': "GS",
    'standings.dg': "DR",
    'standings.pts': "Pt",
    'standings.racha': "Forma",
    'standings.zona': "Zona {letter}",
    'standings.ordenarPuntos': "Ordina per punti",
    'standings.ordenarGolesFavor': "Ordina per gol fatti",
    'standings.ordenarGolesContra': "Ordina per gol subiti",
  },
  fr: {
    'standings.equipo': "Équipe",
    'standings.pj': "J",
    'standings.pg': "G",
    'standings.pe': "N",
    'standings.pp': "P",
    'standings.gf': "BP",
    'standings.gc': "BC",
    'standings.dg': "Diff",
    'standings.pts': "Pts",
    'standings.racha': "Forme",
    'standings.zona': "Zone {letter}",
    'standings.ordenarPuntos': "Trier par points",
    'standings.ordenarGolesFavor': "Trier par buts marqués",
    'standings.ordenarGolesContra': "Trier par buts encaissés",
  },
  de: {
    'standings.equipo': "Team",
    'standings.pj': "Sp",
    'standings.pg': "S",
    'standings.pe': "U",
    'standings.pp': "N",
    'standings.gf': "TF",
    'standings.gc': "TG",
    'standings.dg': "Diff",
    'standings.pts': "Pkt",
    'standings.racha': "Form",
    'standings.zona': "Zone {letter}",
    'standings.ordenarPuntos': "Nach Punkten sortieren",
    'standings.ordenarGolesFavor': "Nach erzielten Toren sortieren",
    'standings.ordenarGolesContra': "Nach Gegentoren sortieren",
  },
  ar: {
    'standings.equipo': "الفريق",
    'standings.pj': "لعب",
    'standings.pg': "فوز",
    'standings.pe': "تعادل",
    'standings.pp': "خسارة",
    'standings.gf': "له",
    'standings.gc': "عليه",
    'standings.dg': "ف.أ",
    'standings.pts': "نقاط",
    'standings.racha': "الأداء",
    'standings.zona': "المنطقة {letter}",
    'standings.ordenarPuntos': "الترتيب حسب النقاط",
    'standings.ordenarGolesFavor': "الترتيب حسب الأهداف له",
    'standings.ordenarGolesContra': "الترتيب حسب الأهداف عليه",
  },
  zh: {
    'standings.equipo': "球队",
    'standings.pj': "场",
    'standings.pg': "胜",
    'standings.pe': "平",
    'standings.pp': "负",
    'standings.gf': "进",
    'standings.gc': "失",
    'standings.dg': "净胜",
    'standings.pts': "积分",
    'standings.racha': "状态",
    'standings.zona': "分区{letter}",
    'standings.ordenarPuntos': "按积分排序",
    'standings.ordenarGolesFavor': "按进球数排序",
    'standings.ordenarGolesContra': "按失球数排序",
  },
  ja: {
    'standings.equipo': "チーム",
    'standings.pj': "試合",
    'standings.pg': "勝",
    'standings.pe': "分",
    'standings.pp': "敗",
    'standings.gf': "得点",
    'standings.gc': "失点",
    'standings.dg': "得失点差",
    'standings.pts': "勝点",
    'standings.racha': "フォーム",
    'standings.zona': "ゾーン{letter}",
    'standings.ordenarPuntos': "勝点で並び替え",
    'standings.ordenarGolesFavor': "得点で並び替え",
    'standings.ordenarGolesContra': "失点で並び替え",
  },
}

let totalInserted = 0
for (const [lang, anchor] of Object.entries(anchors)) {
  if (!src.includes(anchor)) {
    console.error(`ANCHOR NOT FOUND for ${lang}`)
    continue
  }
  const keys = keysByLang[lang]
  const newLines = Object.entries(keys)
    .map(([k, v]) => `    '${k}': ${JSON.stringify(v)},`)
    .join('\n')
  src = src.replace(anchor, anchor + '\n' + newLines)
  totalInserted += Object.keys(keys).length
}

fs.writeFileSync(file, src, 'utf8')
console.log('Inserted:', totalInserted)
