import { readFileSync, writeFileSync } from 'fs';

const path = 'src/constants/translations.ts';
const content = readFileSync(path, 'utf8');

const T = {
  titulo: { es: 'Página no encontrada', en: 'Page not found', tr: 'Sayfa bulunamadı', it: 'Pagina non trovata', fr: 'Page introuvable', de: 'Seite nicht gefunden', ar: 'الصفحة غير موجودة', zh: '页面未找到', ja: 'ページが見つかりません' },
  mensaje: {
    es: 'La página que buscás no existe o se movió de lugar.', en: "The page you're looking for doesn't exist or has moved.", tr: 'Aradığınız sayfa mevcut değil veya taşınmış.',
    it: 'La pagina che cerchi non esiste o è stata spostata.', fr: "La page que vous recherchez n'existe pas ou a été déplacée.", de: 'Die gesuchte Seite existiert nicht oder wurde verschoben.',
    ar: 'الصفحة التي تبحث عنها غير موجودة أو تم نقلها.', zh: '您要查找的页面不存在或已被移动。', ja: 'お探しのページは存在しないか、移動しました。',
  },
  volver: { es: 'Volver a', en: 'Back to', tr: 'Geri dön:', it: 'Torna a', fr: 'Retour à', de: 'Zurück zu', ar: 'العودة إلى', zh: '返回', ja: 'に戻る' },
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
  const insertion = keyOrder.map(k => `    'notFound.${k}': ${JSON.stringify(T[k][lang])},`);
  const endLine = blockEnds[lang];
  lines.splice(endLine, 0, ...insertion);
  for (const l2 of LANGS) {
    if (blockStarts[l2] > endLine) blockStarts[l2] += insertion.length;
    if (blockEnds[l2] > endLine) blockEnds[l2] += insertion.length;
  }
}
writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Injected', keyOrder.length, 'notFound.* keys into', LANGS.length, 'languages.');
