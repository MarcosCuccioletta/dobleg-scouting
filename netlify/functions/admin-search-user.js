const { requireSuperAdmin, CORS } = require('./_shared/requireSuperAdmin')

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  const { admin, errorResponse } = await requireSuperAdmin(event)
  if (errorResponse) return errorResponse

  const { email } = JSON.parse(event.body || '{}')
  if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Falta el email' }) }

  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers()
  if (listErr) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: listErr.message }) }

  const user = usersPage.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())
  if (!user) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'No existe una cuenta con ese email' }) }

  const { data: profile } = await admin.from('user_profiles').select('club_id').eq('user_id', user.id).maybeSingle()

  const { data: memberships, error: memErr } = await admin
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
  if (memErr) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: memErr.message }) }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      homeClub: profile?.club_id ?? null,
      extraClubIds: (memberships || []).map(m => m.club_id),
    }),
  }
}
