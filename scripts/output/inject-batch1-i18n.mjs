import { readFileSync, writeFileSync } from 'fs';

const path = 'src/constants/translations.ts';
const content = readFileSync(path, 'utf8');

const T = {
  'coachesList.subtitulo': { es: 'Cuerpo técnico representado por Doble G Sports Group', en: 'Coaching staff represented by Doble G Sports Group', tr: 'Doble G Sports Group tarafından temsil edilen teknik ekip', it: 'Staff tecnico rappresentato da Doble G Sports Group', fr: 'Staff technique représenté par Doble G Sports Group', de: 'Trainerstab, vertreten von Doble G Sports Group', ar: 'الطاقم الفني الذي تمثله Doble G Sports Group', zh: '由 Doble G Sports Group 代理的教练团队', ja: 'Doble G Sports Group が代理するコーチングスタッフ' },
  'coachesList.sinClub': { es: 'Sin club actualmente', en: 'Currently without a club', tr: 'Şu anda kulüpsüz', it: 'Attualmente senza club', fr: 'Actuellement sans club', de: 'Derzeit ohne Verein', ar: 'بدون نادٍ حاليًا', zh: '目前无所属俱乐部', ja: '現在無所属' },
  'coachDetail.noEncontrado': { es: 'Entrenador no encontrado', en: 'Coach not found', tr: 'Antrenör bulunamadı', it: 'Allenatore non trovato', fr: 'Entraîneur introuvable', de: 'Trainer nicht gefunden', ar: 'لم يتم العثور على المدرب', zh: '未找到教练', ja: 'コーチが見つかりません' },
  'coachDetail.noEncontradoDesc': { es: 'No pudimos encontrar a este entrenador en el plantel técnico de Doble G.', en: "We couldn't find this coach in Doble G's coaching staff.", tr: 'Bu antrenörü Doble G teknik ekibinde bulamadık.', it: 'Non abbiamo trovato questo allenatore nello staff tecnico di Doble G.', fr: "Nous n'avons pas trouvé cet entraîneur dans le staff technique de Doble G.", de: 'Dieser Trainer wurde im Trainerstab von Doble G nicht gefunden.', ar: 'لم نتمكن من العثور على هذا المدرب ضمن الطاقم الفني لـ Doble G.', zh: '在 Doble G 的教练团队中未找到该教练。', ja: 'Doble Gのコーチングスタッフにこのコーチは見つかりませんでした。' },
  'coachDetail.volver': { es: 'Volver a Entrenadores', en: 'Back to Coaches', tr: 'Antrenörlere dön', it: 'Torna ad Allenatori', fr: 'Retour aux Entraîneurs', de: 'Zurück zu Trainern', ar: 'العودة إلى المدربين', zh: '返回教练列表', ja: 'コーチ一覧に戻る' },
  'coachDetail.tabResumen': { es: 'Resumen', en: 'Summary', tr: 'Özet', it: 'Riepilogo', fr: 'Résumé', de: 'Übersicht', ar: 'ملخص', zh: '概览', ja: '概要' },
  'coachDetail.tabPlantel': { es: 'Plantel', en: 'Squad', tr: 'Kadro', it: 'Rosa', fr: 'Effectif', de: 'Kader', ar: 'التشكيلة', zh: '阵容', ja: 'スカッド' },
  'coachDetail.tabLiga': { es: 'Liga', en: 'League', tr: 'Lig', it: 'Campionato', fr: 'Championnat', de: 'Liga', ar: 'الدوري', zh: '联赛', ja: 'リーグ' },
  'coachDetail.tabCalendario': { es: 'Calendario', en: 'Calendar', tr: 'Takvim', it: 'Calendario', fr: 'Calendrier', de: 'Kalender', ar: 'التقويم', zh: '赛程', ja: 'カレンダー' },
  'coachDetail.tabEntrenamientos': { es: 'Entrenamientos', en: 'Training', tr: 'Antrenmanlar', it: 'Allenamenti', fr: 'Entraînements', de: 'Training', ar: 'التدريبات', zh: '训练', ja: 'トレーニング' },
  'coachDetail.tabNotas': { es: 'Notas de partidos', en: 'Match notes', tr: 'Maç notları', it: 'Note partite', fr: 'Notes de match', de: 'Spielnotizen', ar: 'ملاحظات المباريات', zh: '比赛笔记', ja: '試合メモ' },
  'coachDetail.tabPizarra': { es: 'Pizarra', en: 'Tactics board', tr: 'Taktik tahtası', it: 'Lavagna tattica', fr: 'Tableau tactique', de: 'Taktiktafel', ar: 'اللوح التكتيكي', zh: '战术板', ja: '戦術ボード' },
  'coachDetail.tabPlantelFuturo': { es: 'Plantel futuro', en: 'Future squad', tr: 'Gelecek kadro', it: 'Rosa futura', fr: 'Effectif futur', de: 'Zukünftiger Kader', ar: 'التشكيلة المستقبلية', zh: '未来阵容', ja: '将来のスカッド' },
  'coachDetail.tabReserva': { es: 'Reserva', en: 'Reserves', tr: 'Yedek takım', it: 'Riserve', fr: 'Réserve', de: 'Reserve', ar: 'الاحتياطي', zh: '预备队', ja: 'リザーブ' },
  'coachDetail.reservaSufijo': { es: 'Reserva', en: 'Reserves', tr: 'Yedek', it: 'Riserve', fr: 'Réserve', de: 'Reserve', ar: 'الاحتياطي', zh: '预备队', ja: 'リザーブ' },
  'perfil.usuario': { es: 'Usuario', en: 'User', tr: 'Kullanıcı', it: 'Utente', fr: 'Utilisateur', de: 'Benutzer', ar: 'المستخدم', zh: '用户', ja: 'ユーザー' },
  'perfil.eliminarCuenta': { es: 'Eliminar cuenta', en: 'Delete account', tr: 'Hesabı sil', it: 'Elimina account', fr: 'Supprimer le compte', de: 'Konto löschen', ar: 'حذف الحساب', zh: '删除账户', ja: 'アカウントを削除' },
  'perfil.eliminarDescripcion': { es: 'Esto elimina tu cuenta de forma permanente. No se puede deshacer.', en: 'This permanently deletes your account. This cannot be undone.', tr: 'Bu işlem hesabınızı kalıcı olarak siler. Geri alınamaz.', it: 'Questo elimina il tuo account in modo permanente. Non può essere annullato.', fr: 'Cela supprime définitivement votre compte. Cette action est irréversible.', de: 'Dadurch wird dein Konto dauerhaft gelöscht. Dies kann nicht rückgängig gemacht werden.', ar: 'سيؤدي هذا إلى حذف حسابك نهائيًا. لا يمكن التراجع عن هذا الإجراء.', zh: '这将永久删除您的账户，且无法撤销。', ja: 'これによりアカウントが完全に削除されます。元に戻すことはできません。' },
  'perfil.eliminarBoton': { es: 'Eliminar mi cuenta', en: 'Delete my account', tr: 'Hesabımı sil', it: 'Elimina il mio account', fr: 'Supprimer mon compte', de: 'Mein Konto löschen', ar: 'حذف حسابي', zh: '删除我的账户', ja: 'アカウントを削除する' },
  'perfil.confirmarPregunta': { es: '¿Seguro? Esta acción es permanente.', en: 'Are you sure? This action is permanent.', tr: 'Emin misiniz? Bu işlem kalıcıdır.', it: 'Sei sicuro? Questa azione è permanente.', fr: 'Êtes-vous sûr ? Cette action est définitive.', de: 'Bist du sicher? Diese Aktion ist dauerhaft.', ar: 'هل أنت متأكد؟ هذا الإجراء نهائي.', zh: '确定吗？此操作不可撤销。', ja: 'よろしいですか？この操作は元に戻せません。' },
  'perfil.confirmarBoton': { es: 'Sí, eliminar definitivamente', en: 'Yes, delete permanently', tr: 'Evet, kalıcı olarak sil', it: 'Sì, elimina definitivamente', fr: 'Oui, supprimer définitivement', de: 'Ja, endgültig löschen', ar: 'نعم، احذف نهائيًا', zh: '是，永久删除', ja: 'はい、完全に削除します' },
  'perfil.cancelar': { es: 'Cancelar', en: 'Cancel', tr: 'İptal', it: 'Annulla', fr: 'Annuler', de: 'Abbrechen', ar: 'إلغاء', zh: '取消', ja: 'キャンセル' },
  'perfil.errorEliminar': { es: 'No se pudo eliminar la cuenta. Intentá de nuevo.', en: 'Could not delete the account. Please try again.', tr: 'Hesap silinemedi. Tekrar deneyin.', it: "Impossibile eliminare l'account. Riprova.", fr: 'Impossible de supprimer le compte. Réessayez.', de: 'Konto konnte nicht gelöscht werden. Bitte erneut versuchen.', ar: 'تعذر حذف الحساب. حاول مرة أخرى.', zh: '无法删除账户，请重试。', ja: 'アカウントを削除できませんでした。もう一度お試しください。' },
  'perfil.politicaPrivacidad': { es: 'Política de privacidad', en: 'Privacy policy', tr: 'Gizlilik politikası', it: 'Informativa sulla privacy', fr: 'Politique de confidentialité', de: 'Datenschutzrichtlinie', ar: 'سياسة الخصوصية', zh: '隐私政策', ja: 'プライバシーポリシー' },
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
  const insertion = keyOrder.map(k => `    '${k}': ${JSON.stringify(T[k][lang])},`);
  const endLine = blockEnds[lang];
  lines.splice(endLine, 0, ...insertion);
  for (const l2 of LANGS) {
    if (blockStarts[l2] > endLine) blockStarts[l2] += insertion.length;
    if (blockEnds[l2] > endLine) blockEnds[l2] += insertion.length;
  }
}
writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Injected', keyOrder.length, 'keys into', LANGS.length, 'languages.');
