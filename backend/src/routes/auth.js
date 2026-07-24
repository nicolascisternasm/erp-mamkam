const { Router } = require('express')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const supabase = require('../lib/supabase.js')
const { hashBcrypt, verifyPassword, sha256 } = require('../utils/crypto.js')
const { requireAuth, requireAdmin } = require('../middleware/auth.js')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Solo se permiten imágenes'))
  },
})

const router = Router()

/* ── helpers ──────────────────────────────────────────────────────── */

function makeToken(user, rememberMe = false) {
  const payload = {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    empresa_id:           user.empresa_id           ?? null,
    app_activa:           user.app_activa           ?? false,
    puede_cotizar:        user.puede_cotizar        ?? false,
    puede_oc:             user.puede_oc             ?? false,
    puede_rrhh:           user.puede_rrhh           ?? false,
    puede_finanzas:       user.puede_finanzas       ?? false,
    puede_proyectos:      user.puede_proyectos      ?? false,
    puede_asesoria:       user.puede_asesoria       ?? false,
    puede_remuneraciones: user.puede_remuneraciones ?? false,
    puede_facturas:       user.puede_facturas       ?? false,
    puede_productos:      user.puede_productos      ?? false,
    puede_marcaciones:    user.puede_marcaciones    ?? false,
    puede_vacaciones:     user.puede_vacaciones     ?? false,
    puede_gastos:         user.puede_gastos         ?? false,
    puede_visitas:        user.puede_visitas        ?? false,
    puede_visitas_app:    user.puede_visitas_app    ?? false,
    puede_planificacion:  user.puede_planificacion  ?? false,
  }
  const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '7d')
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn })
}

async function getPermisos(usuarioId) {
  const { data } = await supabase
    .from('trabajadores')
    .select('app_activa, puede_cotizar, puede_oc, puede_rrhh, puede_finanzas, puede_proyectos, puede_planificacion, puede_asesoria, puede_remuneraciones, puede_facturas, puede_productos, puede_marcaciones, puede_vacaciones, puede_gastos, puede_visitas, puede_visitas_app, sueldo_minimo, sueldo_es_liquido')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  return {
    app_activa:           data?.app_activa           ?? false,
    puede_cotizar:        data?.puede_cotizar        ?? false,
    puede_oc:             data?.puede_oc             ?? false,
    puede_rrhh:           data?.puede_rrhh           ?? false,
    puede_finanzas:       data?.puede_finanzas       ?? false,
    puede_proyectos:      data?.puede_proyectos      ?? false,
    puede_asesoria:       data?.puede_asesoria       ?? false,
    puede_remuneraciones: data?.puede_remuneraciones ?? false,
    puede_facturas:       data?.puede_facturas       ?? false,
    puede_productos:      data?.puede_productos      ?? false,
    puede_marcaciones:    data?.puede_marcaciones    ?? false,
    puede_vacaciones:     data?.puede_vacaciones     ?? false,
    puede_gastos:         data?.puede_gastos         ?? false,
    puede_visitas:        data?.puede_visitas        ?? false,
    puede_visitas_app:    data?.puede_visitas_app    ?? false,
    puede_planificacion:  data?.puede_planificacion  ?? false,
    sueldo_minimo:        data?.sueldo_minimo        ?? 539000,
    sueldo_es_liquido:    data?.sueldo_es_liquido    ?? false,
  }
}

function maskEmail(email) {
  const [user, domain] = email.split('@')
  const masked = user[0] + '***'
  return `${masked}@${domain}`
}

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/* ── POST /api/auth/registro ──────────────────────────────────────── */

router.post('/registro', async (req, res) => {
  const {
    rut_empresa, razon_social, nombre_fantasia, email_contacto, telefono_empresa,
    nombre, apellidos, email, password, rut_usuario,
  } = req.body

  if (!rut_empresa || !razon_social || !email_contacto || !nombre || !email || !password || !rut_usuario) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Faltan campos requeridos (incluido RUT del administrador)' },
    })
  }
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'La contraseña debe tener al menos 8 caracteres' },
    })
  }

  const { data: existeEmpresa } = await supabase
    .from('empresas_tenant')
    .select('id')
    .eq('rut', rut_empresa)
    .maybeSingle()

  if (existeEmpresa) {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'Ya existe una empresa registrada con ese RUT' },
    })
  }

  const { data: existeUsuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', email.toLowerCase())
    .is('deleted_at', null)
    .maybeSingle()

  if (existeUsuario) {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'Ya existe un usuario con ese email' },
    })
  }

  const empresaId = crypto.randomUUID()
  const { data: empresa, error: errEmpresa } = await supabase
    .from('empresas_tenant')
    .insert([{
      id: empresaId,
      rut: rut_empresa,
      razon_social,
      nombre_fantasia: nombre_fantasia || null,
      email_contacto: email_contacto.toLowerCase(),
      telefono: telefono_empresa || null,
    }])
    .select()
    .single()

  if (errEmpresa) {
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: 'Error al crear la empresa' },
    })
  }

  await supabase.from('empresas').insert([{
    id: empresaId,
    nombre: razon_social,
    rut: rut_empresa,
    nombre_fantasia: nombre_fantasia || null,
    telefono: telefono_empresa || null,
    email: email_contacto.toLowerCase(),
    activa: true,
  }])

  const password_hash = sha256(password)
  const { data: usuario, error: errUsuario } = await supabase
    .from('usuarios')
    .insert([{
      id: crypto.randomUUID(),
      nombre,
      apellidos: apellidos || null,
      email: email.toLowerCase(),
      rut: rut_usuario,
      password_hash,
      hash_method: 'sha256',
      rol: 'admin',
      empresa_id: empresaId,
      activo: true,
    }])
    .select('id, email, nombre, apellidos, rol, empresa_id')
    .single()

  if (errUsuario) {
    await supabase.from('empresas_tenant').delete().eq('id', empresaId)
    await supabase.from('empresas').delete().eq('id', empresaId)
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: errUsuario.message || 'Error al crear el usuario administrador' },
    })
  }

  const token = makeToken(usuario)
  res.status(201).json({ success: true, data: { token, user: usuario } })
})

/* ── POST /api/auth/login ─────────────────────────────────────────── */

router.post('/login', async (req, res) => {
  const { email, password, rememberMe = false } = req.body

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Email y contraseña requeridos' },
    })
  }

  const { data: user } = await supabase
    .from('usuarios')
    .select('id, email, nombre, apellidos, rol, empresa_id, password_hash, hash_method, activo')
    .eq('email', email.toLowerCase())
    .is('deleted_at', null)
    .maybeSingle()

  if (!user || user.activo === false) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' },
    })
  }

  const valid = await verifyPassword(password, user.password_hash, user.hash_method || 'bcrypt')
  if (!valid) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' },
    })
  }

  await supabase
    .from('usuarios')
    .update({ ultimo_acceso: new Date().toISOString() })
    .eq('id', user.id)

  const permisos = await getPermisos(user.id)
  const token = makeToken({ ...user, ...permisos }, rememberMe)
  const { password_hash, hash_method, activo, ...userData } = user
  res.json({ success: true, data: { token, user: { ...userData, ...permisos } } })
})

/* ── POST /api/auth/forgot-password ──────────────────────────────── */

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Email requerido' },
    })
  }

  const { data: user } = await supabase
    .from('usuarios')
    .select('id, email')
    .eq('email', email.toLowerCase())
    .is('deleted_at', null)
    .maybeSingle()

  const email_masked = maskEmail(email.toLowerCase())

  let reset_token_code = null
  if (user) {
    reset_token_code = randomCode()
    const reset_token_exp = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await supabase
      .from('usuarios')
      .update({ reset_token: reset_token_code, reset_token_exp })
      .eq('id', user.id)
  }

  res.json({ success: true, data: { email_masked, reset_token: reset_token_code } })
})

/* ── POST /api/auth/reset-password ───────────────────────────────── */

router.post('/reset-password', async (req, res) => {
  const { email, token, nueva_password } = req.body

  if (!email || !token || !nueva_password) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Email, código y nueva contraseña requeridos' },
    })
  }
  if (nueva_password.length < 8) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'La contraseña debe tener al menos 8 caracteres' },
    })
  }

  const { data: user } = await supabase
    .from('usuarios')
    .select('id, reset_token, reset_token_exp')
    .eq('email', email.toLowerCase())
    .is('deleted_at', null)
    .maybeSingle()

  if (!user || user.reset_token !== token) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Código inválido' },
    })
  }

  if (!user.reset_token_exp || new Date(user.reset_token_exp) < new Date()) {
    return res.status(400).json({
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'El código ha expirado. Solicita uno nuevo.' },
    })
  }

  const password_hash = await hashBcrypt(nueva_password)
  await supabase
    .from('usuarios')
    .update({
      password_hash,
      hash_method: 'bcrypt',
      reset_token: null,
      reset_token_exp: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  res.json({ success: true, data: { message: 'Contraseña actualizada correctamente' } })
})

/* ── GET /api/auth/me ─────────────────────────────────────────────── */

router.get('/me', requireAuth, async (req, res) => {
  console.log('[/auth/me] INICIO — req.user.id:', req.user?.id)
  const { data: user } = await supabase
    .from('usuarios')
    .select('id, email, nombre, apellidos, rol, empresa_id, telefono, rut, activo, ultimo_acceso, puede_cotizar, puede_oc, puede_rrhh, puede_finanzas, puede_proyectos, puede_asesoria')
    .eq('id', req.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!user || user.activo === false) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Usuario no encontrado o inactivo' },
    })
  }

  let empresa = null
  let empresaId = user.empresa_id ?? req.user.empresa_id

  console.log('[/auth/me] user.id:', user.id, '| email:', user.email, '| rol:', user.rol, '| empresa_id:', user.empresa_id)

  if (empresaId) {
    const { data: emp, error: errEmp } = await supabase
      .from('empresas_tenant')
      .select('id, rut, razon_social, nombre_fantasia, email_contacto, telefono, activo, datos_bancarios')
      .eq('id', String(empresaId))
      .maybeSingle()
    if (errEmp) console.log('[/auth/me] error empresas_tenant:', errEmp.message)
    if (emp) empresa = emp

    // Fallback a tabla legada si no está en empresas_tenant
    if (!empresa) {
      const { data: legacy, error: errLegacy } = await supabase
        .from('empresas')
        .select('id, rut, nombre, nombre_fantasia, email, telefono, activa')
        .eq('id', String(empresaId))
        .maybeSingle()
      if (errLegacy) console.log('[/auth/me] error empresas:', errLegacy.message)
      if (legacy) {
        empresa = {
          id:              legacy.id,
          rut:             legacy.rut,
          razon_social:    legacy.nombre,
          nombre_fantasia: legacy.nombre_fantasia,
          email_contacto:  legacy.email,
          telefono:        legacy.telefono,
          activo:          legacy.activa,
          datos_bancarios: null,
        }
      }
    }
  }

  // Fallback: usuario sin empresa_id (registrado antes del sistema multi-tenant).
  // Busca la empresa por email del usuario en ambas tablas y auto-asocia.
  if (!empresa && user.rol === 'admin') {
    console.log('[/auth/me] empresa_id vacío, buscando por email:', user.email)
    const { data: tenantByEmail } = await supabase
      .from('empresas_tenant')
      .select('id, rut, razon_social, nombre_fantasia, email_contacto, telefono, activo, datos_bancarios')
      .eq('email_contacto', user.email)
      .maybeSingle()

    console.log('[/auth/me] tenantByEmail:', tenantByEmail)
    if (tenantByEmail) {
      empresa = tenantByEmail
      empresaId = tenantByEmail.id
    } else {
      const { data: legacyByEmail } = await supabase
        .from('empresas')
        .select('id, rut, nombre, nombre_fantasia, email, telefono, activa')
        .eq('email', user.email)
        .maybeSingle()
      console.log('[/auth/me] legacyByEmail:', legacyByEmail)
      if (legacyByEmail) {
        empresa = {
          id:              legacyByEmail.id,
          rut:             legacyByEmail.rut,
          razon_social:    legacyByEmail.nombre,
          nombre_fantasia: legacyByEmail.nombre_fantasia,
          email_contacto:  legacyByEmail.email,
          telefono:        legacyByEmail.telefono,
          activo:          legacyByEmail.activa,
          datos_bancarios: null,
        }
        empresaId = legacyByEmail.id
      }
    }

    // Auto-corrige el registro del usuario para futuras solicitudes
    if (empresaId) {
      await supabase.from('usuarios').update({ empresa_id: empresaId }).eq('id', user.id)
    }
  }

  const permisos = await getPermisos(user.id)
  res.json({ success: true, data: { ...user, ...permisos, empresa } })
})

/* ── PATCH /api/auth/me ───────────────────────────────────────────── */

router.patch('/me', requireAuth, async (req, res) => {
  const { nombre, apellidos, telefono, email } = req.body

  if (!nombre?.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'El nombre es requerido' },
    })
  }

  const updates = { updated_at: new Date().toISOString() }
  updates.nombre    = nombre.trim()
  if (apellidos !== undefined) updates.apellidos = apellidos?.trim() || null
  if (telefono  !== undefined) updates.telefono  = telefono?.trim()  || null
  if (email     !== undefined) updates.email     = email.toLowerCase().trim()

  const { data: user, error } = await supabase
    .from('usuarios')
    .update(updates)
    .eq('id', req.user.id)
    .select('id, email, nombre, apellidos, rol, empresa_id, telefono, rut')
    .single()

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: 'Error al actualizar el perfil' },
    })
  }

  res.json({ success: true, data: user })
})

/* ── PATCH /api/auth/me/password ──────────────────────────────────── */

router.patch('/me/password', requireAuth, async (req, res) => {
  const { actual, nueva } = req.body

  if (!actual || !nueva) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Contraseña actual y nueva son requeridas' },
    })
  }
  if (nueva.length < 8) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'La nueva contraseña debe tener al menos 8 caracteres' },
    })
  }

  const { data: user } = await supabase
    .from('usuarios')
    .select('id, password_hash, hash_method')
    .eq('id', req.user.id)
    .maybeSingle()

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' },
    })
  }

  const valid = await verifyPassword(actual, user.password_hash, user.hash_method || 'bcrypt')
  if (!valid) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'La contraseña actual es incorrecta' },
    })
  }

  const password_hash = await hashBcrypt(nueva)
  await supabase
    .from('usuarios')
    .update({ password_hash, hash_method: 'bcrypt', updated_at: new Date().toISOString() })
    .eq('id', user.id)

  res.json({ success: true, data: { message: 'Contraseña actualizada correctamente' } })
})

/* ── GET /api/auth/empresa ────────────────────────────────────────── */

router.get('/empresa', requireAuth, async (req, res) => {
  let empresaId = req.user.empresa_id

  // Fallback: el JWT puede estar desactualizado o el usuario fue creado sin empresa_id en el token.
  // Se busca directamente en la tabla usuarios por el id del usuario autenticado.
  if (!empresaId) {
    const { data: u } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('id', req.user.id)
      .maybeSingle()
    empresaId = u?.empresa_id ?? null
  }

  if (!empresaId) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'No tienes una empresa asociada' },
    })
  }

  const id = String(empresaId)

  // Consultar ambas tablas en paralelo
  const [{ data: tenant }, { data: legacy }] = await Promise.all([
    supabase.from('empresas_tenant').select('*').eq('id', id).maybeSingle(),
    supabase.from('empresas').select('*').eq('id', id).maybeSingle(),
  ])

  if (!tenant && !legacy) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Empresa no encontrada' },
    })
  }

  // Normalizar campos de la tabla legada al esquema del tenant
  const legacyNorm = legacy ? {
    id:              legacy.id,
    rut:             legacy.rut,
    razon_social:    legacy.nombre      ?? legacy.razon_social,
    nombre_fantasia: legacy.nombre_fantasia,
    email_contacto:  legacy.email       ?? legacy.email_contacto,
    telefono:        legacy.telefono,
    activo:          legacy.activa      ?? legacy.activo,
    datos_bancarios: legacy.datos_bancarios ?? null,
    logo_url:        legacy.logo_url    ?? null,
    ...legacy, // incluir cualquier columna adicional que tenga la tabla
  } : {}

  // Mergear: tenant tiene prioridad, legacy aporta campos que falten (ej. logo_url)
  const empresa = { ...legacyNorm, ...(tenant ?? {}) }

  // Normalizar nombres de campo por si tenant tiene columnas distintas
  if (!empresa.razon_social && empresa.nombre)       empresa.razon_social   = empresa.nombre
  if (!empresa.email_contacto && empresa.email)      empresa.email_contacto = empresa.email
  if (empresa.activa !== undefined && empresa.activo === undefined) empresa.activo = empresa.activa

  res.json({ success: true, data: empresa })
})

/* ── POST /api/auth/empresa/logo ──────────────────────────────────── */

router.post('/empresa/logo', requireAuth, requireAdmin, upload.single('logo'), async (req, res) => {
  const { empresa_id } = req.user
  if (!empresa_id) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Sin empresa asociada' } })
  }
  if (!req.file) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No se recibió ningún archivo' } })
  }

  const ext  = req.file.originalname.split('.').pop().toLowerCase()
  const path = `${empresa_id}/logo.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true,
    })

  if (uploadError) {
    return res.status(500).json({ success: false, error: { code: 'UPLOAD_ERROR', message: uploadError.message } })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('logos')
    .getPublicUrl(path)

  const now = new Date().toISOString()
  await Promise.all([
    supabase.from('empresas_tenant').update({ logo_url: publicUrl, updated_at: now }).eq('id', empresa_id),
    supabase.from('empresas').update({ logo_url: publicUrl, updated_at: now }).eq('id', empresa_id),
  ])

  res.json({ success: true, data: { logo_url: publicUrl } })
})

/* ── PATCH /api/auth/empresa ──────────────────────────────────────── */

router.patch('/empresa', requireAuth, requireAdmin, async (req, res) => {
  const { empresa_id } = req.user

  if (!empresa_id) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'No tienes una empresa asociada' },
    })
  }

  const {
    razon_social, nombre_fantasia, email_contacto, telefono, datos_bancarios,
    giro, direccion, comuna, ciudad, region, pais, codigo_postal,
    representante_legal, sitio_web,
  } = req.body
  const now = new Date().toISOString()

  const str = (v) => v?.trim() || null
  const low = (v) => v?.toLowerCase().trim() || null

  // empresas_tenant: razon_social, nombre_fantasia, email_contacto, telefono, datos_bancarios
  const tenantUpdates = { updated_at: now }
  if (razon_social    !== undefined) tenantUpdates.razon_social    = str(razon_social)
  if (nombre_fantasia !== undefined) tenantUpdates.nombre_fantasia = str(nombre_fantasia)
  if (email_contacto  !== undefined) tenantUpdates.email_contacto  = low(email_contacto)
  if (telefono        !== undefined) tenantUpdates.telefono        = str(telefono)
  if (datos_bancarios !== undefined) tenantUpdates.datos_bancarios = datos_bancarios

  // empresas: esquema completo (nombre = razon_social, email = email_contacto, sitio_web, etc.)
  const legacyUpdates = { updated_at: now }
  if (razon_social        !== undefined) legacyUpdates.nombre              = str(razon_social)
  if (nombre_fantasia     !== undefined) legacyUpdates.nombre_fantasia     = str(nombre_fantasia)
  if (email_contacto      !== undefined) legacyUpdates.email               = low(email_contacto)
  if (telefono            !== undefined) legacyUpdates.telefono            = str(telefono)
  if (giro                !== undefined) legacyUpdates.giro                = str(giro)
  if (direccion           !== undefined) legacyUpdates.direccion           = str(direccion)
  if (comuna              !== undefined) legacyUpdates.comuna              = str(comuna)
  if (ciudad              !== undefined) legacyUpdates.ciudad              = str(ciudad)
  if (region              !== undefined) legacyUpdates.region              = str(region)
  if (pais                !== undefined) legacyUpdates.pais                = str(pais)
  if (codigo_postal       !== undefined) legacyUpdates.codigo_postal       = str(codigo_postal)
  if (representante_legal !== undefined) legacyUpdates.representante_legal = str(representante_legal)
  if (sitio_web           !== undefined) legacyUpdates.sitio_web           = str(sitio_web)

  const [{ error: tenantErr }, { error: legacyErr }] = await Promise.all([
    supabase.from('empresas_tenant').update(tenantUpdates).eq('id', empresa_id),
    supabase.from('empresas').update(legacyUpdates).eq('id', empresa_id),
  ])

  if (tenantErr) console.error('[PATCH /empresa] empresas_tenant error:', tenantErr.message)
  if (legacyErr) console.error('[PATCH /empresa] empresas error:', legacyErr.message)

  if (tenantErr && legacyErr) {
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: legacyErr.message },
    })
  }

  // Datos frescos: merge de ambas tablas
  const [{ data: tenant }, { data: legacy }] = await Promise.all([
    supabase.from('empresas_tenant').select('*').eq('id', empresa_id).maybeSingle(),
    supabase.from('empresas').select('*').eq('id', empresa_id).maybeSingle(),
  ])

  const merged = {
    ...(legacy ?? {}),
    razon_social:   legacy?.nombre         ?? legacy?.razon_social,
    email_contacto: legacy?.email          ?? legacy?.email_contacto,
    activo:         legacy?.activa         ?? legacy?.activo,
    ...(tenant ?? {}),
  }

  res.json({ success: true, data: merged })
})

module.exports = router
