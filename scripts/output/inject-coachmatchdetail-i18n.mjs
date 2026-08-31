import fs from 'fs';

const FILE = 'src/constants/translations.ts';
const ANCHOR = `    'coachNotes.sinPartidos':`;

const LANGS = ['es', 'en', 'tr', 'it', 'fr', 'de', 'ar', 'zh', 'ja'];

const DATA = {
  volverA: {
    es: "Volver a", en: "Back to", tr: "Geri dön:", it: "Torna a", fr: "Retour à",
    de: "Zurück zu", ar: "العودة إلى", zh: "返回", ja: "に戻る",
  },
  ingresa: {
    es: "Ingresa", en: "In", tr: "Giriyor", it: "Entra", fr: "Entre",
    de: "Ein", ar: "دخول", zh: "替补上场", ja: "交代IN",
  },
  sale: {
    es: "Sale", en: "Out", tr: "Çıkıyor", it: "Esce", fr: "Sort",
    de: "Aus", ar: "خروج", zh: "被换下", ja: "交代OUT",
  },
  enContra: {
    es: "en contra", en: "own goal", tr: "kendi kalesine", it: "autogol", fr: "contre son camp",
    de: "Eigentor", ar: "هدف عكسي", zh: "乌龙球", ja: "オウンゴール",
  },
  penal: {
    es: "penal", en: "penalty", tr: "penaltı", it: "rigore", fr: "penalty",
    de: "Elfmeter", ar: "ركلة جزاء", zh: "点球", ja: "PK",
  },
  asistencia: {
    es: "Asistencia", en: "Assist", tr: "Asist", it: "Assist", fr: "Passe décisive",
    de: "Vorlage", ar: "تمريرة حاسمة", zh: "助攻", ja: "アシスト",
  },
  cargandoEntrenador: {
    es: "Cargando entrenador...", en: "Loading coach...", tr: "Teknik direktör yükleniyor...",
    it: "Caricamento allenatore...", fr: "Chargement de l'entraîneur...", de: "Trainer wird geladen...",
    ar: "جارٍ تحميل المدرب...", zh: "正在加载教练...", ja: "監督を読み込み中...",
  },
  noEncontrado: {
    es: "No pudimos encontrar este partido.", en: "We couldn't find this match.",
    tr: "Bu maçı bulamadık.", it: "Non siamo riusciti a trovare questa partita.",
    fr: "Nous n'avons pas trouvé ce match.", de: "Wir konnten dieses Spiel nicht finden.",
    ar: "لم نتمكن من العثور على هذه المباراة.", zh: "未找到该场比赛。", ja: "この試合が見つかりませんでした。",
  },
  cargandoPartido: {
    es: "Cargando partido...", en: "Loading match...", tr: "Maç yükleniyor...",
    it: "Caricamento partita...", fr: "Chargement du match...", de: "Spiel wird geladen...",
    ar: "جارٍ تحميل المباراة...", zh: "正在加载比赛...", ja: "試合を読み込み中...",
  },
  notasDT: {
    es: "Notas del DT", en: "Coach's notes", tr: "Teknik direktör notları", it: "Note dell'allenatore",
    fr: "Notes de l'entraîneur", de: "Trainernotizen", ar: "ملاحظات المدرب", zh: "教练笔记", ja: "監督メモ",
  },
  editarEnNotas: {
    es: "Editar en Notas de partidos", en: "Edit in Match notes", tr: "Maç notlarında düzenle",
    it: "Modifica in Note partite", fr: "Modifier dans Notes de match", de: "In Spielnotizen bearbeiten",
    ar: "تعديل في ملاحظات المباريات", zh: "在比赛笔记中编辑", ja: "試合メモで編集",
  },
  golesYHechos: {
    es: "Goles y hechos", en: "Goals and events", tr: "Goller ve olaylar", it: "Gol ed eventi",
    fr: "Buts et événements", de: "Tore und Ereignisse", ar: "الأهداف والأحداث", zh: "进球与事件", ja: "ゴールと出来事",
  },
  cargandoHechos: {
    es: "Cargando hechos...", en: "Loading events...", tr: "Olaylar yükleniyor...",
    it: "Caricamento eventi...", fr: "Chargement des événements...", de: "Ereignisse werden geladen...",
    ar: "جارٍ تحميل الأحداث...", zh: "正在加载事件...", ja: "出来事を読み込み中...",
  },
  sinEventos: {
    es: "No hay eventos registrados para este partido.", en: "No events recorded for this match.",
    tr: "Bu maç için kayıtlı olay yok.", it: "Nessun evento registrato per questa partita.",
    fr: "Aucun événement enregistré pour ce match.", de: "Für dieses Spiel sind keine Ereignisse erfasst.",
    ar: "لا توجد أحداث مسجلة لهذه المباراة.", zh: "该场比赛暂无记录事件。", ja: "この試合に記録された出来事はありません。",
  },
  alineaciones: {
    es: "Alineaciones", en: "Lineups", tr: "Kadrolar", it: "Formazioni", fr: "Compositions",
    de: "Aufstellungen", ar: "التشكيلات", zh: "阵容", ja: "スターティングメンバー",
  },
  cargandoAlineaciones: {
    es: "Cargando alineaciones...", en: "Loading lineups...", tr: "Kadrolar yükleniyor...",
    it: "Caricamento formazioni...", fr: "Chargement des compositions...", de: "Aufstellungen werden geladen...",
    ar: "جارٍ تحميل التشكيلات...", zh: "正在加载阵容...", ja: "メンバーを読み込み中...",
  },
  sinAlineaciones: {
    es: "No hay alineaciones disponibles para este partido.", en: "No lineups available for this match.",
    tr: "Bu maç için kadro bilgisi yok.", it: "Nessuna formazione disponibile per questa partita.",
    fr: "Aucune composition disponible pour ce match.", de: "Für dieses Spiel sind keine Aufstellungen verfügbar.",
    ar: "لا توجد تشكيلات متاحة لهذه المباراة.", zh: "该场比赛暂无阵容信息。", ja: "この試合のメンバー情報はありません。",
  },
  dt: {
    es: "DT", en: "Coach", tr: "Teknik Direktör", it: "Allenatore", fr: "Entraîneur",
    de: "Trainer", ar: "المدرب", zh: "主教练", ja: "監督",
  },
  titulares: {
    es: "Titulares", en: "Starters", tr: "İlk 11", it: "Titolari", fr: "Titulaires",
    de: "Startelf", ar: "الأساسيون", zh: "首发", ja: "先発",
  },
  suplentes: {
    es: "Suplentes", en: "Substitutes", tr: "Yedekler", it: "Riserve", fr: "Remplaçants",
    de: "Ersatzbank", ar: "الاحتياط", zh: "替补", ja: "控え",
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
      out.push(`    'coachMatchDetail.${key}': ${JSON.stringify(value)},`);
    }
    langIdx++;
  }
}

if (langIdx !== LANGS.length) {
  throw new Error(`Expected ${LANGS.length} anchor matches, found ${langIdx}`);
}

fs.writeFileSync(FILE, out.join('\n'));
console.log(`Inserted ${KEYS.length} keys x ${LANGS.length} languages after ${langIdx} anchors.`);
