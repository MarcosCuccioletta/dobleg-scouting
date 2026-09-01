import { readFileSync, writeFileSync } from 'fs';

const path = 'src/constants/translations.ts';
const content = readFileSync(path, 'utf8');

const T = {
  buscandoJugador: { es: 'Buscando jugador...', en: 'Looking up player...', tr: 'Oyuncu aranıyor...', it: 'Ricerca giocatore...', fr: 'Recherche du joueur...', de: 'Spieler wird gesucht...', ar: 'جارٍ البحث عن اللاعب...', zh: '正在查找球员...', ja: '選手を検索中...' },
  jugadorNoEncontrado: { es: 'No se encontró ningún jugador con ese ID.', en: 'No player found with that ID.', tr: 'Bu ID ile eşleşen oyuncu bulunamadı.', it: 'Nessun giocatore trovato con questo ID.', fr: "Aucun joueur trouvé avec cet identifiant.", de: 'Kein Spieler mit dieser ID gefunden.', ar: 'لم يتم العثور على لاعب بهذا المعرّف.', zh: '未找到该ID对应的球员。', ja: 'そのIDの選手は見つかりませんでした。' },
};

const LANGS = ['es', 'en', 'tr', 'it', 'fr', 'de', 'ar', 'zh', 'ja'];
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
  let end = nextStart != null ? nextStart - 1 : lines.length - 1;
  while (!/^  \},?$/.test(lines[end])) end--;
  blockEnds[lang] = end;
}
const keyOrder = Object.keys(T);
for (const lang of LANGS) {
  const insertion = keyOrder.map(k => `    'mercado.${k}': ${JSON.stringify(T[k][lang])},`);
  const endLine = blockEnds[lang];
  lines.splice(endLine, 0, ...insertion);
  for (const l2 of LANGS) {
    if (blockStarts[l2] > endLine) blockStarts[l2] += insertion.length;
    if (blockEnds[l2] > endLine) blockEnds[l2] += insertion.length;
  }
}
writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Injected', keyOrder.length, 'mercado.* keys into', LANGS.length, 'languages.');
