import fs from 'fs'

const path = 'src/constants/translations.ts'
let src = fs.readFileSync(path, 'utf8')

const anchors = [
  { find: "'mercado.jugador': \"Jugador\",", value: "Seguimiento" },
  { find: "'mercado.jugador': \"Player\",", value: "Follow-up" },
  { find: "'mercado.jugador': \"Oyuncu\",", value: "Takip" },
  { find: "'mercado.jugador': \"Giocatore\",", value: "Follow-up" },
  { find: "'mercado.jugador': \"Joueur\",", value: "Suivi" },
  { find: "'mercado.jugador': \"Spieler\",", value: "Nachfassen" },
  { find: "'mercado.jugador': \"اللاعب\",", value: "المتابعة" },
  { find: "'mercado.jugador': \"球员\",", value: "跟进" },
  { find: "'mercado.jugador': \"選手\",", value: "フォローアップ" },
]

let count = 0
for (const { find, value } of anchors) {
  const insertion = `${find}\n    'mercado.columnaSeguimiento': "${value}",`
  if (!src.includes(find)) { console.error('NOT FOUND:', find); continue }
  src = src.replace(find, insertion)
  count++
}

fs.writeFileSync(path, src, 'utf8')
console.log('OK inserted', count)
