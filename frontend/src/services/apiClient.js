const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const AUTH_KEY = 'mamkam_auth'

function getToken() {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? JSON.parse(raw).token : null
  } catch { return null }
}

async function request(method, path, body) {
  const url = `${BASE_URL}${path}`
  console.log('[apiClient] request:', method, url, 'token existe:', !!getToken())
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    const err = new Error(`El servidor no está disponible (${res.status}). Intenta nuevamente.`)
    err.status = res.status
    throw err
  }

  if (!res.ok) {
    const err = new Error(json.error?.message || 'Error de servidor')
    err.code = json.error?.code
    err.status = res.status
    throw err
  }
  return json.data
}

export const apiClient = {
  get:    (path)       => request('GET',    path),
  post:   (path, body) => request('POST',   path, body),
  put:    (path, body) => request('PUT',    path, body),
  patch:  (path, body) => request('PATCH',  path, body),
  delete: (path)       => request('DELETE', path),
}
