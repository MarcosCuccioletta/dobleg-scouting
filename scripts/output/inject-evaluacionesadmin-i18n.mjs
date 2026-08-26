import fs from 'fs'
const path = 'src/constants/translations.ts'
let src = fs.readFileSync(path, 'utf8')

const blocks = {
  es: {
    anchor: "'nav.gestionarEvaluaciones': 'Gestionar evaluaciones',",
    keys: {
      noTienesAcceso: 'No tenés acceso a esta página.',
      titulo: 'Evaluaciones de Scouts', subtitulo: 'Vincula las evaluaciones con los jugadores de la base de datos',
      sinVincularCount: 'Sin vincular ({count})', todasCount: 'Todas ({count})',
      sinEvaluacionesSinVincular: 'No hay evaluaciones sin vincular', sinEvaluaciones: 'No hay evaluaciones',
      colJugador: 'Jugador', colEquipoPartido: 'Equipo / Partido', colScout: 'Scout', colScore: 'Score', colEstado: 'Estado', colAccion: 'Acción',
      vinculado: 'Vinculado', pendiente: 'Pendiente', vincular: 'Vincular',
      vincularEvaluacion: 'Vincular evaluación', buscaJugadorEnBase: 'Busca el jugador en la base de datos para vincular esta evaluación',
      evaluadoPor: 'Evaluado por {scout} el {date}',
      buscarJugadorPlaceholder: 'Buscar jugador...', sugerencias: 'Sugerencias ({count})',
      sinJugadoresSimilares: 'No se encontraron jugadores similares', matchPercent: '{score}% match',
      omitirJugadorNuevo: 'Omitir (jugador nuevo)', cancelar: 'Cancelar',
      razonNombreSimilar: 'Nombre similar', razonMismoEquipo: 'Mismo equipo', razonMismaPosicion: 'Misma posición',
    },
  },
  en: {
    anchor: "'nav.gestionarEvaluaciones': 'Manage Evaluations',",
    keys: {
      noTienesAcceso: "You don't have access to this page.",
      titulo: 'Scout Evaluations', subtitulo: 'Link the evaluations to the players in the database',
      sinVincularCount: 'Unlinked ({count})', todasCount: 'All ({count})',
      sinEvaluacionesSinVincular: 'No unlinked evaluations', sinEvaluaciones: 'No evaluations',
      colJugador: 'Player', colEquipoPartido: 'Team / Match', colScout: 'Scout', colScore: 'Score', colEstado: 'Status', colAccion: 'Action',
      vinculado: 'Linked', pendiente: 'Pending', vincular: 'Link',
      vincularEvaluacion: 'Link evaluation', buscaJugadorEnBase: 'Search for the player in the database to link this evaluation',
      evaluadoPor: 'Evaluated by {scout} on {date}',
      buscarJugadorPlaceholder: 'Search player...', sugerencias: 'Suggestions ({count})',
      sinJugadoresSimilares: 'No similar players found', matchPercent: '{score}% match',
      omitirJugadorNuevo: 'Skip (new player)', cancelar: 'Cancel',
      razonNombreSimilar: 'Similar name', razonMismoEquipo: 'Same team', razonMismaPosicion: 'Same position',
    },
  },
  tr: {
    anchor: "'nav.gestionarEvaluaciones': 'Değerlendirmeleri Yönet',",
    keys: {
      noTienesAcceso: 'Bu sayfaya erişimin yok.',
      titulo: 'Scout Değerlendirmeleri', subtitulo: 'Değerlendirmeleri veritabanındaki oyuncularla eşleştir',
      sinVincularCount: 'Eşleşmemiş ({count})', todasCount: 'Tümü ({count})',
      sinEvaluacionesSinVincular: 'Eşleşmemiş değerlendirme yok', sinEvaluaciones: 'Değerlendirme yok',
      colJugador: 'Oyuncu', colEquipoPartido: 'Takım / Maç', colScout: 'Scout', colScore: 'Skor', colEstado: 'Durum', colAccion: 'İşlem',
      vinculado: 'Eşleşti', pendiente: 'Bekliyor', vincular: 'Eşleştir',
      vincularEvaluacion: 'Değerlendirmeyi eşleştir', buscaJugadorEnBase: 'Bu değerlendirmeyi eşleştirmek için veritabanında oyuncuyu ara',
      evaluadoPor: '{scout} tarafından {date} tarihinde değerlendirildi',
      buscarJugadorPlaceholder: 'Oyuncu ara...', sugerencias: 'Öneriler ({count})',
      sinJugadoresSimilares: 'Benzer oyuncu bulunamadı', matchPercent: '%{score} eşleşme',
      omitirJugadorNuevo: 'Atla (yeni oyuncu)', cancelar: 'İptal',
      razonNombreSimilar: 'Benzer isim', razonMismoEquipo: 'Aynı takım', razonMismaPosicion: 'Aynı pozisyon',
    },
  },
  it: {
    anchor: "'nav.gestionarEvaluaciones': 'Gestisci Valutazioni',",
    keys: {
      noTienesAcceso: 'Non hai accesso a questa pagina.',
      titulo: 'Valutazioni degli Scout', subtitulo: 'Collega le valutazioni ai giocatori nel database',
      sinVincularCount: 'Non collegate ({count})', todasCount: 'Tutte ({count})',
      sinEvaluacionesSinVincular: 'Nessuna valutazione non collegata', sinEvaluaciones: 'Nessuna valutazione',
      colJugador: 'Giocatore', colEquipoPartido: 'Squadra / Partita', colScout: 'Scout', colScore: 'Punteggio', colEstado: 'Stato', colAccion: 'Azione',
      vinculado: 'Collegato', pendiente: 'In sospeso', vincular: 'Collega',
      vincularEvaluacion: 'Collega valutazione', buscaJugadorEnBase: 'Cerca il giocatore nel database per collegare questa valutazione',
      evaluadoPor: 'Valutato da {scout} il {date}',
      buscarJugadorPlaceholder: 'Cerca giocatore...', sugerencias: 'Suggerimenti ({count})',
      sinJugadoresSimilares: 'Nessun giocatore simile trovato', matchPercent: '{score}% corrispondenza',
      omitirJugadorNuevo: 'Salta (nuovo giocatore)', cancelar: 'Annulla',
      razonNombreSimilar: 'Nome simile', razonMismoEquipo: 'Stessa squadra', razonMismaPosicion: 'Stessa posizione',
    },
  },
  fr: {
    anchor: "'nav.gestionarEvaluaciones': 'Gérer les Évaluations',",
    keys: {
      noTienesAcceso: "Vous n'avez pas accès à cette page.",
      titulo: 'Évaluations des Scouts', subtitulo: 'Associez les évaluations aux joueurs de la base de données',
      sinVincularCount: 'Non associées ({count})', todasCount: 'Toutes ({count})',
      sinEvaluacionesSinVincular: 'Aucune évaluation non associée', sinEvaluaciones: 'Aucune évaluation',
      colJugador: 'Joueur', colEquipoPartido: 'Équipe / Match', colScout: 'Scout', colScore: 'Score', colEstado: 'Statut', colAccion: 'Action',
      vinculado: 'Associé', pendiente: 'En attente', vincular: 'Associer',
      vincularEvaluacion: "Associer l'évaluation", buscaJugadorEnBase: 'Recherchez le joueur dans la base de données pour associer cette évaluation',
      evaluadoPor: 'Évalué par {scout} le {date}',
      buscarJugadorPlaceholder: 'Rechercher un joueur...', sugerencias: 'Suggestions ({count})',
      sinJugadoresSimilares: 'Aucun joueur similaire trouvé', matchPercent: '{score} % de correspondance',
      omitirJugadorNuevo: 'Ignorer (nouveau joueur)', cancelar: 'Annuler',
      razonNombreSimilar: 'Nom similaire', razonMismoEquipo: 'Même équipe', razonMismaPosicion: 'Même poste',
    },
  },
  de: {
    anchor: "'nav.gestionarEvaluaciones': 'Bewertungen Verwalten',",
    keys: {
      noTienesAcceso: 'Du hast keinen Zugriff auf diese Seite.',
      titulo: 'Scout-Bewertungen', subtitulo: 'Verknüpfe die Bewertungen mit den Spielern in der Datenbank',
      sinVincularCount: 'Nicht verknüpft ({count})', todasCount: 'Alle ({count})',
      sinEvaluacionesSinVincular: 'Keine nicht verknüpften Bewertungen', sinEvaluaciones: 'Keine Bewertungen',
      colJugador: 'Spieler', colEquipoPartido: 'Verein / Spiel', colScout: 'Scout', colScore: 'Punktzahl', colEstado: 'Status', colAccion: 'Aktion',
      vinculado: 'Verknüpft', pendiente: 'Ausstehend', vincular: 'Verknüpfen',
      vincularEvaluacion: 'Bewertung verknüpfen', buscaJugadorEnBase: 'Suche den Spieler in der Datenbank, um diese Bewertung zu verknüpfen',
      evaluadoPor: 'Bewertet von {scout} am {date}',
      buscarJugadorPlaceholder: 'Spieler suchen...', sugerencias: 'Vorschläge ({count})',
      sinJugadoresSimilares: 'Keine ähnlichen Spieler gefunden', matchPercent: '{score}% Übereinstimmung',
      omitirJugadorNuevo: 'Überspringen (neuer Spieler)', cancelar: 'Abbrechen',
      razonNombreSimilar: 'Ähnlicher Name', razonMismoEquipo: 'Gleicher Verein', razonMismaPosicion: 'Gleiche Position',
    },
  },
  ar: {
    anchor: "'nav.gestionarEvaluaciones': 'إدارة التقييمات',",
    keys: {
      noTienesAcceso: 'ليس لديك صلاحية الوصول إلى هذه الصفحة.',
      titulo: 'تقييمات الكشافين', subtitulo: 'اربط التقييمات باللاعبين في قاعدة البيانات',
      sinVincularCount: 'غير مرتبطة ({count})', todasCount: 'الكل ({count})',
      sinEvaluacionesSinVincular: 'لا توجد تقييمات غير مرتبطة', sinEvaluaciones: 'لا توجد تقييمات',
      colJugador: 'اللاعب', colEquipoPartido: 'النادي / المباراة', colScout: 'الكشاف', colScore: 'النتيجة', colEstado: 'الحالة', colAccion: 'الإجراء',
      vinculado: 'مرتبط', pendiente: 'قيد الانتظار', vincular: 'ربط',
      vincularEvaluacion: 'ربط التقييم', buscaJugadorEnBase: 'ابحث عن اللاعب في قاعدة البيانات لربط هذا التقييم',
      evaluadoPor: 'تم التقييم بواسطة {scout} بتاريخ {date}',
      buscarJugadorPlaceholder: 'ابحث عن لاعب...', sugerencias: 'اقتراحات ({count})',
      sinJugadoresSimilares: 'لم يتم العثور على لاعبين مشابهين', matchPercent: 'تطابق {score}%',
      omitirJugadorNuevo: 'تخطي (لاعب جديد)', cancelar: 'إلغاء',
      razonNombreSimilar: 'اسم مشابه', razonMismoEquipo: 'نفس النادي', razonMismaPosicion: 'نفس المركز',
    },
  },
  zh: {
    anchor: "'nav.gestionarEvaluaciones': '管理评估',",
    keys: {
      noTienesAcceso: '您无权访问此页面。',
      titulo: '球探评估', subtitulo: '将评估与数据库中的球员关联',
      sinVincularCount: '未关联（{count}）', todasCount: '全部（{count}）',
      sinEvaluacionesSinVincular: '没有未关联的评估', sinEvaluaciones: '没有评估',
      colJugador: '球员', colEquipoPartido: '球队/比赛', colScout: '球探', colScore: '评分', colEstado: '状态', colAccion: '操作',
      vinculado: '已关联', pendiente: '待处理', vincular: '关联',
      vincularEvaluacion: '关联评估', buscaJugadorEnBase: '在数据库中搜索球员以关联此评估',
      evaluadoPor: '由{scout}于{date}评估',
      buscarJugadorPlaceholder: '搜索球员...', sugerencias: '建议（{count}）',
      sinJugadoresSimilares: '未找到相似球员', matchPercent: '{score}% 匹配',
      omitirJugadorNuevo: '跳过（新球员）', cancelar: '取消',
      razonNombreSimilar: '姓名相似', razonMismoEquipo: '同一球队', razonMismaPosicion: '同一位置',
    },
  },
  ja: {
    anchor: "'nav.gestionarEvaluaciones': '評価管理',",
    keys: {
      noTienesAcceso: 'このページへのアクセス権がありません。',
      titulo: 'スカウト評価', subtitulo: '評価をデータベース内の選手と関連付ける',
      sinVincularCount: '未関連付け（{count}）', todasCount: 'すべて（{count}）',
      sinEvaluacionesSinVincular: '未関連付けの評価はありません', sinEvaluaciones: '評価はありません',
      colJugador: '選手', colEquipoPartido: 'チーム／試合', colScout: 'スカウト', colScore: 'スコア', colEstado: 'ステータス', colAccion: '操作',
      vinculado: '関連付け済み', pendiente: '保留中', vincular: '関連付け',
      vincularEvaluacion: '評価を関連付け', buscaJugadorEnBase: 'この評価を関連付けるためデータベースで選手を検索',
      evaluadoPor: '{scout}が{date}に評価',
      buscarJugadorPlaceholder: '選手を検索...', sugerencias: '候補（{count}）',
      sinJugadoresSimilares: '類似選手が見つかりません', matchPercent: '{score}%一致',
      omitirJugadorNuevo: 'スキップ（新規選手）', cancelar: 'キャンセル',
      razonNombreSimilar: '類似した名前', razonMismoEquipo: '同じチーム', razonMismaPosicion: '同じポジション',
    },
  },
}

let count = 0
for (const [lang, { anchor, keys }] of Object.entries(blocks)) {
  if (!src.includes(anchor)) { console.error('ANCHOR NOT FOUND for', lang, ':', anchor); continue }
  const lines = Object.entries(keys).map(([k, v]) => `    'evaluacionesAdmin.${k}': ${JSON.stringify(v)},`).join('\n')
  src = src.replace(anchor, `${anchor}\n${lines}`)
  count++
}

fs.writeFileSync(path, src, 'utf8')
console.log('OK inserted for', count, 'languages')
