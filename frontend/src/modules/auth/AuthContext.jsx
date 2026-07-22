import { createContext, useContext, useState, useEffect } from 'react'
import { apiClient } from '../../services/apiClient'

const AUTH_KEY = 'mamkam_auth'

function getInitials(nombre) {
  return (nombre || '').split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_KEY)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  // false hasta que /auth/me complete (o hasta confirmar que no hay sesión)
  const [authReady, setAuthReady] = useState(false)

  const fetchMe = (token) => {
    const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
    return fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.data) return
        const me = json.data
        setUser(prev => {
          if (!prev) return prev
          const enriched = { ...prev, ...me, token: prev.token, initials: getInitials(me.nombre) }
          localStorage.setItem(AUTH_KEY, JSON.stringify(enriched))
          return enriched
        })
      })
      .catch(() => {})
  }

  // Carga inicial
  useEffect(() => {
    if (!user?.token) { setAuthReady(true); return }
    fetchMe(user.token).finally(() => setAuthReady(true))
  }, [])

  // Re-consulta permisos cuando el usuario vuelve a la pestaña
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setUser(prev => {
          if (prev?.token) fetchMe(prev.token)
          return prev
        })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Almacena usuario en estado y localStorage; enriquece con datos de empresa y permisos
  const _setAuth = async (token, userData) => {
    const base = { ...userData, token, initials: getInitials(userData.nombre) }
    setUser(base)
    localStorage.setItem(AUTH_KEY, JSON.stringify(base))
    try {
      const me = await apiClient.get('/auth/me')
      const enriched = { ...base, ...me, token, initials: getInitials(me.nombre) }
      setUser(enriched)
      localStorage.setItem(AUTH_KEY, JSON.stringify(enriched))
      return enriched
    } catch {
      return base
    }
  }

  const login = async (email, password, rememberMe = false) => {
    const { token, user: userData } = await apiClient.post('/auth/login', { email, password, rememberMe })
    return _setAuth(token, userData)
  }

  const registerEmpresa = async (formData) => {
    const { token, user: userData } = await apiClient.post('/auth/registro', formData)
    return _setAuth(token, userData)
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(AUTH_KEY)
  }

  const updateUser = (partial) => {
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, ...partial, initials: getInitials(partial.nombre ?? prev.nombre) }
      localStorage.setItem(AUTH_KEY, JSON.stringify(updated))
      return updated
    })
  }

  // Shim para Navbar — el nuevo sistema no usa selección múltiple de empresa
  const selectEmpresa = () => {}

  return (
    <AuthContext.Provider value={{ user, authReady, login, registerEmpresa, logout, selectEmpresa, updateUser, fetchMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
