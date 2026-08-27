import fs from 'fs'

const file = 'src/constants/translations.ts'
let src = fs.readFileSync(file, 'utf8')

const anchors = {
  es: `'coachDetail.ligaError': "No se pudo cargar la tabla de posiciones.",`,
  en: `'coachDetail.ligaError': "Couldn't load the standings table.",`,
  tr: `'coachDetail.ligaError': "Puan durumu tablosu yüklenemedi.",`,
  it: `'coachDetail.ligaError': "Impossibile caricare la classifica.",`,
  fr: `'coachDetail.ligaError': "Impossible de charger le classement.",`,
  de: `'coachDetail.ligaError': "Die Tabelle konnte nicht geladen werden.",`,
  ar: `'coachDetail.ligaError': "تعذّر تحميل جدول الترتيب.",`,
  zh: `'coachDetail.ligaError': "无法加载积分榜。",`,
  ja: `'coachDetail.ligaError': "順位表を読み込めませんでした。",`,
}

const keysByLang = {
  es: {
    'coachDetail.bioCargandoPerfil': "Cargando perfil...",
    'coachDetail.bioNoEncontrado': "No encontramos el perfil de este entrenador en la base de datos.",
    'coachDetail.bioEdad': "Edad",
    'coachDetail.bioNacionalidad': "Nacionalidad",
    'coachDetail.bioLugarNacimiento': "Lugar de nacimiento",
    'coachDetail.bioTrayectoria': "Trayectoria",
    'coachDetail.bioSinTrayectoria': "No hay trayectoria registrada para este entrenador.",
    'coachDetail.bioActualidad': "Actualidad",
  },
  en: {
    'coachDetail.bioCargandoPerfil': "Loading profile...",
    'coachDetail.bioNoEncontrado': "We couldn't find this coach's profile in the database.",
    'coachDetail.bioEdad': "Age",
    'coachDetail.bioNacionalidad': "Nationality",
    'coachDetail.bioLugarNacimiento': "Birthplace",
    'coachDetail.bioTrayectoria': "Career",
    'coachDetail.bioSinTrayectoria': "No career history recorded for this coach.",
    'coachDetail.bioActualidad': "Present",
  },
  tr: {
    'coachDetail.bioCargandoPerfil': "Profil yükleniyor...",
    'coachDetail.bioNoEncontrado': "Bu antrenörün profilini veritabanında bulamadık.",
    'coachDetail.bioEdad': "Yaş",
    'coachDetail.bioNacionalidad': "Uyruk",
    'coachDetail.bioLugarNacimiento': "Doğum yeri",
    'coachDetail.bioTrayectoria': "Kariyer",
    'coachDetail.bioSinTrayectoria': "Bu antrenör için kayıtlı kariyer geçmişi yok.",
    'coachDetail.bioActualidad': "Günümüz",
  },
  it: {
    'coachDetail.bioCargandoPerfil': "Caricamento profilo...",
    'coachDetail.bioNoEncontrado': "Non abbiamo trovato il profilo di questo allenatore nel database.",
    'coachDetail.bioEdad': "Età",
    'coachDetail.bioNacionalidad': "Nazionalità",
    'coachDetail.bioLugarNacimiento': "Luogo di nascita",
    'coachDetail.bioTrayectoria': "Carriera",
    'coachDetail.bioSinTrayectoria': "Nessuna carriera registrata per questo allenatore.",
    'coachDetail.bioActualidad': "Attualità",
  },
  fr: {
    'coachDetail.bioCargandoPerfil': "Chargement du profil...",
    'coachDetail.bioNoEncontrado': "Nous n'avons pas trouvé le profil de cet entraîneur dans la base de données.",
    'coachDetail.bioEdad': "Âge",
    'coachDetail.bioNacionalidad': "Nationalité",
    'coachDetail.bioLugarNacimiento': "Lieu de naissance",
    'coachDetail.bioTrayectoria': "Carrière",
    'coachDetail.bioSinTrayectoria': "Aucun parcours enregistré pour cet entraîneur.",
    'coachDetail.bioActualidad': "Actuel",
  },
  de: {
    'coachDetail.bioCargandoPerfil': "Profil wird geladen...",
    'coachDetail.bioNoEncontrado': "Wir konnten das Profil dieses Trainers nicht in der Datenbank finden.",
    'coachDetail.bioEdad': "Alter",
    'coachDetail.bioNacionalidad': "Nationalität",
    'coachDetail.bioLugarNacimiento': "Geburtsort",
    'coachDetail.bioTrayectoria': "Laufbahn",
    'coachDetail.bioSinTrayectoria': "Für diesen Trainer ist keine Laufbahn erfasst.",
    'coachDetail.bioActualidad': "Aktuell",
  },
  ar: {
    'coachDetail.bioCargandoPerfil': "جارٍ تحميل الملف الشخصي...",
    'coachDetail.bioNoEncontrado': "لم نتمكن من العثور على ملف هذا المدرب في قاعدة البيانات.",
    'coachDetail.bioEdad': "العمر",
    'coachDetail.bioNacionalidad': "الجنسية",
    'coachDetail.bioLugarNacimiento': "مكان الميلاد",
    'coachDetail.bioTrayectoria': "المسيرة المهنية",
    'coachDetail.bioSinTrayectoria': "لا توجد مسيرة مسجلة لهذا المدرب.",
    'coachDetail.bioActualidad': "حتى الآن",
  },
  zh: {
    'coachDetail.bioCargandoPerfil': "正在加载个人资料...",
    'coachDetail.bioNoEncontrado': "在数据库中未找到该教练的资料。",
    'coachDetail.bioEdad': "年龄",
    'coachDetail.bioNacionalidad': "国籍",
    'coachDetail.bioLugarNacimiento': "出生地",
    'coachDetail.bioTrayectoria': "职业生涯",
    'coachDetail.bioSinTrayectoria': "该教练暂无职业生涯记录。",
    'coachDetail.bioActualidad': "至今",
  },
  ja: {
    'coachDetail.bioCargandoPerfil': "プロフィールを読み込み中...",
    'coachDetail.bioNoEncontrado': "このコーチのプロフィールがデータベースに見つかりませんでした。",
    'coachDetail.bioEdad': "年齢",
    'coachDetail.bioNacionalidad': "国籍",
    'coachDetail.bioLugarNacimiento': "出身地",
    'coachDetail.bioTrayectoria': "経歴",
    'coachDetail.bioSinTrayectoria': "このコーチの経歴は登録されていません。",
    'coachDetail.bioActualidad': "現在",
  },
}

let totalInserted = 0
for (const [lang, anchor] of Object.entries(anchors)) {
  if (!src.includes(anchor)) {
    console.error(`ANCHOR NOT FOUND for ${lang}`)
    continue
  }
  const keys = keysByLang[lang]
  const newLines = Object.entries(keys)
    .map(([k, v]) => `    '${k}': ${JSON.stringify(v)},`)
    .join('\n')
  src = src.replace(anchor, anchor + '\n' + newLines)
  totalInserted += Object.keys(keys).length
}

fs.writeFileSync(file, src, 'utf8')
console.log('Inserted:', totalInserted)
