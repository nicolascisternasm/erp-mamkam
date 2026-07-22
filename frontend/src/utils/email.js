import emailjs from '@emailjs/browser'
import { formatCLP, formatDate } from './formatters'

const SVC    = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TPL    = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const OC_TPL = import.meta.env.VITE_EMAILJS_OC_TEMPLATE_ID
const KEY    = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

function generarTablaHTML(items) {
  const rows = items.map((i) => {
    const precio = i.valorUnitario ?? i.precio ?? 0
    return `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 12px;font-size:13px;color:#1e293b">
        <strong>${i.producto}</strong>
        ${i.incluirDescripcion && i.descripcion ? `<br><span style="color:#64748b;font-size:11px">${i.descripcion}</span>` : ''}
      </td>
      <td style="padding:8px 12px;font-size:13px;color:#475569;text-align:center">${i.cantidad}${i.medicion ? ` ${i.medicion}` : ''}</td>
      <td style="padding:8px 12px;font-size:13px;color:#475569;text-align:right">${formatCLP(precio)}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#0f172a;text-align:right">${formatCLP(i.cantidad * precio)}</td>
    </tr>`
  }).join('')

  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:8px 12px;font-size:11px;text-align:left;color:#64748b;font-weight:600;text-transform:uppercase">Producto / Servicio</th>
          <th style="padding:8px 12px;font-size:11px;text-align:center;color:#64748b;font-weight:600;text-transform:uppercase">Cant.</th>
          <th style="padding:8px 12px;font-size:11px;text-align:right;color:#64748b;font-weight:600;text-transform:uppercase">Precio Unit.</th>
          <th style="padding:8px 12px;font-size:11px;text-align:right;color:#64748b;font-weight:600;text-transform:uppercase">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

export async function sendCompraEmail(oc, proveedor) {
  const params = {
    to_email:       proveedor?.email || '',
    to_name:        proveedor?.nombre || '',
    tipo_documento: 'Orden de Compra',
    numero:         oc.numero,
    fecha:          formatDate(oc.fecha),
    direccion:      proveedor?.direccion ?? '',
    items_table:    generarTablaHTML(oc.items || []),
    neto:           formatCLP(oc.monto),
    iva:            formatCLP(Math.round(oc.monto * 0.19)),
    total:          formatCLP(Math.round(oc.monto * 1.19)),
    observaciones:  oc.observaciones ?? '',
  }

  if (!SVC || !(OC_TPL || TPL) || !KEY) {
    await new Promise((r) => setTimeout(r, 1200))
    return { status: 200, text: 'OK (modo demo)' }
  }

  return emailjs.send(SVC, OC_TPL || TPL, params, KEY)
}

export async function sendCotizacionEmail(cot) {
  const params = {
    to_email:       cot.email,
    to_name:        cot.cliente,
    tipo_documento: 'Cotización',
    numero:         cot.numero,
    fecha:          formatDate(cot.fecha),
    direccion:      [cot.direccion, cot.comuna].filter(Boolean).join(', '),
    items_table:    generarTablaHTML(cot.items),
    neto:           formatCLP(cot.neto ?? cot.total),
    iva:            formatCLP(cot.iva ?? 0),
    total:          formatCLP(cot.total),
    observaciones:  cot.observaciones || '—',
  }

  if (!SVC || !TPL || !KEY) {
    await new Promise((r) => setTimeout(r, 1600))
    return { status: 200, text: 'OK (modo demo)' }
  }

  return emailjs.send(SVC, TPL, params, KEY)
}
