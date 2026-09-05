// Agrega o quita una membresia EXTRA (user_club_memberships) -- un club
// adicional al "de siempre" (user_profiles.club_id) de una cuenta.
const { requireSuperAdmin, CORS } = require('./_shared/requireSuperAdmin')

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  const { admin, errorResponse } = await requireSuperAdmin(event)
  if (errorResponse) return errorResponse

  const { userId, clubId, action } = JSON.parse(event.body || '{}')
  if (!userId || !clubId || !['add', 'remove'].includes(action)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Faltan userId, clubId o action inválida' }) }
  }

  if (action === 'add') {
    const { error } = await admin.from('user_club_memberships').upsert({ user_id: userId, club_id: clubId })
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }
  } else {
    const { error } = await admin.from('user_club_memberships').delete().eq('user_id', userId).eq('club_id', clubId)
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) }
}
