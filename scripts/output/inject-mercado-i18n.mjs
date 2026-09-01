import { readFileSync, writeFileSync } from 'fs';

const path = 'src/constants/translations.ts';
const content = readFileSync(path, 'utf8');

// key -> { es, en, tr, it, fr, de, ar, zh, ja }
const T = {
  titulo: { es: 'Mercado', en: 'Market', tr: 'Piyasa', it: 'Mercato', fr: 'Marché', de: 'Markt', ar: 'السوق', zh: '市场', ja: 'マーケット' },
  subtitulo: {
    es: 'Negociaciones y objetivos con clubes', en: 'Negotiations and club targets', tr: 'Kulüplerle görüşmeler ve hedefler',
    it: 'Trattative e obiettivi con i club', fr: 'Négociations et objectifs avec les clubs', de: 'Verhandlungen und Ziele mit Vereinen',
    ar: 'مفاوضات وأهداف مع الأندية', zh: '与俱乐部的谈判与目标', ja: 'クラブとの交渉とターゲット',
  },
  nuevaNegociacion: { es: 'Nueva negociación', en: 'New negotiation', tr: 'Yeni görüşme', it: 'Nuova trattativa', fr: 'Nouvelle négociation', de: 'Neue Verhandlung', ar: 'مفاوضة جديدة', zh: '新建谈判', ja: '新規交渉' },
  nuevoObjetivo: { es: 'Nuevo objetivo', en: 'New target', tr: 'Yeni hedef', it: 'Nuovo obiettivo', fr: 'Nouvel objectif', de: 'Neues Ziel', ar: 'هدف جديد', zh: '新建目标', ja: '新規ターゲット' },
  tabNegociaciones: { es: 'Negociaciones', en: 'Negotiations', tr: 'Görüşmeler', it: 'Trattative', fr: 'Négociations', de: 'Verhandlungen', ar: 'المفاوضات', zh: '谈判', ja: '交渉' },
  tabObjetivos: { es: 'Objetivos', en: 'Targets', tr: 'Hedefler', it: 'Obiettivi', fr: 'Objectifs', de: 'Ziele', ar: 'الأهداف', zh: '目标', ja: 'ターゲット' },
  soloVencidos: { es: 'Solo vencidos', en: 'Overdue only', tr: 'Sadece gecikmiş', it: 'Solo scaduti', fr: 'Uniquement en retard', de: 'Nur überfällig', ar: 'المتأخرة فقط', zh: '仅显示已逾期', ja: '期限切れのみ' },
  filtrarClub: { es: 'Filtrar por club...', en: 'Filter by club...', tr: 'Kulübe göre filtrele...', it: 'Filtra per club...', fr: 'Filtrer par club...', de: 'Nach Verein filtern...', ar: 'تصفية حسب النادي...', zh: '按俱乐部筛选...', ja: 'クラブで絞り込む...' },
  todosResponsables: { es: 'Todos los responsables', en: 'All owners', tr: 'Tüm sorumlular', it: 'Tutti i responsabili', fr: 'Tous les responsables', de: 'Alle Verantwortlichen', ar: 'جميع المسؤولين', zh: '所有负责人', ja: 'すべての担当者' },
  todosEstados: { es: 'Todos los estados', en: 'All statuses', tr: 'Tüm durumlar', it: 'Tutti gli stati', fr: 'Tous les statuts', de: 'Alle Status', ar: 'جميع الحالات', zh: '所有状态', ja: 'すべてのステータス' },
  cargando: { es: 'Cargando Mercado...', en: 'Loading Market...', tr: 'Piyasa yükleniyor...', it: 'Caricamento Mercato...', fr: 'Chargement du Marché...', de: 'Markt wird geladen...', ar: 'جارٍ تحميل السوق...', zh: '正在加载市场...', ja: 'マーケットを読み込み中...' },
  sinNegociacionesTitulo: { es: 'Sin negociaciones', en: 'No negotiations', tr: 'Görüşme yok', it: 'Nessuna trattativa', fr: 'Aucune négociation', de: 'Keine Verhandlungen', ar: 'لا توجد مفاوضات', zh: '暂无谈判', ja: '交渉はありません' },
  sinNegociacionesVacio: { es: 'Todavía no hay negociaciones cargadas.', en: 'No negotiations added yet.', tr: 'Henüz görüşme eklenmedi.', it: 'Ancora nessuna trattativa caricata.', fr: 'Aucune négociation ajoutée pour le moment.', de: 'Noch keine Verhandlungen hinzugefügt.', ar: 'لم تتم إضافة أي مفاوضات بعد.', zh: '还没有添加谈判。', ja: 'まだ交渉が登録されていません。' },
  sinNegociacionesFiltro: { es: 'No hay negociaciones vencidas.', en: 'No overdue negotiations.', tr: 'Gecikmiş görüşme yok.', it: 'Nessuna trattativa scaduta.', fr: 'Aucune négociation en retard.', de: 'Keine überfälligen Verhandlungen.', ar: 'لا توجد مفاوضات متأخرة.', zh: '没有逾期的谈判。', ja: '期限切れの交渉はありません。' },
  sinObjetivosTitulo: { es: 'Sin objetivos', en: 'No targets', tr: 'Hedef yok', it: 'Nessun obiettivo', fr: 'Aucun objectif', de: 'Keine Ziele', ar: 'لا توجد أهداف', zh: '暂无目标', ja: 'ターゲットはありません' },
  sinObjetivosVacio: { es: 'Todavía no hay objetivos cargados.', en: 'No targets added yet.', tr: 'Henüz hedef eklenmedi.', it: 'Ancora nessun obiettivo caricato.', fr: 'Aucun objectif ajouté pour le moment.', de: 'Noch keine Ziele hinzugefügt.', ar: 'لم تتم إضافة أي أهداف بعد.', zh: '还没有添加目标。', ja: 'まだターゲットが登録されていません。' },
  sinObjetivosFiltro: { es: 'No hay objetivos vencidos.', en: 'No overdue targets.', tr: 'Gecikmiş hedef yok.', it: 'Nessun obiettivo scaduto.', fr: 'Aucun objectif en retard.', de: 'Keine überfälligen Ziele.', ar: 'لا توجد أهداف متأخرة.', zh: '没有逾期的目标。', ja: '期限切れのターゲットはありません。' },
  estadoContactado: { es: 'Contactado', en: 'Contacted', tr: 'İletişime geçildi', it: 'Contattato', fr: 'Contacté', de: 'Kontaktiert', ar: 'تم التواصل', zh: '已联系', ja: '連絡済み' },
  estadoReunion: { es: 'Reunión', en: 'Meeting', tr: 'Toplantı', it: 'Riunione', fr: 'Réunion', de: 'Besprechung', ar: 'اجتماع', zh: '会面', ja: '面談' },
  estadoOfertaEnviada: { es: 'Oferta enviada', en: 'Offer sent', tr: 'Teklif gönderildi', it: 'Offerta inviata', fr: 'Offre envoyée', de: 'Angebot gesendet', ar: 'تم إرسال العرض', zh: '已发送报价', ja: 'オファー送信済み' },
  estadoEnEspera: { es: 'En espera', en: 'On hold', tr: 'Beklemede', it: 'In attesa', fr: 'En attente', de: 'In Wartestellung', ar: 'قيد الانتظار', zh: '等待中', ja: '保留中' },
  estadoCerradoExitoso: { es: 'Cerrado (éxito)', en: 'Closed (success)', tr: 'Kapandı (başarılı)', it: 'Chiuso (successo)', fr: 'Clôturé (succès)', de: 'Abgeschlossen (Erfolg)', ar: 'مغلق (نجاح)', zh: '已完成（成功）', ja: 'クローズ（成立）' },
  estadoCerradoRechazado: { es: 'Cerrado (rechazado)', en: 'Closed (rejected)', tr: 'Kapandı (reddedildi)', it: 'Chiuso (rifiutato)', fr: 'Clôturé (refusé)', de: 'Abgeschlossen (abgelehnt)', ar: 'مغلق (مرفوض)', zh: '已完成（失败）', ja: 'クローズ（不成立）' },
  estadoAbierto: { es: 'Abierto', en: 'Open', tr: 'Açık', it: 'Aperto', fr: 'Ouvert', de: 'Offen', ar: 'مفتوح', zh: '进行中', ja: '未対応' },
  estadoCerrado: { es: 'Cerrado', en: 'Closed', tr: 'Kapalı', it: 'Chiuso', fr: 'Fermé', de: 'Geschlossen', ar: 'مغلق', zh: '已关闭', ja: 'クローズ' },
  responsable: { es: 'Responsable', en: 'Owner', tr: 'Sorumlu', it: 'Responsabile', fr: 'Responsable', de: 'Verantwortlich', ar: 'المسؤول', zh: '负责人', ja: '担当者' },
  seguimientoLabel: { es: 'Seguimiento', en: 'Follow-up', tr: 'Takip', it: 'Follow-up', fr: 'Suivi', de: 'Nachfassen', ar: 'المتابعة', zh: '跟进', ja: 'フォローアップ' },
  vencidoSingular: { es: 'vencido', en: 'overdue', tr: 'gecikmiş', it: 'scaduto', fr: 'en retard', de: 'überfällig', ar: 'متأخر', zh: '项已逾期', ja: '件が期限切れ' },
  vencidoPlural: { es: 'vencidos', en: 'overdue', tr: 'gecikmiş', it: 'scaduti', fr: 'en retard', de: 'überfällig', ar: 'متأخرة', zh: '项已逾期', ja: '件が期限切れ' },
  porVencer: { es: 'por vencer', en: 'due soon', tr: 'yaklaşan', it: 'in scadenza', fr: 'à venir', de: 'demnächst fällig', ar: 'قريبة الاستحقاق', zh: '项即将到期', ja: '件が期限間近' },
  negociacionLabel: { es: 'Negociación', en: 'Negotiation', tr: 'Görüşme', it: 'Trattativa', fr: 'Négociation', de: 'Verhandlung', ar: 'مفاوضة', zh: '谈判', ja: '交渉' },
  objetivoLabel: { es: 'Objetivo', en: 'Target', tr: 'Hedef', it: 'Obiettivo', fr: 'Objectif', de: 'Ziel', ar: 'هدف', zh: '目标', ja: 'ターゲット' },
  club: { es: 'Club', en: 'Club', tr: 'Kulüp', it: 'Club', fr: 'Club', de: 'Verein', ar: 'النادي', zh: '俱乐部', ja: 'クラブ' },
  jugador: { es: 'Jugador', en: 'Player', tr: 'Oyuncu', it: 'Giocatore', fr: 'Joueur', de: 'Spieler', ar: 'اللاعب', zh: '球员', ja: '選手' },
  nombreJugadorPlaceholder: { es: 'Nombre del jugador', en: 'Player name', tr: 'Oyuncu adı', it: 'Nome del giocatore', fr: 'Nom du joueur', de: 'Spielername', ar: 'اسم اللاعب', zh: '球员姓名', ja: '選手名' },
  contacto: { es: 'Contacto', en: 'Contact', tr: 'İletişim kişisi', it: 'Contatto', fr: 'Contact', de: 'Kontakt', ar: 'جهة الاتصال', zh: '联系人', ja: '連絡先' },
  nombre: { es: 'Nombre', en: 'Name', tr: 'İsim', it: 'Nome', fr: 'Nom', de: 'Name', ar: 'الاسم', zh: '姓名', ja: '氏名' },
  cargo: { es: 'Cargo', en: 'Role', tr: 'Görev', it: 'Ruolo', fr: 'Fonction', de: 'Position', ar: 'المنصب', zh: '职位', ja: '役職' },
  cargoPlaceholder: { es: 'Ej: Director deportivo', en: 'E.g.: Sporting director', tr: 'Örn: Spor direktörü', it: 'Es.: Direttore sportivo', fr: 'Ex : Directeur sportif', de: 'Z. B. Sportdirektor', ar: 'مثال: المدير الرياضي', zh: '例如：体育总监', ja: '例：スポーツディレクター' },
  volverAHablar: { es: 'Volver a hablar el (opcional)', en: 'Follow up on (optional)', tr: 'Tekrar görüşme tarihi (opsiyonel)', it: 'Richiamare il (opzionale)', fr: 'Relancer le (facultatif)', de: 'Erneut kontaktieren am (optional)', ar: 'التواصل مرة أخرى في (اختياري)', zh: '再次跟进日期（可选）', ja: '次回連絡日（任意）' },
  guardarNegociacion: { es: 'Guardar negociación', en: 'Save negotiation', tr: 'Görüşmeyi kaydet', it: 'Salva trattativa', fr: 'Enregistrer la négociation', de: 'Verhandlung speichern', ar: 'حفظ المفاوضة', zh: '保存谈判', ja: '交渉を保存' },
  guardando: { es: 'Guardando...', en: 'Saving...', tr: 'Kaydediliyor...', it: 'Salvataggio...', fr: 'Enregistrement...', de: 'Speichern...', ar: 'جارٍ الحفظ...', zh: '正在保存...', ja: '保存中...' },
  errorGuardar: { es: 'No se pudo guardar. Probá de nuevo.', en: 'Could not save. Please try again.', tr: 'Kaydedilemedi. Tekrar deneyin.', it: 'Impossibile salvare. Riprova.', fr: "Impossible d'enregistrer. Réessayez.", de: 'Speichern fehlgeschlagen. Bitte erneut versuchen.', ar: 'تعذر الحفظ. حاول مرة أخرى.', zh: '保存失败，请重试。', ja: '保存できませんでした。もう一度お試しください。' },
  queBusca: { es: '¿Qué busca?', en: 'What are they looking for?', tr: 'Ne arıyorlar?', it: 'Cosa cercano?', fr: 'Que recherchent-ils ?', de: 'Wonach wird gesucht?', ar: 'ما الذي يبحثون عنه؟', zh: '他们在寻找什么？', ja: '求めているポジションは？' },
  posicionPlaceholder: { es: 'Ej: Lateral derecho', en: 'E.g.: Right-back', tr: 'Örn: Sağ bek', it: 'Es.: Terzino destro', fr: 'Ex : Arrière droit', de: 'Z. B. Rechter Verteidiger', ar: 'مثال: ظهير أيمن', zh: '例如：右后卫', ja: '例：右サイドバック' },
  guardarObjetivo: { es: 'Guardar objetivo', en: 'Save target', tr: 'Hedefi kaydet', it: 'Salva obiettivo', fr: "Enregistrer l'objectif", de: 'Ziel speichern', ar: 'حفظ الهدف', zh: '保存目标', ja: 'ターゲットを保存' },
  elegirResponsable: { es: 'Elegir responsable...', en: 'Choose owner...', tr: 'Sorumlu seçin...', it: 'Scegli responsabile...', fr: 'Choisir un responsable...', de: 'Verantwortlichen wählen...', ar: 'اختر المسؤول...', zh: '选择负责人...', ja: '担当者を選択...' },
  buscarClub: { es: 'Buscar club...', en: 'Search club...', tr: 'Kulüp ara...', it: 'Cerca club...', fr: 'Rechercher un club...', de: 'Verein suchen...', ar: 'ابحث عن نادٍ...', zh: '搜索俱乐部...', ja: 'クラブを検索...' },
  idJugadorPlaceholder: { es: 'ID de jugador en la API (opcional)', en: 'Player API ID (optional)', tr: 'API oyuncu ID\'si (opsiyonel)', it: 'ID giocatore API (opzionale)', fr: "ID joueur API (facultatif)", de: 'Spieler-API-ID (optional)', ar: 'معرّف اللاعب في الـ API (اختياري)', zh: 'API 球员 ID（可选）', ja: '選手API ID（任意）' },
  esJugadorSugerido: { es: '¿Es {name}, {position}? Usar este jugador de la API', en: 'Is it {name}, {position}? Use this API player', tr: '{name}, {position} mi? Bu API oyuncusunu kullan', it: 'È {name}, {position}? Usa questo giocatore dell\'API', fr: "S'agit-il de {name}, {position} ? Utiliser ce joueur de l'API", de: 'Ist es {name}, {position}? Diesen API-Spieler verwenden', ar: 'هل هو {name}، {position}؟ استخدم هذا اللاعب من الـ API', zh: '是 {name}（{position}）吗？使用该 API 球员', ja: '{name}（{position}）ですか？このAPI選手を使用' },
  notas: { es: 'Notas', en: 'Notes', tr: 'Notlar', it: 'Note', fr: 'Notes', de: 'Notizen', ar: 'الملاحظات', zh: '备注', ja: 'メモ' },
  reunionSingular: { es: 'reunión', en: 'meeting', tr: 'toplantı', it: 'riunione', fr: 'réunion', de: 'Besprechung', ar: 'اجتماع', zh: '次会面', ja: '件の面談' },
  reunionPlural: { es: 'reuniones', en: 'meetings', tr: 'toplantı', it: 'riunioni', fr: 'réunions', de: 'Besprechungen', ar: 'اجتماعات', zh: '次会面', ja: '件の面談' },
  escribirNota: { es: 'Escribir una nota...', en: 'Write a note...', tr: 'Bir not yazın...', it: 'Scrivi una nota...', fr: 'Écrire une note...', de: 'Notiz schreiben...', ar: 'اكتب ملاحظة...', zh: '写一条备注...', ja: 'メモを書く...' },
  fueReunion: { es: 'Fue una reunión', en: 'It was a meeting', tr: 'Bir toplantıydı', it: "È stata una riunione", fr: "C'était une réunion", de: 'Es war eine Besprechung', ar: 'كان اجتماعًا', zh: '这是一次会面', ja: 'これは面談でした' },
  agregar: { es: 'Agregar', en: 'Add', tr: 'Ekle', it: 'Aggiungi', fr: 'Ajouter', de: 'Hinzufügen', ar: 'إضافة', zh: '添加', ja: '追加' },
  cargandoNotas: { es: 'Cargando notas...', en: 'Loading notes...', tr: 'Notlar yükleniyor...', it: 'Caricamento note...', fr: 'Chargement des notes...', de: 'Notizen werden geladen...', ar: 'جارٍ تحميل الملاحظات...', zh: '正在加载备注...', ja: 'メモを読み込み中...' },
  sinNotas: { es: 'Todavía no hay notas.', en: 'No notes yet.', tr: 'Henüz not yok.', it: 'Ancora nessuna nota.', fr: "Aucune note pour l'instant.", de: 'Noch keine Notizen.', ar: 'لا توجد ملاحظات بعد.', zh: '还没有备注。', ja: 'まだメモがありません。' },
  sistema: { es: 'Sistema', en: 'System', tr: 'Sistem', it: 'Sistema', fr: 'Système', de: 'System', ar: 'النظام', zh: '系统', ja: 'システム' },
  negociacionTitulo: { es: 'Negociación', en: 'Negotiation', tr: 'Görüşme', it: 'Trattativa', fr: 'Négociation', de: 'Verhandlung', ar: 'مفاوضة', zh: '谈判', ja: '交渉' },
  objetivoTitulo: { es: 'Objetivo', en: 'Target', tr: 'Hedef', it: 'Obiettivo', fr: 'Objectif', de: 'Ziel', ar: 'هدف', zh: '目标', ja: 'ターゲット' },
  estado: { es: 'Estado', en: 'Status', tr: 'Durum', it: 'Stato', fr: 'Statut', de: 'Status', ar: 'الحالة', zh: '状态', ja: 'ステータス' },
  contactoConDatos: { es: 'Contacto:', en: 'Contact:', tr: 'İletişim:', it: 'Contatto:', fr: 'Contact :', de: 'Kontakt:', ar: 'جهة الاتصال:', zh: '联系人：', ja: '連絡先：' },
  reasignar: { es: 'Reasignar', en: 'Reassign', tr: 'Yeniden ata', it: 'Riassegna', fr: 'Réassigner', de: 'Neu zuweisen', ar: 'إعادة التعيين', zh: '重新分配', ja: '再割り当て' },
  sinAsignar: { es: 'Sin asignar', en: 'Unassigned', tr: 'Atanmadı', it: 'Non assegnato', fr: 'Non assigné', de: 'Nicht zugewiesen', ar: 'غير معيَّن', zh: '未分配', ja: '未割り当て' },
  vinculadoApi: { es: 'Vinculado a la API (#{id})', en: 'Linked to API (#{id})', tr: 'API\'ye bağlandı (#{id})', it: "Collegato all'API (#{id})", fr: "Lié à l'API (#{id})", de: 'Mit API verknüpft (#{id})', ar: 'مرتبط بالـ API (#{id})', zh: '已关联 API（#{id}）', ja: 'API連携済み（#{id}）' },
  sinVincularApi: { es: 'Sin vincular a la API', en: 'Not linked to API', tr: "API'ye bağlı değil", it: "Non collegato all'API", fr: "Non lié à l'API", de: 'Nicht mit API verknüpft', ar: 'غير مرتبط بالـ API', zh: '未关联 API', ja: 'API未連携' },
  vincularJugador: { es: 'Vincular jugador', en: 'Link player', tr: 'Oyuncu bağla', it: 'Collega giocatore', fr: 'Lier un joueur', de: 'Spieler verknüpfen', ar: 'ربط اللاعب', zh: '关联球员', ja: '選手を連携' },
  guardarVinculo: { es: 'Guardar vínculo', en: 'Save link', tr: 'Bağlantıyı kaydet', it: 'Salva collegamento', fr: 'Enregistrer le lien', de: 'Verknüpfung speichern', ar: 'حفظ الرابط', zh: '保存关联', ja: '連携を保存' },
};

const LANGS = ['es', 'en', 'tr', 'it', 'fr', 'de', 'ar', 'zh', 'ja'];

// Find each language block start line, and its closing "  }," line (the line
// with just "  }," right before the next language key or the closing "}" of
// the whole `translations` object).
const lines = content.split(/\r?\n/);
const blockStarts = {};
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^  (es|en|tr|it|fr|de|ar|zh|ja): \{$/);
  if (m) blockStarts[m[1]] = i;
}

const order = LANGS.slice().sort((a, b) => blockStarts[a] - blockStarts[b]);
const blockEnds = {};
for (let i = 0; i < order.length; i++) {
  const lang = order[i];
  const nextStart = i + 1 < order.length ? blockStarts[order[i + 1]] : null;
  // search backwards from nextStart (or end of translations object) for the
  // closing "  }," of this block
  let end = nextStart != null ? nextStart - 1 : lines.length - 1;
  while (!/^  \},?$/.test(lines[end])) end--;
  blockEnds[lang] = end;
}

// Insert new keys just before each block's closing line, in a stable order.
const keyOrder = Object.keys(T);
for (const lang of LANGS) {
  const insertion = keyOrder.map(k => `    'mercado.${k}': ${JSON.stringify(T[k][lang])},`);
  const endLine = blockEnds[lang];
  lines.splice(endLine, 0, ...insertion);
  // shift subsequent blockEnds/blockStarts down since we inserted lines
  for (const l2 of LANGS) {
    if (blockStarts[l2] > endLine) blockStarts[l2] += insertion.length;
    if (blockEnds[l2] > endLine) blockEnds[l2] += insertion.length;
  }
}

writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Injected', keyOrder.length, 'mercado.* keys into', LANGS.length, 'languages.');
