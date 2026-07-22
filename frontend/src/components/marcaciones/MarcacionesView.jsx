import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../modules/auth/AuthContext'
import { supabase } from '../../services/supabase'
import { RefreshCw, Download, Pencil, FileText, XCircle } from 'lucide-react'

// ── Timezone helpers ──────────────────────────────────────────────────────────
const TZ = 'America/Santiago'
const FMT_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })
const FMT_HORA = new Intl.DateTimeFormat('es-CL', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
})

function fechaChile(isoUtc) {
  return FMT_DATE.format(new Date(isoUtc))
}

function fmtHora(isoUtc) {
  if (!isoUtc) return null
  return FMT_HORA.format(new Date(isoUtc))
}

function fmtHHMM(min) {
  if (min == null) return '—'
  const abs = Math.abs(Math.round(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function getMeses() {
  const ahora = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    return { val, label: label.charAt(0).toUpperCase() + label.slice(1) }
  })
}

const DIAS_KEY    = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const DIAS_NOMBRE = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const ESTADO_CFG = {
  completo:      { label: 'Completo',      cls: 'bg-emerald-100 text-emerald-700' },
  sin_salida:    { label: 'Sin salida',    cls: 'bg-amber-100 text-amber-700'     },
  sin_colacion:  { label: 'Sin colación',  cls: 'bg-blue-100 text-blue-700'       },
  incompleto:    { label: 'Incompleto',    cls: 'bg-red-100 text-red-700'         },
  sin_marcacion: { label: 'Sin marcación', cls: 'bg-slate-100 text-slate-400'     },
}

function calcMinTrab(reg, horario) {
  if (!reg?.entrada || !reg?.salida) return null
  let minCol
  if (reg.salidaColacion && reg.regresoColacion)
    minCol = (new Date(reg.regresoColacion) - new Date(reg.salidaColacion)) / 60000
  else
    minCol = reg.sinColacion ? 0 : (horario?.minutosColacion ?? 60)
  return Math.max(0, (new Date(reg.salida) - new Date(reg.entrada)) / 60000 - minCol)
}

function calcMinProg(horario, diaKey) {
  const laboral = horario ? !!horario[diaKey] : true
  if (!laboral) return null
  const entrada = horario?.[`${diaKey}Entrada`] || '07:00'
  const salida  = horario?.[`${diaKey}Salida`]  || '17:00'
  const [eh, em] = entrada.split(':').map(Number)
  const [sh, sm] = salida.split(':').map(Number)
  return Math.max(0, (sh * 60 + sm) - (eh * 60 + em) - (horario?.minutosColacion ?? 60))
}

function getEstado(reg, lab) {
  if (!reg?.entrada) return lab ? 'sin_marcacion' : null
  const tiene4 = reg.entrada && reg.salidaColacion && reg.regresoColacion && reg.salida
  if (tiene4 || (reg.sinColacion && reg.entrada && reg.salida)) return 'completo'
  if (reg.entrada && !reg.salida) return 'sin_salida'
  if (reg.entrada && reg.salida) return 'sin_colacion'
  return 'incompleto'
}

// ── Geofence: distancia entre dos puntos (Haversine) ─────────────────────────
function calcDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function distMarcacion(metaEntry, punto) {
  if (!metaEntry || metaEntry.lat == null || !punto || punto.latitud == null) return null
  return calcDistanciaMetros(metaEntry.lat, metaEntry.lon, punto.latitud, punto.longitud)
}

function esFueraRadio(metaEntry, punto) {
  const d = distMarcacion(metaEntry, punto)
  if (d == null) return false
  return d > (punto.radioPermitidoMetros || 100)
}

// ── Detección de marcaciones sospechosas ─────────────────────────────────────
const UMBRAL_SEGUNDOS = 30

function detectarSospechosas(reg) {
  if (!reg) return {}
  const sospechas = {}
  const tipos = ['entrada', 'salidaColacion', 'regresoColacion', 'salida']
  for (let i = 0; i < tipos.length - 1; i++) {
    const a = reg[tipos[i]]
    const b = reg[tipos[i + 1]]
    if (a && b) {
      const diffMs = Math.abs(new Date(b) - new Date(a))
      if (diffMs < UMBRAL_SEGUNDOS * 1000) {
        sospechas[tipos[i]]     = 'Marcación muy rápida — posible marca automática'
        sospechas[tipos[i + 1]] = 'Marcación muy rápida — posible marca automática'
      }
    }
  }
  if (reg.salidaColacion && reg.regresoColacion) {
    const minutos = (new Date(reg.regresoColacion) - new Date(reg.salidaColacion)) / 60000
    if (minutos < 10)  sospechas.salidaColacion  = 'Colación menor a 10 minutos'
    if (minutos > 180) sospechas.regresoColacion = 'Colación mayor a 3 horas'
  }
  return sospechas
}

// Chile UTC-4 (offset fijo, consistente con el backend)
function chileToUTC(fechaStr, horaStr) {
  const [h, m] = horaStr.split(':').map(Number)
  const date = new Date(fechaStr)
  date.setUTCHours(h + 4, m, 0, 0)
  return date.toISOString()
}

function BtnComentario({ metaEntry, onOpen }) {
  if (!metaEntry) return null
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(metaEntry.id) }}
      className="hover:opacity-70 transition-opacity"
      title={metaEntry.hasComment ? 'Editar comentario' : 'Agregar comentario'}
    >
      {metaEntry.hasComment
        ? <FileText className="w-2.5 h-2.5 text-orange-400" />
        : <Pencil className="w-2.5 h-2.5 text-slate-300" />}
    </button>
  )
}

export default function MarcacionesView() {
  const { trabajadores, horarios, puntosTrabajo } = useApp()
  const { user } = useAuth()

  const MESES = useMemo(() => getMeses(), [])

  const [mesStr,    setMesStr]    = useState(MESES[0].val)
  const [filTrabId, setFilTrabId] = useState('')
  const [loading,   setLoading]   = useState(true)
  const [marcData,  setMarcData]  = useState([])
  const [feriadosSet, setFeriadosSet] = useState(new Set())

  const [editComentario,  setEditComentario]  = useState(null)
  const [comentTexto,     setComentTexto]     = useState('')
  const [comentGuardando, setComentGuardando] = useState(false)
  const [comentToast,     setComentToast]     = useState(false)

  const [asignaciones, setAsignaciones] = useState([])
  const [geoModal,     setGeoModal]     = useState(null) // { fila, punto, entradaDist, salidaDist }

  const [vista,        setVista]        = useState('hoy')
  const [detalleModal, setDetalleModal] = useState(null)

  const [confirmModal,   setConfirmModal]   = useState(null)   // { trabajador, fecha, faltaReg }
  const [confirmTipo,    setConfirmTipo]    = useState('falta') // 'falta' | 'asistio' | 'vacacion'
  const [confirmObs,     setConfirmObs]     = useState('')
  const [confirmSaving,  setConfirmSaving]  = useState(false)
  const [actionToast,    setActionToast]    = useState(null)
  const [vacacionData,   setVacacionData]   = useState(null)   // null | [] | [solicitud]
  const [vacacionLoading,setVacacionLoading]= useState(false)

  const [editModal,     setEditModal]     = useState(null)   // { marcacionId, tipo, fecha, horaActual }
  const [editHora,      setEditHora]      = useState('')
  const [editMotivo,    setEditMotivo]    = useState('')
  const [editAutorizado,setEditAutorizado]= useState(false)
  const [editSaving,    setEditSaving]    = useState(false)

  const [agregarModal,     setAgregarModal]     = useState(null)  // { trabajador, fecha, tipo }
  const [agregarHora,      setAgregarHora]      = useState('')
  const [agregarMotivo,    setAgregarMotivo]    = useState('')
  const [agregarAutorizado,setAgregarAutorizado]= useState(false)
  const [agregarSaving,    setAgregarSaving]    = useState(false)

  const hoyStr = useMemo(() => FMT_DATE.format(new Date()), [])

  const trabActivos = useMemo(
    () => trabajadores.filter((t) => t.estado === 'activo'),
    [trabajadores],
  )

  const cargar = useCallback(async () => {
    const trabIds = trabActivos.map((t) => t.id)
    if (!trabIds.length) { setLoading(false); return }
    setLoading(true)
    try {
      const [anio, mes] = mesStr.split('-').map(Number)
      const primerDia    = new Date(anio, mes - 1, 1)
      const primerDiaSig = new Date(anio, mes, 1)
      const pad = (n) => String(n).padStart(2, '0')
      const pDStr  = `${anio}-${pad(mes)}-01`
      const pDSStr = `${primerDiaSig.getFullYear()}-${pad(primerDiaSig.getMonth() + 1)}-01`

      const [{ data: marcs }, { data: feriados }, { data: asigs }] = await Promise.all([
        supabase
          .from('marcaciones')
          .select('id, trabajador_id, tipo_marcacion, fecha_hora_servidor, observacion, comentario_admin, asistencia_confirmada, asistencia_observacion, latitud, longitud')
          .in('trabajador_id', trabIds)
          .gte('fecha_hora_servidor', primerDia.toISOString())
          .lt('fecha_hora_servidor',  primerDiaSig.toISOString())
          .order('fecha_hora_servidor', { ascending: true }),
        supabase.from('feriados').select('fecha')
          .gte('fecha', pDStr).lt('fecha', pDSStr)
          .or('empresa_id.is.null'),
        supabase.from('asignaciones_trabajo').select('trabajador_id, punto_trabajo_id')
          .in('trabajador_id', trabIds).eq('activo', true),
      ])

      setMarcData(marcs || [])
      setAsignaciones(asigs || [])
      setFeriadosSet(new Set((feriados || []).map((f) => f.fecha)))
    } catch (e) {
      console.error('[MarcacionesView]', e)
    } finally {
      setLoading(false)
    }
  }, [trabActivos, mesStr])

  useEffect(() => { cargar() }, [cargar])

  const { filas, resumenPorTrab } = useMemo(() => {
    const [anio, mes] = mesStr.split('-').map(Number)
    const primerDia   = new Date(anio, mes - 1, 1)
    const ultimoDia   = new Date(anio, mes, 0)
    const hoy = new Date(); hoy.setHours(23, 59, 59, 999)

    const byTrabFecha = {}
    marcData.forEach((m) => {
      const f = fechaChile(m.fecha_hora_servidor)
      if (!byTrabFecha[m.trabajador_id]) byTrabFecha[m.trabajador_id] = {}
      if (!byTrabFecha[m.trabajador_id][f])
        byTrabFecha[m.trabajador_id][f] = { _meta: {} }
      const reg = byTrabFecha[m.trabajador_id][f]
      if (m.tipo_marcacion === 'falta' || m.tipo_marcacion === 'vacacion') {
        reg.faltaReg = { id: m.id, tipo_marcacion: m.tipo_marcacion, asistencia_confirmada: m.asistencia_confirmada, asistencia_observacion: m.asistencia_observacion }
      } else {
        reg._meta[m.tipo_marcacion] = { id: m.id, hasComment: !!m.comentario_admin, lat: m.latitud, lon: m.longitud }
        if (m.tipo_marcacion === 'entrada')              reg.entrada         = m.fecha_hora_servidor
        else if (m.tipo_marcacion === 'salida')           reg.salida          = m.fecha_hora_servidor
        else if (m.tipo_marcacion === 'salida_colacion')  reg.salidaColacion  = m.fecha_hora_servidor
        else if (m.tipo_marcacion === 'regreso_colacion') reg.regresoColacion = m.fecha_hora_servidor
        if (m.observacion === 'sin_colacion') reg.sinColacion = true
      }
    })

    const filas = []
    const resumenPorTrab = {}

    trabActivos.forEach((t) => {
      const horario    = horarios[t.id] || null
      const trabFechas = byTrabFecha[t.id] || {}
      let totTrab = 0, totProg = 0, diasTrab = 0, diasLab = 0

      const cur = new Date(primerDia)
      while (cur <= ultimoDia) {
        if (cur > hoy) { cur.setDate(cur.getDate() + 1); continue }

        const fStr             = FMT_DATE.format(cur)
        const [fy, fm, fd]     = fStr.split('-').map(Number)
        const dow              = new Date(fy, fm - 1, fd).getDay()
        const diaKey           = DIAS_KEY[dow]
        const esFinde   = dow === 0 || dow === 6
        const esFeriado = feriadosSet.has(fStr)
        const lab = !esFinde && !esFeriado && (horario ? !!horario[diaKey] : true)
        const reg       = trabFechas[fStr] || null
        const tieneAlgo = !!reg?.entrada

        if (lab) diasLab++

        const minTrab = calcMinTrab(reg, horario)
        const minProg = lab ? calcMinProg(horario, diaKey) : null
        const diff    = minTrab != null && minProg != null ? minTrab - minProg : null
        const estado  = getEstado(reg, lab)

        if (lab && minTrab != null) diasTrab++
        if (minTrab) totTrab += minTrab
        if (lab && minProg) totProg += minProg

        if (lab || tieneAlgo) {
          filas.push({
            trabajador: t, fecha: fStr, dow,
            diaNombre: DIAS_NOMBRE[dow], lab, esFinde, esFeriado,
            reg, minTrab, minProg, diff, estado,
            faltaReg: reg?.faltaReg || null,
          })
        }

        cur.setDate(cur.getDate() + 1)
      }

      resumenPorTrab[t.id] = {
        diasTrab, diasLab, totTrab, totProg,
        extras:    Math.max(0, totTrab - totProg),
        faltantes: Math.min(0, totTrab - totProg),
        promedio:  diasTrab > 0 ? totTrab / diasTrab : 0,
      }
    })

    const filtrados = filTrabId ? filas.filter((f) => f.trabajador.id === filTrabId) : filas
    filtrados.sort((a, b) => {
      const fd = a.fecha.localeCompare(b.fecha)
      if (fd !== 0) return fd
      return a.trabajador.nombre.localeCompare(b.trabajador.nombre)
    })

    const filasFinal = vista === 'hoy' ? filtrados.filter((f) => f.fecha === hoyStr) : filtrados
    return { filas: filasFinal, resumenPorTrab }
  }, [marcData, mesStr, trabActivos, filTrabId, horarios, feriadosSet, vista, hoyStr])

  const totales = useMemo(() => ({
    trab: filas.reduce((a, f) => a + (f.minTrab || 0), 0),
    diff: filas.reduce((a, f) => a + (f.diff || 0), 0),
  }), [filas])

  const puntoByTrab = useMemo(() => {
    const map = {}
    asignaciones.forEach((a) => {
      const pt = puntosTrabajo.find((p) => p.id === a.punto_trabajo_id)
      if (pt) map[a.trabajador_id] = pt
    })
    return map
  }, [asignaciones, puntosTrabajo])

  const abrirComentario = (marcacionId) => {
    const marc = marcData.find((m) => m.id === marcacionId)
    setEditComentario({ marcacionId })
    setComentTexto(marc?.comentario_admin || '')
  }

  const abrirConfirmar = (fila) => {
    setConfirmModal(fila)
    setVacacionData(null)
    if (fila.faltaReg) {
      if (fila.faltaReg.tipo_marcacion === 'vacacion') {
        setConfirmTipo('vacacion')
      } else {
        setConfirmTipo(fila.faltaReg.asistencia_confirmada === false ? 'falta' : 'asistio')
      }
      setConfirmObs(fila.faltaReg.asistencia_observacion || '')
    } else {
      setConfirmTipo('falta')
      setConfirmObs('')
    }
  }

  useEffect(() => {
    if (confirmTipo !== 'vacacion' || !confirmModal) return
    setVacacionLoading(true)
    setVacacionData(null)
    supabase
      .from('solicitudes_vacaciones')
      .select('id, fecha_desde, fecha_hasta, dias_habiles, estado')
      .eq('trabajador_id', confirmModal.trabajador.id)
      .eq('estado', 'aprobada')
      .lte('fecha_desde', confirmModal.fecha)
      .gte('fecha_hasta', confirmModal.fecha)
      .order('fecha_desde', { ascending: false })
      .then(({ data }) => {
        const sols = data || []
        setVacacionData(sols)
        setConfirmObs(
          sols.length
            ? `Vacaciones (sol. ${sols[0].id.slice(0, 8)})`
            : 'Vacaciones',
        )
      })
      .finally(() => setVacacionLoading(false))
  }, [confirmTipo, confirmModal])

  const handleGuardarConfirmacion = async () => {
    console.log('[guardarConfirmacion] ejecutando...', { confirmTipo, confirmObs })
    if (!confirmObs.trim()) return
    setConfirmSaving(true)
    const { trabajador, fecha, faltaReg } = confirmModal
    const fechaHora   = `${fecha}T16:00:00.000Z`
    const esVacacion  = confirmTipo === 'vacacion'
    const tipoMarcacion      = esVacacion ? 'vacacion' : 'falta'
    const asistenciaConfirm  = esVacacion ? false : confirmTipo !== 'falta'

    let error
    if (faltaReg) {
      ;({ error } = await supabase.from('marcaciones').update({
        tipo_marcacion:                tipoMarcacion,
        asistencia_confirmada:         asistenciaConfirm,
        asistencia_observacion:        confirmObs.trim(),
        asistencia_confirmada_por:     user?.id ?? null,
        asistencia_fecha_confirmacion: new Date().toISOString(),
      }).eq('id', faltaReg.id))
    } else {
      ;({ error } = await supabase.from('marcaciones').insert({
        trabajador_id:                 trabajador.id,
        tipo_marcacion:                tipoMarcacion,
        fecha_hora_servidor:           fechaHora,
        fecha_hora_dispositivo:        fechaHora,
        origen:                        'manual',
        asistencia_confirmada:         asistenciaConfirm,
        asistencia_observacion:        confirmObs.trim(),
        asistencia_confirmada_por:     user?.id ?? null,
        asistencia_fecha_confirmacion: new Date().toISOString(),
      }))
    }

    if (error) {
      console.error('[guardarConfirmacion] error Supabase:', error)
      setActionToast(`Error: ${error.message}`)
      setTimeout(() => setActionToast(null), 5000)
    } else {
      const msg = esVacacion ? 'Vacaciones registradas' : confirmTipo === 'falta' ? 'Falta registrada' : 'Asistencia confirmada'
      setConfirmModal(null)
      setActionToast(msg)
      setTimeout(() => setActionToast(null), 3000)
      cargar()
    }
    setConfirmSaving(false)
  }

  const handleGuardarComentario = async () => {
    setComentGuardando(true)
    const { error } = await supabase
      .from('marcaciones')
      .update({ comentario_admin: comentTexto.trim() || null })
      .eq('id', editComentario.marcacionId)
    if (!error) {
      setMarcData((prev) =>
        prev.map((m) => m.id === editComentario.marcacionId
          ? { ...m, comentario_admin: comentTexto.trim() || null }
          : m,
        ),
      )
      setEditComentario(null)
      setComentToast(true)
      setTimeout(() => setComentToast(false), 3000)
    }
    setComentGuardando(false)
  }

  const abrirModalAgregar = (e, fila, tipo) => {
    e.stopPropagation()
    setAgregarModal({ trabajador: fila.trabajador, fecha: fila.fecha, tipo })
    setAgregarHora('')
    setAgregarMotivo('')
    setAgregarAutorizado(false)
  }

  const handleGuardarAgregar = async () => {
    if (!agregarMotivo.trim() || !agregarHora) return
    setAgregarSaving(true)
    const horaUTC = chileToUTC(agregarModal.fecha, agregarHora)
    const { error } = await supabase
      .from('marcaciones')
      .insert({
        trabajador_id:        agregarModal.trabajador.id,
        tipo_marcacion:       agregarModal.tipo,
        fecha_hora_servidor:  horaUTC,
        fecha_hora_dispositivo: horaUTC,
        origen:               'manual',
        dentro_geocerca:      false,
        estado_validacion:    'pendiente_revision',
        observacion:          'Agregada manualmente por administrador',
        comentario_admin:     agregarMotivo.trim(),
        editado_por_admin:    true,
        editado_at:           new Date().toISOString(),
        editado_por:          user?.id ?? null,
      })
    if (error) {
      setActionToast(`Error: ${error.message}`)
      setTimeout(() => setActionToast(null), 5000)
    } else {
      setAgregarModal(null)
      setActionToast('Marcación agregada correctamente')
      setTimeout(() => setActionToast(null), 3000)
      cargar()
    }
    setAgregarSaving(false)
  }

  const abrirEdicion = (e, marcacionId, tipo, fecha, horaActual) => {
    e.stopPropagation()
    setEditModal({ marcacionId, tipo, fecha, horaActual })
    setEditHora(horaActual || '')
    setEditMotivo('')
    setEditAutorizado(false)
  }

  // ALTER TABLE marcaciones ADD COLUMN IF NOT EXISTS editado_por_admin boolean DEFAULT false;
  // ALTER TABLE marcaciones ADD COLUMN IF NOT EXISTS editado_at timestamptz;
  // ALTER TABLE marcaciones ADD COLUMN IF NOT EXISTS editado_por uuid;
  const handleGuardarEdicion = async () => {
    if (!editMotivo.trim() || !editHora) return
    setEditSaving(true)
    const nuevaHoraUTC = chileToUTC(editModal.fecha, editHora)
    const { error } = await supabase
      .from('marcaciones')
      .update({
        fecha_hora_servidor: nuevaHoraUTC,
        comentario_admin:    editMotivo.trim(),
        editado_por_admin:   true,
        editado_at:          new Date().toISOString(),
        editado_por:         user?.id ?? null,
      })
      .eq('id', editModal.marcacionId)
    if (error) {
      setActionToast(`Error: ${error.message}`)
      setTimeout(() => setActionToast(null), 5000)
    } else {
      setEditModal(null)
      setActionToast('Marcación corregida correctamente')
      setTimeout(() => setActionToast(null), 3000)
      cargar()
    }
    setEditSaving(false)
  }

  const exportCSV = () => {
    const conTrab = !filTrabId
    const cols = [
      ...(conTrab ? ['Trabajador'] : []),
      'Fecha', 'Día', 'Entrada', 'S.Colación', 'R.Colación', 'Salida',
      'Hrs Trabajadas', 'Hrs Extras', 'Estado',
    ]
    const rows = filas.map((f) => [
      ...(conTrab ? [f.trabajador.nombre] : []),
      f.fecha, f.diaNombre,
      fmtHora(f.reg?.entrada) || '—',
      fmtHora(f.reg?.salidaColacion) || '—',
      fmtHora(f.reg?.regresoColacion) || '—',
      fmtHora(f.reg?.salida) || '—',
      f.minTrab != null ? fmtHHMM(f.minTrab) : '—',
      f.diff != null && f.diff !== 0 ? (f.diff > 0 ? '+' : '-') + fmtHHMM(Math.abs(f.diff)) : '—',
      ESTADO_CFG[f.estado]?.label || '—',
    ])
    const csv = [cols, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `marcaciones-${mesStr}${filTrabId ? '-' + trabActivos.find((t) => t.id === filTrabId)?.nombre?.replace(/\s+/g, '_') : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const mesLabel = MESES.find((m) => m.val === mesStr)?.label ?? mesStr
  const mostrarColTrab    = !filTrabId
  const panelTrabajadores = filTrabId ? trabActivos.filter((t) => t.id === filTrabId) : trabActivos

  return (
    <div className="space-y-4">

      {/* ── FILTROS ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setVista('hoy')}
            style={vista === 'hoy'
              ? { backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' }
              : { backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' }
            }
          >Hoy</button>
          <button
            type="button"
            onClick={() => setVista('mes')}
            style={vista === 'mes'
              ? { backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' }
              : { backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' }
            }
          >Este mes</button>
        </div>
        {vista === 'mes' && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Mes</label>
          <select value={mesStr} onChange={(e) => setMesStr(e.target.value)} className="input-base text-sm">
            {MESES.map((m) => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
        </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Trabajador</label>
          <select value={filTrabId} onChange={(e) => setFilTrabId(e.target.value)} className="input-base text-sm">
            <option value="">Todos los trabajadores</option>
            {trabActivos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />Exportar CSV
          </button>
          <button
            onClick={cargar}
            title="Recargar"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── LAYOUT PRINCIPAL ── */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── PANEL IZQUIERDO ── */}
        <div className={`shrink-0 lg:sticky lg:top-4 space-y-2 max-h-[80vh] lg:overflow-y-auto ${filTrabId ? 'w-full lg:w-64' : 'w-full lg:w-52'}`}>
          {loading ? (
            <div className="card p-6 flex justify-center">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
            </div>
          ) : panelTrabajadores.map((t) => {
            const res      = resumenPorTrab[t.id] || {}
            const initials = t.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
            const selected = filTrabId === t.id
            const esSolo   = !!filTrabId

            return (
              <div
                key={t.id}
                onClick={() => setFilTrabId(selected ? '' : t.id)}
                className={`card cursor-pointer transition-all hover:shadow-md select-none ${
                  esSolo
                    ? 'p-4 ring-2 ring-indigo-400 ring-offset-1'
                    : `p-3 ${selected ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`
                }`}
              >
                {esSolo ? (
                  // Card grande — trabajador específico
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <span className="text-indigo-700 text-sm font-bold">{initials}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 leading-tight">{t.nombre}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t.cargo}</p>
                      </div>
                    </div>
                    <p className="text-xs text-indigo-500 font-medium mb-3">{mesLabel}</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Días trabajados</span>
                        <span className="font-semibold text-slate-700">{res.diasTrab ?? 0}/{res.diasLab ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Hrs trabajadas</span>
                        <span className="font-semibold text-slate-700">{fmtHHMM(res.totTrab)}</span>
                      </div>
                      {res.extras > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Horas extras</span>
                          <span className="font-bold text-emerald-600">+{fmtHHMM(res.extras)}</span>
                        </div>
                      )}
                      {res.faltantes < 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Horas faltantes</span>
                          <span className="font-bold text-red-500">-{fmtHHMM(Math.abs(res.faltantes))}</span>
                        </div>
                      )}
                      {res.promedio > 0 && (
                        <div className="flex justify-between border-t border-slate-100 pt-1.5 mt-0.5">
                          <span className="text-slate-500">Promedio diario</span>
                          <span className="font-semibold text-slate-700">{fmtHHMM(res.promedio)}/día</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  // Card compacta — todos los trabajadores
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <span className="text-indigo-700 text-xs font-bold">{initials}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{t.nombre}</p>
                        {selected && <p className="text-xs text-slate-400 truncate">{t.cargo}</p>}
                      </div>
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Días trab.</span>
                        <span className="font-medium text-slate-700">{res.diasTrab ?? 0}/{res.diasLab ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Hrs trab.</span>
                        <span className="font-medium text-slate-700">{fmtHHMM(res.totTrab)}</span>
                      </div>
                      {res.extras > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Extras</span>
                          <span className="font-semibold text-emerald-600">+{fmtHHMM(res.extras)}</span>
                        </div>
                      )}
                      {res.faltantes < 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Faltantes</span>
                          <span className="font-semibold text-red-500">-{fmtHHMM(Math.abs(res.faltantes))}</span>
                        </div>
                      )}
                      {selected && res.promedio > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Promedio</span>
                          <span className="font-medium text-slate-700">{fmtHHMM(res.promedio)}/día</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* ── TABLA PRINCIPAL ── */}
        <div className="flex-1 min-w-0 card overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : filas.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">
              Sin datos para el período seleccionado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {mostrarColTrab && (
                      <th className="text-left px-3 py-2.5 font-medium text-slate-500">Trabajador</th>
                    )}
                    <th className="text-left px-3 py-2.5 font-medium text-slate-500">Día</th>
                    <th className="text-center px-3 py-2.5 font-medium text-slate-500">Entrada</th>
                    <th className="text-center px-3 py-2.5 font-medium text-slate-500">S.Colación</th>
                    <th className="text-center px-3 py-2.5 font-medium text-slate-500">R.Colación</th>
                    <th className="text-center px-3 py-2.5 font-medium text-slate-500">Salida</th>
                    <th className="text-right px-3 py-2.5 font-medium text-slate-500">Hrs Trab.</th>
                    <th className="text-right px-3 py-2.5 font-medium text-slate-500">Extras</th>
                    <th className="text-center px-3 py-2.5 font-medium text-slate-500">Estado</th>
                    <th className="px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filas.map((f) => {
                    const rowBg = f.esFinde
                      ? 'bg-blue-50/40'
                      : f.dow === 5
                        ? 'bg-blue-50'
                        : !f.reg?.entrada && f.lab
                          ? 'bg-slate-50/70 opacity-60'
                          : ''
                    const estadoCfg = ESTADO_CFG[f.estado]
                    const clickable = !!f.reg?.entrada
                    const sospechas = f.reg ? detectarSospechosas(f.reg) : {}
                    const esDiaConfirmado = !!f.faltaReg

                    return (
                      <tr
                        key={`${f.trabajador.id}-${f.fecha}`}
                        onClick={() => clickable && setDetalleModal(f)}
                        className={`transition-colors ${rowBg} ${clickable ? 'cursor-pointer hover:bg-indigo-50/50' : 'hover:bg-slate-50/80'}`}
                      >
                        {mostrarColTrab && (
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="font-medium text-slate-700">{f.trabajador.nombre}</span>
                          </td>
                        )}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="font-medium text-slate-700">{f.diaNombre}</span>
                          <span className="text-slate-400 ml-1">{f.fecha.slice(8)}</span>
                          {f.esFeriado && <span className="ml-1 text-violet-400">feriado</span>}
                        </td>

                        {/* Entrada */}
                        <td className="px-3 py-2 text-center">
                          {f.reg?.entrada ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-700">{fmtHora(f.reg.entrada)}</span>
                              <BtnComentario metaEntry={f.reg._meta?.entrada} onOpen={abrirComentario} />
                              {sospechas.entrada && (
                                <span style={{fontSize:'11px',cursor:'help',marginLeft:'2px'}} title={sospechas.entrada}>⚠️</span>
                              )}
                              {user?.rol === 'admin' && !esDiaConfirmado && f.reg._meta?.entrada?.id && (
                                <button onClick={(e) => abrirEdicion(e, f.reg._meta.entrada.id, 'entrada', f.fecha, fmtHora(f.reg.entrada))}
                                  style={{fontSize:'11px',cursor:'pointer',marginLeft:'2px',color:'#94a3b8',background:'none',border:'none',padding:'0'}}
                                  title="Editar hora">✏️</button>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-300">—</span>
                              {user?.rol === 'admin' && !esDiaConfirmado && f.fecha < hoyStr && (
                                <button onClick={(e) => abrirModalAgregar(e, f, 'entrada')}
                                  style={{fontSize:'11px',color:'#94a3b8',background:'none',border:'1px dashed #cbd5e1',borderRadius:'4px',padding:'1px 4px',cursor:'pointer'}}
                                  title="Agregar marcación">+</button>
                              )}
                            </span>
                          )}
                        </td>

                        {/* S.Colación */}
                        <td className="px-3 py-2 text-center">
                          {f.reg?.salidaColacion ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-700">{fmtHora(f.reg.salidaColacion)}</span>
                              <BtnComentario metaEntry={f.reg._meta?.salida_colacion} onOpen={abrirComentario} />
                              {sospechas.salidaColacion && (
                                <span style={{fontSize:'11px',cursor:'help',marginLeft:'2px'}} title={sospechas.salidaColacion}>⚠️</span>
                              )}
                              {user?.rol === 'admin' && !esDiaConfirmado && f.reg._meta?.salida_colacion?.id && (
                                <button onClick={(e) => abrirEdicion(e, f.reg._meta.salida_colacion.id, 'salida_colacion', f.fecha, fmtHora(f.reg.salidaColacion))}
                                  style={{fontSize:'11px',cursor:'pointer',marginLeft:'2px',color:'#94a3b8',background:'none',border:'none',padding:'0'}}
                                  title="Editar hora">✏️</button>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-300">—</span>
                              {user?.rol === 'admin' && !esDiaConfirmado && f.fecha < hoyStr && (
                                <button onClick={(e) => abrirModalAgregar(e, f, 'salida_colacion')}
                                  style={{fontSize:'11px',color:'#94a3b8',background:'none',border:'1px dashed #cbd5e1',borderRadius:'4px',padding:'1px 4px',cursor:'pointer'}}
                                  title="Agregar marcación">+</button>
                              )}
                            </span>
                          )}
                        </td>

                        {/* R.Colación */}
                        <td className="px-3 py-2 text-center">
                          {f.reg?.regresoColacion ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-700">{fmtHora(f.reg.regresoColacion)}</span>
                              <BtnComentario metaEntry={f.reg._meta?.regreso_colacion} onOpen={abrirComentario} />
                              {sospechas.regresoColacion && (
                                <span style={{fontSize:'11px',cursor:'help',marginLeft:'2px'}} title={sospechas.regresoColacion}>⚠️</span>
                              )}
                              {user?.rol === 'admin' && !esDiaConfirmado && f.reg._meta?.regreso_colacion?.id && (
                                <button onClick={(e) => abrirEdicion(e, f.reg._meta.regreso_colacion.id, 'regreso_colacion', f.fecha, fmtHora(f.reg.regresoColacion))}
                                  style={{fontSize:'11px',cursor:'pointer',marginLeft:'2px',color:'#94a3b8',background:'none',border:'none',padding:'0'}}
                                  title="Editar hora">✏️</button>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-300">—</span>
                              {user?.rol === 'admin' && !esDiaConfirmado && f.fecha < hoyStr && (
                                <button onClick={(e) => abrirModalAgregar(e, f, 'regreso_colacion')}
                                  style={{fontSize:'11px',color:'#94a3b8',background:'none',border:'1px dashed #cbd5e1',borderRadius:'4px',padding:'1px 4px',cursor:'pointer'}}
                                  title="Agregar marcación">+</button>
                              )}
                            </span>
                          )}
                        </td>

                        {/* Salida */}
                        <td className="px-3 py-2 text-center">
                          {f.reg?.salida ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-700">{fmtHora(f.reg.salida)}</span>
                              <BtnComentario metaEntry={f.reg._meta?.salida} onOpen={abrirComentario} />
                              {sospechas.salida && (
                                <span style={{fontSize:'11px',cursor:'help',marginLeft:'2px'}} title={sospechas.salida}>⚠️</span>
                              )}
                              {user?.rol === 'admin' && !esDiaConfirmado && f.reg._meta?.salida?.id && (
                                <button onClick={(e) => abrirEdicion(e, f.reg._meta.salida.id, 'salida', f.fecha, fmtHora(f.reg.salida))}
                                  style={{fontSize:'11px',cursor:'pointer',marginLeft:'2px',color:'#94a3b8',background:'none',border:'none',padding:'0'}}
                                  title="Editar hora">✏️</button>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-300">—</span>
                              {user?.rol === 'admin' && !esDiaConfirmado && f.fecha < hoyStr && (
                                <button onClick={(e) => abrirModalAgregar(e, f, 'salida')}
                                  style={{fontSize:'11px',color:'#94a3b8',background:'none',border:'1px dashed #cbd5e1',borderRadius:'4px',padding:'1px 4px',cursor:'pointer'}}
                                  title="Agregar marcación">+</button>
                              )}
                            </span>
                          )}
                        </td>

                        {/* Hrs Trabajadas */}
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">
                          {f.minTrab != null
                            ? fmtHHMM(f.minTrab)
                            : <span className="text-slate-300 font-normal">—</span>}
                        </td>

                        {/* Extras */}
                        <td className="px-3 py-2 text-right font-semibold">
                          {f.diff == null || f.diff === 0
                            ? <span className="text-slate-300 font-normal">—</span>
                            : (
                              <span className={f.diff > 0 ? 'text-emerald-600' : 'text-red-500'}>
                                {f.diff > 0 ? '+' : '-'}{fmtHHMM(Math.abs(f.diff))}
                              </span>
                            )}
                        </td>

                        {/* Estado */}
                        <td className="px-3 py-2 text-center">
                          {f.estado === 'sin_marcacion' && f.lab ? (
                            f.fecha === hoyStr ? (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_CFG.sin_marcacion.cls}`}>
                                {ESTADO_CFG.sin_marcacion.label}
                              </span>
                            ) : f.faltaReg ? (
                              f.faltaReg.tipo_marcacion === 'vacacion' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  🏖️ Vacaciones
                                  {f.faltaReg.asistencia_observacion && <FileText className="w-2.5 h-2.5" />}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); abrirConfirmar(f) }}
                                    title="Editar" className="hover:opacity-70 transition-opacity ml-0.5"
                                  ><Pencil className="w-2.5 h-2.5" /></button>
                                </span>
                              ) : f.faltaReg.asistencia_confirmada === false ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  Falta confirmada
                                  {f.faltaReg.asistencia_observacion && <FileText className="w-2.5 h-2.5" />}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); abrirConfirmar(f) }}
                                    title="Editar" className="hover:opacity-70 transition-opacity ml-0.5"
                                  ><Pencil className="w-2.5 h-2.5" /></button>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  Sin registro
                                  {f.faltaReg.asistencia_observacion && <FileText className="w-2.5 h-2.5" />}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); abrirConfirmar(f) }}
                                    title="Editar" className="hover:opacity-70 transition-opacity ml-0.5"
                                  ><Pencil className="w-2.5 h-2.5" /></button>
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                  Sin confirmar
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); abrirConfirmar(f) }}
                                  className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                                >
                                  Confirmar
                                </button>
                              </span>
                            )
                          ) : estadoCfg ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${estadoCfg.cls}`}>
                              {estadoCfg.label}
                            </span>
                          ) : null}
                        </td>

                        {/* Inconsistencia geofence */}
                        <td className="px-2 py-2 text-center">
                          {(() => {
                            const punto = puntoByTrab[f.trabajador.id]
                            const metaE = f.reg?._meta?.entrada
                            const metaS = f.reg?._meta?.salida
                            const entradaFuera = esFueraRadio(metaE, punto)
                            const salidaFuera  = esFueraRadio(metaS, punto)
                            if (!entradaFuera && !salidaFuera) return null
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setGeoModal({
                                    fila: f,
                                    punto,
                                    entradaDist: entradaFuera ? distMarcacion(metaE, punto) : null,
                                    salidaDist:  salidaFuera  ? distMarcacion(metaS, punto) : null,
                                  })
                                }}
                                title="Inconsistencia de ubicación"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '0' }}
                              >⚠️</button>
                            )
                          })()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td
                      colSpan={mostrarColTrab ? 6 : 5}
                      className="px-3 py-2.5 text-xs font-semibold text-slate-600"
                    >
                      Total período · {filas.filter((f) => f.minTrab != null).length} días con jornada completa
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold text-slate-900">
                      {fmtHHMM(totales.trab)}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-sm font-bold ${totales.diff > 0 ? 'text-emerald-600' : totales.diff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {totales.diff !== 0
                        ? (totales.diff > 0 ? '+' : '-') + fmtHHMM(Math.abs(totales.diff))
                        : '—'}
                    </td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL INCONSISTENCIA GEOFENCE ── */}
      {geoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setGeoModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Inconsistencia de ubicación</h3>
                <p className="text-xs text-slate-500">
                  {geoModal.fila.trabajador.nombre} · {geoModal.fila.diaNombre} {geoModal.fila.fecha.slice(8)}/{geoModal.fila.fecha.slice(5,7)}/{geoModal.fila.fecha.slice(0,4)}
                </p>
              </div>
              <button onClick={() => setGeoModal(null)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <XCircle className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              {/* Punto de trabajo */}
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Punto de trabajo asignado</p>
                <p className="font-semibold text-slate-800">{geoModal.punto.nombreLugar}</p>
                {geoModal.punto.direccion && <p className="text-xs text-slate-500">{geoModal.punto.direccion}</p>}
                <p className="text-xs text-slate-400">Radio permitido: {geoModal.punto.radioPermitidoMetros} m</p>
                <a
                  href={`https://maps.google.com/?q=${geoModal.punto.latitud},${geoModal.punto.longitud}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Ver en Google Maps →
                </a>
              </div>

              {/* Entrada fuera */}
              {geoModal.entradaDist != null && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Marcación Entrada</p>
                  <p className="text-slate-700">Hora: <span className="font-semibold">{fmtHora(geoModal.fila.reg?.entrada)}</span></p>
                  <p className="text-xs text-slate-500">
                    Coordenadas: {geoModal.fila.reg._meta?.entrada?.lat?.toFixed(6)}, {geoModal.fila.reg._meta?.entrada?.lon?.toFixed(6)}
                  </p>
                  <p className="text-xs font-semibold text-red-600">
                    Distancia al punto: {Math.round(geoModal.entradaDist)} m
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${geoModal.fila.reg._meta?.entrada?.lat},${geoModal.fila.reg._meta?.entrada?.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Ver en Google Maps →
                  </a>
                </div>
              )}

              {/* Salida fuera */}
              {geoModal.salidaDist != null && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Marcación Salida</p>
                  <p className="text-slate-700">Hora: <span className="font-semibold">{fmtHora(geoModal.fila.reg?.salida)}</span></p>
                  <p className="text-xs text-slate-500">
                    Coordenadas: {geoModal.fila.reg._meta?.salida?.lat?.toFixed(6)}, {geoModal.fila.reg._meta?.salida?.lon?.toFixed(6)}
                  </p>
                  <p className="text-xs font-semibold text-red-600">
                    Distancia al punto: {Math.round(geoModal.salidaDist)} m
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${geoModal.fila.reg._meta?.salida?.lat},${geoModal.fila.reg._meta?.salida?.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Ver en Google Maps →
                  </a>
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={() => setGeoModal(null)} className="btn-secondary text-sm">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE DÍA ── */}
      {detalleModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setDetalleModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{detalleModal.trabajador.nombre}</h3>
                <p className="text-xs text-slate-500">
                  {detalleModal.diaNombre}{' '}
                  {detalleModal.fecha.slice(8)}/{detalleModal.fecha.slice(5, 7)}/{detalleModal.fecha.slice(0, 4)}
                  {detalleModal.esFinde && <span className="ml-1.5 text-blue-400 font-medium">Día extra</span>}
                  {detalleModal.esFeriado && <span className="ml-1.5 text-violet-400 font-medium">Feriado</span>}
                </p>
              </div>
              <button
                onClick={() => setDetalleModal(null)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <XCircle className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Entrada',     value: fmtHora(detalleModal.reg?.entrada)        },
                  { label: 'S. Colación', value: fmtHora(detalleModal.reg?.salidaColacion)  },
                  { label: 'R. Colación', value: fmtHora(detalleModal.reg?.regresoColacion) },
                  { label: 'Salida',      value: fmtHora(detalleModal.reg?.salida)          },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs text-slate-400 mb-1">{label}</p>
                    <p className={`text-sm font-bold ${value ? 'text-slate-800' : 'text-slate-300'}`}>
                      {value || '—'}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2.5">
                <div className="flex-1 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">Hrs trabajadas</p>
                  <p className="text-sm font-bold text-slate-800">
                    {detalleModal.minTrab != null ? fmtHHMM(detalleModal.minTrab) : '—'}
                  </p>
                </div>
                {detalleModal.minProg != null && (
                  <div className="flex-1 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs text-slate-400 mb-1">Hrs programadas</p>
                    <p className="text-sm font-bold text-slate-800">{fmtHHMM(detalleModal.minProg)}</p>
                  </div>
                )}
                {detalleModal.diff != null && (
                  <div className="flex-1 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs text-slate-400 mb-1">Diferencia</p>
                    <p className={`text-sm font-bold ${detalleModal.diff > 0 ? 'text-emerald-600' : detalleModal.diff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {detalleModal.diff === 0
                        ? '—'
                        : (detalleModal.diff > 0 ? '+' : '-') + fmtHHMM(Math.abs(detalleModal.diff))}
                    </p>
                  </div>
                )}
              </div>

              {detalleModal.estado && ESTADO_CFG[detalleModal.estado] && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Estado:</span>
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${ESTADO_CFG[detalleModal.estado].cls}`}>
                    {ESTADO_CFG[detalleModal.estado].label}
                  </span>
                  {detalleModal.reg?.sinColacion && (
                    <span className="text-xs text-slate-400">(colación omitida)</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL COMENTARIO ── */}
      {editComentario && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setEditComentario(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-900 text-sm">Comentario admin</h3>
            <textarea
              value={comentTexto}
              onChange={(e) => setComentTexto(e.target.value)}
              rows={3}
              placeholder="Escribe un comentario..."
              className="input-base text-sm resize-none w-full"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditComentario(null)} className="btn-secondary text-sm">
                Cancelar
              </button>
              <button
                onClick={handleGuardarComentario}
                disabled={comentGuardando}
                className="btn-primary text-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {comentGuardando && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMACIÓN ASISTENCIA ── */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-900 text-sm">
              Confirmar asistencia — {confirmModal.trabajador.nombre} — {confirmModal.fecha}
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio" name="confirmTipo" value="falta"
                  checked={confirmTipo === 'falta'}
                  onChange={() => { setConfirmTipo('falta'); setVacacionData(null) }}
                  className="accent-red-500"
                />
                <span className="text-sm text-slate-700">Falta (descontar día)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio" name="confirmTipo" value="asistio"
                  checked={confirmTipo === 'asistio'}
                  onChange={() => { setConfirmTipo('asistio'); setVacacionData(null) }}
                  className="accent-blue-500"
                />
                <span className="text-sm text-slate-700">Asistió (problema con app)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio" name="confirmTipo" value="vacacion"
                  checked={confirmTipo === 'vacacion'}
                  onChange={() => setConfirmTipo('vacacion')}
                  className="accent-cyan-500"
                />
                <span className="text-sm text-slate-700">Vacaciones</span>
              </label>
            </div>

            {/* Sección vacaciones */}
            {confirmTipo === 'vacacion' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                {vacacionLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Verificando solicitudes de vacaciones...
                  </div>
                ) : vacacionData?.length ? (
                  <div className="space-y-1.5">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                      ✓ Vacaciones aprobadas
                    </span>
                    {vacacionData.map((sol) => (
                      <p key={sol.id} className="text-xs text-slate-600">
                        Del {sol.fecha_desde} al {sol.fecha_hasta} · {sol.dias_habiles} días hábiles
                      </p>
                    ))}
                  </div>
                ) : vacacionData !== null ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                    <p className="text-xs text-amber-700 font-medium">
                      ⚠️ No hay solicitud de vacaciones aprobada para este día
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">Puedes registrarla igual con una observación manual</p>
                  </div>
                ) : null}
              </div>
            )}

            <textarea
              value={confirmObs}
              onChange={(e) => setConfirmObs(e.target.value)}
              rows={2}
              placeholder={
                confirmTipo === 'vacacion'
                  ? 'Ej: Vacaciones período enero, aprobado por gerencia...'
                  : confirmTipo === 'falta'
                    ? 'Ej: No se presentó, avisó por whatsapp, etc.'
                    : 'Ej: Olvidó marcar, problema con el celular, etc.'
              }
              className="input-base text-sm resize-none w-full"
              autoFocus={confirmTipo !== 'vacacion'}
            />
            {!confirmObs.trim() && (
              <p className="text-xs text-red-500 -mt-2">La observación es obligatoria</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmModal(null)} className="btn-secondary text-sm">
                Cancelar
              </button>
              <button
                onClick={handleGuardarConfirmacion}
                disabled={confirmSaving || !confirmObs.trim()}
                className="btn-primary text-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {confirmSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {confirmTipo === 'vacacion'
                  ? vacacionData?.length ? 'Confirmar vacaciones' : 'Registrar igual'
                  : 'Guardar confirmación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AGREGAR MARCACIÓN (solo admin) ── */}
      {agregarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setAgregarModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">
                Agregar {agregarModal.tipo.replace(/_/g, ' ')} — {agregarModal.fecha}
              </h3>
              <button onClick={() => setAgregarModal(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <XCircle className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500">{agregarModal.trabajador.nombre}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hora (Chile)</label>
                <input
                  type="time"
                  value={agregarHora}
                  onChange={(e) => setAgregarHora(e.target.value)}
                  className="input-base text-sm w-full"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Motivo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={agregarMotivo}
                  onChange={(e) => setAgregarMotivo(e.target.value)}
                  rows={2}
                  placeholder="Ej: olvidó marcar, autorizado por supervisor..."
                  className="input-base text-sm resize-none w-full"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agregarAutorizado}
                  onChange={(e) => setAgregarAutorizado(e.target.checked)}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-slate-700">Autorizado por admin</span>
              </label>
            </div>
            {!agregarMotivo.trim() && (
              <p className="text-xs text-red-500 -mt-2">El motivo es obligatorio</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setAgregarModal(null)} className="btn-secondary text-sm">
                Cancelar
              </button>
              <button
                onClick={handleGuardarAgregar}
                disabled={agregarSaving || !agregarMotivo.trim() || !agregarHora}
                className="btn-primary text-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {agregarSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDICIÓN HORA (solo admin) ── */}
      {editModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setEditModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">
                Editar marcación — {editModal.tipo.replace('_', ' ')} del {editModal.fecha}
              </h3>
              <button onClick={() => setEditModal(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <XCircle className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nueva hora (Chile)</label>
                <input
                  type="time"
                  value={editHora}
                  onChange={(e) => setEditHora(e.target.value)}
                  className="input-base text-sm w-full"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Motivo de la corrección <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editMotivo}
                  onChange={(e) => setEditMotivo(e.target.value)}
                  rows={2}
                  placeholder="Ej: Error en registro, se verificó con supervisor..."
                  className="input-base text-sm resize-none w-full"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editAutorizado}
                  onChange={(e) => setEditAutorizado(e.target.checked)}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-slate-700">Esta corrección fue autorizada</span>
              </label>
            </div>
            {!editMotivo.trim() && (
              <p className="text-xs text-red-500 -mt-2">El motivo es obligatorio</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditModal(null)} className="btn-secondary text-sm">
                Cancelar
              </button>
              <button
                onClick={handleGuardarEdicion}
                disabled={editSaving || !editMotivo.trim() || !editHora}
                className="btn-primary text-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {editSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Guardar corrección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST COMENTARIO ── */}
      {comentToast && (
        <div className="fixed bottom-4 right-4 z-[60] bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
          Comentario guardado
        </div>
      )}

      {/* ── TOAST ACCIÓN ASISTENCIA ── */}
      {actionToast && (
        <div className={`fixed bottom-4 right-4 z-[60] text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg ${actionToast.startsWith('Error:') ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {actionToast}
        </div>
      )}
    </div>
  )
}
