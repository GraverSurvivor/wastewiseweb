/**
 * JSON / multipart calls to the Python (FastAPI) backend.
 * Auth: Supabase session access_token in Authorization header.
 */

export function apiRoot() {
  const b = import.meta.env.VITE_API_URL
  if (b) return `${String(b).replace(/\/$/, '')}/api`
  return '/api'
}

function detailMessage(detail) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail))
    return detail.map((x) => x.msg || JSON.stringify(x)).join('; ')
  return JSON.stringify(detail)
}

export async function apiJson(path, { method = 'GET', token, body } = {}) {
  const url = `${apiRoot()}${path.startsWith('/') ? path : `/${path}`}`
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  let res
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    if (error instanceof TypeError) {
      if (import.meta.env.DEV) {
        throw new Error(
          'Could not reach the local backend. Start it with `npm run dev` or `npm run api` and keep it running on http://127.0.0.1:8000.',
        )
      }
      throw new Error('Could not reach the server. Please try again.')
    }
    throw error
  }
  const text = await res.text()
  const contentType = res.headers.get('content-type') || ''
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (res.ok && typeof data === 'string' && contentType.includes('text/html')) {
    throw new Error(
      'The backend API is not deployed correctly right now. It returned the website HTML instead of JSON.',
    )
  }
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && data.detail
        ? detailMessage(data.detail)
        : typeof data === 'string'
          ? data
          : res.statusText
    throw new Error(msg)
  }
  return data
}

export async function apiForm(path, { token, formData }) {
  const url = `${apiRoot()}${path.startsWith('/') ? path : `/${path}`}`
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(url, { method: 'POST', headers, body: formData })
  } catch (error) {
    if (error instanceof TypeError) {
      if (import.meta.env.DEV) {
        throw new Error(
          'Could not reach the local backend. Start it with `npm run dev` or `npm run api` and keep it running on http://127.0.0.1:8000.',
        )
      }
      throw new Error('Could not reach the server. Please try again.')
    }
    throw error
  }
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && data.detail
        ? detailMessage(data.detail)
        : res.statusText
    throw new Error(msg)
  }
  return data
}
