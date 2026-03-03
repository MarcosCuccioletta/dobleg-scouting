exports.handler = async (event) => {
  const url = event.queryStringParameters?.url

  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing url parameter' })
    }
  }

  if (!url.startsWith('https://docs.google.com/')) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Invalid URL' })
    }
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ScoutPlatform/1.0)',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `HTTP ${response.status}` })
      }
    }

    const text = await response.text()

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
      body: text
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}
