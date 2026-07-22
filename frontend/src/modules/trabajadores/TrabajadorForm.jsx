import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { AuthAPI } from '../../services/authAPI'
import { SupabaseAPI, supabase } from '../../services/supabase'
import { apiClient } from '../../services/apiClient'
import {
  ArrowLeft, Save, User, Briefcase, AlertCircle,
  CheckCircle, XCircle, Building2, Clock, MapPin, UserCheck, X,
  CreditCard, Shield, Home,
} from 'lucide-react'

/*
 * SQL para agregar columnas de honorarios (ejecutar manualmente en Supabase):
 * ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS monto_honorarios numeric;
 * ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS monto_boleta_bruto numeric;
 * ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS tipo_boleta text;
 * ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS frecuencia_pago text;
 * ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS descripcion_servicio text;
 */
/* ── Constantes ────────────────────────────────────────────────────── */
const AFP_TASAS = {
  Capital: 10.44, Cuprum: 10.58, Habitat: 10.27,
  Modelo: 10.58, PlanVital: 10.58, ProVida: 10.58, Uno: 10.49,
}

const REGIONES_CHILE = [
  'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo',
  'Valparaíso', 'Metropolitana de Santiago',
  "Libertador General Bernardo O'Higgins",
  'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos',
  'Aysén del General Carlos Ibáñez del Campo',
  'Magallanes y de la Antártica Chilena',
]

const BANCOS_CHILE = [
  'BancoEstado', 'Santander', 'BCI', 'Scotiabank', 'Itaú',
  'BICE', 'Falabella', 'Ripley', 'Consorcio', 'Security', 'Otro',
]

/* ── Helpers visuales ──────────────────────────────────────────────── */
function Section({ icon: Icon, title, badge, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {badge && <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      {children}
    </div>
  )
}


function validarRut(rut) {
  const clean = rut.replace(/[.\-\s]/g, '').toUpperCase()
  if (clean.length < 2) return null
  const body = clean.slice(0, -1)
  const dv   = clean.slice(-1)
  if (!/^\d+$/.test(body)) return false
  let sum = 0, mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const expected = 11 - (sum % 11)
  const dvCalc = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected)
  return dv === dvCalc
}

/* ── Formulario principal ──────────────────────────────────────────── */
export default function TrabajadorForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { trabajadores, addTrabajador, updateTrabajador } = useApp()
  const { user } = useAuth()
  const isEdit = Boolean(id)
  const existing = isEdit ? trabajadores.find((t) => t.id === id) : null

  const [form, setForm] = useState({
    // Sección 1 — Datos Personales
    nombres: '', apellidos: '', rut: '',
    fechaNacimiento: '', nacionalidad: 'Chilena', estadoCivil: 'soltero',
    tipoDocumento: 'RUT', numeroDocumento: '', fechaVencimientoVisa: '',
    // Sección 2 — Contacto y Dirección
    email: '', telefono: '',
    direccion: '', numero: '', comuna: '', ciudad: '', region: '',
    // Sección 3 — Datos Laborales
    cargo: '', fechaIngreso: new Date().toISOString().split('T')[0],
    tipoContrato: 'indefinido', sueldo: '', sueldoMinimo: '539000', estado: 'activo',
    // Sección 4 — Previsión Social
    afp: 'Habitat', porcentajeAfp: '10.27', previsionSalud: 'Fonasa',
    isapre: '', montoIsapre: '',
    bonoFijo: '0', colacion: '0', movilizacion: '0',
    // Sección 5 — Datos Bancarios
    banco: '', tipoCuenta: '', numeroCuenta: '',
    // Honorarios
    montoHonorarios: '',
  })

  const [puntos,               setPuntos]               = useState([])
  const [puntoTrabajoId,       setPuntoTrabajoId]       = useState(null)
  const [cuentaGastosId,       setCuentaGastosId]       = useState('')
  const [cuentasBancarias,     setCuentasBancarias]     = useState([])
  const [rutStatus,            setRutStatus]            = useState(null)
  const [errors,               setErrors]               = useState({})
  const [saving,               setSaving]               = useState(false)
  const [saveError,            setSaveError]            = useState(null)
  const [usuarioId,            setUsuarioId]            = useState(null)
  const [usuarioVinculado,     setUsuarioVinculado]     = useState(null)
  const [usuariosSinVincular,  setUsuariosSinVincular]  = useState([])
  const [loadingUsuarios,      setLoadingUsuarios]      = useState(false)

  const DIAS = [
    { key: 'lunes',     label: 'Lunes',     short: 'L' },
    { key: 'martes',    label: 'Martes',    short: 'M' },
    { key: 'miercoles', label: 'Miércoles', short: 'X' },
    { key: 'jueves',    label: 'Jueves',    short: 'J' },
    { key: 'viernes',   label: 'Viernes',   short: 'V' },
    { key: 'sabado',    label: 'Sábado',    short: 'S' },
    { key: 'domingo',   label: 'Domingo',   short: 'D' },
  ]
  const [horario, setHorario] = useState({
    lunes: true,    lunesEntrada: '08:00',    lunesSalida: '18:00',
    martes: true,   martesEntrada: '08:00',   martesSalida: '18:00',
    miercoles: true, miercolesEntrada: '08:00', miercolesSalida: '18:00',
    jueves: true,   juevesEntrada: '08:00',   juevesSalida: '18:00',
    viernes: true,  viernesEntrada: '08:00',  viernesSalida: '18:00',
    sabado: false,  sabadoEntrada: '08:00',   sabadoSalida: '13:00',
    domingo: false, domingoEntrada: '08:00',  domingoSalida: '13:00',
    minutosColacion: 60,
  })

  useEffect(() => {
    apiClient.get('/puntos-trabajo')
      .then((list) => setPuntos(list.filter((p) => p.activo)))
      .catch(() => setPuntos([]))

    const eId = user?.empresa_id ?? user?.empresa?.id
    if (eId) {
      supabase.from('cuentas_bancarias')
        .select('id, nombre, banco')
        .eq('empresa_id', eId)
        .eq('activa', true)
        .order('nombre')
        .then(({ data }) => setCuentasBancarias(data || []))
        .catch(() => setCuentasBancarias([]))
    }

    if (!isEdit && (user?.empresa_id ?? user?.empresa?.id)) {
      setLoadingUsuarios(true)
      apiClient.get('/usuarios/sin-trabajador')
        .then(setUsuariosSinVincular)
        .catch(() => setUsuariosSinVincular([]))
        .finally(() => setLoadingUsuarios(false))
    }
  }, [])

  useEffect(() => {
    if (!existing?.id) return
    if (!existing?.nombre) return

    setUsuarioId(existing.usuarioId ?? null)
    setCuentaGastosId(existing.cuentaGastosId ?? '')
    const fullNombre = (existing.nombre || '').trim()
    const firstSpace = fullNombre.indexOf(' ')
    const nombres   = firstSpace === -1 ? fullNombre : fullNombre.slice(0, firstSpace)
    const apellidos = firstSpace === -1 ? '' : fullNombre.slice(firstSpace + 1).trim()
    const telDigits = String(existing.telefono ?? '').replace(/\D/g, '')
    const tel8 = telDigits.startsWith('569') ? telDigits.slice(3)
               : telDigits.startsWith('56')  ? telDigits.slice(2)
               : telDigits

    setForm({
      ...existing,
      nombres, apellidos,
      telefono:            tel8.slice(0, 8),
      sueldo:              String(existing.sueldo ?? ''),
      sueldoMinimo:        String(existing.sueldoMinimo ?? 539000),
      porcentajeAfp:       String(existing.porcentajeAfp ?? 10.27),
      montoIsapre:         String(existing.montoIsapre ?? ''),
      bonoFijo:            String(existing.bonoFijo ?? 0),
      colacion:            String(existing.colacion ?? 0),
      movilizacion:        String(existing.movilizacion ?? 0),
      fechaNacimiento:     existing.fechaNacimiento     ?? '',
      nacionalidad:        existing.nacionalidad        ?? 'Chilena',
      estadoCivil:         existing.estadoCivil         ?? 'soltero',
      tipoDocumento:       existing.tipoDocumento       ?? 'RUT',
      numeroDocumento:     existing.numeroDocumento     ?? '',
      fechaVencimientoVisa: existing.fechaVencimientoVisa ?? '',
      direccion:           existing.direccion           ?? '',
      numero:              existing.numero              ?? '',
      comuna:              existing.comuna              ?? '',
      ciudad:              existing.ciudad              ?? '',
      region:              existing.region              ?? '',
      tipoContrato:        existing.tipoContrato        ?? 'indefinido',
      afp:                 existing.afp                 ?? 'Habitat',
      previsionSalud:      existing.previsionSalud      ?? 'Fonasa',
      isapre:              existing.isapre              ?? '',
      banco:               existing.banco               ?? '',
      tipoCuenta:          existing.tipoCuenta          ?? '',
      numeroCuenta:        existing.numeroCuenta        ?? '',
      montoHonorarios:     String(existing.montoHonorarios ?? ''),
    })
    if (existing.rut) setRutStatus(validarRut(existing.rut))
    SupabaseAPI.getHorario(existing.id).then((h) => { if (h) setHorario(h) })
    SupabaseAPI.getAsignacionActiva(existing.id)
      .then((a) => setPuntoTrabajoId(a?.punto_trabajo_id ?? null))
      .catch(() => setPuntoTrabajoId(null))
  }, [existing?.id, existing?.nombre, existing?.puedeRemuneraciones, existing?.puedeFacturas, existing?.puedeProductos,
      existing?.direccion, existing?.numero, existing?.comuna, existing?.ciudad, existing?.region])

  const setH = (field, value) => setHorario((p) => ({ ...p, [field]: value }))

  const calcHorasDia = (key) => {
    const entrada = horario[`${key}Entrada`]
    const salida  = horario[`${key}Salida`]
    if (!entrada || !salida) return 0
    const [eh, em] = entrada.split(':').map(Number)
    const [sh, sm] = salida.split(':').map(Number)
    return Math.max(0, ((sh * 60 + sm) - (eh * 60 + em) - Number(horario.minutosColacion)) / 60)
  }

  const { diasSemana, horasSemanales } = useMemo(() => {
    const ds = DIAS.filter((d) => horario[d.key]).length
    const hs = DIAS.reduce((acc, d) => acc + (horario[d.key] ? calcHorasDia(d.key) : 0), 0)
    return { diasSemana: ds, horasSemanales: +hs.toFixed(1) }
  }, [horario])

  const set = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
  }

  const handleRut = (raw) => {
    set('rut', raw)
    const result = validarRut(raw)
    setRutStatus(raw.length < 2 ? null : result)
  }

  const handleTelefono = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 8)
    set('telefono', digits)
  }

  const handleAfpChange = (afp) => {
    setForm((p) => ({ ...p, afp, porcentajeAfp: String(AFP_TASAS[afp] ?? 10.27) }))
  }

  const esHonorarios = form.tipoContrato === 'honorarios'

  const validate = () => {
    const e = {}
    if (!form.nombres.trim()) e.nombres = 'El nombre es obligatorio'
    if (!form.rut.trim())     e.rut     = 'El RUT es obligatorio'
    else if (rutStatus === false) e.rut = 'RUT inválido'
    if (!form.cargo.trim())   e.cargo   = 'El cargo es obligatorio'
    if (!esHonorarios && (!form.sueldo || Number(form.sueldo) <= 0)) e.sueldo = 'El sueldo debe ser mayor a 0'
    if (form.telefono && form.telefono.replace(/\D/g, '').length !== 8) {
      e.telefono = 'El teléfono debe tener 8 dígitos'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSaveError(null)
    try {
      const nombreCompleto = `${form.nombres.trim()} ${form.apellidos.trim()}`.trim()
      const {
        nombres: _n, apellidos: _a,
        appActiva: _aa, puedeCotizar: _pc, puedeOC: _poc, puedeRRHH: _prrhh,
        puedeFinanzas: _pf, puedeProyectos: _pp, puedeAsesoria: _pa,
        puedeRemuneraciones: _pre, puedeFacturas: _pfac, puedeVisitas: _pv,
        puedeProductos: _pprod, puedeMarcaciones: _pm, puedeVacaciones: _pvac,
        puedeGastos: _pg, puedePlanificacion: _pplan,
        puedeTrabajadores: _pt, puedeVisitasApp: _pva,
        ...rest
      } = form
      const data = {
        ...rest,
        nombre:       nombreCompleto,
        sueldo:       Number(form.sueldo),
        sueldoMinimo: Number(form.sueldoMinimo) || 539000,
        porcentajeAfp: Number(form.porcentajeAfp) || 10.27,
        montoIsapre:  Number(form.montoIsapre) || 0,
        bonoFijo:     Number(form.bonoFijo) || 0,
        colacion:     Number(form.colacion) || 0,
        movilizacion: Number(form.movilizacion) || 0,
        usuario_id:   usuarioId ?? null,
        cuentaGastosId: cuentaGastosId || null,
      }

      let trabajadorId
      if (isEdit) {
        await updateTrabajador(id, data)
        trabajadorId = id
      } else {
        const nuevo = addTrabajador(data)
        trabajadorId = nuevo.id
      }
      await Promise.all([
        AuthAPI.sincronizarUsuarioTrabajador(trabajadorId, {
          rut:       form.rut,
          nombre:    nombreCompleto,
          email:     form.email,
          appActiva: form.appActiva,
          empresaId: user?.empresa_id ?? user?.empresa?.id,
        }),
        SupabaseAPI.upsertHorario(
          { ...horario, trabajadorId },
          user?.empresa_id ?? user?.empresa?.id,
        ),
        SupabaseAPI.setAsignacionTrabajador(trabajadorId, puntoTrabajoId),
      ])
      navigate('/trabajadores')
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const telefonoDisplay = form.telefono ? `+569 ${form.telefono}` : ''

  return (
    <div className="w-full space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/trabajadores')} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isEdit ? `Editar ${existing?.nombre}` : 'Nuevo Trabajador'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isEdit ? 'Actualiza los datos del trabajador' : 'Registra un nuevo trabajador en el sistema'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Empresa asociada (solo edición) */}
        {isEdit && user?.empresa && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-700">Empresa Asociada</h3>
              <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Razón social</p>
                <p className="text-sm font-medium text-slate-800">{user.empresa.nombre}</p>
              </div>
              {user.empresa.nombreFantasia && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Nombre fantasía</p>
                  <p className="text-sm text-slate-700">{user.empresa.nombreFantasia}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400 mb-0.5">RUT empresa</p>
                <p className="text-sm font-mono text-slate-700">{user.empresa.rut}</p>
              </div>
              {user.empresa.giro && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Giro</p>
                  <p className="text-sm text-slate-700">{user.empresa.giro}</p>
                </div>
              )}
              {user.empresa.direccion && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 mb-0.5">Dirección</p>
                  <p className="text-sm text-slate-700">
                    {[user.empresa.direccion, user.empresa.comuna, user.empresa.ciudad].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vincular usuario existente (solo al crear) */}
        {!isEdit && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-700">Vincular usuario existente</h3>
              <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Opcional</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Si el trabajador ya tiene una cuenta en el sistema, selecciónala para vincularla y autocompletar sus datos.
            </p>
            {loadingUsuarios ? (
              <p className="text-xs text-slate-400">Cargando usuarios disponibles...</p>
            ) : usuarioId ? (
              <div className="flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-indigo-800 truncate">
                      {usuariosSinVincular.find(u => u.id === usuarioId)?.nombre ?? usuarioId}
                    </p>
                    <p className="text-xs text-indigo-400 truncate">
                      {usuariosSinVincular.find(u => u.id === usuarioId)?.email ?? ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setUsuarioId(null); setUsuarioVinculado(null) }}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors font-medium shrink-0 ml-3"
                >
                  <X className="w-3.5 h-3.5" />Sin vincular
                </button>
              </div>
            ) : usuariosSinVincular.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay usuarios disponibles para vincular.</p>
            ) : (
              <select
                value=""
                onChange={(e) => {
                  const u = usuariosSinVincular.find(u => u.id === e.target.value)
                  if (!u) return
                  setUsuarioId(u.id); setUsuarioVinculado(u)
                  const firstSpace = u.nombre.indexOf(' ')
                  const nombresFromCombined   = firstSpace === -1 ? u.nombre : u.nombre.slice(0, firstSpace)
                  const apellidosFromCombined = firstSpace === -1 ? ''       : u.nombre.slice(firstSpace + 1).trim()
                  const telDigits = String(u.telefono ?? '').replace(/\D/g, '')
                  const tel8 = telDigits.startsWith('569') ? telDigits.slice(3)
                             : telDigits.startsWith('56')  ? telDigits.slice(2)
                             : telDigits
                  setForm(prev => ({
                    ...prev,
                    nombres:   u.nombres   || nombresFromCombined || prev.nombres,
                    apellidos: u.apellidos || apellidosFromCombined || prev.apellidos,
                    email:     u.email     || prev.email,
                    rut:       u.rut       || prev.rut,
                    telefono:  tel8.slice(0, 8) || prev.telefono,
                    cargo:     u.cargo || prev.cargo,
                  }))
                  if (u.rut) setRutStatus(validarRut(u.rut))
                }}
                className="input-base"
              >
                <option value="" disabled>Seleccionar usuario...</option>
                {usuariosSinVincular.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}{u.email ? ` — ${u.email}` : ''}{u.rol ? ` (${u.rol})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* ── SECCIÓN 1: Datos Personales ───────────────────────────── */}
        <Section icon={User} title="Datos Personales">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">Nombres *</label>
              <input
                value={form.nombres}
                onChange={(e) => !usuarioVinculado && set('nombres', e.target.value)}
                readOnly={!!usuarioVinculado}
                placeholder="Juan"
                className={`input-base ${errors.nombres ? 'border-red-400' : ''} ${usuarioVinculado ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
              />
              {errors.nombres && <p className="text-xs text-red-500 mt-1">{errors.nombres}</p>}
            </div>

            <div>
              <label className="label-base">Apellidos</label>
              <input
                value={form.apellidos}
                onChange={(e) => !usuarioVinculado && set('apellidos', e.target.value)}
                readOnly={!!usuarioVinculado}
                placeholder="Pérez González"
                className={`input-base ${usuarioVinculado ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
              />
            </div>

            <div>
              <label className="label-base">RUT *</label>
              <div className="relative">
                <input
                  value={form.rut}
                  onChange={(e) => !usuarioVinculado && handleRut(e.target.value)}
                  readOnly={!!usuarioVinculado}
                  placeholder="12.345.678-9"
                  className={`input-base pr-8 ${
                    errors.rut ? 'border-red-400' :
                    rutStatus === true  ? 'border-emerald-400' :
                    rutStatus === false ? 'border-red-400' : ''
                  } ${usuarioVinculado ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
                />
                {rutStatus === true  && <CheckCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" />}
                {rutStatus === false && <XCircle     className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 pointer-events-none" />}
              </div>
              {errors.rut
                ? <p className="text-xs text-red-500 mt-1">{errors.rut}</p>
                : rutStatus === false ? <p className="text-xs text-red-400 mt-1">RUT inválido</p>
                : rutStatus === true  ? <p className="text-xs text-emerald-600 mt-1">RUT válido</p>
                : null}
            </div>

            <div>
              <label className="label-base">Fecha de nacimiento</label>
              <input
                type="date"
                value={form.fechaNacimiento}
                onChange={(e) => set('fechaNacimiento', e.target.value)}
                className="input-base"
              />
            </div>

            <div>
              <label className="label-base">Nacionalidad</label>
              <input
                value={form.nacionalidad}
                onChange={(e) => set('nacionalidad', e.target.value)}
                placeholder="Chilena"
                className="input-base"
              />
            </div>

            <div>
              <label className="label-base">Estado civil</label>
              <select value={form.estadoCivil} onChange={(e) => set('estadoCivil', e.target.value)} className="input-base">
                <option value="soltero">Soltero/a</option>
                <option value="casado">Casado/a</option>
                <option value="conviviente">Conviviente civil</option>
                <option value="divorciado">Divorciado/a</option>
                <option value="viudo">Viudo/a</option>
              </select>
            </div>

            <div>
              <label className="label-base">Tipo de documento</label>
              <select value={form.tipoDocumento} onChange={(e) => set('tipoDocumento', e.target.value)} className="input-base">
                <option value="RUT">RUT</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="DNI extranjero">DNI extranjero</option>
              </select>
            </div>

            {form.tipoDocumento !== 'RUT' && (
              <div>
                <label className="label-base">Número de documento</label>
                <input
                  value={form.numeroDocumento}
                  onChange={(e) => set('numeroDocumento', e.target.value)}
                  placeholder="Número de documento"
                  className="input-base"
                />
              </div>
            )}

            {form.nacionalidad !== 'Chilena' && (
              <div>
                <label className="label-base">Vencimiento visa</label>
                <input
                  type="date"
                  value={form.fechaVencimientoVisa}
                  onChange={(e) => set('fechaVencimientoVisa', e.target.value)}
                  className="input-base"
                />
              </div>
            )}
          </div>

          {usuarioVinculado && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-600">
                Datos del usuario vinculado. Para modificarlos ve a{' '}
                <strong>Usuarios → editar usuario</strong>.
              </p>
            </div>
          )}
        </Section>

        {/* ── SECCIÓN 2: Contacto y Dirección ─────────────────────── */}
        <Section icon={Home} title="Contacto y Dirección">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => !usuarioVinculado && set('email', e.target.value)}
                readOnly={!!usuarioVinculado}
                placeholder="juan.perez@correo.com"
                className={`input-base ${usuarioVinculado ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
              />
            </div>

            <div>
              <label className="label-base">Teléfono</label>
              <div className="flex">
                <span className="flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-sm text-slate-500 select-none whitespace-nowrap">
                  +569
                </span>
                <input
                  value={form.telefono}
                  onChange={(e) => !(usuarioVinculado?.telefono) && handleTelefono(e.target.value)}
                  readOnly={!!(usuarioVinculado?.telefono)}
                  placeholder="12345678"
                  maxLength={8}
                  className={`input-base rounded-l-none ${errors.telefono ? 'border-red-400' : ''} ${usuarioVinculado?.telefono ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
                />
              </div>
              {errors.telefono
                ? <p className="text-xs text-red-500 mt-1">{errors.telefono}</p>
                : telefonoDisplay && <p className="text-xs text-slate-400 mt-1">Se guardará como {telefonoDisplay}</p>}
            </div>

            <div className="col-span-2 grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="label-base">Dirección</label>
                <input
                  value={form.direccion}
                  onChange={(e) => set('direccion', e.target.value)}
                  placeholder="Av. Principal"
                  className="input-base"
                />
              </div>
              <div>
                <label className="label-base">Número</label>
                <input
                  value={form.numero}
                  onChange={(e) => set('numero', e.target.value)}
                  placeholder="1234"
                  className="input-base"
                />
              </div>
            </div>

            <div>
              <label className="label-base">Comuna</label>
              <input
                value={form.comuna}
                onChange={(e) => set('comuna', e.target.value)}
                placeholder="Las Condes"
                className="input-base"
              />
            </div>

            <div>
              <label className="label-base">Ciudad</label>
              <input
                value={form.ciudad}
                onChange={(e) => set('ciudad', e.target.value)}
                placeholder="Santiago"
                className="input-base"
              />
            </div>

            <div className="col-span-2">
              <label className="label-base">Región</label>
              <select value={form.region} onChange={(e) => set('region', e.target.value)} className="input-base">
                <option value="">Seleccionar región...</option>
                {REGIONES_CHILE.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* ── SECCIÓN 3: Datos Laborales ──────────────────────────── */}
        {esHonorarios && (
          <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', padding: '12px' }}>
            <p style={{ fontSize: '13px', color: '#854d0e', margin: 0 }}>
              ⚠️ Trabajador con boleta de honorarios — Los campos de remuneraciones y previsión social no aplican para este tipo de contrato.
            </p>
          </div>
        )}
        <Section icon={Briefcase} title="Datos Laborales">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">Cargo *</label>
              <input
                value={form.cargo}
                onChange={(e) => set('cargo', e.target.value)}
                placeholder="Vendedor, Técnico, Administrativo..."
                className={`input-base ${errors.cargo ? 'border-red-400' : ''}`}
              />
              {errors.cargo && <p className="text-xs text-red-500 mt-1">{errors.cargo}</p>}
            </div>

            <div>
              <label className="label-base">Fecha de ingreso</label>
              <input
                type="date"
                value={form.fechaIngreso}
                onChange={(e) => set('fechaIngreso', e.target.value)}
                className="input-base"
              />
            </div>

            <div>
              <label className="label-base">Tipo de contrato</label>
              <select value={form.tipoContrato} onChange={(e) => set('tipoContrato', e.target.value)} className="input-base">
                <option value="indefinido">Indefinido</option>
                <option value="plazo_fijo">Plazo fijo</option>
                <option value="obra">Por obra o faena</option>
                <option value="honorarios">Boleta de honorarios</option>
              </select>
            </div>

            <div>
              <label className="label-base" title="Monto líquido mensual pactado con el trabajador">
                Sueldo líquido acordado *
              </label>
              <input
                type="number"
                value={form.sueldo}
                onChange={(e) => set('sueldo', e.target.value)}
                placeholder="650000"
                disabled={esHonorarios}
                className={`input-base ${errors.sueldo ? 'border-red-400' : ''} ${esHonorarios ? 'bg-slate-100 cursor-not-allowed text-slate-400' : ''}`}
              />
              {esHonorarios && <p className="text-xs text-slate-400 mt-1">No aplica — completar sección Honorarios</p>}
              {!esHonorarios && errors.sueldo && <p className="text-xs text-red-500 mt-1">{errors.sueldo}</p>}
            </div>

            {!esHonorarios && (
            <div>
              <label className="label-base">Sueldo mínimo legal vigente</label>
              <input
                type="number"
                value={form.sueldoMinimo}
                onChange={(e) => set('sueldoMinimo', e.target.value)}
                placeholder="539000"
                className="input-base"
              />
              <p className="text-xs text-slate-400 mt-1">Ingreso Mínimo Mensual Chile vigente. Actualizar cuando cambie por ley.</p>
            </div>
            )}

            <div>
              <label className="label-base">Bono fijo mensual</label>
              <input
                type="number"
                value={form.bonoFijo}
                onChange={(e) => set('bonoFijo', e.target.value)}
                placeholder="0"
                disabled={esHonorarios}
                className={`input-base ${esHonorarios ? 'bg-slate-100 cursor-not-allowed text-slate-400' : ''}`}
              />
            </div>

            <div>
              <label className="label-base">Colación</label>
              <input type="number" value={form.colacion} onChange={(e) => set('colacion', e.target.value)} placeholder="0" disabled={esHonorarios} className={`input-base ${esHonorarios ? 'bg-slate-100 cursor-not-allowed text-slate-400' : ''}`} />
            </div>

            <div>
              <label className="label-base">Movilización</label>
              <input type="number" value={form.movilizacion} onChange={(e) => set('movilizacion', e.target.value)} placeholder="0" disabled={esHonorarios} className={`input-base ${esHonorarios ? 'bg-slate-100 cursor-not-allowed text-slate-400' : ''}`} />
            </div>

            {isEdit && (
              <div>
                <label className="label-base">Estado</label>
                <select value={form.estado} onChange={(e) => set('estado', e.target.value)} className="input-base">
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
            )}
          </div>
        </Section>

        {/* ── SECCIÓN Honorarios (solo cuando tipoContrato = honorarios) ── */}
        {esHonorarios && (
          <Section icon={Briefcase} title="Honorarios">
            <div>
              <label className="label-base">Monto de honorarios</label>
              <input
                type="number"
                value={form.montoHonorarios}
                onChange={(e) => set('montoHonorarios', e.target.value)}
                placeholder="0"
                className="input-base"
              />
              <p className="text-xs text-slate-400 mt-1">Monto acordado a pagar</p>
            </div>
          </Section>
        )}

        {/* ── SECCIÓN 4: Previsión Social ─────────────────────────── */}
        <Section icon={Shield} title="Previsión Social">
          <div className={`grid grid-cols-2 gap-4${esHonorarios ? ' opacity-50 pointer-events-none' : ''}`}>
            <div>
              <label className="label-base">AFP</label>
              <select value={form.afp} onChange={(e) => handleAfpChange(e.target.value)} className="input-base">
                {Object.keys(AFP_TASAS).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div>
              <label className="label-base">Tasa AFP (%)</label>
              <input
                type="number"
                step="0.01"
                value={form.porcentajeAfp}
                onChange={(e) => set('porcentajeAfp', e.target.value)}
                className="input-base"
              />
              <p className="text-xs text-slate-400 mt-1">Se autocompleta al seleccionar AFP</p>
            </div>

            <div>
              <label className="label-base">Previsión de salud</label>
              <select value={form.previsionSalud} onChange={(e) => set('previsionSalud', e.target.value)} className="input-base">
                <option value="Fonasa">Fonasa (7%)</option>
                <option value="Isapre">Isapre</option>
              </select>
            </div>

            {form.previsionSalud === 'Isapre' ? (
              <>
                <div>
                  <label className="label-base">Nombre Isapre</label>
                  <input
                    value={form.isapre}
                    onChange={(e) => set('isapre', e.target.value)}
                    placeholder="Banmédica, Colmena..."
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="label-base">Monto Isapre (mensual $)</label>
                  <input
                    type="number"
                    value={form.montoIsapre}
                    onChange={(e) => set('montoIsapre', e.target.value)}
                    placeholder="0"
                    className="input-base"
                  />
                </div>
              </>
            ) : (
              <div className="flex items-end pb-1">
                <p className="text-sm text-slate-500">Fonasa: descuento fijo 7% del total imponible</p>
              </div>
            )}

            <div className="col-span-2">
              <p className="text-xs text-slate-400">
                Seguro de cesantía: {form.tipoContrato === 'indefinido' ? '0,6% trabajador + 2,4% empleador' : '3,0% empleador (plazo fijo/obra)'} — calculado automáticamente
              </p>
            </div>
          </div>
        </Section>

        {/* ── SECCIÓN 5: Datos Bancarios ──────────────────────────── */}
        <Section icon={CreditCard} title="Datos Bancarios">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">Banco</label>
              <select value={form.banco} onChange={(e) => set('banco', e.target.value)} className="input-base">
                <option value="">Seleccionar banco...</option>
                {BANCOS_CHILE.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div>
              <label className="label-base">Tipo de cuenta</label>
              <select value={form.tipoCuenta} onChange={(e) => set('tipoCuenta', e.target.value)} className="input-base">
                <option value="">Seleccionar tipo...</option>
                <option value="corriente">Cuenta corriente</option>
                <option value="vista">Cuenta vista</option>
                <option value="ahorro">Cuenta de ahorro</option>
                <option value="rut">Cuenta RUT</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="label-base">Número de cuenta</label>
              <input
                value={form.numeroCuenta}
                onChange={(e) => set('numeroCuenta', e.target.value)}
                placeholder="00000000000"
                className="input-base"
              />
            </div>
          </div>
        </Section>

        {/* ── SECCIÓN: Cuenta de Gastos ───────────────────────────── */}
        <Section icon={CreditCard} title="Cuenta de Gastos">
          <p className="text-xs text-slate-400 -mt-2 mb-3">
            Cuenta bancaria de la empresa asociada a los gastos de este trabajador
          </p>
          <select
            value={cuentaGastosId}
            onChange={(e) => setCuentaGastosId(e.target.value)}
            className="input-base"
          >
            <option value="">Sin cuenta asignada</option>
            {cuentasBancarias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} — {c.banco}</option>
            ))}
          </select>
        </Section>

        {/* Punto de Trabajo */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Punto de Trabajo</h3>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Lugar donde el trabajador debe marcar asistencia. La geocerca se valida con este punto.
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setPuntoTrabajoId(null)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                puntoTrabajoId === null ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-slate-700">Sin punto asignado</div>
                <div className="text-xs text-slate-400">El trabajador no tendrá validación de geocerca</div>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 ${puntoTrabajoId === null ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`} />
            </button>
            {puntos.map((p) => {
              const active = puntoTrabajoId === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPuntoTrabajoId(p.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    active ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{p.nombreLugar}</div>
                    <div className="text-xs text-slate-400 truncate">{p.direccion}</div>
                    <div className="text-xs text-slate-300">Radio {p.radioPermitidoMetros} m</div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 ${active ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`} />
                </button>
              )
            })}
            {puntos.length === 0 && (
              <p className="text-xs text-slate-400 italic">No hay puntos de trabajo registrados aún.</p>
            )}
          </div>
        </div>

        {/* Horario de Trabajo */}
        <div className={`card p-5${esHonorarios ? ' opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Horario de Trabajo</h3>
          </div>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs text-slate-400 font-medium pb-2 w-28">Día</th>
                  <th className="text-center text-xs text-slate-400 font-medium pb-2 w-12">Activo</th>
                  <th className="text-left text-xs text-slate-400 font-medium pb-2 pl-3">Entrada</th>
                  <th className="text-left text-xs text-slate-400 font-medium pb-2 pl-3">Salida</th>
                  <th className="text-right text-xs text-slate-400 font-medium pb-2">Horas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {DIAS.map((d) => {
                  const activo = horario[d.key]
                  const horas  = calcHorasDia(d.key)
                  return (
                    <tr key={d.key}>
                      <td className="py-2">
                        <button type="button" onClick={() => setH(d.key, !activo)}
                          className="flex items-center gap-2 text-xs font-medium text-slate-800">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${activo ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {d.short}
                          </span>
                          {d.label}
                        </button>
                      </td>
                      <td className="py-2 text-center">
                        <button type="button" onClick={() => setH(d.key, !activo)}
                          className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${activo ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                        </button>
                      </td>
                      <td className="py-2 pl-3">
                        <input type="time" value={horario[`${d.key}Entrada`]}
                          onChange={(e) => setH(`${d.key}Entrada`, e.target.value)}
                          disabled={!activo}
                          className="input-base py-1 text-sm w-32 disabled:opacity-40 disabled:cursor-not-allowed" />
                      </td>
                      <td className="py-2 pl-3">
                        <input type="time" value={horario[`${d.key}Salida`]}
                          onChange={(e) => setH(`${d.key}Salida`, e.target.value)}
                          disabled={!activo}
                          className="input-base py-1 text-sm w-32 disabled:opacity-40 disabled:cursor-not-allowed" />
                      </td>
                      <td className="py-2 text-right">
                        <span className={`text-xs font-semibold ${activo ? 'text-indigo-600' : 'text-slate-300'}`}>
                          {activo ? `${horas.toFixed(1)} h` : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 mb-4">
            <label className="text-xs text-slate-500 shrink-0">Tiempo de colación</label>
            <input
              type="number" min="0" max="120"
              value={horario.minutosColacion}
              onChange={(e) => setH('minutosColacion', Number(e.target.value))}
              className="input-base py-1 text-sm w-24"
            />
            <span className="text-xs text-slate-400">minutos (se descuenta de todos los días)</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100">
              <span className="text-xs text-slate-500">Días/semana</span>
              <span className="text-sm font-bold text-slate-700">{diasSemana}</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${horasSemanales <= 42 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <span className={`text-xs ${horasSemanales <= 42 ? 'text-emerald-600' : 'text-amber-600'}`}>Horas semanales</span>
              <span className={`text-sm font-bold ${horasSemanales <= 42 ? 'text-emerald-700' : 'text-amber-700'}`}>{horasSemanales} h</span>
              {horasSemanales > 42 && <span className="text-xs text-amber-500">↑ sobre 42h</span>}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50">
              <span className="text-xs text-indigo-500">Horas mensuales (~)</span>
              <span className="text-sm font-bold text-indigo-700">{+(horasSemanales * 4.33).toFixed(0)} h</span>
            </div>
          </div>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {saveError}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate('/trabajadores')} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Trabajador'}
          </button>
        </div>
      </form>
    </div>
  )
}
