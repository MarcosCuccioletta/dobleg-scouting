import fs from 'fs';

const FILE = 'src/constants/translations.ts';
const ANCHOR = `    'trainingDay.sinEntrenamientosDia':`;

const LANGS = ['es', 'en', 'tr', 'it', 'fr', 'de', 'ar', 'zh', 'ja'];

const DATA = {
  // boardColor.*
  'boardColor.blanco': { es: "Blanco", en: "White", tr: "Beyaz", it: "Bianco", fr: "Blanc", de: "Weiß", ar: "أبيض", zh: "白色", ja: "白" },
  'boardColor.amarillo': { es: "Amarillo", en: "Yellow", tr: "Sarı", it: "Giallo", fr: "Jaune", de: "Gelb", ar: "أصفر", zh: "黄色", ja: "黄" },
  'boardColor.rojo': { es: "Rojo", en: "Red", tr: "Kırmızı", it: "Rosso", fr: "Rouge", de: "Rot", ar: "أحمر", zh: "红色", ja: "赤" },
  'boardColor.celeste': { es: "Celeste", en: "Sky blue", tr: "Gök mavisi", it: "Azzurro", fr: "Bleu ciel", de: "Himmelblau", ar: "أزرق سماوي", zh: "天蓝色", ja: "スカイブルー" },
  'boardColor.negro': { es: "Negro", en: "Black", tr: "Siyah", it: "Nero", fr: "Noir", de: "Schwarz", ar: "أسود", zh: "黑色", ja: "黒" },

  // boardTool.*
  'boardTool.mover': { es: "Mover", en: "Move", tr: "Taşı", it: "Sposta", fr: "Déplacer", de: "Verschieben", ar: "تحريك", zh: "移动", ja: "移動" },
  'boardTool.lapiz': { es: "Lápiz", en: "Pencil", tr: "Kalem", it: "Matita", fr: "Crayon", de: "Stift", ar: "قلم", zh: "画笔", ja: "ペン" },
  'boardTool.flecha': { es: "Flecha", en: "Arrow", tr: "Ok", it: "Freccia", fr: "Flèche", de: "Pfeil", ar: "سهم", zh: "箭头", ja: "矢印" },
  'boardTool.zona': { es: "Zona", en: "Zone", tr: "Bölge", it: "Zona", fr: "Zone", de: "Zone", ar: "منطقة", zh: "区域", ja: "ゾーン" },

  // tacticalBoard.*
  'tacticalBoard.propio': { es: "Propio", en: "Own team", tr: "Kendi takımı", it: "Squadra propria", fr: "Notre équipe", de: "Eigenes Team", ar: "فريقنا", zh: "己方", ja: "自チーム" },
  'tacticalBoard.zonaCircular': { es: "Zona circular", en: "Circular zone", tr: "Dairesel bölge", it: "Zona circolare", fr: "Zone circulaire", de: "Kreisförmige Zone", ar: "منطقة دائرية", zh: "圆形区域", ja: "円形ゾーン" },
  'tacticalBoard.zonaRectangular': { es: "Zona rectangular", en: "Rectangular zone", tr: "Dikdörtgen bölge", it: "Zona rettangolare", fr: "Zone rectangulaire", de: "Rechteckige Zone", ar: "منطقة مستطيلة", zh: "矩形区域", ja: "矩形ゾーン" },
  'tacticalBoard.agregarFicha': { es: "+ Ficha", en: "+ Marker", tr: "+ Oyuncu işareti", it: "+ Segnalino", fr: "+ Pion", de: "+ Marker", ar: "+ علامة", zh: "+ 标记", ja: "+ マーカー" },
  'tacticalBoard.agregarJugador': { es: "+ Jugador", en: "+ Player", tr: "+ Oyuncu", it: "+ Giocatore", fr: "+ Joueur", de: "+ Spieler", ar: "+ لاعب", zh: "+ 球员", ja: "+ 選手" },
  'tacticalBoard.agregarPelota': { es: "+ Pelota", en: "+ Ball", tr: "+ Top", it: "+ Palla", fr: "+ Ballon", de: "+ Ball", ar: "+ الكرة", zh: "+ 球", ja: "+ ボール" },
  'tacticalBoard.deshacer': { es: "Deshacer", en: "Undo", tr: "Geri al", it: "Annulla", fr: "Annuler", de: "Rückgängig", ar: "تراجع", zh: "撤销", ja: "元に戻す" },
  'tacticalBoard.borrarTodo': { es: "Borrar todo", en: "Clear all", tr: "Tümünü sil", it: "Cancella tutto", fr: "Tout effacer", de: "Alles löschen", ar: "مسح الكل", zh: "清除全部", ja: "すべて消去" },
  'tacticalBoard.cambiarJugador': { es: "Cambiar jugador", en: "Change player", tr: "Oyuncuyu değiştir", it: "Cambia giocatore", fr: "Changer de joueur", de: "Spieler wechseln", ar: "تغيير اللاعب", zh: "更换球员", ja: "選手を変更" },
  'tacticalBoard.eliminarFicha': { es: "Eliminar ficha", en: "Remove marker", tr: "İşareti kaldır", it: "Rimuovi segnalino", fr: "Supprimer le pion", de: "Marker entfernen", ar: "إزالة العلامة", zh: "删除标记", ja: "マーカーを削除" },
  'tacticalBoard.buscarJugadorPlaceholder': { es: "Buscar jugador...", en: "Search player...", tr: "Oyuncu ara...", it: "Cerca giocatore...", fr: "Rechercher un joueur...", de: "Spieler suchen...", ar: "البحث عن لاعب...", zh: "搜索球员…", ja: "選手を検索…" },
  'tacticalBoard.sugerido': { es: "Sugerido", en: "Suggested", tr: "Önerilen", it: "Suggerito", fr: "Suggéré", de: "Vorgeschlagen", ar: "مقترح", zh: "推荐", ja: "おすすめ" },
  'tacticalBoard.sinResultados': { es: "Sin resultados.", en: "No results.", tr: "Sonuç yok.", it: "Nessun risultato.", fr: "Aucun résultat.", de: "Keine Ergebnisse.", ar: "لا توجد نتائج.", zh: "没有结果。", ja: "結果はありません。" },
  'tacticalBoard.guardarNombre': { es: "Guardar nombre", en: "Save name", tr: "Adı kaydet", it: "Salva nome", fr: "Enregistrer le nom", de: "Namen speichern", ar: "حفظ الاسم", zh: "保存名称", ja: "名前を保存" },
  'tacticalBoard.sinPizarraAbierta': { es: "Sin pizarra abierta", en: "No board open", tr: "Açık pano yok", it: "Nessuna lavagna aperta", fr: "Aucun tableau ouvert", de: "Kein Board geöffnet", ar: "لا توجد لوحة مفتوحة", zh: "未打开战术板", ja: "開いているボードなし" },
  'tacticalBoard.nueva': { es: "Nueva", en: "New", tr: "Yeni", it: "Nuova", fr: "Nouveau", de: "Neu", ar: "جديدة", zh: "新建", ja: "新規" },
  'tacticalBoard.cambiosSinGuardar': { es: "Cambios sin guardar", en: "Unsaved changes", tr: "Kaydedilmemiş değişiklikler", it: "Modifiche non salvate", fr: "Modifications non enregistrées", de: "Nicht gespeicherte Änderungen", ar: "تغييرات غير محفوظة", zh: "未保存的更改", ja: "未保存の変更" },
  'tacticalBoard.cargando': { es: "Cargando pizarras...", en: "Loading boards...", tr: "Panolar yükleniyor...", it: "Caricamento lavagne...", fr: "Chargement des tableaux...", de: "Boards werden geladen...", ar: "جارٍ تحميل اللوحات...", zh: "正在加载战术板...", ja: "ボードを読み込み中..." },
  'tacticalBoard.vacioMensaje': { es: "Creá una pizarra nueva o cargá una guardada para empezar.", en: "Create a new board or load a saved one to get started.", tr: "Başlamak için yeni bir pano oluştur ya da kayıtlı birini yükle.", it: "Crea una nuova lavagna o caricane una salvata per iniziare.", fr: "Créez un nouveau tableau ou chargez-en un enregistré pour commencer.", de: "Erstelle ein neues Board oder lade ein gespeichertes, um zu starten.", ar: "أنشئ لوحة جديدة أو حمّل لوحة محفوظة للبدء.", zh: "新建一个战术板或加载已保存的战术板即可开始。", ja: "新しいボードを作成するか、保存済みのボードを読み込んで開始してください。" },
  'tacticalBoard.jugadorSugeridoPara': { es: "Jugador sugerido para {slot}", en: "Suggested player for {slot}", tr: "{slot} için önerilen oyuncu", it: "Giocatore suggerito per {slot}", fr: "Joueur suggéré pour {slot}", de: "Vorgeschlagener Spieler für {slot}", ar: "لاعب مقترح لـ {slot}", zh: "{slot}的推荐球员", ja: "{slot}のおすすめ選手" },
  'tacticalBoard.nuevaPizarraTitulo': { es: "Nueva pizarra", en: "New board", tr: "Yeni pano", it: "Nuova lavagna", fr: "Nouveau tableau", de: "Neues Board", ar: "لوحة جديدة", zh: "新建战术板", ja: "新しいボード" },
  'tacticalBoard.nombrePlaceholder': { es: "Ej: Salida en corto vs 4-4-2", en: "E.g.: Build-up play vs 4-4-2", tr: "Ör: 4-4-2'ye karşı kısa çıkış", it: "Es: Costruzione dal basso vs 4-4-2", fr: "Ex : Relance courte vs 4-4-2", de: "Z. B.: Spielaufbau gegen 4-4-2", ar: "مثال: بناء اللعب أمام 4-4-2", zh: "例如：短传出球对阵4-4-2", ja: "例：4-4-2に対するビルドアップ" },
  'tacticalBoard.creando': { es: "Creando...", en: "Creating...", tr: "Oluşturuluyor...", it: "Creazione...", fr: "Création...", de: "Wird erstellt...", ar: "جارٍ الإنشاء...", zh: "正在创建...", ja: "作成中..." },
  'tacticalBoard.crear': { es: "Crear", en: "Create", tr: "Oluştur", it: "Crea", fr: "Créer", de: "Erstellen", ar: "إنشاء", zh: "创建", ja: "作成" },
  'tacticalBoard.errorCrear': { es: "No se pudo crear la pizarra. Puede que la funcionalidad todavía no esté disponible en el servidor — probá de nuevo más tarde.", en: "Couldn't create the board. This feature might not be available on the server yet — try again later.", tr: "Pano oluşturulamadı. Bu özellik sunucuda henüz kullanılamıyor olabilir — daha sonra tekrar dene.", it: "Impossibile creare la lavagna. La funzionalità potrebbe non essere ancora disponibile sul server — riprova più tardi.", fr: "Impossible de créer le tableau. Cette fonctionnalité n'est peut-être pas encore disponible sur le serveur — réessayez plus tard.", de: "Das Board konnte nicht erstellt werden. Diese Funktion ist auf dem Server möglicherweise noch nicht verfügbar — versuche es später erneut.", ar: "تعذر إنشاء اللوحة. قد لا تكون هذه الميزة متاحة بعد على الخادم — حاول مرة أخرى لاحقًا.", zh: "无法创建战术板。该功能可能尚未在服务器上启用——请稍后重试。", ja: "ボードを作成できませんでした。この機能はまだサーバーで利用できない可能性があります。後でもう一度お試しください。" },
  'tacticalBoard.errorRenombrar': { es: "No se pudo renombrar, intentá de nuevo.", en: "Couldn't rename it. Try again.", tr: "Yeniden adlandırılamadı, tekrar dene.", it: "Impossibile rinominare, riprova.", fr: "Impossible de renommer, réessayez.", de: "Umbenennen fehlgeschlagen, versuche es erneut.", ar: "تعذر إعادة التسمية، حاول مرة أخرى.", zh: "无法重命名，请重试。", ja: "名前を変更できませんでした。もう一度お試しください。" },
  'tacticalBoard.confirmarBorrarPizarra': { es: "¿Borrar la pizarra \"{name}\"?", en: "Delete board \"{name}\"?", tr: "\"{name}\" panosu silinsin mi?", it: "Eliminare la lavagna \"{name}\"?", fr: "Supprimer le tableau « {name} » ?", de: "Board \"{name}\" löschen?", ar: "هل تريد حذف اللوحة \"{name}\"؟", zh: "删除战术板「{name}」？", ja: "ボード「{name}」を削除しますか？" },
  'tacticalBoard.errorBorrarPizarra': { es: "No se pudo borrar la pizarra, intentá de nuevo.", en: "Couldn't delete the board. Try again.", tr: "Pano silinemedi, tekrar dene.", it: "Impossibile eliminare la lavagna, riprova.", fr: "Impossible de supprimer le tableau, réessayez.", de: "Board konnte nicht gelöscht werden, versuche es erneut.", ar: "تعذر حذف اللوحة، حاول مرة أخرى.", zh: "无法删除战术板，请重试。", ja: "ボードを削除できませんでした。もう一度お試しください。" },
  'tacticalBoard.confirmarBorrarDibujos': { es: "¿Borrar todos los dibujos de esta pizarra?", en: "Clear all drawings on this board?", tr: "Bu panodaki tüm çizimler silinsin mi?", it: "Cancellare tutti i disegni di questa lavagna?", fr: "Effacer tous les dessins de ce tableau ?", de: "Alle Zeichnungen auf diesem Board löschen?", ar: "هل تريد مسح جميع الرسومات في هذه اللوحة؟", zh: "清除该战术板上的所有绘图？", ja: "このボードのすべての描画を消去しますか？" },
  'tacticalBoard.pizarrasGuardadas': { es: "Pizarras guardadas", en: "Saved boards", tr: "Kayıtlı panolar", it: "Lavagne salvate", fr: "Tableaux enregistrés", de: "Gespeicherte Boards", ar: "اللوحات المحفوظة", zh: "已保存的战术板", ja: "保存済みのボード" },
  'tacticalBoard.sinPizarrasGuardadas': { es: "Sin pizarras guardadas todavía.", en: "No saved boards yet.", tr: "Henüz kayıtlı pano yok.", it: "Nessuna lavagna salvata ancora.", fr: "Aucun tableau enregistré pour le moment.", de: "Noch keine gespeicherten Boards.", ar: "لا توجد لوحات محفوظة بعد.", zh: "暂无已保存的战术板。", ja: "保存済みのボードはまだありません。" },
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
