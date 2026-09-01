import fs from 'fs'

const file = 'src/constants/translations.ts'
let src = fs.readFileSync(file, 'utf8')

const anchors = {
  es: `'informesStep1.cerrarAviso': "Cerrar aviso",`,
  en: `'informesStep1.cerrarAviso': "Close notice",`,
  tr: `'informesStep1.cerrarAviso': "Uyarıyı kapat",`,
  it: `'informesStep1.cerrarAviso': "Chiudi avviso",`,
  fr: `'informesStep1.cerrarAviso': "Fermer l'avis",`,
  de: `'informesStep1.cerrarAviso': "Hinweis schließen",`,
  ar: `'informesStep1.cerrarAviso': "إغلاق التنبيه",`,
  zh: `'informesStep1.cerrarAviso': "关闭提示",`,
  ja: `'informesStep1.cerrarAviso': "通知を閉じる",`,
}

const keysByLang = {
  es: {
    'informesStep1.errorSinFilas': "El archivo no tiene filas de datos.",
    'informesStep1.errorLeerArchivo': "No se pudo leer el archivo.",
    'informesStep1.errorProcesarFoto': "No se pudo procesar la foto.",
    'informesStep1.errorProcesarEscudo': "No se pudo procesar el escudo de liga.",
  },
  en: {
    'informesStep1.errorSinFilas': "The file has no data rows.",
    'informesStep1.errorLeerArchivo': "Couldn't read the file.",
    'informesStep1.errorProcesarFoto': "Couldn't process the photo.",
    'informesStep1.errorProcesarEscudo': "Couldn't process the league crest.",
  },
  tr: {
    'informesStep1.errorSinFilas': "Dosyada veri satırı yok.",
    'informesStep1.errorLeerArchivo': "Dosya okunamadı.",
    'informesStep1.errorProcesarFoto': "Fotoğraf işlenemedi.",
    'informesStep1.errorProcesarEscudo': "Lig arması işlenemedi.",
  },
  it: {
    'informesStep1.errorSinFilas': "Il file non ha righe di dati.",
    'informesStep1.errorLeerArchivo': "Impossibile leggere il file.",
    'informesStep1.errorProcesarFoto': "Impossibile elaborare la foto.",
    'informesStep1.errorProcesarEscudo': "Impossibile elaborare lo stemma del campionato.",
  },
  fr: {
    'informesStep1.errorSinFilas': "Le fichier ne contient aucune ligne de données.",
    'informesStep1.errorLeerArchivo': "Impossible de lire le fichier.",
    'informesStep1.errorProcesarFoto': "Impossible de traiter la photo.",
    'informesStep1.errorProcesarEscudo': "Impossible de traiter l'écusson du championnat.",
  },
  de: {
    'informesStep1.errorSinFilas': "Die Datei enthält keine Datenzeilen.",
    'informesStep1.errorLeerArchivo': "Die Datei konnte nicht gelesen werden.",
    'informesStep1.errorProcesarFoto': "Das Foto konnte nicht verarbeitet werden.",
    'informesStep1.errorProcesarEscudo': "Das Liga-Wappen konnte nicht verarbeitet werden.",
  },
  ar: {
    'informesStep1.errorSinFilas': "لا يحتوي الملف على صفوف بيانات.",
    'informesStep1.errorLeerArchivo': "تعذّرت قراءة الملف.",
    'informesStep1.errorProcesarFoto': "تعذّرت معالجة الصورة.",
    'informesStep1.errorProcesarEscudo': "تعذّرت معالجة شعار الدوري.",
  },
  zh: {
    'informesStep1.errorSinFilas': "文件中没有数据行。",
    'informesStep1.errorLeerArchivo': "无法读取文件。",
    'informesStep1.errorProcesarFoto': "无法处理照片。",
    'informesStep1.errorProcesarEscudo': "无法处理联赛徽章。",
  },
  ja: {
    'informesStep1.errorSinFilas': "ファイルにデータ行がありません。",
    'informesStep1.errorLeerArchivo': "ファイルを読み込めませんでした。",
    'informesStep1.errorProcesarFoto': "写真を処理できませんでした。",
    'informesStep1.errorProcesarEscudo': "リーグの紋章を処理できませんでした。",
  },
}

let totalInserted = 0
for (const [lang, anchor] of Object.entries(anchors)) {
  if (!src.includes(anchor)) { console.error(`ANCHOR NOT FOUND for ${lang}`); continue }
  const keys = keysByLang[lang]
  const newLines = Object.entries(keys).map(([k, v]) => `    '${k}': ${JSON.stringify(v)},`).join('\n')
  src = src.replace(anchor, anchor + '\n' + newLines)
  totalInserted += Object.keys(keys).length
}

fs.writeFileSync(file, src, 'utf8')
console.log('Inserted:', totalInserted)
