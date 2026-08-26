import fs from 'fs'

const path = 'src/constants/translations.ts'
let src = fs.readFileSync(path, 'utf8')

// key: [es, en, tr, it, fr, de, ar, zh, ja] in that column order matching the file's language blocks
const replacements = [
  {
    old: "'mercado.estadoContactado': \"Contactado\",",
    new: "'mercado.estadoOfrecido': \"Ofrecido\",",
  },
  {
    old: "'mercado.estadoReunion': \"Reunión\",",
    new: "'mercado.estadoPausado': \"Pausado\",",
  },
  {
    old: "'mercado.estadoOfertaEnviada': \"Oferta enviada\",",
    new: "'mercado.estadoEnNegociacion': \"En negociación\",",
  },
  {
    old: "'mercado.estadoEnEspera': \"En espera\",",
    new: "'mercado.estadoAvanzado': \"Avanzado\",",
  },
  {
    old: "'mercado.estadoCerradoExitoso': \"Cerrado (éxito)\",",
    new: "'mercado.estadoCerradoExito': \"Cerrado (éxito)\",",
  },
  {
    old: "'mercado.estadoCerradoRechazado': \"Cerrado (rechazado)\",",
    new: "'mercado.estadoCerradoCaido': \"Cerrado (caído)\",",
  },
  // en
  { old: "'mercado.estadoContactado': \"Contacted\",", new: "'mercado.estadoOfrecido': \"Offered\"," },
  { old: "'mercado.estadoReunion': \"Meeting\",", new: "'mercado.estadoPausado': \"Paused\"," },
  { old: "'mercado.estadoOfertaEnviada': \"Offer sent\",", new: "'mercado.estadoEnNegociacion': \"In negotiation\"," },
  { old: "'mercado.estadoEnEspera': \"On hold\",", new: "'mercado.estadoAvanzado': \"Advanced\"," },
  { old: "'mercado.estadoCerradoExitoso': \"Closed (success)\",", new: "'mercado.estadoCerradoExito': \"Closed (success)\"," },
  { old: "'mercado.estadoCerradoRechazado': \"Closed (rejected)\",", new: "'mercado.estadoCerradoCaido': \"Closed (fell through)\"," },
  // tr
  { old: "'mercado.estadoContactado': \"İletişime geçildi\",", new: "'mercado.estadoOfrecido': \"Teklif edildi\"," },
  { old: "'mercado.estadoReunion': \"Toplantı\",", new: "'mercado.estadoPausado': \"Durduruldu\"," },
  { old: "'mercado.estadoOfertaEnviada': \"Teklif gönderildi\",", new: "'mercado.estadoEnNegociacion': \"Müzakerede\"," },
  { old: "'mercado.estadoEnEspera': \"Beklemede\",", new: "'mercado.estadoAvanzado': \"İlerledi\"," },
  { old: "'mercado.estadoCerradoExitoso': \"Kapandı (başarılı)\",", new: "'mercado.estadoCerradoExito': \"Kapandı (başarılı)\"," },
  { old: "'mercado.estadoCerradoRechazado': \"Kapandı (reddedildi)\",", new: "'mercado.estadoCerradoCaido': \"Kapandı (düştü)\"," },
  // it
  { old: "'mercado.estadoContactado': \"Contattato\",", new: "'mercado.estadoOfrecido': \"Offerto\"," },
  { old: "'mercado.estadoReunion': \"Riunione\",", new: "'mercado.estadoPausado': \"In pausa\"," },
  { old: "'mercado.estadoOfertaEnviada': \"Offerta inviata\",", new: "'mercado.estadoEnNegociacion': \"In trattativa\"," },
  { old: "'mercado.estadoEnEspera': \"In attesa\",", new: "'mercado.estadoAvanzado': \"Avanzato\"," },
  { old: "'mercado.estadoCerradoExitoso': \"Chiuso (successo)\",", new: "'mercado.estadoCerradoExito': \"Chiuso (successo)\"," },
  { old: "'mercado.estadoCerradoRechazado': \"Chiuso (rifiutato)\",", new: "'mercado.estadoCerradoCaido': \"Chiuso (saltato)\"," },
  // fr
  { old: "'mercado.estadoContactado': \"Contacté\",", new: "'mercado.estadoOfrecido': \"Proposé\"," },
  { old: "'mercado.estadoReunion': \"Réunion\",", new: "'mercado.estadoPausado': \"En pause\"," },
  { old: "'mercado.estadoOfertaEnviada': \"Offre envoyée\",", new: "'mercado.estadoEnNegociacion': \"En négociation\"," },
  { old: "'mercado.estadoEnEspera': \"En attente\",", new: "'mercado.estadoAvanzado': \"Avancé\"," },
  { old: "'mercado.estadoCerradoExitoso': \"Clôturé (succès)\",", new: "'mercado.estadoCerradoExito': \"Clôturé (succès)\"," },
  { old: "'mercado.estadoCerradoRechazado': \"Clôturé (refusé)\",", new: "'mercado.estadoCerradoCaido': \"Clôturé (échoué)\"," },
  // de
  { old: "'mercado.estadoContactado': \"Kontaktiert\",", new: "'mercado.estadoOfrecido': \"Angeboten\"," },
  { old: "'mercado.estadoReunion': \"Besprechung\",", new: "'mercado.estadoPausado': \"Pausiert\"," },
  { old: "'mercado.estadoOfertaEnviada': \"Angebot gesendet\",", new: "'mercado.estadoEnNegociacion': \"In Verhandlung\"," },
  { old: "'mercado.estadoEnEspera': \"In Wartestellung\",", new: "'mercado.estadoAvanzado': \"Fortgeschritten\"," },
  { old: "'mercado.estadoCerradoExitoso': \"Abgeschlossen (Erfolg)\",", new: "'mercado.estadoCerradoExito': \"Abgeschlossen (Erfolg)\"," },
  { old: "'mercado.estadoCerradoRechazado': \"Abgeschlossen (abgelehnt)\",", new: "'mercado.estadoCerradoCaido': \"Abgeschlossen (gescheitert)\"," },
  // ar
  { old: "'mercado.estadoContactado': \"تم التواصل\",", new: "'mercado.estadoOfrecido': \"معروض\"," },
  { old: "'mercado.estadoReunion': \"اجتماع\",", new: "'mercado.estadoPausado': \"متوقف مؤقتًا\"," },
  { old: "'mercado.estadoOfertaEnviada': \"تم إرسال العرض\",", new: "'mercado.estadoEnNegociacion': \"قيد التفاوض\"," },
  { old: "'mercado.estadoEnEspera': \"قيد الانتظار\",", new: "'mercado.estadoAvanzado': \"متقدم\"," },
  { old: "'mercado.estadoCerradoExitoso': \"مغلق (نجاح)\",", new: "'mercado.estadoCerradoExito': \"مغلق (نجاح)\"," },
  { old: "'mercado.estadoCerradoRechazado': \"مغلق (مرفوض)\",", new: "'mercado.estadoCerradoCaido': \"مغلق (فشل)\"," },
  // zh
  { old: "'mercado.estadoContactado': \"已联系\",", new: "'mercado.estadoOfrecido': \"已报价\"," },
  { old: "'mercado.estadoReunion': \"会面\",", new: "'mercado.estadoPausado': \"已暂停\"," },
  { old: "'mercado.estadoOfertaEnviada': \"已发送报价\",", new: "'mercado.estadoEnNegociacion': \"谈判中\"," },
  { old: "'mercado.estadoEnEspera': \"等待中\",", new: "'mercado.estadoAvanzado': \"已推进\"," },
  { old: "'mercado.estadoCerradoExitoso': \"已完成（成功）\",", new: "'mercado.estadoCerradoExito': \"已完成（成功）\"," },
  { old: "'mercado.estadoCerradoRechazado': \"已完成（失败）\",", new: "'mercado.estadoCerradoCaido': \"已完成（失败）\"," },
  // ja
  { old: "'mercado.estadoContactado': \"連絡済み\",", new: "'mercado.estadoOfrecido': \"オファー済み\"," },
  { old: "'mercado.estadoReunion': \"面談\",", new: "'mercado.estadoPausado': \"一時停止\"," },
  { old: "'mercado.estadoOfertaEnviada': \"オファー送信済み\",", new: "'mercado.estadoEnNegociacion': \"交渉中\"," },
  { old: "'mercado.estadoEnEspera': \"保留中\",", new: "'mercado.estadoAvanzado': \"進行中\"," },
  { old: "'mercado.estadoCerradoExitoso': \"クローズ（成立）\",", new: "'mercado.estadoCerradoExito': \"クローズ（成立）\"," },
  { old: "'mercado.estadoCerradoRechazado': \"クローズ（不成立）\",", new: "'mercado.estadoCerradoCaido': \"クローズ（不成立）\"," },
]

let missing = []
for (const { old, new: nw } of replacements) {
  if (!src.includes(old)) { missing.push(old); continue }
  src = src.replace(old, nw)
}

if (missing.length) {
  console.error('NOT FOUND (' + missing.length + '):')
  missing.forEach(m => console.error('  ' + m))
  process.exit(1)
}

fs.writeFileSync(path, src, 'utf8')
console.log('OK: replaced', replacements.length, 'entries')
