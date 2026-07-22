import { useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { formatCLP, formatDate } from '../../utils/formatters'
import { Zap, MapPin, Phone, Mail, Calendar, AlertCircle } from 'lucide-react'



function decode(str) {
  try {
    const raw = JSON.parse(decodeURIComponent(escape(atob(str))))
    // Lean format (new encoding uses single-char keys)
    if (raw.n !== undefined && raw.tt !== undefined) {
      return {
        numero: raw.n,
        cliente: raw.c,
        comuna: raw.m,
        direccion: raw.r,
        email: raw.e,
        telefono: raw.t,
        fecha: raw.f,
        estado: raw.s,
        observaciones: raw.o,
        items: (raw.i || []).map((it) => ({
          producto: it.p,
          incluirDescripcion: !!it.b,
          descripcion: it.b || '',
          cantidad: it.q,
          medicion: it.u || 'Unidad',
          valorUnitario: it.v,
        })),
        neto: raw.nt,
        iva: raw.iv,
        total: raw.tt,
        empresaLogoUrl: raw.el || null,
        empresaNombre:  raw.en || 'MAMKAM',
        empresaEmail:   raw.ee || null,
        empresaGiro:    raw.eg || null,
        empresaBanco:   raw.eb || null,
      }
    }
    // Old format fallback
    return raw
  } catch {
    return null
  }
}

const ESTADO_LABEL = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
}

const ESTADO_COLOR = {
  borrador: 'bg-slate-100 text-slate-600',
  enviada: 'bg-blue-100 text-blue-700',
  aprobada: 'bg-emerald-100 text-emerald-700',
  rechazada: 'bg-red-100 text-red-600',
}

export default function PublicCotizacionPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const cot = useMemo(() => decode(params.get('d') || ''), [params])

  if (!cot) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Cotización no disponible</h2>
          <p className="text-sm text-slate-500 mt-2">
            El enlace no es válido o ha expirado. Contáctanos para recibir una nueva copia.
          </p>
        </div>
      </div>
    )
  }

  const neto = cot.neto ?? cot.total
  const iva = cot.iva ?? 0

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto">
        {/* Documento */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header empresa */}
          <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {cot.empresaLogoUrl ? (
                <img
                  src={cot.empresaLogoUrl}
                  alt={cot.empresaNombre}
                  className="h-12 w-auto max-w-[140px] object-contain"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <div className="text-white font-bold text-lg tracking-tight">{cot.empresaNombre}</div>
                {cot.empresaEmail && <div className="text-slate-400 text-xs">{cot.empresaEmail}</div>}
                {cot.empresaGiro  && <div className="text-slate-500 text-xs">{cot.empresaGiro}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-bold text-xl">{cot.numero}</div>
              <div className="mt-1">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[cot.estado]}`}>
                  {ESTADO_LABEL[cot.estado]}
                </span>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-6">
            {/* Datos del cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Para</p>
                <p className="font-bold text-slate-800 text-base">{cot.cliente}</p>
                {(cot.direccion || cot.comuna) && (
                  <div className="flex items-start gap-1.5 mt-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-500">
                      {[cot.direccion, cot.comuna].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
                {cot.email && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <p className="text-sm text-slate-500">{cot.email}</p>
                  </div>
                )}
                {cot.telefono && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <p className="text-sm text-slate-500">{cot.telefono}</p>
                  </div>
                )}
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Fecha de emisión</p>
                <div className="flex sm:justify-end items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-sm text-slate-600">{formatDate(cot.fecha)}</p>
                </div>
                <p className="text-xs text-slate-400 mt-2">Válida por 15 días</p>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Ítems */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Detalle de productos / servicios
              </p>
              <div className="space-y-2">
                {cot.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-4 py-3 border-b border-slate-50 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm">{item.producto}</p>
                      {item.incluirDescripcion && item.descripcion && (
                        <p className="text-xs text-slate-400 mt-0.5">{item.descripcion}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {item.cantidad} {item.medicion || 'Unidad'} × {formatCLP(item.valorUnitario)}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm flex-shrink-0">
                      {formatCLP(item.cantidad * item.valorUnitario)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales */}
            <div className="bg-slate-50 rounded-xl p-5">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal Neto</span>
                  <span>{formatCLP(neto)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>IVA (19%)</span>
                  <span>{formatCLP(iva)}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-slate-200 mt-2">
                  <span className="font-bold text-slate-800">Total</span>
                  <span className="text-2xl font-bold text-indigo-600">{formatCLP(cot.total)}</span>
                </div>
              </div>
            </div>

            {/* Observaciones */}
            {cot.observaciones && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Observaciones</p>
                <p className="text-sm text-amber-800">{cot.observaciones}</p>
              </div>
            )}

            {/* Datos de transferencia */}
            {cot.empresaBanco?.banco && (
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Datos de Transferencia</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                  {cot.empresaBanco.banco             && <div><span className="text-slate-400">Banco: </span>{cot.empresaBanco.banco}</div>}
                  {cot.empresaBanco.tipo_cuenta       && <div><span className="text-slate-400">Tipo: </span>{cot.empresaBanco.tipo_cuenta}</div>}
                  {cot.empresaBanco.numero_cuenta     && <div><span className="text-slate-400">N° cuenta: </span>{cot.empresaBanco.numero_cuenta}</div>}
                  {cot.empresaBanco.rut_titular       && <div><span className="text-slate-400">RUT: </span>{cot.empresaBanco.rut_titular}</div>}
                  {cot.empresaBanco.nombre_titular    && <div><span className="text-slate-400">Titular: </span>{cot.empresaBanco.nombre_titular}</div>}
                  {cot.empresaBanco.email_transferencia && <div className="col-span-2"><span className="text-slate-400">Email: </span>{cot.empresaBanco.email_transferencia}</div>}
                </div>
              </div>
            )}

            {/* Pie */}
            <div className="text-center pt-2 pb-1">
              <p className="text-xs text-slate-400">
                Este documento es una cotización y no constituye una factura.
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Para aceptar o consultar, responde directamente a este mensaje.
              </p>
            </div>
          </div>
        </div>

        {/* Branding pie externo */}
        <p className="text-center text-xs text-slate-400 mt-4">
          Generado por <span className="font-semibold text-slate-500">MAMKAM ERP</span>
        </p>
      </div>
    </div>
  )
}
