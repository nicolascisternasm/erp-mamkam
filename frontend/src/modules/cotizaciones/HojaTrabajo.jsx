import { useState, useEffect, useRef } from 'react'
import { ClipboardCheck, Paperclip, Download, Trash2, Loader2, MapPin, MessageCircle, ChevronDown, Film } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { downloadPDF } from '../../utils/pdf'

export default function HojaTrabajo({ cot, user, empresa }) {
  const [hojaId,        setHojaId]        = useState(null)
  const [observaciones, setObservaciones] = useState('')
  const [adjuntos,      setAdjuntos]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [subiendo,      setSubiendo]      = useState([])    // [{ id, name }]
  const [guardando,    setGuardando]    = useState(false)
  const [savedOk,      setSavedOk]      = useState(false)
  const [pdfReady,     setPdfReady]     = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [usuarios,     setUsuarios]     = useState([])
  const [encargadoId,  setEncargadoId]  = useState(null)

  const [activeTab,     setActiveTab]     = useState('hoja')
  const [visita,        setVisita]        = useState(null)
  const [checklist,     setChecklist]     = useState([])
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [fotos,         setFotos]         = useState([])
  const [fotosOpen,     setFotosOpen]     = useState(false)
  const [lightbox,      setLightbox]      = useState(null)
  const [loadingVisita, setLoadingVisita] = useState(false)

  const fileInputRef = useRef(null)
  const debounceRef  = useRef(null)
  const pdfRef       = useRef(null)

  const productos = (cot.items || []).map(i => i.producto).filter(Boolean).join(', ') || '—'
  const direccion  = [cot.direccion, cot.comuna].filter(Boolean).join(', ') || '—'
  const fechaGen   = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const empresaId  = user?.empresa_id

  /* ── Inicializar hoja al montar ── */
  useEffect(() => {
    async function init() {
      setLoading(true)

      let { data: hoja } = await supabase
        .from('hoja_trabajo')
        .select('*')
        .eq('cotizacion_id', cot.id)
        .maybeSingle()

      if (!hoja) {
        const { data: created } = await supabase
          .from('hoja_trabajo')
          .insert({ cotizacion_id: cot.id, empresa_id: empresaId, observaciones: '' })
          .select()
          .single()
        hoja = created
      }

      if (hoja) {
        setHojaId(hoja.id)
        setObservaciones(hoja.observaciones || '')
        setEncargadoId(hoja.encargado_id || null)

        const { data: adj } = await supabase
          .from('hoja_trabajo_adjuntos')
          .select('*')
          .eq('hoja_id', hoja.id)
          .order('created_at')
        setAdjuntos(adj || [])
      }

      const { data: users } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos, telefono')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .order('nombre')
      setUsuarios(users || [])

      const { data: visitaData } = await supabase
        .from('visitas')
        .select('id, fecha_agendada, productos, responsable_visita, instalador_nombre, notas_previas, resumen_ia, estado')
        .eq('cotizacion_id', cot.id)
        .maybeSingle()
      setVisita(visitaData || null)

      setLoading(false)
    }
    void init()
  }, [cot.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cargar checklist y fotos al abrir tab Visita ── */
  useEffect(() => {
    if (activeTab !== 'visita' || !visita?.id) return
    async function loadVisitaData() {
      setLoadingVisita(true)
      const [{ data: cl }, { data: ft }] = await Promise.all([
        supabase
          .from('visita_checklist')
          .select('respuesta, pregunta_label, critical, unidad')
          .eq('visita_id', visita.id)
          .not('respuesta', 'is', null)
          .neq('respuesta', '')
          .order('unidad')
          .order('created_at'),
        supabase
          .from('visita_fotos')
          .select('*')
          .eq('visita_id', visita.id)
          .order('created_at'),
      ])
      setChecklist(cl || [])
      setFotos(ft || [])
      setLoadingVisita(false)
    }
    void loadVisitaData()
  }, [activeTab, visita?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Observaciones con debounce 800ms ── */
  function handleObservaciones(value) {
    setObservaciones(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!hojaId) return
      setGuardando(true)
      await supabase
        .from('hoja_trabajo')
        .update({ observaciones: value, updated_at: new Date().toISOString() })
        .eq('id', hojaId)
      setGuardando(false)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2000)
    }, 800)
  }

  /* ── Seleccionar encargado (guardado inmediato) ── */
  async function handleEncargado(id) {
    setEncargadoId(id)
    if (!hojaId) return
    await supabase
      .from('hoja_trabajo')
      .update({ encargado_id: id || null, updated_at: new Date().toISOString() })
      .eq('id', hojaId)
    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 2000)
  }

  /* ── Subir adjuntos ── */
  async function handleAdjuntar(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length || !hojaId) return

    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) continue
      const uploadId = `${Date.now()}_${Math.random()}`
      const bucket   = file.type.startsWith('video/') ? 'visitas-audios' : 'visitas-fotos'
      const path     = `hoja-trabajo/${cot.id}/${Date.now()}_${file.name.replace(/\s/g, '_')}`

      setSubiendo(prev => [...prev, { id: uploadId, name: file.name }])

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: false, contentType: file.type })

      if (upErr) {
        setSubiendo(prev => prev.filter(s => s.id !== uploadId))
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path)

      const { data: adj } = await supabase
        .from('hoja_trabajo_adjuntos')
        .insert({
          hoja_id:        hojaId,
          url:            publicUrl,
          nombre_archivo: file.name,
          tamano_kb:      Math.round(file.size / 1024),
          subido_por:     user?.nombre || user?.email || null,
          bucket,
        })
        .select()
        .single()

      if (adj) setAdjuntos(prev => [...prev, adj])
      setSubiendo(prev => prev.filter(s => s.id !== uploadId))
    }
  }

  /* ── Eliminar adjunto ── */
  async function handleEliminar(adjunto) {
    if (!window.confirm(`¿Eliminar "${adjunto.nombre_archivo}"?`)) return
    const bucket      = adjunto.bucket || 'visitas-fotos'
    const parts       = adjunto.url.split(`/${bucket}/`)
    const storagePath = parts[1]
    if (storagePath) {
      await supabase.storage.from(bucket).remove([storagePath])
    }
    await supabase.from('hoja_trabajo_adjuntos').delete().eq('id', adjunto.id)
    setAdjuntos(prev => prev.filter(a => a.id !== adjunto.id))
  }

  /* ── PDF: disparar downloadPDF tras renderizar el div off-screen ── */
  useEffect(() => {
    if (!pdfReady) return
    const el = pdfRef.current
    if (!el) return
    let cancelled = false
    downloadPDF(el, `HojaTrabajo_${cot.numero}.pdf`)
      .finally(() => {
        if (!cancelled) {
          setPdfReady(false)
          setGenerandoPdf(false)
        }
      })
    return () => { cancelled = true }
  }, [pdfReady, cot.numero])

  function handleDescargarPdf() {
    setGenerandoPdf(true)
    setPdfReady(true)
  }

  const fmtKb = kb => kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`

  const encargado         = usuarios.find(u => u.id === encargadoId) || null
  const telefonoEncargado = encargado?.telefono || null

  const mapsQuery = encodeURIComponent([cot.direccion, cot.comuna, 'Chile'].filter(Boolean).join(', '))
  const mapsUrl   = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`

  function handleMaps() {
    window.open(mapsUrl, '_blank')
  }

  function handleWhatsApp() {
    const numero = telefonoEncargado.replace(/\D/g, '')
    const lineas = [
      `*HOJA DE TRABAJO — ${cot.numero}*`,
      '',
      `*Cliente:* ${cot.cliente || '—'}`,
      `*Dirección:* ${[cot.direccion, cot.comuna].filter(Boolean).join(', ') || '—'}`,
      `*Productos:* ${productos}`,
      '',
      '*Observaciones:*',
      observaciones || '(Sin observaciones)',
    ]
    if (adjuntos.length > 0) {
      lineas.push('')
      lineas.push(`*Adjuntos (${adjuntos.length}):*`)
      adjuntos.forEach(a => lineas.push(`• ${a.nombre_archivo} → ${a.url}`))
    }
    lineas.push('')
    lineas.push(`📍 Ver ubicación: ${mapsUrl}`)
    lineas.push('')
    lineas.push('_Enviado desde MAMKAM ERP_')
    const mensaje = encodeURIComponent(lineas.join('\n'))
    window.open(`https://wa.me/${numero}?text=${mensaje}`, '_blank')
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="sticky top-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-slate-300" />
          <span className="text-sm font-semibold text-white">Hoja de Trabajo</span>
        </div>
        <span className="text-xs text-slate-400">{cot.numero}</span>
      </div>

      {/* ── Datos del proyecto ── */}
      <div className="px-4 py-3 border-b border-slate-100 space-y-1.5">
        <DataRow label="Cliente"   value={cot.cliente || '—'} />
        <DataRow label="Dirección" value={direccion} />
        <DataRow label="Productos" value={productos} />
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-slate-100">
        {[['hoja', 'Hoja'], ['visita', 'Visita']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              activeTab === id
                ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/40'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Observaciones ── */}
      {activeTab === 'hoja' && (<>
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Observaciones</span>
          {(guardando || savedOk) && (
            <span className={`text-xs font-medium ${savedOk ? 'text-emerald-600' : 'text-slate-400'}`}>
              {savedOk ? 'Guardado ✓' : 'Guardando…'}
            </span>
          )}
        </div>
        <textarea
          value={observaciones}
          onChange={e => handleObservaciones(e.target.value)}
          placeholder="Agregar observaciones..."
          rows={5}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none leading-relaxed"
        />
      </div>

      {/* ── Encargado de instalaciones ── */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Encargado de instalaciones</span>
          {savedOk && (
            <span className="text-xs font-medium text-emerald-600">Guardado ✓</span>
          )}
        </div>
        <select
          value={encargadoId || ''}
          onChange={e => handleEncargado(e.target.value || null)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-slate-700"
        >
          <option value="">Seleccionar encargado...</option>
          {usuarios.map(u => (
            <option key={u.id} value={u.id}>
              {[u.nombre, u.apellidos].filter(Boolean).join(' ')}
            </option>
          ))}
        </select>
        {encargadoId && !telefonoEncargado && (
          <p className="text-xs text-red-500 mt-1">Este usuario no tiene teléfono registrado</p>
        )}
      </div>

      {/* ── Adjuntos ── */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Adjuntos</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Paperclip className="w-3.5 h-3.5" />
            Adjuntar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            multiple
            className="hidden"
            onChange={handleAdjuntar}
          />
        </div>

        {subiendo.map(s => (
          <div key={s.id} className="flex items-center gap-2 py-1.5 text-xs text-indigo-600">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span className="truncate">{s.name}</span>
          </div>
        ))}

        {adjuntos.length === 0 && subiendo.length === 0 ? (
          <p className="text-xs text-slate-400 py-1">Sin adjuntos.</p>
        ) : (
          <div className="space-y-0.5">
            {adjuntos.map(a => (
              <div key={a.id} className="flex items-center gap-2 py-1.5 group">
                <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-700 hover:text-indigo-600 truncate flex-1"
                >
                  {a.nombre_archivo}
                </a>
                <span className="text-[10px] text-slate-400 shrink-0">{fmtKb(a.tamano_kb)}</span>
                <button
                  onClick={() => handleEliminar(a)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-red-500 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Acciones ── */}
      <div className="px-4 py-3 border-b border-slate-100 space-y-2">
        <button
          onClick={handleMaps}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
        >
          <MapPin className="w-4 h-4" />
          Ver en Google Maps
        </button>
        {encargadoId && telefonoEncargado && (
          <button
            onClick={handleWhatsApp}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Enviar por WhatsApp
          </button>
        )}
      </div>

      {/* ── Descargar PDF ── */}
      <div className="px-4 py-3">
        <button
          onClick={handleDescargarPdf}
          disabled={generandoPdf}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          {generandoPdf
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Download className="w-4 h-4" />}
          {generandoPdf ? 'Preparando...' : 'Descargar Hoja de Trabajo'}
        </button>
      </div>
      </>)}

      {/* ── Tab Visita ── */}
      {activeTab === 'visita' && (
        <div className="px-4 py-4 space-y-3">
          {!visita ? (
            <p className="text-xs text-slate-400 text-center py-6">No hay visita registrada para esta cotización.</p>
          ) : (
            <>
              {/* Estado + datos clave */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${VISITA_ESTADO_STYLES[visita.estado] || 'bg-slate-100 text-slate-600'}`}>
                  {visita.estado}
                </span>
              </div>

              <div className="space-y-1.5">
                {visita.fecha_agendada && <DataRow label="Fecha"       value={visita.fecha_agendada} />}
                {visita.responsable_visita && <DataRow label="Responsable" value={visita.responsable_visita} />}
                {visita.instalador_nombre  && <DataRow label="Instalador"  value={visita.instalador_nombre} />}
              </div>

              {/* Chips de productos */}
              {Array.isArray(visita.productos) && visita.productos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {visita.productos.map(p => (
                    <span key={p} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {p}
                    </span>
                  ))}
                </div>
              )}

              {/* Notas previas */}
              {visita.notas_previas && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Notas previas</p>
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5 leading-relaxed">{visita.notas_previas}</p>
                </div>
              )}

              {/* ── Checklist (acordeón) ── */}
              {loadingVisita ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  <div className="border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setChecklistOpen(o => !o)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors"
                    >
                      <span>Checklist ({checklist.length})</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${checklistOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {checklistOpen && (
                      checklist.length === 0 ? (
                        <p className="text-xs text-slate-400 mt-2">Sin respuestas registradas.</p>
                      ) : (() => {
                        const grupos = checklist.reduce((acc, item) => {
                          const u = item.unidad || 1
                          if (!acc[u]) acc[u] = []
                          acc[u].push(item)
                          return acc
                        }, {})
                        const unidades = Object.keys(grupos).map(Number).sort()
                        const multiU   = unidades.length > 1 || unidades[0] > 1
                        return (
                          <div className="mt-2 space-y-3">
                            {unidades.map(u => (
                              <div key={u}>
                                {multiU && (
                                  <p className="text-xs font-semibold text-amber-700 mb-1.5">Toldo {u}</p>
                                )}
                                <div className="space-y-1.5">
                                  {grupos[u].map((item, i) => (
                                    <div key={i} className="bg-slate-50 rounded-lg px-2.5 py-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="text-xs text-slate-600 leading-snug flex-1">{item.pregunta_label}</span>
                                        {item.critical && (
                                          <span className="shrink-0 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">⚠ Crítica</span>
                                        )}
                                      </div>
                                      <p className="text-xs font-medium text-slate-800 mt-0.5">{item.respuesta}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()
                    )}
                  </div>

                  {/* ── Fotos y Videos (acordeón) ── */}
                  <div className="border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setFotosOpen(o => !o)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors"
                    >
                      <span>Fotos y videos ({fotos.length})</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${fotosOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {fotosOpen && (
                      fotos.length === 0 ? (
                        <p className="text-xs text-slate-400 mt-2">Sin fotos registradas.</p>
                      ) : (
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {fotos.map(f => (
                            f.tipo === 'video' ? (
                              <div key={f.id} className="aspect-square bg-slate-100 rounded-lg flex flex-col items-center justify-center gap-1 px-1">
                                <Film className="w-5 h-5 text-slate-400" />
                                <span className="text-[9px] text-slate-500 text-center leading-tight truncate w-full text-center">{f.nombre_archivo}</span>
                              </div>
                            ) : (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setLightbox(f.url)}
                                className="aspect-square rounded-lg overflow-hidden bg-slate-100 hover:opacity-90 transition-opacity"
                              >
                                <img src={f.url} alt={f.nombre_archivo} className="w-full h-full object-cover" />
                              </button>
                            )
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* ── Div off-screen para html2canvas ── */}
      {pdfReady && (
        <div
          ref={pdfRef}
          style={{
            position: 'fixed', top: 0, left: '-9999px',
            width: '794px', background: '#ffffff',
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: '13px', color: '#1e293b', lineHeight: '1.6',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ background: '#1e3a5f', padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>MAMKAM</div>
              <div style={{ fontSize: '12px', color: '#93c5fd', marginTop: '3px' }}>Documento Interno</div>
            </div>
            <div style={{ textAlign: 'right', color: '#bfdbfe', fontSize: '12px', lineHeight: '1.8' }}>
              <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>HOJA DE TRABAJO</div>
              <div>{cot.numero}</div>
              <div>{fechaGen}</div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '32px 40px' }}>

            {/* Datos del proyecto */}
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '16px' }}>
              Datos del Proyecto
            </div>
            <div style={{ marginBottom: '24px' }}>
              {[
                ['Cliente',    cot.cliente || '—'],
                ['Dirección',  direccion],
                ['Productos',  productos],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: '16px', paddingBottom: '8px', marginBottom: '8px', borderBottom: '1px solid #f8fafc' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', width: '100px', flexShrink: 0 }}>{label}</div>
                  <div style={{ fontSize: '13px', color: '#1e293b', flex: 1 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Observaciones */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                Observaciones
              </div>
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.7', whiteSpace: 'pre-wrap', minHeight: '80px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                {observaciones || '(Sin observaciones)'}
              </div>
            </div>

            {/* Adjuntos */}
            {adjuntos.length > 0 && (
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                  Adjuntos ({adjuntos.length})
                </div>
                {adjuntos.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: i < adjuntos.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }} />
                    <div style={{ fontSize: '13px', color: '#475569', flex: 1 }}>{a.nombre_archivo}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{fmtKb(a.tamano_kb)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '16px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                Generado por {user?.nombre || user?.email || '—'} — {empresa?.nombre_fantasia || empresa?.nombre || empresa?.razon_social || 'MAMKAM'} · {fechaGen}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

const VISITA_ESTADO_STYLES = {
  planificada: 'bg-blue-100 text-blue-700',
  ejecutada:   'bg-emerald-100 text-emerald-700',
}

function DataRow({ label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-slate-400 min-w-[72px] shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-slate-700 leading-relaxed">{value}</span>
    </div>
  )
}
