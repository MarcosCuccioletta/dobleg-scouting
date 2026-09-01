import { readFileSync, writeFileSync } from 'fs';

const path = 'src/constants/translations.ts';
const content = readFileSync(path, 'utf8');

const NEW = {
  'mercado.alertas': { es: 'Alertas', en: 'Alerts', tr: 'Uyarılar', it: 'Avvisi', fr: 'Alertes', de: 'Benachrichtigungen', ar: 'التنبيهات', zh: '提醒', ja: 'アラート' },
  'mercado.sinAlertas': { es: 'No tenés alertas pendientes.', en: "You don't have any pending alerts.", tr: 'Bekleyen uyarınız yok.', it: 'Non hai avvisi in sospeso.', fr: "Vous n'avez aucune alerte en attente.", de: 'Du hast keine ausstehenden Benachrichtigungen.', ar: 'ليس لديك أي تنبيهات معلقة.', zh: '您没有待处理的提醒。', ja: '保留中のアラートはありません。' },
};

const LANGS = ['es', 'en', 'tr', 'it', 'fr', 'de', 'ar', 'zh', 'ja'];
const lines = content.split(/\r?\n/);

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

const { blockStarts } = computeBlocks();
const order = LANGS.slice().sort((a, b) => blockStarts[a] - blockStarts[b]);
const keyOrder = Object.keys(NEW);
for (const lang of order) {
  const insertion = keyOrder.map(k => `    '${k}': ${JSON.stringify(NEW[k][lang])},`);
  const endLine = computeBlocks().blockEnds[lang];
  lines.splice(endLine, 0, ...insertion);
}

writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Inserted', keyOrder.length, 'new keys into', LANGS.length, 'languages.');
