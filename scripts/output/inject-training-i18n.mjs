import fs from 'fs';

const FILE = 'src/constants/translations.ts';
const ANCHOR = `    'coachCalendar.sinActividad':`;

const LANGS = ['es', 'en', 'tr', 'it', 'fr', 'de', 'ar', 'zh', 'ja'];

const DATA = {
  // trainingType.*
  'trainingType.tactico': { es: "Táctico", en: "Tactical", tr: "Taktik", it: "Tattico", fr: "Tactique", de: "Taktik", ar: "تكتيكي", zh: "战术", ja: "戦術" },
  'trainingType.fisico': { es: "Físico", en: "Physical", tr: "Fiziksel", it: "Fisico", fr: "Physique", de: "Physisch", ar: "بدني", zh: "体能", ja: "フィジカル" },
  'trainingType.recuperacion': { es: "Recuperación", en: "Recovery", tr: "Toparlanma", it: "Recupero", fr: "Récupération", de: "Regeneration", ar: "تعافي", zh: "恢复", ja: "リカバリー" },
  'trainingType.setPieces': { es: "Pelota parada", en: "Set pieces", tr: "Duran top", it: "Palla inattiva", fr: "Coup de pied arrêté", de: "Standardsituation", ar: "الكرات الثابتة", zh: "定位球", ja: "セットプレー" },
  'trainingType.preRival': { es: "Pre-rival", en: "Pre-match", tr: "Rakip öncesi", it: "Pre-rivale", fr: "Avant-match", de: "Vor dem Gegner", ar: "قبل المنافس", zh: "赛前准备", ja: "対戦相手対策" },
  'trainingType.otro': { es: "Otro", en: "Other", tr: "Diğer", it: "Altro", fr: "Autre", de: "Sonstiges", ar: "أخرى", zh: "其他", ja: "その他" },

  // trainingFocus.*
  'trainingFocus.finalizacion': { es: "Finalización", en: "Finishing", tr: "Bitiricilik", it: "Finalizzazione", fr: "Finition", de: "Torabschluss", ar: "الإنهاء", zh: "射门终结", ja: "フィニッシュ" },
  'trainingFocus.posesion': { es: "Posesión", en: "Possession", tr: "Top hakimiyeti", it: "Possesso palla", fr: "Possession", de: "Ballbesitz", ar: "الاستحواذ", zh: "控球", ja: "ポゼッション" },
  'trainingFocus.pressing': { es: "Pressing", en: "Pressing", tr: "Pressing", it: "Pressing", fr: "Pressing", de: "Pressing", ar: "الضغط", zh: "逼抢", ja: "プレッシング" },
  'trainingFocus.transiciones': { es: "Transiciones", en: "Transitions", tr: "Geçişler", it: "Transizioni", fr: "Transitions", de: "Umschaltspiel", ar: "التحولات", zh: "攻防转换", ja: "切り替え" },
  'trainingFocus.fisicoAerobico': { es: "Físico aeróbico", en: "Aerobic fitness", tr: "Aerobik kondisyon", it: "Fisico aerobico", fr: "Physique aérobie", de: "Aerobe Fitness", ar: "اللياقة الهوائية", zh: "有氧体能", ja: "有酸素フィジカル" },
  'trainingFocus.fuerza': { es: "Fuerza", en: "Strength", tr: "Kuvvet", it: "Forza", fr: "Force", de: "Kraft", ar: "القوة", zh: "力量", ja: "筋力" },
  'trainingFocus.tacticoDefensivo': { es: "Táctico defensivo", en: "Defensive tactics", tr: "Defansif taktik", it: "Tattico difensivo", fr: "Tactique défensive", de: "Defensive Taktik", ar: "تكتيك دفاعي", zh: "防守战术", ja: "守備戦術" },
  'trainingFocus.tacticoOfensivo': { es: "Táctico ofensivo", en: "Attacking tactics", tr: "Ofansif taktik", it: "Tattico offensivo", fr: "Tactique offensive", de: "Offensive Taktik", ar: "تكتيك هجومي", zh: "进攻战术", ja: "攻撃戦術" },

  // trainingInsights.*
  'trainingInsights.diaSeguidoUno': { es: "{count} día seguido", en: "{count} day in a row", tr: "{count} gün üst üste", it: "{count} giorno di fila", fr: "{count} jour d'affilée", de: "{count} Tag in Folge", ar: "{count} يوم متتالٍ", zh: "连续{count}天", ja: "{count}日連続" },
  'trainingInsights.diaSeguidoVarios': { es: "{count} días seguidos", en: "{count} days in a row", tr: "{count} gün üst üste", it: "{count} giorni di fila", fr: "{count} jours d'affilée", de: "{count} Tage in Folge", ar: "{count} أيام متتالية", zh: "连续{count}天", ja: "{count}日連続" },
  'trainingInsights.foco': { es: "Foco:", en: "Focus:", tr: "Odak:", it: "Focus:", fr: "Focus :", de: "Fokus:", ar: "التركيز:", zh: "重点：", ja: "フォーカス：" },
  'trainingInsights.sobrecarga': { es: "Varios días de alta intensidad seguidos", en: "Several high-intensity days in a row", tr: "Art arda birçok yüksek yoğunluklu gün", it: "Diversi giorni di alta intensità di fila", fr: "Plusieurs jours de haute intensité d'affilée", de: "Mehrere Tage mit hoher Intensität in Folge", ar: "عدة أيام متتالية عالية الشدة", zh: "连续多日高强度训练", ja: "高強度の日が連続しています" },

  // trainingTab.*
  'trainingTab.cargando': { es: "Cargando entrenamientos...", en: "Loading training sessions...", tr: "Antrenmanlar yükleniyor...", it: "Caricamento allenamenti...", fr: "Chargement des entraînements...", de: "Trainingseinheiten werden geladen...", ar: "جارٍ تحميل التدريبات...", zh: "正在加载训练...", ja: "トレーニングを読み込み中..." },
  'trainingTab.semanaAnterior': { es: "Semana anterior", en: "Previous week", tr: "Önceki hafta", it: "Settimana precedente", fr: "Semaine précédente", de: "Vorherige Woche", ar: "الأسبوع السابق", zh: "上一周", ja: "前の週" },
  'trainingTab.semanaSiguiente': { es: "Semana siguiente", en: "Next week", tr: "Sonraki hafta", it: "Settimana successiva", fr: "Semaine suivante", de: "Nächste Woche", ar: "الأسبوع التالي", zh: "下一周", ja: "次の週" },
  'trainingTab.estaSemana': { es: "Esta semana", en: "This week", tr: "Bu hafta", it: "Questa settimana", fr: "Cette semaine", de: "Diese Woche", ar: "هذا الأسبوع", zh: "本周", ja: "今週" },
  'trainingTab.historial': { es: "Historial", en: "History", tr: "Geçmiş", it: "Cronologia", fr: "Historique", de: "Verlauf", ar: "السجل", zh: "历史记录", ja: "履歴" },
  'trainingTab.intAbrev': { es: "Int. {n}/5", en: "Int. {n}/5", tr: "Yoğ. {n}/5", it: "Int. {n}/5", fr: "Int. {n}/5", de: "Int. {n}/5", ar: "الشدة {n}/5", zh: "强度{n}/5", ja: "強度{n}/5" },
  'trainingTab.sinEntrenamientos': { es: "Sin entrenamientos agendados. Tocá un día de la semana de arriba para cargar el primero.", en: "No training sessions scheduled. Tap a day above to add the first one.", tr: "Planlanmış antrenman yok. İlkini eklemek için yukarıdan bir gün seç.", it: "Nessun allenamento programmato. Tocca un giorno qui sopra per aggiungere il primo.", fr: "Aucun entraînement programmé. Touchez un jour ci-dessus pour ajouter le premier.", de: "Keine Trainingseinheiten geplant. Tippe oben auf einen Tag, um die erste hinzuzufügen.", ar: "لا توجد تدريبات مجدولة. اضغط على يوم بالأعلى لإضافة أول تدريب.", zh: "暂无已安排的训练。点击上方某一天添加第一次训练。", ja: "予定されたトレーニングはありません。上の日付をタップして最初のトレーニングを追加してください。" },

  // trainingDay.*
  'trainingDay.horario': { es: "Horario", en: "Time", tr: "Saat", it: "Orario", fr: "Horaire", de: "Uhrzeit", ar: "الوقت", zh: "时间", ja: "時間" },
  'trainingDay.tipo': { es: "Tipo", en: "Type", tr: "Tür", it: "Tipo", fr: "Type", de: "Typ", ar: "النوع", zh: "类型", ja: "タイプ" },
  'trainingDay.duracionMin': { es: "Duración (min)", en: "Duration (min)", tr: "Süre (dk)", it: "Durata (min)", fr: "Durée (min)", de: "Dauer (Min.)", ar: "المدة (دقيقة)", zh: "时长（分钟）", ja: "所要時間（分）" },
  'trainingDay.intensidad': { es: "Intensidad", en: "Intensity", tr: "Yoğunluk", it: "Intensità", fr: "Intensité", de: "Intensität", ar: "الشدة", zh: "强度", ja: "強度" },
  'trainingDay.titulo': { es: "Título", en: "Title", tr: "Başlık", it: "Titolo", fr: "Titre", de: "Titel", ar: "العنوان", zh: "标题", ja: "タイトル" },
  'trainingDay.focoDelDia': { es: "Foco del día", en: "Focus of the day", tr: "Günün odağı", it: "Focus del giorno", fr: "Focus du jour", de: "Fokus des Tages", ar: "تركيز اليوم", zh: "当日重点", ja: "今日のフォーカス" },
  'trainingDay.notas': { es: "Notas", en: "Notes", tr: "Notlar", it: "Note", fr: "Notes", de: "Notizen", ar: "ملاحظات", zh: "备注", ja: "メモ" },
  'trainingDay.tituloPlaceholder': { es: "Ej: Trabajo de definición", en: "E.g.: Finishing work", tr: "Ör: Bitiricilik çalışması", it: "Es: Lavoro di finalizzazione", fr: "Ex : Travail de finition", de: "Z. B.: Torabschlusstraining", ar: "مثال: تمرين الإنهاء", zh: "例如：射门训练", ja: "例：フィニッシュ練習" },
  'trainingDay.notasPlaceholder': { es: "Qué se trabajó, observaciones...", en: "What was worked on, observations...", tr: "Ne çalışıldı, gözlemler...", it: "Cosa si è lavorato, osservazioni...", fr: "Ce qui a été travaillé, observations...", de: "Was trainiert wurde, Beobachtungen...", ar: "ما تم العمل عليه، ملاحظات...", zh: "训练内容、观察记录…", ja: "取り組んだ内容、所見…" },
  'trainingDay.intensidadAria': { es: "Intensidad {n}", en: "Intensity {n}", tr: "Yoğunluk {n}", it: "Intensità {n}", fr: "Intensité {n}", de: "Intensität {n}", ar: "الشدة {n}", zh: "强度{n}", ja: "強度{n}" },
  'trainingDay.intensidadValor': { es: "Intensidad {n}/5", en: "Intensity {n}/5", tr: "Yoğunluk {n}/5", it: "Intensità {n}/5", fr: "Intensité {n}/5", de: "Intensität {n}/5", ar: "الشدة {n}/5", zh: "强度{n}/5", ja: "強度{n}/5" },
  'trainingDay.errorGuardar': { es: "No se pudo guardar la sesión. Intentá de nuevo.", en: "Couldn't save the session. Try again.", tr: "Seans kaydedilemedi. Tekrar dene.", it: "Impossibile salvare la sessione. Riprova.", fr: "Impossible d'enregistrer la séance. Réessayez.", de: "Die Einheit konnte nicht gespeichert werden. Versuche es erneut.", ar: "تعذر حفظ الحصة. حاول مرة أخرى.", zh: "无法保存该训练。请重试。", ja: "セッションを保存できませんでした。もう一度お試しください。" },
  'trainingDay.errorBorrar': { es: "No se pudo borrar la sesión. Intentá de nuevo.", en: "Couldn't delete the session. Try again.", tr: "Seans silinemedi. Tekrar dene.", it: "Impossibile eliminare la sessione. Riprova.", fr: "Impossible de supprimer la séance. Réessayez.", de: "Die Einheit konnte nicht gelöscht werden. Versuche es erneut.", ar: "تعذر حذف الحصة. حاول مرة أخرى.", zh: "无法删除该训练。请重试。", ja: "セッションを削除できませんでした。もう一度お試しください。" },
  'trainingDay.confirmarBorrar': { es: "¿Borrar la sesión \"{title}\"?", en: "Delete session \"{title}\"?", tr: "\"{title}\" seansı silinsin mi?", it: "Eliminare la sessione \"{title}\"?", fr: "Supprimer la séance « {title} » ?", de: "Einheit \"{title}\" löschen?", ar: "هل تريد حذف الحصة \"{title}\"؟", zh: "删除训练「{title}」？", ja: "セッション「{title}」を削除しますか？" },
  'trainingDay.borrarSesionAria': { es: "Borrar sesión {title}", en: "Delete session {title}", tr: "{title} seansını sil", it: "Elimina sessione {title}", fr: "Supprimer la séance {title}", de: "Einheit {title} löschen", ar: "حذف الحصة {title}", zh: "删除训练{title}", ja: "セッション{title}を削除" },
  'trainingDay.agregarSesion': { es: "+ Agregar sesión", en: "+ Add session", tr: "+ Seans ekle", it: "+ Aggiungi sessione", fr: "+ Ajouter une séance", de: "+ Einheit hinzufügen", ar: "+ إضافة حصة", zh: "+ 添加训练", ja: "+ セッションを追加" },
  'trainingDay.sinEntrenamientosDia': { es: "Sin entrenamientos este día.", en: "No training sessions this day.", tr: "Bu gün için antrenman yok.", it: "Nessun allenamento in questo giorno.", fr: "Aucun entraînement ce jour.", de: "Keine Trainingseinheit an diesem Tag.", ar: "لا توجد تدريبات في هذا اليوم.", zh: "当天无训练。", ja: "この日のトレーニングはありません。" },
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
      out.push(`    '${key}': ${JSON.stringify(value)},`);
    }
    langIdx++;
  }
}

if (langIdx !== LANGS.length) {
  throw new Error(`Expected ${LANGS.length} anchor matches, found ${langIdx}`);
}

fs.writeFileSync(FILE, out.join('\n'));
console.log(`Inserted ${KEYS.length} keys x ${LANGS.length} languages after ${langIdx} anchors.`);
