import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { formatCLP, formatDate } from '../../utils/formatters'
import { downloadPDF } from '../../utils/pdf'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import { ConfirmModal } from '../../components/Modal'
import PuntosTrabajoPage from '../puntos-trabajo/PuntosTrabajoPage'
import MarcacionesView from '../../components/marcaciones/MarcacionesView'
import { supabase } from '../../services/supabase'
import {
  Plus, Search, Users, Pencil, Trash2,
  Clock, Calendar,
  Umbrella, TrendingUp, AlertCircle, Smartphone,
  CheckCircle2, XCircle, Inbox, RefreshCw, MessageSquare, BarChart2, MapPin,
  DollarSign, Gift, Star, FileText, Download, X,
} from 'lucide-react'

function StatChip({ icon: Icon, label, value, color = 'slate' }) {
  const colors = {
    slate:   'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    red:     'bg-red-100 text-red-700',
    amber:   'bg-amber-100 text-amber-700',
    indigo:  'bg-indigo-100 text-indigo-700',
    violet:  'bg-violet-100 text-violet-700',
  }
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${colors[color]}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="text-xs text-current opacity-70">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}

const DIAS_NOMBRE  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_SEM_KEY = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function localDateStr(val) {
  const d = val instanceof Date ? val : new Date(val)
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

function fmtTime(isoStr) {
  if (!isoStr) return 'â€"'
  return new Date(isoStr).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}
function fmtDur(min) {
  if (min == null || min < 0) return 'â€"'
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

// Idénticas a MarcacionesView para garantizar mismo resultado
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

function DetalleMarcacionesModal({ trabajador, horario, marcaciones, onClose }) {
  const [periodo, setPeriodo] = useState('semana')

  const filas = useMemo(() => {
    const hoy = new Date(); hoy.setHours(23, 59, 59, 999)
    let inicio
    if (periodo === 'hoy') {
      inicio = new Date(); inicio.setHours(0, 0, 0, 0)
    } else if (periodo === 'semana') {
      inicio = new Date()
      const d = inicio.getDay()
      inicio.setDate(inicio.getDate() - (d === 0 ? 6 : d - 1))
      inicio.setHours(0, 0, 0, 0)
    } else {
      inicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    }

    const porFecha = {}
    marcaciones.forEach((m) => {
      const f = localDateStr(m.fechaHoraServidor)
      if (!porFecha[f]) porFecha[f] = {}
      if (m.tipoMarcacion === 'entrada')           porFecha[f].entrada = m.fechaHoraServidor
      else if (m.tipoMarcacion === 'salida')        porFecha[f].salida = m.fechaHoraServidor
      else if (m.tipoMarcacion === 'salida_colacion')  porFecha[f].salidaColacion = m.fechaHoraServidor
      else if (m.tipoMarcacion === 'regreso_colacion') porFecha[f].regresoColacion = m.fechaHoraServidor
      if (m.observacion === 'sin_colacion') porFecha[f].sinColacion = true
    })

    const rows = []
    const cur = new Date(inicio)
    while (cur <= hoy) {
      const key  = DIAS_SEM_KEY[cur.getDay()]
      const fStr = localDateStr(cur)
      const lab  = horario ? horario[key] : false
      const reg  = porFecha[fStr] || {}

      let minTrab = null, minProg = null
      if (reg.entrada && reg.salida) {
        let minColacionReal
        if (reg.salidaColacion && reg.regresoColacion)
          minColacionReal = (new Date(reg.regresoColacion) - new Date(reg.salidaColacion)) / 60000
        else
          minColacionReal = reg.sinColacion ? 0 : (horario?.minutosColacion || 0)
        minTrab = Math.max(0, (new Date(reg.salida) - new Date(reg.entrada)) / 60000 - minColacionReal)
      }
      if (lab && horario) {
        const [eh, em] = (horario[`${key}Entrada`] || '08:00').split(':').map(Number)
        const [sh, sm] = (horario[`${key}Salida`]  || '18:00').split(':').map(Number)
        minProg = Math.max(0, (sh * 60 + sm) - (eh * 60 + em) - (horario.minutosColacion || 0))
      }

      rows.push({
        fecha: fStr,
        diaNombre: DIAS_NOMBRE[cur.getDay()],
        lab, reg,
        minTrab, minProg,
        diff: minTrab != null && minProg != null ? minTrab - minProg : null,
        ausente: lab && !reg.entrada,
      })
      cur.setDate(cur.getDate() + 1)
    }
    return rows
  }, [periodo, marcaciones, horario])

  const totales = useMemo(() => {
    const trab = filas.reduce((a, f) => a + (f.minTrab || 0), 0)
    const prog = filas.reduce((a, f) => a + (f.minProg || 0), 0)
    return { trab, prog, diff: trab - prog }
  }, [filas])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">{trabajador.nombre}</h3>
            <p className="text-xs text-slate-500">{trabajador.cargo} · Detalle de marcaciones</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Período */}
        <div className="px-6 py-3 border-b border-slate-100">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {[{ key: 'hoy', label: 'Hoy' }, { key: 'semana', label: 'Esta semana' }, { key: 'mes', label: 'Este mes' }].map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodo(p.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  periodo === p.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Fecha', 'Día', 'Entrada', 'Salida', 'Trabajado', 'Programado', 'Diferencia'].map((h, i) => (
                  <th key={h} className={`text-xs text-slate-400 font-medium pb-2 ${i >= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filas.map((f) => (
                <tr key={f.fecha} className={!f.lab ? 'opacity-35' : ''}>
                  <td className="py-2.5 text-xs text-slate-500">{f.fecha}</td>
                  <td className="py-2.5 text-xs font-medium text-slate-700">{f.diaNombre}</td>
                  <td className="py-2.5 text-xs text-slate-600">{fmtTime(f.reg.entrada)}</td>
                  <td className="py-2.5 text-xs text-slate-600">{fmtTime(f.reg.salida)}</td>
                  <td className="py-2.5 text-right text-xs font-semibold text-slate-800">
                    {f.minTrab != null ? fmtDur(f.minTrab) : f.ausente ? <span className="text-red-400 font-medium">Ausente</span> : 'â€"'}
                  </td>
                  <td className="py-2.5 text-right text-xs text-slate-500">{fmtDur(f.minProg)}</td>
                  <td className="py-2.5 text-right text-xs font-bold">
                    {f.diff != null ? (
                      <span className={f.diff >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                        {f.diff >= 0 ? '+' : '-'}{fmtDur(Math.abs(f.diff))}
                      </span>
                    ) : 'â€"'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200">
                <td colSpan={4} className="py-3 text-xs font-semibold text-slate-600">Total período</td>
                <td className="py-3 text-right text-sm font-bold text-slate-900">{fmtDur(totales.trab)}</td>
                <td className="py-3 text-right text-sm font-semibold text-slate-500">{fmtDur(totales.prog)}</td>
                <td className={`py-3 text-right text-sm font-bold ${totales.diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {totales.diff >= 0 ? '+' : '-'}{fmtDur(Math.abs(totales.diff))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

const ESTADO_SOL = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  aprobada:  { label: 'Aprobada',  cls: 'bg-emerald-100 text-emerald-700' },
  rechazada: { label: 'Rechazada', cls: 'bg-red-100 text-red-700' },
}

function EstadoBadge({ estado }) {
  const info = ESTADO_SOL[estado] ?? { label: estado, cls: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  )
}

const MESES_LABEL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// â"€â"€ Tab Adelantos y Bonos â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const BONO_ASISTENCIA_MONTO = 40000

function AdelantosBanosTab({ trabajadores }) {
  const hoy = new Date()
  const { user } = useAuth()
  const { horarios, proyectos } = useApp()
  const empresaId = user?.empresa_id

  const [mes,                setMes]                = useState(hoy.getMonth() + 1)
  const [anio,               setAnio]               = useState(hoy.getFullYear())
  const [adelantos,          setAdelantos]          = useState([])
  const [bonos,              setBonos]              = useState([])
  const [loading,            setLoading]            = useState(false)
  const [buscado,            setBuscado]            = useState(false)
  const [asistenciaPerfecta, setAsistenciaPerfecta] = useState({})
  const [modalAdelanto,      setModalAdelanto]      = useState(false)
  const [modalTrabId,        setModalTrabId]        = useState(null)
  const [modalBono,          setModalBono]          = useState(false)
  const [guardando,          setGuardando]          = useState(false)
  const [formA, setFormA] = useState({ tipo: 'quincena', monto: '', fecha: '', descripcion: '' })
  const [formB, setFormB] = useState({ tipo: 'asistencia_perfecta', monto: '', proyecto_id: '', descripcion: '' })
  const [adelantosApp, setAdelantosApp] = useState([])

  const periodo = `${anio}-${String(mes).padStart(2, '0')}`
  const anios   = [hoy.getFullYear(), hoy.getFullYear() - 1, hoy.getFullYear() - 2]
  const proyectosActivos = (proyectos || []).filter((p) => p.estado !== 'cancelado')

  const cargar = useCallback(async () => {
    setLoading(true)
    setBuscado(true)
    try {
      const primerDia    = new Date(anio, mes - 1, 1)
      const primerDiaSig = new Date(anio, mes, 1)
      const pad = (n) => String(n).padStart(2, '0')
      const primerDiaStr    = `${anio}-${pad(mes)}-01`
      const primerDiaSigStr = `${primerDiaSig.getFullYear()}-${pad(primerDiaSig.getMonth() + 1)}-01`
      const trabIds  = trabajadores.map((t) => t.id)

      if (!trabIds.length) {
        setAdelantos([]); setBonos([]); setAdelantosApp([]); setAsistenciaPerfecta({})
        setLoading(false); return
      }

      const ultimoDia    = new Date(anio, mes, 0).getDate()
      const ultimoDiaStr = `${anio}-${pad(mes)}-${pad(ultimoDia)}`
      let adelantosQ = supabase.from('adelantos').select('*').eq('periodo', periodo).order('fecha', { ascending: true })
      let bonosQ     = supabase.from('bonos').select('*').eq('periodo', periodo)
      let marcsQ     = supabase.from('marcaciones').select('fecha_hora_servidor, trabajador_id')
        .gte('fecha_hora_servidor', primerDia.toISOString())
        .lt('fecha_hora_servidor',  primerDiaSig.toISOString())
      let adelantosAppQ = supabase
        .from('gastos')
        .select('id, monto, descripcion, fecha_gasto, foto_url, trabajador_id, trabajador_nombre')
        .eq('empresa_id', empresaId)
        .eq('subtipo', 'adelanto')
        .gte('fecha_gasto', primerDiaStr)
        .lte('fecha_gasto', ultimoDiaStr)

      adelantosQ    = adelantosQ.in('trabajador_id', trabIds)
      bonosQ        = bonosQ.in('trabajador_id', trabIds)
      marcsQ        = marcsQ.in('trabajador_id', trabIds)
      adelantosAppQ = adelantosAppQ.in('trabajador_id', trabIds)

      const [
        { data: adelantosData },
        { data: bonosData },
        { data: marcacionesData },
        { data: feriadosData },
        { data: adelantosAppData },
      ] = await Promise.all([
        adelantosQ,
        bonosQ,
        marcsQ,
        supabase.from('feriados').select('fecha')
          .gte('fecha', primerDiaStr)
          .lt('fecha',  primerDiaSigStr)
          .or(empresaId ? `empresa_id.is.null,empresa_id.eq.${empresaId}` : 'empresa_id.is.null'),
        adelantosAppQ,
      ])

      setAdelantos(adelantosData || [])
      setBonos(bonosData || [])
      setAdelantosApp(adelantosAppData || [])

      const pad2        = (n) => String(n).padStart(2, '0')
      const feriadosSet = new Set((feriadosData || []).map((f) => f.fecha))
      const hoyFin      = new Date(); hoyFin.setHours(23, 59, 59, 999)
      const evalIds     = trabIds
      const newMap      = {}

      for (const tid of evalIds) {
        const horario = horarios[tid]
        if (!horario) { newMap[tid] = false; continue }

        const marcasSet = new Set()
        ;(marcacionesData || []).forEach((m) => {
          if (m.trabajador_id === tid) {
            const d = new Date(m.fecha_hora_servidor)
            marcasSet.add([d.getFullYear(), pad2(d.getMonth() + 1), pad2(d.getDate())].join('-'))
          }
        })

        let perfecta = true
        const cursor = new Date(primerDia)
        while (cursor < primerDiaSig && cursor <= hoyFin) {
          const dKey = DIAS_SEM_KEY[cursor.getDay()]
          if (horario[dKey]) {
            const fStr = [cursor.getFullYear(), pad2(cursor.getMonth() + 1), pad2(cursor.getDate())].join('-')
            if (!feriadosSet.has(fStr) && !marcasSet.has(fStr)) { perfecta = false; break }
          }
          cursor.setDate(cursor.getDate() + 1)
        }
        newMap[tid] = perfecta
      }
      setAsistenciaPerfecta(newMap)
    } catch (e) {
      console.error('[AdelantosBanosTab]', e)
    } finally {
      setLoading(false)
    }
  }, [mes, anio, empresaId, horarios, trabajadores, periodo])

  useEffect(() => { cargar() }, [cargar])

  const agregarAdelanto = async () => {
    if (!formA.monto || !formA.fecha) return
    setGuardando(true)
    const { error } = await supabase.from('adelantos').insert({
      trabajador_id: modalTrabId, empresa_id: empresaId, periodo,
      tipo: formA.tipo, monto: parseInt(formA.monto) || 0,
      fecha: formA.fecha, descripcion: formA.descripcion || null, descontado: false,
    })
    setGuardando(false)
    if (!error) { setModalAdelanto(false); setModalTrabId(null); setFormA({ tipo: 'quincena', monto: '', fecha: '', descripcion: '' }); cargar() }
  }

  const eliminarAdelanto = async (id) => {
    await supabase.from('adelantos').delete().eq('id', id)
    setAdelantos((prev) => prev.filter((a) => a.id !== id))
  }

  const agregarBono = async () => {
    const monto = formB.tipo === 'asistencia_perfecta' ? BONO_ASISTENCIA_MONTO : (parseInt(formB.monto) || 0)
    if (!monto) return
    setGuardando(true)
    const { error } = await supabase.from('bonos').insert({
      trabajador_id: modalTrabId, empresa_id: empresaId, periodo,
      tipo: formB.tipo, monto,
      proyecto_id: formB.proyecto_id || null, descripcion: formB.descripcion || null,
    })
    setGuardando(false)
    if (!error) { setModalBono(false); setModalTrabId(null); setFormB({ tipo: 'asistencia_perfecta', monto: '', proyecto_id: '', descripcion: '' }); cargar() }
  }

  const eliminarBono = async (id) => {
    await supabase.from('bonos').delete().eq('id', id)
    setBonos((prev) => prev.filter((b) => b.id !== id))
  }

  const workersToShow = [...trabajadores].sort((a, b) => {
    const aHasData = adelantos.some((x) => x.trabajador_id === a.id) ||
                     adelantosApp.some((x) => x.trabajador_id === a.id) ||
                     bonos.some((x) => x.trabajador_id === a.id)
    const bHasData = adelantos.some((x) => x.trabajador_id === b.id) ||
                     adelantosApp.some((x) => x.trabajador_id === b.id) ||
                     bonos.some((x) => x.trabajador_id === b.id)
    if (aHasData && !bHasData) return -1
    if (!aHasData && bHasData) return 1
    return 0
  })
  const totalAdelantosGlobal = [...adelantos, ...adelantosApp].reduce((s, a) => s + (a.monto || 0), 0)
  const totalBonosGlobal     = bonos.reduce((s, b) => s + (b.monto || 0), 0)

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mes</label>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="input-base text-sm">
            {MESES_LABEL.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Año</label>
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="input-base text-sm">
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {loading && <RefreshCw className="w-4 h-4 animate-spin text-indigo-500 self-end mb-2" />}
      </div>

      {loading && <div className="card p-10 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-indigo-500" /></div>}

      {!loading && buscado && (<>
        {/* Resumen global */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total adelantos del mes</p>
            <p className="text-2xl font-bold text-red-600">{formatCLP(totalAdelantosGlobal)}</p>
          </div>
          <div className="card p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total bonos del mes</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCLP(totalBonosGlobal)}</p>
          </div>
        </div>

        {/* Tarjeta por trabajador */}
        {workersToShow.map((t) => {
          const tAd       = adelantos.filter((a) => a.trabajador_id === t.id)
          const tAdApp    = adelantosApp.filter((a) => a.trabajador_id === t.id)
          const tBon      = bonos.filter((b) => b.trabajador_id === t.id)
          const tPerfecta = asistenciaPerfecta[t.id]
          const tYaExiste = tBon.some((b) => b.tipo === 'asistencia_perfecta')
          const tTotalAd  = tAd.reduce((acc, a) => acc + (a.monto || 0), 0) + tAdApp.reduce((acc, a) => acc + (a.monto || 0), 0)
          const tTotalBon = tBon.reduce((acc, b) => acc + (b.monto || 0), 0)
          const adCount   = tAd.length + tAdApp.length

          return (
            <div key={t.id} className="card overflow-hidden">
              {/* HEADER */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-indigo-700">{t.nombre.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{t.nombre}</p>
                    <p className="text-xs text-slate-400">{adCount} adelanto{adCount !== 1 ? 's' : ''} · {tBon.length} bono{tBon.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {tTotalAd > 0 && <span className="text-sm font-bold text-red-600">{formatCLP(tTotalAd)}</span>}
                  {tTotalBon > 0 && <span className="text-sm font-bold text-emerald-600">{formatCLP(tTotalBon)}</span>}
                  <button onClick={() => { setModalTrabId(t.id); setFormA({ tipo: 'quincena', monto: '', fecha: '', descripcion: '' }); setModalAdelanto(true) }}
                    className="btn-ghost text-xs py-1.5 px-3">
                    <Plus className="w-3 h-3" />Adelanto
                  </button>
                  <button onClick={() => { setModalTrabId(t.id); setFormB({ tipo: 'asistencia_perfecta', monto: '', proyecto_id: '', descripcion: '' }); setModalBono(true) }}
                    className="btn-ghost text-xs py-1.5 px-3">
                    <Plus className="w-3 h-3" />Bono
                  </button>
                </div>
              </div>

              {/* Sugerencia asistencia perfecta */}
              {tPerfecta && !tYaExiste && (
                <div className="flex items-center justify-between gap-4 px-5 py-3 bg-emerald-50 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-xs font-medium text-emerald-800">
                      Asistencia perfecta en {MESES_LABEL[mes - 1]} {anio}. ¿Agregar bono de {formatCLP(BONO_ASISTENCIA_MONTO)}?
                    </p>
                  </div>
                  <button
                    onClick={() => { setModalTrabId(t.id); setFormB({ tipo: 'asistencia_perfecta', monto: '', proyecto_id: '', descripcion: '' }); setModalBono(true) }}
                    className="btn-primary shrink-0 text-xs py-1.5 px-3">
                    <Gift className="w-3 h-3" />Agregar
                  </button>
                </div>
              )}

              {/* ADELANTOS */}
              <div className="px-5 py-3 border-b border-slate-50">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Adelantos</p>
                {adCount === 0 ? (
                  <p className="text-xs text-slate-300 py-1">Sin adelantos</p>
                ) : (
                  <div className="space-y-2">
                    {tAd.map((a) => (
                      <div key={a.id} className="flex items-center gap-3">
                        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            a.tipo === 'quincena' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {a.tipo === 'quincena' ? 'Quincena' : 'Adicional'}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            a.descontado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {a.descontado ? 'Descontado' : 'Pendiente'}
                          </span>
                          <span className="text-xs text-slate-400">{a.fecha}</span>
                          {a.descripcion && <span className="text-xs text-slate-400">· {a.descripcion}</span>}
                          <span className="font-semibold text-red-600 text-sm">{formatCLP(a.monto)}</span>
                        </div>
                        {!a.descontado && (
                          <button onClick={() => eliminarAdelanto(a.id)}
                            className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                            title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {tAdApp.map((a) => (
                      <div key={`app-${a.id}`} className="flex items-center gap-3">
                        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">App</span>
                          <span className="text-xs text-slate-400">{a.fecha_gasto}</span>
                          {a.descripcion && <span className="text-xs text-slate-400">· {a.descripcion}</span>}
                          <span className="font-semibold text-red-600 text-sm">{formatCLP(a.monto)}</span>
                          {a.foto_url && (
                            <a href={a.foto_url} target="_blank" rel="noopener noreferrer"
                              className="text-indigo-400 hover:text-indigo-600 transition-colors" title="Ver comprobante">
                              📎
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* BONOS */}
              <div className="px-5 py-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Bonos</p>
                {tBon.length === 0 ? (
                  <p className="text-xs text-slate-300 py-1">Sin bonos</p>
                ) : (
                  <div className="space-y-2">
                    {tBon.map((b) => (
                      <div key={b.id} className="flex items-center gap-3">
                        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            b.tipo === 'asistencia_perfecta' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'
                          }`}>
                            {b.tipo === 'asistencia_perfecta' ? 'Asistencia perfecta' : 'Desempeño'}
                          </span>
                          {b.proyecto_id && (
                            <span className="text-xs text-indigo-600">
                              {proyectosActivos.find((p) => p.id === b.proyecto_id)?.nombre ?? b.proyecto_id}
                            </span>
                          )}
                          {b.descripcion && <span className="text-xs text-slate-400">· {b.descripcion}</span>}
                          <span className="font-semibold text-emerald-600 text-sm">{formatCLP(b.monto)}</span>
                        </div>
                        <button onClick={() => eliminarBono(b.id)}
                          className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                          title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </>)}

      {/* Modal Adelanto */}
      {modalAdelanto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => { setModalAdelanto(false); setModalTrabId(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Agregar adelanto</h3>
              <button onClick={() => { setModalAdelanto(false); setModalTrabId(null) }} className="p-2 rounded-lg hover:bg-slate-100">
                <XCircle className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</label>
                <select value={formA.tipo} onChange={(e) => setFormA((f) => ({ ...f, tipo: e.target.value }))} className="input-base">
                  <option value="quincena">Quincena</option>
                  <option value="adicional">Adicional</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Monto ($)</label>
                <input type="number" value={formA.monto} onChange={(e) => setFormA((f) => ({ ...f, monto: e.target.value }))}
                  placeholder="0" className="input-base" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</label>
                <input type="date" value={formA.fecha} onChange={(e) => setFormA((f) => ({ ...f, fecha: e.target.value }))}
                  className="input-base" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Descripción (opcional)</label>
                <input type="text" value={formA.descripcion} onChange={(e) => setFormA((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Motivo del adelanto..." className="input-base" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setModalAdelanto(false); setModalTrabId(null) }} className="btn-ghost">Cancelar</button>
              <button onClick={agregarAdelanto} disabled={!formA.monto || !formA.fecha || guardando}
                className="btn-primary disabled:opacity-50">
                {guardando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bono */}
      {modalBono && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => { setModalBono(false); setModalTrabId(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Agregar bono</h3>
              <button onClick={() => { setModalBono(false); setModalTrabId(null) }} className="p-2 rounded-lg hover:bg-slate-100">
                <XCircle className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</label>
                <select value={formB.tipo}
                  onChange={(e) => setFormB((f) => ({ ...f, tipo: e.target.value, monto: '' }))}
                  className="input-base">
                  <option value="asistencia_perfecta">Asistencia perfecta</option>
                  <option value="desempeno">Desempeño</option>
                </select>
              </div>
              {formB.tipo === 'asistencia_perfecta' ? (
                <div className="px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium">
                  Monto fijo: {formatCLP(BONO_ASISTENCIA_MONTO)}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Monto ($)</label>
                    <input type="number" value={formB.monto} onChange={(e) => setFormB((f) => ({ ...f, monto: e.target.value }))}
                      placeholder="0" className="input-base" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Proyecto (opcional)</label>
                    <select value={formB.proyecto_id} onChange={(e) => setFormB((f) => ({ ...f, proyecto_id: e.target.value }))} className="input-base">
                      <option value="">Sin proyecto asociado</option>
                      {proyectosActivos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Descripción</label>
                    <input type="text" value={formB.descripcion} onChange={(e) => setFormB((f) => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Motivo del bono..." className="input-base" />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setModalBono(false); setModalTrabId(null) }} className="btn-ghost">Cancelar</button>
              <button onClick={agregarBono}
                disabled={guardando || (formB.tipo === 'desempeno' && !formB.monto)}
                className="btn-primary disabled:opacity-50">
                {guardando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const fechaEspanol = (dateStr) => {
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre']
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
}

function nextBusinessDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
}

export default function TrabajadoresPage() {
  const {
    trabajadores, deleteTrabajador,
    solicitudesVacaciones, solicitudesColacion,
    resolverSolicitudVacacion, resolverSolicitudColacion,
    marcaciones, horarios, empresa,
  } = useApp()
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'
  const navigate = useNavigate()

  const [statsMap, setStatsMap] = useState({})

  useEffect(() => {
    if (!trabajadores.length) return
    const trabActivos = trabajadores.filter((t) => t.estado === 'activo')
    if (!trabActivos.length) return

    const cargar = async () => {
      try {
        const dayFmt    = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' })
        const hoy       = new Date(); hoy.setHours(23, 59, 59, 999)
        const todayKey  = dayFmt.format(new Date())
        const [anio, mes] = todayKey.split('-').map(Number)
        const primerDia    = new Date(anio, mes - 1, 1)
        const primerDiaSig = new Date(anio, mes, 1)
        const ultimoDia    = new Date(anio, mes, 0)
        const pad = (n) => String(n).padStart(2, '0')
        const pDStr  = `${anio}-${pad(mes)}-01`
        const pDSStr = `${primerDiaSig.getFullYear()}-${pad(primerDiaSig.getMonth() + 1)}-01`
        const trabIds = trabActivos.map((t) => t.id)

        const [{ data: marcs, error: marcError }, { data: feriados }] = await Promise.all([
          supabase
            .from('marcaciones')
            .select('id, trabajador_id, tipo_marcacion, fecha_hora_servidor, observacion, comentario_admin')
            .in('trabajador_id', trabIds)
            .gte('fecha_hora_servidor', primerDia.toISOString())
            .lt('fecha_hora_servidor',  primerDiaSig.toISOString())
            .order('fecha_hora_servidor', { ascending: true }),
          supabase.from('feriados').select('fecha')
            .gte('fecha', pDStr).lt('fecha', pDSStr)
            .or('empresa_id.is.null'),
        ])
        if (marcError) throw marcError

        const feriadosSet = new Set((feriados || []).map((f) => f.fecha))

        // grouping — idéntico a MarcacionesView
        const byTrabFecha = {}
        ;(marcs || []).forEach((m) => {
          const f = dayFmt.format(new Date(m.fecha_hora_servidor))
          if (!byTrabFecha[m.trabajador_id]) byTrabFecha[m.trabajador_id] = {}
          if (!byTrabFecha[m.trabajador_id][f])
            byTrabFecha[m.trabajador_id][f] = { _meta: {} }
          const reg = byTrabFecha[m.trabajador_id][f]
          reg._meta[m.tipo_marcacion] = { id: m.id, hasComment: !!m.comentario_admin }
          if      (m.tipo_marcacion === 'entrada')          reg.entrada         = m.fecha_hora_servidor
          else if (m.tipo_marcacion === 'salida')           reg.salida          = m.fecha_hora_servidor
          else if (m.tipo_marcacion === 'salida_colacion')  reg.salidaColacion  = m.fecha_hora_servidor
          else if (m.tipo_marcacion === 'regreso_colacion') reg.regresoColacion = m.fecha_hora_servidor
          if (m.observacion === 'sin_colacion') reg.sinColacion = true
        })

        // loop — idéntico a MarcacionesView (sin filas)
        const resumenPorTrab = {}
        trabActivos.forEach((t) => {
          const horario    = horarios[t.id] || null
          const trabFechas = byTrabFecha[t.id] || {}
          let totTrab = 0, totProg = 0, diasTrab = 0, diasLab = 0

          const cur = new Date(primerDia)
          while (cur <= ultimoDia) {
            if (cur > hoy) { cur.setDate(cur.getDate() + 1); continue }

            const dow     = cur.getDay()
            const diaKey  = DIAS_SEM_KEY[dow]
            const fStr    = dayFmt.format(cur)
            const esFinde   = dow === 0 || dow === 6
            const esFeriado = feriadosSet.has(fStr)
            const lab = !esFinde && !esFeriado && (horario ? !!horario[diaKey] : true)
            const reg = trabFechas[fStr] || null

            if (lab) diasLab++

            const minTrab = calcMinTrab(reg, horario)
            const minProg = lab ? calcMinProg(horario, diaKey) : null

            if (lab && minTrab != null) diasTrab++
            if (minTrab) totTrab += minTrab
            if (lab && reg?.entrada && reg?.salida) totProg += minProg

            cur.setDate(cur.getDate() + 1)
          }

          resumenPorTrab[t.id] = {
            diasTrab, diasLab, totTrab, totProg,
            extras:    Math.max(0, totTrab - totProg),
            faltantes: Math.min(0, totTrab - totProg),
          }
        })

        const map = {}
        trabActivos.forEach((t) => {
          const r = resumenPorTrab[t.id]
          map[t.id] = {
            diasTrabajados:  r.diasTrab,
            diasFaltados:    r.diasLab - r.diasTrab,
            horasTrabajadas: +(r.totTrab / 60).toFixed(1),
            horasExtras:     +(r.extras  / 60).toFixed(1),
          }
        })

        setStatsMap(map)
      } catch (err) {
        console.error('[statsMap]', err)
      }
    }
    cargar()
  }, [trabajadores, horarios])

  /* â"€â"€ tabs â"€â"€ */
  const [activeTab,    setActiveTab]    = useState('equipo')
  const [solicitudTab, setSolicitudTab] = useState('vacaciones')

  /* â"€â"€ equipo â"€â"€ */
  const [search,       setSearch]       = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [deleteId,     setDeleteId]     = useState(null)
  const [detalleId,    setDetalleId]    = useState(null)

  /* â"€â"€ rechazar vacaciones (inline comment) â"€â"€ */
  const [rechazandoId,      setRechazandoId]      = useState(null)
  const [comentarioRechazo, setComentarioRechazo] = useState('')

  /* ── PDF modal vacaciones ── */
  const [pdfModal, setPdfModal] = useState(null)
  const docRef = useRef(null)

  const filtered = trabajadores.filter((t) => {
    const matchSearch =
      t.nombre.toLowerCase().includes(search.toLowerCase()) ||
      t.rut.includes(search) ||
      t.cargo.toLowerCase().includes(search.toLowerCase())
    const matchEstado = filtroEstado === 'todos' || t.estado === filtroEstado
    return matchSearch && matchEstado
  })

  const activos = trabajadores.filter((t) => t.estado === 'activo').length

  /* â"€â"€ conteo pendientes â"€â"€ */
  const pendientesVac = solicitudesVacaciones.filter((s) => s.estado === 'pendiente').length
  const pendientesCol = solicitudesColacion.filter((s) => s.estado === 'pendiente').length
  const totalPendientes = pendientesVac + pendientesCol

  /* â"€â"€ handlers â"€â"€ */
  const aprobarVacacion = (id) => {
    resolverSolicitudVacacion(id, 'aprobada', null, null)
  }
  const confirmarRechazoVacacion = (id) => {
    resolverSolicitudVacacion(id, 'rechazada', comentarioRechazo, null)
    setRechazandoId(null)
    setComentarioRechazo('')
  }
  const revertirVacacion = (id) => resolverSolicitudVacacion(id, 'pendiente', null, null)

  const aprobarColacion  = (id) => resolverSolicitudColacion(id, 'aprobada',  null)
  const rechazarColacion = (id) => resolverSolicitudColacion(id, 'rechazada', null)
  const revertirColacion = (id) => resolverSolicitudColacion(id, 'pendiente', null)

  const handleDownloadVacPDF = async () => {
    if (!docRef.current || !pdfModal) return
    const trab = trabajadores.find(t => t.id === pdfModal.trabajadorId)
    const nombre = (trab?.nombre || pdfModal.trabajadorNombre || 'trabajador').replace(/\s+/g, '_')
    await downloadPDF(docRef.current, `Vacaciones_${nombre}_${pdfModal.fechaDesde}.pdf`)
  }

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Trabajadores</h2>
          <p className="text-sm text-slate-500 mt-0.5">{activos} activos · {trabajadores.length} total</p>
        </div>
        {activeTab === 'equipo' && (
          <button onClick={() => navigate('/trabajadores/nuevo')} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo </span>Trabajador
          </button>
        )}
      </div>

      {/* Tabs principales */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('equipo')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'equipo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />Equipo
        </button>
        <button
          onClick={() => setActiveTab('solicitudes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'solicitudes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Inbox className="w-4 h-4" />Solicitudes
          {totalPendientes > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-xs leading-none font-bold">
              {totalPendientes}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('puntos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'puntos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <MapPin className="w-4 h-4" />Puntos de trabajo
        </button>
        <button
          onClick={() => setActiveTab('marcaciones')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'marcaciones' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart2 className="w-4 h-4" />Marcaciones
        </button>
        <button
          onClick={() => setActiveTab('adelantos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'adelantos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <DollarSign className="w-4 h-4" />Adelantos y Bonos
        </button>
      </div>

      {/* â"€â"€ TAB EQUIPO â"€â"€ */}
      {activeTab === 'equipo' && (
        <>
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, RUT o cargo..."
                  className="input-base pl-9"
                />
              </div>
              <div className="flex gap-1.5">
                {['todos', 'activo', 'inactivo'].map((e) => (
                  <button
                    key={e}
                    onClick={() => setFiltroEstado(e)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                      filtroEstado === e ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {e === 'todos' ? 'Todos' : e.charAt(0).toUpperCase() + e.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Users}
                title="Sin trabajadores"
                description="No hay trabajadores que coincidan con tu búsqueda."
                action={
                  <button onClick={() => navigate('/trabajadores/nuevo')} className="btn-primary">
                    <Plus className="w-4 h-4" />Nuevo Trabajador
                  </button>
                }
              />
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="table-th">Trabajador</th>
                    <th className="table-th hidden md:table-cell">RUT</th>
                    <th className="table-th hidden sm:table-cell">Ingreso</th>
                    <th className="table-th text-center">Estado</th>
                    {isAdmin && <th className="table-th text-right hidden lg:table-cell">Sueldo</th>}
                    <th className="table-th hidden xl:table-cell">Mes actual</th>
                    <th className="table-th text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((t) => {
                    const s = statsMap[t.id] || {}
                    const sinHorario = !horarios[t.id]
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="table-td">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                              <span className="text-indigo-600 font-bold text-xs">
                                {t.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                              </span>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800 text-sm">{t.nombre}</div>
                              <div className="text-xs text-slate-500">{t.cargo}</div>
                            </div>
                          </div>
                        </td>
                        <td className="table-td hidden md:table-cell">
                          <span className="font-mono text-xs text-slate-600">{t.rut}</span>
                        </td>
                        <td className="table-td hidden sm:table-cell text-xs text-slate-500">
                          {formatDate(t.fechaIngreso)}
                        </td>
                        <td className="table-td text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge status={t.estado} />
                            {t.appActiva && (
                              <span className="inline-flex items-center gap-1 text-xs text-indigo-600">
                                <Smartphone className="w-3 h-3" />App
                              </span>
                            )}
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="table-td text-right hidden lg:table-cell font-semibold text-slate-800 text-sm">
                            {formatCLP(t.sueldo)}
                          </td>
                        )}
                        <td className="table-td hidden xl:table-cell">
                          {sinHorario ? (
                            <span className="text-xs text-slate-300 italic">Sin horario</span>
                          ) : !statsMap[t.id] ? (
                            <span className="text-xs text-slate-300 italic">—</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">
                                <Calendar className="w-3 h-3" />{s.diasTrabajados ?? 0}d trab.
                              </span>
                              {(s.diasFaltados ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-600 text-xs font-medium">
                                  <AlertCircle className="w-3 h-3" />{s.diasFaltados}d falt.
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium">
                                <Clock className="w-3 h-3" />{s.horasTrabajadas ?? 0}h
                              </span>
                              {(s.horasExtras ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 text-violet-700 text-xs font-medium">
                                  <TrendingUp className="w-3 h-3" />+{s.horasExtras}h ext.
                                </span>
                              )}
                              <button
                                onClick={() => setDetalleId(t.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Ver detalle de marcaciones"
                              >
                                <BarChart2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="table-td text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => navigate(`/trabajadores/${t.id}/editar`)}
                              className="btn-ghost p-1.5"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteId(t.id)}
                              className="btn-ghost p-1.5 text-red-400 hover:text-red-600"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* â"€â"€ TAB SOLICITUDES â"€â"€ */}
      {activeTab === 'solicitudes' && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setSolicitudTab('vacaciones')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                solicitudTab === 'vacaciones' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Umbrella className="w-4 h-4" />Vacaciones
              {pendientesVac > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-xs leading-none font-bold">
                  {pendientesVac}
                </span>
              )}
            </button>
            <button
              onClick={() => setSolicitudTab('colacion')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                solicitudTab === 'colacion' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Clock className="w-4 h-4" />Omitir Colación
              {pendientesCol > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-xs leading-none font-bold">
                  {pendientesCol}
                </span>
              )}
            </button>
          </div>

          {/* â"€â"€ Vacaciones â"€â"€ */}
          {solicitudTab === 'vacaciones' && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Solicitudes de Vacaciones</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{solicitudesVacaciones.length} solicitudes · {pendientesVac} pendientes</p>
                </div>
              </div>

              {solicitudesVacaciones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Umbrella className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500">Sin solicitudes de vacaciones</p>
                  <p className="text-xs text-slate-400 mt-1">Las solicitudes enviadas desde la app aparecerán aquí.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {solicitudesVacaciones.map((s) => (
                    <div key={s.id} className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        {/* Trabajador avatar */}
                        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <span className="text-amber-700 font-bold text-xs">
                            {(s.trabajadorNombre || '?').split(' ').map((n) => n[0]).slice(0, 2).join('')}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-800 text-sm">{s.trabajadorNombre || 'â€"'}</span>
                            <EstadoBadge estado={s.estado} />
                          </div>

                          <div className="flex flex-wrap gap-4 text-xs text-slate-500 mb-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(s.fechaDesde)} â†’ {formatDate(s.fechaHasta)}
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <Umbrella className="w-3.5 h-3.5 text-amber-500" />
                              {s.diasHabiles} días hábiles
                            </span>
                            {s.motivo && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5" />
                                {s.motivo}
                              </span>
                            )}
                          </div>

                          {s.comentarioAdmin && (
                            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-2">
                              <span className="font-semibold text-slate-500">Nota admin: </span>
                              {s.comentarioAdmin}
                            </div>
                          )}

                          <div className="text-xs text-slate-400">
                            Solicitado el {formatDate(s.creadoEn?.split('T')[0])}
                            {s.resueltaEn && ` · Resuelto el ${formatDate(s.resueltaEn?.split('T')[0])}`}
                          </div>
                        </div>

                        {/* Acciones admin */}
                        {isAdmin && (
                          <div className="flex items-center gap-2 shrink-0">
                            {s.estado === 'pendiente' && (
                              <>
                                <button
                                  onClick={() => aprobarVacacion(s.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />Aprobar
                                </button>
                                <button
                                  onClick={() => { setRechazandoId(s.id); setComentarioRechazo('') }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                                >
                                  <XCircle className="w-3.5 h-3.5" />Rechazar
                                </button>
                              </>
                            )}
                            {(s.estado === 'aprobada' || s.estado === 'rechazada') && (
                              <button
                                onClick={() => revertirVacacion(s.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                title="Volver a pendiente"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />Revertir
                              </button>
                            )}
                            {s.estado === 'aprobada' && (
                              <button
                                onClick={() => setPdfModal(s)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                title="Ver solicitud PDF"
                              >
                                <FileText className="w-3.5 h-3.5" />PDF
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Panel de rechazo con comentario */}
                      {rechazandoId === s.id && (
                        <div className="mt-3 ml-12 p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                          <p className="text-xs font-semibold text-red-700">Motivo del rechazo (opcional)</p>
                          <textarea
                            value={comentarioRechazo}
                            onChange={(e) => setComentarioRechazo(e.target.value)}
                            placeholder="Ej: Período de alta demanda, conflicto con otro trabajador..."
                            rows={2}
                            className="input-base text-sm resize-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => confirmarRechazoVacacion(s.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />Confirmar rechazo
                            </button>
                            <button
                              onClick={() => setRechazandoId(null)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* â"€â"€ Omitir Colación â"€â"€ */}
          {solicitudTab === 'colacion' && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Solicitudes Omitir Colación</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{solicitudesColacion.length} solicitudes · {pendientesCol} pendientes</p>
                </div>
              </div>

              {solicitudesColacion.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Clock className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500">Sin solicitudes de colación</p>
                  <p className="text-xs text-slate-400 mt-1">Las solicitudes enviadas desde la app aparecerán aquí.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {solicitudesColacion.map((s) => (
                    <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:p-5">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <span className="text-indigo-700 font-bold text-xs">
                          {(s.trabajadorNombre || '?').split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-800 text-sm">{s.trabajadorNombre || 'â€"'}</span>
                          <EstadoBadge estado={s.estado} />
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />{formatDate(s.fecha)}
                          </span>
                          {s.motivo && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5" />{s.motivo}
                            </span>
                          )}
                          <span>Solicitado el {formatDate(s.creadoEn?.split('T')[0])}</span>
                        </div>
                      </div>

                      {/* Acciones admin */}
                      {isAdmin && (
                        <div className="flex items-center gap-2 shrink-0">
                          {s.estado === 'pendiente' && (
                            <>
                              <button
                                onClick={() => aprobarColacion(s.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />Aprobar
                              </button>
                              <button
                                onClick={() => rechazarColacion(s.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />Rechazar
                              </button>
                            </>
                          )}
                          {(s.estado === 'aprobada' || s.estado === 'rechazada') && (
                            <button
                              onClick={() => revertirColacion(s.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />Revertir
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* â"€â"€ TAB PUNTOS DE TRABAJO â"€â"€ */}
      {activeTab === 'puntos' && <PuntosTrabajoPage />}

      {/* ── TAB MARCACIONES ── */}
      {activeTab === 'marcaciones' && <MarcacionesView />}

      {/* â"€â"€ TAB ADELANTOS Y BONOS â"€â"€ */}
      {activeTab === 'adelantos' && <AdelantosBanosTab trabajadores={trabajadores} />}

      {detalleId && (() => {
        const t = trabajadores.find((w) => w.id === detalleId)
        if (!t) return null
        return (
          <DetalleMarcacionesModal
            trabajador={t}
            horario={horarios[t.id] || null}
            marcaciones={marcaciones.filter((m) => m.trabajadorId === t.id)}
            onClose={() => setDetalleId(null)}
          />
        )
      })()}

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteTrabajador(deleteId)}
        title="Eliminar trabajador"
        message={`¿Eliminar a ${trabajadores.find((t) => t.id === deleteId)?.nombre}? Esta acción no se puede deshacer.`}
      />

      {/* ── Modal PDF Solicitud de Vacaciones ── */}
      {pdfModal && (() => {
        const trab = trabajadores.find(t => t.id === pdfModal.trabajadorId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              {/* Header modal */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-800">Solicitud de Vacaciones</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadVacPDF}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />Descargar PDF
                  </button>
                  <button
                    onClick={() => setPdfModal(null)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Documento */}
              <div className="overflow-y-auto flex-1 p-6">
                <div
                  ref={docRef}
                  className="bg-white p-10 font-serif text-slate-900"
                  style={{ minHeight: '600px', fontFamily: 'Georgia, serif', fontSize: '14px', lineHeight: '1.8' }}
                >
                  {/* Logo y empresa */}
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      {empresa?.logo_url && (
                        <img src={empresa.logo_url} alt="Logo" style={{ maxHeight: '60px', maxWidth: '160px', objectFit: 'contain' }} />
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-base">{empresa?.razon_social || empresa?.nombre || ''}</p>
                      {empresa?.rut && <p className="text-sm text-slate-600">RUT: {empresa.rut}</p>}
                    </div>
                  </div>

                  {/* Título */}
                  <div className="text-center mb-8">
                    <h1 style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Solicitud de Vacaciones
                    </h1>
                    <div className="mt-2 mx-auto" style={{ width: '100px', borderBottom: '2px solid #334155' }} />
                  </div>

                  {/* Ciudad y fecha */}
                  <p className="mb-6">
                    {empresa?.ciudad || 'Santiago'}, {fechaEspanol(pdfModal.resueltaEn?.split('T')[0] || new Date().toISOString().split('T')[0])}
                  </p>

                  {/* Destinatario */}
                  <p className="mb-1">Señor(a): <strong>{empresa?.razon_social || empresa?.nombre || ''}</strong></p>
                  <p className="mb-6">Presente</p>

                  {/* Cuerpo */}
                  <p className="mb-4 text-justify">
                    Por medio de la presente, yo, <strong>{trab?.nombre || pdfModal.trabajadorNombre}</strong>,
                    RUT <strong>{trab?.rut || '—'}</strong>, solicito hacer uso de mi feriado legal (vacaciones)
                    correspondiente al período laboral vigente.
                  </p>

                  <p className="mb-8 text-justify">
                    Solicito que mis vacaciones se otorguen desde el día{' '}
                    <strong>{fechaEspanol(pdfModal.fechaDesde)}</strong> hasta el día{' '}
                    <strong>{fechaEspanol(pdfModal.fechaHasta)}</strong>,
                    reincorporándome a mis funciones el día{' '}
                    <strong>{nextBusinessDay(pdfModal.fechaHasta)}</strong>.
                  </p>

                  <p className="mb-2">Agradezco su atención y quedo a la espera de su aprobación.</p>
                  <p className="mb-10">Sin otro particular, le saluda atentamente,</p>

                  {/* Firma trabajador */}
                  <div className="mb-10">
                    <div style={{ borderBottom: '1px solid #334155', width: '240px', marginBottom: '6px' }} />
                    <p className="font-semibold">{trab?.nombre || pdfModal.trabajadorNombre}</p>
                    <p className="text-sm text-slate-600">RUT: {trab?.rut || '—'}</p>
                    <p className="text-sm text-slate-600">Cargo: {trab?.cargo || '—'}</p>
                  </div>

                  {/* Separador */}
                  <div style={{ borderTop: '1px solid #cbd5e1', marginBottom: '16px' }} />

                  {/* Firma empresa */}
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Firma y timbre empresa:</p>
                    <div style={{ borderBottom: '1px solid #334155', width: '240px', marginBottom: '6px' }} />
                    <p className="font-semibold">{empresa?.razon_social || empresa?.nombre || ''}</p>
                    {empresa?.rut && <p className="text-sm text-slate-600">RUT: {empresa.rut}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
