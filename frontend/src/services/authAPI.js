import { supabase } from './supabase'

function normalizeRut(rut) {
  return rut.replace(/[.\-\s]/g, '').toUpperCase()
}

async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export const AuthAPI = {
  checkUser: async (rut) => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, rut, nombre, rol, empresa_ids, empresa_id, activo, estado')
      .eq('rut', normalizeRut(rut))
      .maybeSingle()
    return data
  },

  login: async (rut, password) => {
    const hash = await hashPassword(password)
    const { data } = await supabase
      .from('usuarios')
      .select('id, rut, nombre, rol, empresa_ids, empresa_id, activo, estado')
      .eq('rut', normalizeRut(rut))
      .eq('password_hash', hash)
      .maybeSingle()
    return data
  },

  register: async ({ rut, nombre, password, email }) => {
    const hash = await hashPassword(password)
    const { data, error } = await supabase
      .from('usuarios')
      .insert({
        id: `usr-${Date.now()}`,
        rut: normalizeRut(rut),
        nombre: nombre.trim(),
        email: email?.toLowerCase().trim() || null,
        password_hash: hash,
        rol: 'vendedor',
        empresa_ids: null,
        empresa_id: null,
        activo: false,
        estado: 'pendiente',
      })
      .select('id, rut, nombre, estado')
      .single()
    if (error) throw error
    return data
  },

  /* ── Gestión de usuarios (admin) ─────────────────────────────── */
  getUsuarios: async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, rut, nombre, rol, empresa_ids, empresa_id, activo, estado, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  activarUsuario: async (id, { rol, empresaId, empresaIds }) => {
    const updates = {
      activo: true,
      estado: 'activo',
      rol,
      empresa_id:   rol === 'vendedor' ? empresaId  : null,
      empresa_ids:  rol === 'admin'    ? empresaIds : null,
    }
    const { error } = await supabase.from('usuarios').update(updates).eq('id', id)
    if (error) throw error
  },

  desactivarUsuario: async (id) => {
    const { error } = await supabase
      .from('usuarios')
      .update({ activo: false, estado: 'inactivo' })
      .eq('id', id)
    if (error) throw error
  },

  reactivarUsuario: async (id) => {
    const { error } = await supabase
      .from('usuarios')
      .update({ activo: true, estado: 'activo' })
      .eq('id', id)
    if (error) throw error
  },

  crearUsuario: async ({ rut, nombre, email, password, rol, empresaId, empresaIds }) => {
    const hash = await hashPassword(password)
    const { data, error } = await supabase
      .from('usuarios')
      .insert({
        id: `usr-${Date.now()}`,
        rut: normalizeRut(rut),
        nombre: nombre.trim(),
        email: email?.toLowerCase().trim() || null,
        password_hash: hash,
        rol,
        empresa_id:  rol !== 'admin' ? empresaId  : null,
        empresa_ids: rol === 'admin' ? empresaIds : null,
        activo: true,
        estado: 'activo',
      })
      .select('id, rut, nombre, rol, empresa_ids, empresa_id, activo, estado')
      .single()
    if (error) throw error
    return data
  },

  /* ── Recuperación de contraseña ──────────────────────────────── */
  solicitarReset: async (email) => {
    const { data: user } = await supabase
      .from('usuarios')
      .select('id, nombre, email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()
    if (!user) throw new Error('No hay una cuenta asociada a ese correo')

    const codigo = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error } = await supabase.from('reset_codes').insert({
      id: `rst-${Date.now()}`,
      email: email.toLowerCase().trim(),
      codigo,
      usuario_id: user.id,
      expires_at: expiresAt,
      used: false,
    })
    if (error) throw error

    return { userId: user.id, nombre: user.nombre, codigo }
  },

  verificarCodigo: async (email, codigo) => {
    const { data } = await supabase
      .from('reset_codes')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('codigo', codigo)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle()
    return data
  },

  cambiarPasswordConCodigo: async (resetId, userId, newPassword) => {
    const hash = await hashPassword(newPassword)
    const { error } = await supabase.from('usuarios').update({ password_hash: hash }).eq('id', userId)
    if (error) throw error
    await supabase.from('reset_codes').update({ used: true }).eq('id', resetId)
  },

  cambiarPasswordAdmin: async (userId, newPassword) => {
    const hash = await hashPassword(newPassword)
    const { error } = await supabase.from('usuarios').update({ password_hash: hash }).eq('id', userId)
    if (error) throw error
  },

  /* Crea o actualiza el usuario de la app móvil vinculado a un trabajador */
  sincronizarUsuarioTrabajador: async (trabajadorId, { rut, nombre, email, appActiva, empresaId }) => {
    const normalRut = normalizeRut(rut)

    /* Buscar usuario existente por ID o por RUT */
    const { data: byId }  = await supabase.from('usuarios').select('id').eq('id', trabajadorId).maybeSingle()
    const { data: byRut } = await supabase.from('usuarios').select('id').eq('rut', normalRut).maybeSingle()
    const existing = byId || byRut

    const updates = {
      rut:        normalRut,
      nombre:     nombre.trim(),
      email:      email?.toLowerCase().trim() || null,
      rol:        'trabajador',
      empresa_id: empresaId,
      activo:     appActiva,
      estado:     appActiva ? 'activo' : 'inactivo',
    }

    if (existing) {
      const { error } = await supabase.from('usuarios').update(updates).eq('id', existing.id)
      if (error) throw error
    }
    // Si no existe usuario, el toggle solo afecta el campo appActiva del trabajador
  },

  agregarEmpresaAdmin: async (userId, empresaId, currentIds) => {
    const newIds = [...(currentIds || []), empresaId]
    const { error } = await supabase.from('usuarios').update({ empresa_ids: newIds }).eq('id', userId)
    if (error) throw error
    return newIds
  },

  editarUsuario: async (id, { nombre, email, rol, empresaId, empresaIds }) => {
    const updates = {
      nombre: nombre.trim(),
      email:  email?.toLowerCase().trim() || null,
      rol,
      empresa_id:  rol !== 'admin' ? empresaId  : null,
      empresa_ids: rol === 'admin' ? empresaIds : null,
    }
    const { error } = await supabase.from('usuarios').update(updates).eq('id', id)
    if (error) throw error
  },
}
