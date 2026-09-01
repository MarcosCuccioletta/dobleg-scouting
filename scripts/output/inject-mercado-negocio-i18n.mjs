import { readFileSync, writeFileSync } from 'fs';

const path = 'src/constants/translations.ts';
const content = readFileSync(path, 'utf8');

// Overrides de texto existente (renombrar "Objetivo(s)" -> "Búsqueda(s)")
const OVERRIDES = {
  'mercado.tabObjetivos': { es: 'Búsquedas', en: 'Club searches', tr: 'Kulüp aramaları', it: 'Ricerche club', fr: 'Recherches des clubs', de: 'Vereinssuchen', ar: 'عمليات بحث الأندية', zh: '俱乐部搜索', ja: 'クラブの探索' },
  'mercado.nuevoObjetivo': { es: 'Nueva búsqueda', en: 'New club search', tr: 'Yeni kulüp araması', it: 'Nuova ricerca club', fr: 'Nouvelle recherche de club', de: 'Neue Vereinssuche', ar: 'بحث نادٍ جديد', zh: '新建俱乐部搜索', ja: '新規クラブ探索' },
  'mercado.guardarObjetivo': { es: 'Guardar búsqueda', en: 'Save search', tr: 'Aramayı kaydet', it: 'Salva ricerca', fr: 'Enregistrer la recherche', de: 'Suche speichern', ar: 'حفظ البحث', zh: '保存搜索', ja: '検索を保存' },
  'mercado.objetivoLabel': { es: 'Búsqueda', en: 'Club search', tr: 'Kulüp araması', it: 'Ricerca club', fr: 'Recherche de club', de: 'Vereinssuche', ar: 'بحث النادي', zh: '俱乐部搜索', ja: 'クラブ探索' },
  'mercado.sinObjetivosTitulo': { es: 'Sin búsquedas', en: 'No club searches', tr: 'Kulüp araması yok', it: 'Nessuna ricerca club', fr: 'Aucune recherche de club', de: 'Keine Vereinssuchen', ar: 'لا توجد عمليات بحث', zh: '暂无俱乐部搜索', ja: 'クラブ探索はありません' },
  'mercado.sinObjetivosVacio': { es: 'Todavía no hay búsquedas cargadas.', en: 'No club searches added yet.', tr: 'Henüz kulüp araması eklenmedi.', it: 'Ancora nessuna ricerca club caricata.', fr: 'Aucune recherche de club ajoutée pour le moment.', de: 'Noch keine Vereinssuchen hinzugefügt.', ar: 'لم تتم إضافة أي عمليات بحث بعد.', zh: '还没有添加俱乐部搜索。', ja: 'まだクラブ探索が登録されていません。' },
  'mercado.sinObjetivosFiltro': { es: 'No hay búsquedas vencidas.', en: 'No overdue club searches.', tr: 'Gecikmiş kulüp araması yok.', it: 'Nessuna ricerca club scaduta.', fr: 'Aucune recherche de club en retard.', de: 'Keine überfälligen Vereinssuchen.', ar: 'لا توجد عمليات بحث متأخرة.', zh: '没有逾期的俱乐部搜索。', ja: '期限切れのクラブ探索はありません。' },
  'mercado.queBusca': { es: '¿Qué posición busca?', en: 'What position are they looking for?', tr: 'Hangi mevkiyi arıyorlar?', it: 'Che ruolo cercano?', fr: 'Quel poste recherchent-ils ?', de: 'Welche Position wird gesucht?', ar: 'عن أي مركز يبحثون؟', zh: '他们在寻找哪个位置？', ja: '求めているポジションは？' },
};

const NEW = {
  'mercado.jugadorLibre': { es: 'Jugador libre', en: 'Free agent', tr: 'Serbest oyuncu', it: 'Svincolato', fr: 'Agent libre', de: 'Vereinsloser Spieler', ar: 'لاعب حر', zh: '自由球员', ja: 'フリーエージェント' },
  'mercado.quedaLibre': { es: 'Queda libre', en: 'Becomes a free agent', tr: 'Serbest kalıyor', it: 'Diventa svincolato', fr: 'Devient agent libre', de: 'Wird vereinslos', ar: 'يصبح حرًا', zh: '成为自由球员', ja: 'フリーになる' },
  'mercado.clubActual': { es: 'Club actual', en: 'Current club', tr: 'Mevcut kulüp', it: 'Club attuale', fr: 'Club actuel', de: 'Aktueller Verein', ar: 'النادي الحالي', zh: '当前俱乐部', ja: '現所属クラブ' },
  'mercado.clubDestino': { es: 'Club destino', en: 'Target club', tr: 'Hedef kulüp', it: 'Club destinazione', fr: 'Club de destination', de: 'Zielverein', ar: 'النادي الهدف', zh: '目标俱乐部', ja: '移籍先クラブ' },
  'mercado.soloLiberarlo': { es: 'Sólo liberarlo (sin destino todavía)', en: 'Just release him (no target yet)', tr: 'Sadece serbest bırak (henüz hedef yok)', it: 'Solo svincolarlo (nessuna destinazione ancora)', fr: 'Juste le libérer (pas encore de destination)', de: 'Nur freistellen (noch kein Ziel)', ar: 'مجرد إطلاق سراحه (لا وجهة بعد)', zh: '仅解约（暂无目标俱乐部）', ja: 'とりあえず解放する（移籍先未定）' },
  'mercado.representante': { es: 'Representante del jugador', en: "Player's agent", tr: 'Oyuncu temsilcisi', it: 'Agente del giocatore', fr: 'Agent du joueur', de: 'Spielerberater', ar: 'وكيل اللاعب', zh: '球员经纪人', ja: '選手代理人' },
  'mercado.representantePlaceholder': { es: 'Nombre del representante', en: "Agent's name", tr: 'Temsilci adı', it: "Nome dell'agente", fr: "Nom de l'agent", de: 'Name des Beraters', ar: 'اسم الوكيل', zh: '经纪人姓名', ja: '代理人名' },
  'mercado.directorDeportivoPlaceholder': { es: 'Director deportivo', en: 'Sporting director', tr: 'Spor direktörü', it: 'Direttore sportivo', fr: 'Directeur sportif', de: 'Sportdirektor', ar: 'المدير الرياضي', zh: '体育总监', ja: 'スポーツディレクター' },
  'mercado.contactoClubActual': { es: 'Contacto club actual', en: 'Current club contact', tr: 'Mevcut kulüp iletişimi', it: 'Contatto club attuale', fr: 'Contact club actuel', de: 'Kontakt aktueller Verein', ar: 'جهة اتصال النادي الحالي', zh: '当前俱乐部联系人', ja: '現所属クラブ担当者' },
  'mercado.contactoClubDestino': { es: 'Contacto club destino', en: 'Target club contact', tr: 'Hedef kulüp iletişimi', it: 'Contatto club destinazione', fr: 'Contact club de destination', de: 'Kontakt Zielverein', ar: 'جهة اتصال النادي الهدف', zh: '目标俱乐部联系人', ja: '移籍先クラブ担当者' },
  'mercado.vinculoSoloAdmin': { es: 'Solo Marcos y Matías pueden vincular el jugador de la API.', en: 'Only Marcos and Matías can link the API player.', tr: 'API oyuncusunu yalnızca Marcos ve Matías bağlayabilir.', it: "Solo Marcos e Matías possono collegare il giocatore dell'API.", fr: "Seuls Marcos et Matías peuvent lier le joueur de l'API.", de: 'Nur Marcos und Matías können den API-Spieler verknüpfen.', ar: 'يمكن فقط لماركوس وماتياس ربط لاعب الـ API.', zh: '只有 Marcos 和 Matías 可以关联 API 球员。', ja: 'MarcosとMatíasのみがAPI選手を連携できます。' },
  'mercado.jugadoresPropuestos': { es: 'Jugadores propuestos', en: 'Players offered', tr: 'Önerilen oyuncular', it: 'Giocatori proposti', fr: 'Joueurs proposés', de: 'Vorgeschlagene Spieler', ar: 'اللاعبون المقترحون', zh: '提议的球员', ja: '提案された選手' },
  'mercado.sinCandidatos': { es: 'Todavía no se propuso ningún jugador.', en: 'No players offered yet.', tr: 'Henüz oyuncu önerilmedi.', it: 'Ancora nessun giocatore proposto.', fr: "Aucun joueur proposé pour l'instant.", de: 'Noch keine Spieler vorgeschlagen.', ar: 'لم يُقترح أي لاعب بعد.', zh: '还没有提议球员。', ja: 'まだ選手が提案されていません。' },
  'mercado.candidatoPropuesto': { es: 'Propuesto', en: 'Offered', tr: 'Önerildi', it: 'Proposto', fr: 'Proposé', de: 'Vorgeschlagen', ar: 'مقترح', zh: '已提议', ja: '提案済み' },
  'mercado.candidatoEnNegociacion': { es: 'En negociación', en: 'Negotiating', tr: 'Görüşülüyor', it: 'In trattativa', fr: 'En négociation', de: 'In Verhandlung', ar: 'قيد التفاوض', zh: '谈判中', ja: '交渉中' },
  'mercado.candidatoDescartado': { es: 'Descartado', en: 'Discarded', tr: 'Elendi', it: 'Scartato', fr: 'Écarté', de: 'Verworfen', ar: 'مستبعد', zh: '已淘汰', ja: '却下' },
  'mercado.candidatoFichado': { es: 'Fichado', en: 'Signed', tr: 'Transfer edildi', it: 'Ingaggiato', fr: 'Signé', de: 'Verpflichtet', ar: 'تم التعاقد', zh: '已签约', ja: '獲得済み' },
  'mercado.vincular': { es: 'Vincular', en: 'Link', tr: 'Bağla', it: 'Collega', fr: 'Lier', de: 'Verknüpfen', ar: 'ربط', zh: '关联', ja: '連携' },
  'mercado.quitar': { es: 'Quitar', en: 'Remove', tr: 'Kaldır', it: 'Rimuovi', fr: 'Retirer', de: 'Entfernen', ar: 'إزالة', zh: '移除', ja: '削除' },
};

const LANGS = ['es', 'en', 'tr', 'it', 'fr', 'de', 'ar', 'zh', 'ja'];
const lines = content.split(/\r?\n/);

function replaceOrInsertKey(lang, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^(\\s*)'${escaped}':\\s*.*,\\s*$`);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (m) {
      lines[i] = `${m[1]}'${key}': ${JSON.stringify(value)},`;
      return true;
    }
  }
  return false;
}

// 1) Apply overrides (must exist already)
let missingOverrides = [];
for (const key of Object.keys(OVERRIDES)) {
  for (const lang of LANGS) {
    // Only touch the line within this language's block: find block bounds fresh each time is complex;
    // since keys are unique strings across the whole file (only one 'mercado.tabObjetivos' per language block,
    // but the key text repeats per block) we must scope by block. Simpler: track blocks first.
  }
}

// Recompute block boundaries (needed for scoping both overrides and inserts)
function computeBlocks() {
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
    let end = nextStart != null ? nextStart - 1 : lines.length - 1;
    while (!/^  \},?$/.test(lines[end])) end--;
    blockEnds[lang] = end;
  }
  return { blockStarts, blockEnds };
}

// Apply overrides scoped per-language block
for (const lang of LANGS) {
  const { blockStarts, blockEnds } = computeBlocks();
  const start = blockStarts[lang];
  const end = blockEnds[lang];
  for (const [key, values] of Object.entries(OVERRIDES)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^(\\s*)'${escaped}':\\s*.*,\\s*$`);
    let found = false;
    for (let i = start; i <= end; i++) {
      const m = lines[i].match(re);
      if (m) {
        lines[i] = `${m[1]}'${key}': ${JSON.stringify(values[lang])},`;
        found = true;
        break;
      }
    }
    if (!found) missingOverrides.push(`${lang}:${key}`);
  }
}

if (missingOverrides.length) {
  console.error('Missing override keys (not found, skipped):', missingOverrides.join(', '));
}

// Insert new keys at the end of each language block
{
  const { blockStarts, blockEnds } = computeBlocks();
  const order = LANGS.slice().sort((a, b) => blockStarts[a] - blockStarts[b]);
  const keyOrder = Object.keys(NEW);
  for (const lang of order) {
    const insertion = keyOrder.map(k => `    '${k}': ${JSON.stringify(NEW[k][lang])},`);
    const endLine = computeBlocks().blockEnds[lang];
    lines.splice(endLine, 0, ...insertion);
  }
}

writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Applied', Object.keys(OVERRIDES).length, 'overrides and inserted', Object.keys(NEW).length, 'new keys into', LANGS.length, 'languages.');
