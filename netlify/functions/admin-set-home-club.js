// Da de alta o cambia el "club de siempre" de una cuenta (user_profiles.club_id
// -- lo que resuelve current_club_id() cuando la plataforma no manda el header
// x-app-club, o cuando no tiene membresia extra a ese club puntual).
const { requireSuperAdmin, CORS } = require('./_shared/requireSuperAdmin')

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  const { admin, errorResponse } = await requireSuperAdmin(event)
  if (errorResponse) return errorResponse

  const { userId, clubId } = JSON.parse(event.body || '{}')
  if (!userId || !clubId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Faltan userId o clubId' }) }
  }

  const { error } = await admin.from('user_profiles').upsert({ user_id: userId, club_id: clubId })
  if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) }
}
