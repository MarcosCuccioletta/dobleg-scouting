import fs from 'fs';

const FILE = 'src/constants/translations.ts';
const ANCHOR = `'coachFutureSquad.quitar':`;

const blocks = {
  es: `
    'matchNotes.faseDefensiva': "Fase defensiva",
    'matchNotes.faseOfensiva': "Fase ofensiva",
    'matchNotes.faseTransiciones': "Fase de transiciones",
    'matchNotes.abp': "ABP",
    'matchNotes.observaciones': "Observaciones",
    'coachNotes.guardando': "Guardando...",
    'coachNotes.guardado': "Guardado ✓",
    'coachNotes.reintentar': "Reintentar",
    'coachNotes.guardar': "Guardar",
    'coachNotes.errorGuardar': "Error al guardar",
    'coachNotes.sinDatosEquipo': "No hay datos de equipo disponibles para este entrenador todavía.",
    'coachNotes.cargandoPartidos': "Cargando partidos...",
    'coachNotes.sinPartidos': "Sin partidos jugados todavía.",`,
  en: `
    'matchNotes.faseDefensiva': "Defensive phase",
    'matchNotes.faseOfensiva': "Offensive phase",
    'matchNotes.faseTransiciones': "Transitions phase",
    'matchNotes.abp': "Set pieces",
    'matchNotes.observaciones': "Observations",
    'coachNotes.guardando': "Saving...",
    'coachNotes.guardado': "Saved ✓",
    'coachNotes.reintentar': "Retry",
    'coachNotes.guardar': "Save",
    'coachNotes.errorGuardar': "Error saving",
    'coachNotes.sinDatosEquipo': "No team data available for this coach yet.",
    'coachNotes.cargandoPartidos': "Loading matches...",
    'coachNotes.sinPartidos': "No matches played yet.",`,
  tr: `
    'matchNotes.faseDefensiva': "Savunma fazı",
    'matchNotes.faseOfensiva': "Hücum fazı",
    'matchNotes.faseTransiciones': "Geçiş fazı",
    'matchNotes.abp': "Duran toplar",
    'matchNotes.observaciones': "Gözlemler",
    'coachNotes.guardando': "Kaydediliyor...",
    'coachNotes.guardado': "Kaydedildi ✓",
    'coachNotes.reintentar': "Tekrar dene",
    'coachNotes.guardar': "Kaydet",
    'coachNotes.errorGuardar': "Kaydetme hatası",
    'coachNotes.sinDatosEquipo': "Bu teknik direktör için henüz takım verisi yok.",
    'coachNotes.cargandoPartidos': "Maçlar yükleniyor...",
    'coachNotes.sinPartidos': "Henüz oynanmış maç yok.",`,
  it: `
    'matchNotes.faseDefensiva': "Fase difensiva",
    'matchNotes.faseOfensiva': "Fase offensiva",
    'matchNotes.faseTransiciones': "Fase di transizione",
    'matchNotes.abp': "Palle inattive",
    'matchNotes.observaciones': "Osservazioni",
    'coachNotes.guardando': "Salvataggio...",
    'coachNotes.guardado': "Salvato ✓",
    'coachNotes.reintentar': "Riprova",
    'coachNotes.guardar': "Salva",
    'coachNotes.errorGuardar': "Errore nel salvataggio",
    'coachNotes.sinDatosEquipo': "Nessun dato della squadra disponibile per questo allenatore ancora.",
    'coachNotes.cargandoPartidos': "Caricamento partite...",
    'coachNotes.sinPartidos': "Nessuna partita giocata ancora.",`,
  fr: `
    'matchNotes.faseDefensiva': "Phase défensive",
    'matchNotes.faseOfensiva': "Phase offensive",
    'matchNotes.faseTransiciones': "Phase de transition",
    'matchNotes.abp': "Coups de pied arrêtés",
    'matchNotes.observaciones': "Observations",
    'coachNotes.guardando': "Enregistrement...",
    'coachNotes.guardado': "Enregistré ✓",
    'coachNotes.reintentar': "Réessayer",
    'coachNotes.guardar': "Enregistrer",
    'coachNotes.errorGuardar': "Erreur lors de l'enregistrement",
    'coachNotes.sinDatosEquipo': "Aucune donnée d'équipe disponible pour cet entraîneur pour le moment.",
    'coachNotes.cargandoPartidos': "Chargement des matchs...",
    'coachNotes.sinPartidos': "Aucun match joué pour le moment.",`,
  de: `
    'matchNotes.faseDefensiva': "Defensivphase",
    'matchNotes.faseOfensiva': "Offensivphase",
    'matchNotes.faseTransiciones': "Übergangsphase",
    'matchNotes.abp': "Standardsituationen",
    'matchNotes.observaciones': "Beobachtungen",
    'coachNotes.guardando': "Wird gespeichert...",
    'coachNotes.guardado': "Gespeichert ✓",
    'coachNotes.reintentar': "Erneut versuchen",
    'coachNotes.guardar': "Speichern",
    'coachNotes.errorGuardar': "Fehler beim Speichern",
    'coachNotes.sinDatosEquipo': "Für diesen Trainer sind noch keine Teamdaten verfügbar.",
    'coachNotes.cargandoPartidos': "Spiele werden geladen...",
    'coachNotes.sinPartidos': "Noch keine gespielten Spiele.",`,
  ar: `
    'matchNotes.faseDefensiva': "مرحلة الدفاع",
    'matchNotes.faseOfensiva': "مرحلة الهجوم",
    'matchNotes.faseTransiciones': "مرحلة الانتقال",
    'matchNotes.abp': "الكرات الثابتة",
    'matchNotes.observaciones': "ملاحظات",
    'coachNotes.guardando': "جارٍ الحفظ...",
    'coachNotes.guardado': "تم الحفظ ✓",
    'coachNotes.reintentar': "إعادة المحاولة",
    'coachNotes.guardar': "حفظ",
    'coachNotes.errorGuardar': "خطأ في الحفظ",
    'coachNotes.sinDatosEquipo': "لا توجد بيانات فريق متاحة لهذا المدرب بعد.",
    'coachNotes.cargandoPartidos': "جارٍ تحميل المباريات...",
    'coachNotes.sinPartidos': "لا توجد مباريات ملعوبة بعد.",`,
  zh: `
    'matchNotes.faseDefensiva': "防守阶段",
    'matchNotes.faseOfensiva': "进攻阶段",
    'matchNotes.faseTransiciones': "转换阶段",
    'matchNotes.abp': "定位球",
    'matchNotes.observaciones': "观察记录",
    'coachNotes.guardando': "正在保存...",
    'coachNotes.guardado': "已保存 ✓",
    'coachNotes.reintentar': "重试",
    'coachNotes.guardar': "保存",
    'coachNotes.errorGuardar': "保存出错",
    'coachNotes.sinDatosEquipo': "该教练暂无球队数据。",
    'coachNotes.cargandoPartidos': "正在加载比赛...",
    'coachNotes.sinPartidos': "暂无已进行的比赛。",`,
  ja: `
    'matchNotes.faseDefensiva': "守備フェーズ",
    'matchNotes.faseOfensiva': "攻撃フェーズ",
    'matchNotes.faseTransiciones': "切り替えフェーズ",
    'matchNotes.abp': "セットプレー",
    'matchNotes.observaciones': "観察メモ",
    'coachNotes.guardando': "保存中...",
    'coachNotes.guardado': "保存済み ✓",
    'coachNotes.reintentar': "再試行",
    'coachNotes.guardar': "保存",
    'coachNotes.errorGuardar': "保存エラー",
    'coachNotes.sinDatosEquipo': "このコーチのチームデータはまだありません。",
    'coachNotes.cargandoPartidos': "試合を読み込み中...",
    'coachNotes.sinPartidos': "まだプレーした試合がありません。",`,
};

let src = fs.readFileSync(FILE, 'utf8');
const langOrder = ['es', 'en', 'tr', 'it', 'fr', 'de', 'ar', 'zh', 'ja'];
let idx = 0;
let count = 0;
for (const lang of langOrder) {
  idx = src.indexOf(ANCHOR, idx);
  if (idx === -1) throw new Error(`anchor not found for ${lang}, ran out of occurrences`);
  const lineEnd = src.indexOf('\n', idx);
  src = src.slice(0, lineEnd + 1) + blocks[lang] + '\n' + src.slice(lineEnd + 1);
  idx = lineEnd + 1 + blocks[lang].length;
  count++;
}
fs.writeFileSync(FILE, src, 'utf8');
console.log(`Inserted blocks for ${count} languages.`);
