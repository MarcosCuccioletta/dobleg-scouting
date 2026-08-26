import fs from 'fs'

const file = 'src/constants/translations.ts'
let src = fs.readFileSync(file, 'utf8')

const blocks = {
  es: {
    anchor: `'clasificacion.claseC': "Clase C",`,
    keys: {
      'clasificacion.titulo': "Clasificación Interna",
      'clasificacion.subtitulo': "Arrastrá a cada jugador de la agencia a su clase — se refleja en Scout Interno y en su ficha.",
      'clasificacion.sinClasificar': "Sin clasificar",
      'clasificacion.cargandoPlantel': "Cargando plantel...",
      'clasificacion.todosClasificados': "Todos ya tienen clase asignada.",
      'clasificacion.arrastraAca': "Arrastrá jugadores acá.",
      'clasificacion.errorQuitar': "No se pudo quitar la clasificación de {name}. Probá de nuevo.",
      'clasificacion.errorGuardar': "No se pudo guardar la clasificación de {name}. Probá de nuevo.",
    },
  },
  en: {
    anchor: `'clasificacion.claseC': "Class C",`,
    keys: {
      'clasificacion.titulo': "Internal Classification",
      'clasificacion.subtitulo': "Drag each agency player to their class — reflected in Internal Scouting and their profile.",
      'clasificacion.sinClasificar': "Unclassified",
      'clasificacion.cargandoPlantel': "Loading squad...",
      'clasificacion.todosClasificados': "Everyone already has a class assigned.",
      'clasificacion.arrastraAca': "Drag players here.",
      'clasificacion.errorQuitar': "Couldn't remove {name}'s classification. Try again.",
      'clasificacion.errorGuardar': "Couldn't save {name}'s classification. Try again.",
    },
  },
  tr: {
    anchor: `'clasificacion.claseC': "C Sınıfı",`,
    keys: {
      'clasificacion.titulo': "Dahili Sınıflandırma",
      'clasificacion.subtitulo': "Ajans oyuncularının her birini sınıfına sürükle — Dahili Scouting'e ve profiline yansır.",
      'clasificacion.sinClasificar': "Sınıflandırılmamış",
      'clasificacion.cargandoPlantel': "Kadro yükleniyor...",
      'clasificacion.todosClasificados': "Herkese zaten bir sınıf atanmış.",
      'clasificacion.arrastraAca': "Oyuncuları buraya sürükle.",
      'clasificacion.errorQuitar': "{name} adlı oyuncunun sınıfı kaldırılamadı. Tekrar dene.",
      'clasificacion.errorGuardar': "{name} adlı oyuncunun sınıfı kaydedilemedi. Tekrar dene.",
    },
  },
  it: {
    anchor: `'nav.clasificacionInterna': "Classificazione Interna",\n    'clasificacion.claseA': "Classe A",\n    'clasificacion.claseB': "Classe B",\n    'clasificacion.claseC': "Classe C",`,
    keys: {
      'clasificacion.titulo': "Classificazione Interna",
      'clasificacion.subtitulo': "Trascina ogni giocatore dell'agenzia nella sua classe — si riflette in Scout Interno e nella sua scheda.",
      'clasificacion.sinClasificar': "Non classificato",
      'clasificacion.cargandoPlantel': "Caricamento rosa...",
      'clasificacion.todosClasificados': "A tutti è già stata assegnata una classe.",
      'clasificacion.arrastraAca': "Trascina i giocatori qui.",
      'clasificacion.errorQuitar': "Impossibile rimuovere la classificazione di {name}. Riprova.",
      'clasificacion.errorGuardar': "Impossibile salvare la classificazione di {name}. Riprova.",
    },
  },
  fr: {
    anchor: `'nav.clasificacionInterna': "Classification Interne",\n    'clasificacion.claseA': "Classe A",\n    'clasificacion.claseB': "Classe B",\n    'clasificacion.claseC': "Classe C",`,
    keys: {
      'clasificacion.titulo': "Classification Interne",
      'clasificacion.subtitulo': "Faites glisser chaque joueur de l'agence vers sa classe — reflété dans Scout Interne et sa fiche.",
      'clasificacion.sinClasificar': "Non classé",
      'clasificacion.cargandoPlantel': "Chargement de l'effectif...",
      'clasificacion.todosClasificados': "Tout le monde a déjà une classe assignée.",
      'clasificacion.arrastraAca': "Faites glisser les joueurs ici.",
      'clasificacion.errorQuitar': "Impossible de retirer la classification de {name}. Réessayez.",
      'clasificacion.errorGuardar': "Impossible d'enregistrer la classification de {name}. Réessayez.",
    },
  },
  de: {
    anchor: `'clasificacion.claseC': "Klasse C",`,
    keys: {
      'clasificacion.titulo': "Interne Klassifizierung",
      'clasificacion.subtitulo': "Ziehe jeden Agenturspieler in seine Klasse — wird in Interner Scout und im Profil übernommen.",
      'clasificacion.sinClasificar': "Nicht klassifiziert",
      'clasificacion.cargandoPlantel': "Kader wird geladen...",
      'clasificacion.todosClasificados': "Allen ist bereits eine Klasse zugewiesen.",
      'clasificacion.arrastraAca': "Spieler hierher ziehen.",
      'clasificacion.errorQuitar': "Klassifizierung von {name} konnte nicht entfernt werden. Versuche es erneut.",
      'clasificacion.errorGuardar': "Klassifizierung von {name} konnte nicht gespeichert werden. Versuche es erneut.",
    },
  },
  ar: {
    anchor: `'clasificacion.claseC': "الفئة C",`,
    keys: {
      'clasificacion.titulo': "التصنيف الداخلي",
      'clasificacion.subtitulo': "اسحب كل لاعب من الوكالة إلى فئته — ينعكس ذلك في الكشف الداخلي وفي ملفه.",
      'clasificacion.sinClasificar': "غير مصنف",
      'clasificacion.cargandoPlantel': "جارٍ تحميل القائمة...",
      'clasificacion.todosClasificados': "تم تعيين فئة لجميع اللاعبين بالفعل.",
      'clasificacion.arrastraAca': "اسحب اللاعبين إلى هنا.",
      'clasificacion.errorQuitar': "تعذّر إزالة تصنيف {name}. حاول مرة أخرى.",
      'clasificacion.errorGuardar': "تعذّر حفظ تصنيف {name}. حاول مرة أخرى.",
    },
  },
  zh: {
    anchor: `'clasificacion.claseC': "C级",`,
    keys: {
      'clasificacion.titulo': "内部分级",
      'clasificacion.subtitulo': "将每位经纪公司球员拖到对应的分级 — 会同步到内部球探和球员档案。",
      'clasificacion.sinClasificar': "未分级",
      'clasificacion.cargandoPlantel': "正在加载阵容...",
      'clasificacion.todosClasificados': "所有球员均已分配分级。",
      'clasificacion.arrastraAca': "将球员拖到这里。",
      'clasificacion.errorQuitar': "无法移除 {name} 的分级，请重试。",
      'clasificacion.errorGuardar': "无法保存 {name} 的分级，请重试。",
    },
  },
  ja: {
    anchor: `'clasificacion.claseC': "クラスC",`,
    keys: {
      'clasificacion.titulo': "内部クラス分け",
      'clasificacion.subtitulo': "所属選手をそれぞれのクラスにドラッグしてください — 内部スカウトと選手プロフィールに反映されます。",
      'clasificacion.sinClasificar': "未分類",
      'clasificacion.cargandoPlantel': "選手一覧を読み込み中...",
      'clasificacion.todosClasificados': "全員に既にクラスが割り当てられています。",
      'clasificacion.arrastraAca': "選手をここにドラッグしてください。",
      'clasificacion.errorQuitar': "{name}のクラス分けを削除できませんでした。もう一度お試しください。",
      'clasificacion.errorGuardar': "{name}のクラス分けを保存できませんでした。もう一度お試しください。",
    },
  },
}

let totalInserted = 0
for (const [lang, block] of Object.entries(blocks)) {
  const anchor = block.anchor
  if (!src.includes(anchor)) {
    console.error(`ANCHOR NOT FOUND for ${lang}`)
    continue
  }
  const newLines = Object.entries(block.keys)
    .map(([k, v]) => `    '${k}': ${JSON.stringify(v)},`)
    .join('\n')
  src = src.replace(anchor, anchor + '\n' + newLines)
  totalInserted += Object.keys(block.keys).length
}

fs.writeFileSync(file, src, 'utf8')
console.log('Inserted:', totalInserted)
