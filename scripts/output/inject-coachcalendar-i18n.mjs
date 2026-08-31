import fs from 'fs';

const FILE = 'src/constants/translations.ts';
const ANCHOR = `    'coachMatchDetail.suplentes':`;

const LANGS = ['es', 'en', 'tr', 'it', 'fr', 'de', 'ar', 'zh', 'ja'];

const DATA = {
  cargando: {
    es: "Cargando calendario...", en: "Loading calendar...", tr: "Takvim yükleniyor...",
    it: "Caricamento calendario...", fr: "Chargement du calendrier...", de: "Kalender wird geladen...",
    ar: "جارٍ تحميل التقويم...", zh: "正在加载日历...", ja: "カレンダーを読み込み中...",
  },
  mesAnterior: {
    es: "Mes anterior", en: "Previous month", tr: "Önceki ay", it: "Mese precedente",
    fr: "Mois précédent", de: "Vorheriger Monat", ar: "الشهر السابق", zh: "上个月", ja: "前の月",
  },
  mesSiguiente: {
    es: "Mes siguiente", en: "Next month", tr: "Sonraki ay", it: "Mese successivo",
    fr: "Mois suivant", de: "Nächster Monat", ar: "الشهر التالي", zh: "下个月", ja: "次の月",
  },
  viajeExterior: {
    es: "Viaje al exterior", en: "Trip abroad", tr: "Yurt dışı seyahati", it: "Trasferta all'estero",
    fr: "Déplacement à l'étranger", de: "Auswärtsreise ins Ausland", ar: "رحلة إلى الخارج",
    zh: "境外客场", ja: "海外遠征",
  },
  sinActividad: {
    es: "Sin actividad este día", en: "No activity this day", tr: "Bu gün için aktivite yok",
    it: "Nessuna attività in questo giorno", fr: "Aucune activité ce jour", de: "Keine Aktivität an diesem Tag",
    ar: "لا يوجد نشاط في هذا اليوم", zh: "当天无活动", ja: "この日の予定はありません",
  },
};

const KEYS = Object.keys(DATA);

let content = fs.readFileSync(FILE, 'utf8');
const lines = content.split('\n');

let langIdx = 0;
const out = [];
for (const line of lines) {
  out.push(line);
  if (line.startsWith(ANCHOR)) {
    const lang = LANGS[langIdx];
    if (!lang) throw new Error('More anchor matches than languages');
    for (const key of KEYS) {
      const value = DATA[key][lang];
      out.push(`    'coachCalendar.${key}': ${JSON.stringify(value)},`);
    }
    langIdx++;
  }
}

if (langIdx !== LANGS.length) {
  throw new Error(`Expected ${LANGS.length} anchor matches, found ${langIdx}`);
}

fs.writeFileSync(FILE, out.join('\n'));
console.log(`Inserted ${KEYS.length} keys x ${LANGS.length} languages after ${langIdx} anchors.`);
