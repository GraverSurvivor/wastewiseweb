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
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
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
  const res = await fetch(url, { method: 'POST', headers, body: formData })
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
