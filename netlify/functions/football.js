// Proxy server-side a API-Football (api-sports.io). La key NUNCA debe llegar
// al bundle del browser (antes vivía en VITE_FOOTBALL_API_KEY y quedaba
// expuesta en el JS público del sitio, visible para cualquiera).
//
// Requiere env var en Netlify:
//   FOOTBALL_API_KEY   (sin prefijo VITE_, así Vite no la inyecta al bundle)
//
// Uso desde el frontend: /api/football?endpoint=/fixtures&team=123&next=20
const BASE_URL = 'https://v3.football.api-sports.io'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' }
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const API_KEY = process.env.FOOTBALL_API_KEY
  if (!API_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Servidor sin configurar (falta FOOTBALL_API_KEY)' }) }
  }

  const query = event.queryStringParameters || {}
  const { endpoint, ...params } = query
  if (!endpoint || !endpoint.startsWith('/')) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Falta endpoint (ej: /fixtures)' }) }
  }

  const url = new URL(endpoint, BASE_URL)
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v)
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { 'x-apisports-key': API_KEY },
    })
    const body = await res.text()
    return {
      statusCode: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body,
    }
  } catch (err) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
