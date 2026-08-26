import fs from 'fs'

const path = 'src/constants/translations.ts'
let src = fs.readFileSync(path, 'utf8')

const rows = [
  { anchor: "'mercado.buscarClub': \"Buscar club...\",", placeholder: "Buscar jugador por nombre (ej: Zapelli)...", noId: "¿No aparece? Ingresar ID manualmente" },
  { anchor: "'mercado.buscarClub': \"Search club...\",", placeholder: "Search player by name (e.g. Zapelli)...", noId: "Not showing up? Enter ID manually" },
  { anchor: "'mercado.buscarClub': \"Kulüp ara...\",", placeholder: "Oyuncuyu ada göre ara (ör: Zapelli)...", noId: "Görünmüyor mu? ID'yi elle gir" },
  { anchor: "'mercado.buscarClub': \"Cerca club...\",", placeholder: "Cerca giocatore per nome (es: Zapelli)...", noId: "Non compare? Inserisci l'ID manualmente" },
  { anchor: "'mercado.buscarClub': \"Rechercher un club...\",", placeholder: "Rechercher un joueur par nom (ex : Zapelli)...", noId: "Introuvable ? Saisir l'ID manuellement" },
  { anchor: "'mercado.buscarClub': \"Verein suchen...\",", placeholder: "Spieler nach Name suchen (z. B. Zapelli)...", noId: "Nicht dabei? ID manuell eingeben" },
  { anchor: "'mercado.buscarClub': \"ابحث عن نادٍ...\",", placeholder: "ابحث عن لاعب بالاسم (مثال: Zapelli)...", noId: "غير ظاهر؟ أدخل المعرّف يدويًا" },
  { anchor: "'mercado.buscarClub': \"搜索俱乐部...\",", placeholder: "按姓名搜索球员（例：Zapelli）...", noId: "没有找到？手动输入ID" },
  { anchor: "'mercado.buscarClub': \"クラブを検索...\",", placeholder: "選手名で検索（例：Zapelli）...", noId: "見つからない場合はIDを手入力" },
]

let count = 0
for (const { anchor, placeholder, noId } of rows) {
  if (!src.includes(anchor)) { console.error('NOT FOUND:', anchor); continue }
  const insertion = `${anchor}\n    'mercado.buscarJugadorPlaceholder': "${placeholder}",\n    'mercado.noAparecePorId': "${noId}",`
  src = src.replace(anchor, insertion)
  count++
}

fs.writeFileSync(path, src, 'utf8')
console.log('OK inserted', count)
