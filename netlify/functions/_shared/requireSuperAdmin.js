// Verifica el JWT del que llama y confirma que está en super_admins.
// Devuelve { admin, userId } si es válido, o { errorResponse } si no.
const { createClient } = require('@supabase/supabase-js')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

async function requireSuperAdmin(event) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return { errorResponse: { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Servidor sin configurar (faltan env vars)' }) } }
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return { errorResponse: { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Falta el token de sesión' }) } }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData || !userData.user) {
    return { errorResponse: { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Sesión inválida' }) } }
  }

  const userId = userData.user.id
  const { data: superAdminRow } = await admin.from('super_admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (!superAdminRow) {
    return { errorResponse: { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'No autorizado' }) } }
  }

  return { admin, userId }
}

module.exports = { requireSuperAdmin, CORS }
