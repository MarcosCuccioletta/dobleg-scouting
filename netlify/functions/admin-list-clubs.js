const { requireSuperAdmin, CORS } = require('./_shared/requireSuperAdmin')

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  const { admin, errorResponse } = await requireSuperAdmin(event)
  if (errorResponse) return errorResponse

  const { data, error } = await admin.from('clubs').select('id, name').order('name')
  if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ clubs: data }) }
}
