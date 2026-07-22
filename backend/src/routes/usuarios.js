const { Router } = require('express')
const supabase = require('../lib/supabase.js')
const { hashBcrypt } = require('../utils/crypto.js')
const { requireAuth, requireAdmin } = require('../middleware/auth.js')

const crypto = require('crypto')
const router = Router()

router.use(requireAuth, requireAdmin)

/* ── helpers ──────────────────────────────────────────────────────── */

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''
  for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd
}

async function insertAudit(actor_id, empresa_id, accion, tabla, registro_id, detalle = null) {
  await supabase.from('audit_log').insert([{
    actor_id,
    empresa_id,
    accion,
    tabla,
    registro_id,
    detalle,
    created_at: new Date().toISOString(),
  }])
}

/* ── GET /api/usuarios/sin-trabajador ────────────────────────────── */

router.get('/sin-trabajador', async (req, res) => {
  const { empresa_id } = req.user

  const { data: vinculados } = await supabase
    .from('trabajadores')
    .select('usuario_id')
    .eq('empresa_id', empresa_id)
    .not('usuario_id', 'is', null)
  const idsVinculados = (vinculados || []).map(t => t.usuario_id).filter(Boolean)

  let query = supabase
    .from('usuarios')
    .select('id, nombre, apellidos, email, rut, telefono, rol')
    .eq('empresa_id', empresa_id)
    .is('deleted_at', null)
    .order('nombre')

  if (idsVinculados.length > 0) {
    query = query.not('id', 'in', `(${idsVinculados.join(',')})`)
  }

  const { data, error } = await query
  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: 'Error al obtener usuarios sin vincular' },
    })
  }

  res.json({
    success: true,
    data: (data || []).map(r => ({
      id:        r.id,
      nombre:    r.nombre    ?? '',
      apellidos: r.apellidos ?? '',
      email:     r.email     ?? '',
      rol:       r.rol       ?? '',
      rut:       r.rut       ?? '',
      telefono:  r.telefono  ?? '',
    })),
  })
})

/* ── GET /api/usuarios ────────────────────────────────────────────── */

router.get('/', async (req, res) => {
  const { empresa_id } = req.user
  const { buscar, rol, activo } = req.query

  let query = supabase
    .from('usuarios')
    .select('id, nombre, apellidos, email, rut, telefono, rol, activo, ultimo_acceso, created_at')
    .eq('empresa_id', empresa_id)
    .is('deleted_at', null)
    .order('nombre')

  if (buscar) {
    query = query.or(`nombre.ilike.%${buscar}%,email.ilike.%${buscar}%`)
  }
  if (rol) {
    query = query.eq('rol', rol)
  }
  if (activo !== undefined) {
    query = query.eq('activo', activo === 'true')
  }

  const { data, error } = await query
  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: 'Error al obtener usuarios' },
    })
  }

  res.json({ success: true, data })
})

/* ── POST /api/usuarios ───────────────────────────────────────────── */

router.post('/', async (req, res) => {
  const { empresa_id, id: actor_id } = req.user
  const { nombre, apellidos, email, rut, telefono, rol, password } = req.body

  if (!nombre || !email || !rol || !password) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Nombre, email, rol y contraseña son requeridos' },
    })
  }
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'La contraseña debe tener al menos 8 caracteres' },
    })
  }

  const rolesValidos = ['admin', 'vendedor', 'gerente', 'contador', 'rrhh', 'compras', 'tesoreria']
  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Rol no válido' },
    })
  }

  const { data: existe } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', email.toLowerCase())
    .is('deleted_at', null)
    .maybeSingle()

  if (existe) {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'Ya existe un usuario con ese email' },
    })
  }

  const password_hash = await hashBcrypt(password)
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .insert([{
      id: crypto.randomUUID(),
      nombre,
      apellidos: apellidos || null,
      email: email.toLowerCase(),
      rut: rut || null,
      telefono: telefono || null,
      rol,
      password_hash,
      hash_method: 'bcrypt',
      empresa_id,
      activo: true,
    }])
    .select('id, nombre, apellidos, email, rut, telefono, rol, activo, created_at')
    .single()

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: 'Error al crear el usuario' },
    })
  }

  await insertAudit(actor_id, empresa_id, 'CREATE', 'usuarios', usuario.id, { email: usuario.email, rol })
  res.status(201).json({ success: true, data: usuario })
})

/* ── PATCH /api/usuarios/:id ──────────────────────────────────────── */

router.patch('/:id', async (req, res) => {
  const { empresa_id, id: actor_id } = req.user
  const { id } = req.params
  const { nombre, apellidos, email, rut, telefono, rol, activo } = req.body

  const { data: existente } = await supabase
    .from('usuarios')
    .select('id, email')
    .eq('id', id)
    .eq('empresa_id', empresa_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existente) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' },
    })
  }

  if (email && email.toLowerCase() !== existente.email) {
    const { data: emailTaken } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email.toLowerCase())
      .is('deleted_at', null)
      .neq('id', id)
      .maybeSingle()

    if (emailTaken) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Ese email ya está en uso' },
      })
    }
  }

  const rolesValidos = ['admin', 'vendedor', 'gerente', 'contador', 'rrhh', 'compras', 'tesoreria']
  if (rol && !rolesValidos.includes(rol)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Rol no válido' },
    })
  }

  const updates = { updated_at: new Date().toISOString() }
  if (nombre    !== undefined) updates.nombre    = nombre
  if (apellidos !== undefined) updates.apellidos = apellidos || null
  if (email     !== undefined) updates.email     = email.toLowerCase()
  if (rut       !== undefined) updates.rut       = rut || null
  if (telefono  !== undefined) updates.telefono  = telefono || null
  if (rol       !== undefined) updates.rol       = rol
  if (activo    !== undefined) updates.activo    = activo

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .update(updates)
    .eq('id', id)
    .select('id, nombre, apellidos, email, rut, telefono, rol, activo, ultimo_acceso')
    .single()

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: 'Error al actualizar el usuario' },
    })
  }

  await insertAudit(actor_id, empresa_id, 'UPDATE', 'usuarios', id, updates)
  res.json({ success: true, data: usuario })
})

/* ── DELETE /api/usuarios/:id ─────────────────────────────────────── */

router.delete('/:id', async (req, res) => {
  const { empresa_id, id: actor_id } = req.user
  const { id } = req.params

  if (id === actor_id) {
    return res.status(400).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'No puedes eliminar tu propio usuario' },
    })
  }

  const { data: existente } = await supabase
    .from('usuarios')
    .select('id, email')
    .eq('id', id)
    .eq('empresa_id', empresa_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existente) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' },
    })
  }

  const { count: cotizaciones } = await supabase
    .from('cotizaciones')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', id)

  if (cotizaciones > 0) {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'No se puede eliminar: el usuario tiene cotizaciones asociadas' },
    })
  }

  const { error } = await supabase
    .from('usuarios')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: 'Error al eliminar el usuario' },
    })
  }

  await insertAudit(actor_id, empresa_id, 'DELETE', 'usuarios', id, { email: existente.email })
  res.json({ success: true, data: { message: 'Usuario eliminado correctamente' } })
})

/* ── POST /api/usuarios/:id/reset-password ────────────────────────── */

router.post('/:id/reset-password', async (req, res) => {
  const { empresa_id, id: actor_id } = req.user
  const { id } = req.params

  const { data: existente } = await supabase
    .from('usuarios')
    .select('id, email')
    .eq('id', id)
    .eq('empresa_id', empresa_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existente) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' },
    })
  }

  const tempPassword = randomPassword()
  const password_hash = await hashBcrypt(tempPassword)

  const { error } = await supabase
    .from('usuarios')
    .update({
      password_hash,
      hash_method: 'bcrypt',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: 'Error al resetear la contraseña' },
    })
  }

  await insertAudit(actor_id, empresa_id, 'RESET_PASSWORD', 'usuarios', id, { email: existente.email })
  res.json({ success: true, data: { tempPassword } })
})

/* ── PATCH /api/usuarios/:id/toggle-activo ────────────────────────── */

router.patch('/:id/toggle-activo', async (req, res) => {
  const { empresa_id, id: actor_id } = req.user
  const { id } = req.params

  if (id === actor_id) {
    return res.status(400).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'No puedes desactivarte a ti mismo' },
    })
  }

  const { data: existente } = await supabase
    .from('usuarios')
    .select('id, activo, email')
    .eq('id', id)
    .eq('empresa_id', empresa_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existente) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' },
    })
  }

  const nuevoEstado = !existente.activo
  const { error } = await supabase
    .from('usuarios')
    .update({ activo: nuevoEstado, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: 'Error al cambiar el estado del usuario' },
    })
  }

  await insertAudit(actor_id, empresa_id, nuevoEstado ? 'ACTIVATE' : 'DEACTIVATE', 'usuarios', id, { email: existente.email })
  res.json({ success: true, data: { activo: nuevoEstado } })
})

module.exports = router
