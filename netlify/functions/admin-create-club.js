const { requireSuperAdmin, CORS } = require('./_shared/requireSuperAdmin')

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  const { admin, errorResponse } = await requireSuperAdmin(event)
  if (errorResponse) return errorResponse

  const { id, name } = JSON.parse(event.body || '{}')
  if (!id || !name) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Faltan id o name' }) }
  if (!/^[a-z0-9-]+$/.test(id)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'El id sólo puede tener minúsculas, números y guiones' }) }
  }

  const { error } = await admin.from('clubs').insert({ id, name })
  if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) }
}
