import fs from 'fs'

const file = 'src/constants/translations.ts'
let src = fs.readFileSync(file, 'utf8')

const anchors = {
  es: `'coachDetail.volver': "Volver a Entrenadores",`,
  en: `'coachDetail.volver': "Back to Coaches",`,
  tr: `'coachDetail.volver': "Antrenörlere dön",`,
  it: `'coachDetail.volver': "Torna ad Allenatori",`,
  fr: `'coachDetail.volver': "Retour aux Entraîneurs",`,
  de: `'coachDetail.volver': "Zurück zu Trainern",`,
  ar: `'coachDetail.volver': "العودة إلى المدربين",`,
  zh: `'coachDetail.volver': "返回教练列表",`,
  ja: `'coachDetail.volver': "コーチ一覧に戻る",`,
}

const keysByLang = {
  es: {
    'coachDetail.ligaSinDatos': "No hay datos de liga disponibles para este entrenador todavía.",
    'coachDetail.ligaCargando': "Cargando tabla de posiciones...",
    'coachDetail.ligaError': "No se pudo cargar la tabla de posiciones.",
  },
  en: {
    'coachDetail.ligaSinDatos': "No league data available for this coach yet.",
    'coachDetail.ligaCargando': "Loading standings...",
    'coachDetail.ligaError': "Couldn't load the standings table.",
  },
  tr: {
    'coachDetail.ligaSinDatos': "Bu antrenör için henüz lig verisi yok.",
    'coachDetail.ligaCargando': "Puan durumu yükleniyor...",
    'coachDetail.ligaError': "Puan durumu tablosu yüklenemedi.",
  },
  it: {
    'coachDetail.ligaSinDatos': "Non ci sono ancora dati sul campionato per questo allenatore.",
    'coachDetail.ligaCargando': "Caricamento classifica...",
    'coachDetail.ligaError': "Impossibile caricare la classifica.",
  },
  fr: {
    'coachDetail.ligaSinDatos': "Aucune donnée de championnat disponible pour cet entraîneur pour le moment.",
    'coachDetail.ligaCargando': "Chargement du classement...",
    'coachDetail.ligaError': "Impossible de charger le classement.",
  },
  de: {
    'coachDetail.ligaSinDatos': "Für diesen Trainer sind noch keine Liga-Daten verfügbar.",
    'coachDetail.ligaCargando': "Tabelle wird geladen...",
    'coachDetail.ligaError': "Die Tabelle konnte nicht geladen werden.",
  },
  ar: {
    'coachDetail.ligaSinDatos': "لا تتوفر بيانات دوري لهذا المدرب بعد.",
    'coachDetail.ligaCargando': "جارٍ تحميل جدول الترتيب...",
    'coachDetail.ligaError': "تعذّر تحميل جدول الترتيب.",
  },
  zh: {
    'coachDetail.ligaSinDatos': "该教练暂无联赛数据。",
    'coachDetail.ligaCargando': "正在加载积分榜...",
    'coachDetail.ligaError': "无法加载积分榜。",
  },
  ja: {
    'coachDetail.ligaSinDatos': "このコーチのリーグデータはまだありません。",
    'coachDetail.ligaCargando': "順位表を読み込み中...",
    'coachDetail.ligaError': "順位表を読み込めませんでした。",
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
