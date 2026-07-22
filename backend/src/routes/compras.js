const { Router }                  = require('express')
const supabase                    = require('../lib/supabase.js')
const { requireAuth, requireRole } = require('../middleware/auth.js')

const router = Router()

/* ── SMTP transporter ───────────────────────────────────────────── */
function createTransporter() {
  const nodemailer = require('nodemailer')
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

/* ── Formatters ─────────────────────────────────────────────────── */
function formatCLP(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n ?? 0)
}

function formatDate(str) {
  if (!str) return ''
  const [y, m, d] = str.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

/* ── HTML del email ─────────────────────────────────────────────── */
function buildEmailHTML(oc) {
  const items  = Array.isArray(oc.items) ? oc.items : []
  const neto   = Math.round((oc.monto ?? 0) / 1.19)
  const iva    = (oc.monto ?? 0) - neto

  const itemRows = items.map(i => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b">
        <strong>${i.producto ?? ''}</strong>
        ${i.incluirDescripcion && i.descripcion ? `<br><span style="font-size:12px;color:#64748b">${i.descripcion}</span>` : ''}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:14px;color:#475569">${i.cantidad ?? 1}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;color:#475569">${formatCLP(i.precio)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;font-weight:600;color:#0f172a">${formatCLP((i.cantidad ?? 1) * (i.precio ?? 0))}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">

      <!-- Header -->
      <tr>
        <td style="background:#1e293b;padding:28px 36px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Orden de Compra</div>
                <div style="color:#ffffff;font-size:28px;font-weight:900;letter-spacing:-0.5px">${oc.numero ?? ''}</div>
                <div style="color:#64748b;font-size:13px;margin-top:4px">Fecha: ${formatDate(oc.fecha)}</div>
              </td>
              <td align="right">
                <div style="background:#3b82f6;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:4px 12px;border-radius:20px;display:inline-block">${oc.estado ?? 'creada'}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Saludo -->
      <tr>
        <td style="padding:28px 36px 0">
          <p style="margin:0;font-size:15px;color:#334155">Estimado/a <strong>${oc.proveedor ?? 'proveedor'}</strong>,</p>
          <p style="margin:12px 0 0;font-size:14px;color:#64748b;line-height:1.6">
            Adjuntamos la presente Orden de Compra emitida por <strong>MAMKAM</strong>.
            Por favor, confirme la recepción y proceda con la entrega de los productos o servicios indicados.
          </p>
        </td>
      </tr>

      <!-- Tabla de productos -->
      <tr>
        <td style="padding:24px 36px">
          <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8">Detalle de productos</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b">Producto</th>
                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b">Cant.</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b">Precio Unit.</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b">Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </td>
      </tr>

      <!-- Totales -->
      <tr>
        <td style="padding:0 36px 24px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:16px">
            <tr>
              <td style="font-size:13px;color:#64748b;padding:4px 16px">Subtotal Neto</td>
              <td style="font-size:13px;color:#64748b;text-align:right;padding:4px 16px">${formatCLP(neto)}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#64748b;padding:4px 16px">IVA (19%)</td>
              <td style="font-size:13px;color:#64748b;text-align:right;padding:4px 16px">${formatCLP(iva)}</td>
            </tr>
            <tr style="border-top:2px solid #e2e8f0">
              <td style="font-size:16px;font-weight:700;color:#0f172a;padding:10px 16px">Total Orden de Compra</td>
              <td style="font-size:20px;font-weight:900;color:#3b82f6;text-align:right;padding:10px 16px">${formatCLP(oc.monto)}</td>
            </tr>
          </table>
        </td>
      </tr>

      ${oc.observaciones ? `
      <!-- Observaciones -->
      <tr>
        <td style="padding:0 36px 24px">
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:#92400e">Observaciones</p>
            <p style="margin:0;font-size:14px;color:#78350f">${oc.observaciones}</p>
          </div>
        </td>
      </tr>` : ''}

      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center">
          <p style="margin:0;font-size:12px;color:#94a3b8">Este documento es una orden de compra interna y no constituye una factura.</p>
          <p style="margin:8px 0 0;font-size:13px;color:#64748b;font-weight:600">Equipo MAMKAM &nbsp;|&nbsp; contacto@mamkam.cl</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

/* ── Rutas CRUD ─────────────────────────────────────────────────── */
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { data, error } = await supabase
    .from('compras')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { data, error } = await supabase
    .from('compras')
    .insert([req.body])
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { data, error } = await supabase
    .from('compras')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

/* ── POST /:id/enviar-email ─────────────────────────────────────── */
router.post('/:id/enviar-email', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params

  /* 1. Obtener la compra */
  const { data: oc, error: ocErr } = await supabase
    .from('compras')
    .select('*')
    .eq('id', id)
    .single()
  if (ocErr || !oc) return res.status(404).json({ ok: false, error: 'OC no encontrada' })

  /* 2. Obtener email del proveedor */
  let proveedorEmail = null
  if (oc.proveedor_id) {
    const { data: prov } = await supabase
      .from('proveedores')
      .select('email')
      .eq('id', oc.proveedor_id)
      .single()
    proveedorEmail = prov?.email || null
  }

  if (!proveedorEmail) {
    return res.status(400).json({
      ok: false,
      error: `El proveedor "${oc.proveedor}" no tiene email registrado. Agrega el email en la seccion Proveedores antes de enviar.`,
    })
  }

  /* 3. Verificar credenciales SMTP */
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    /* Sin SMTP configurado: solo actualizar estado */
    const { error: updErr } = await supabase
      .from('compras')
      .update({ estado: 'enviada' })
      .eq('id', id)
    if (updErr) return res.status(500).json({ ok: false, error: updErr.message })
    return res.json({ ok: true, modo: 'sin_smtp', warning: 'SMTP no configurado: estado actualizado pero email no enviado.' })
  }

  /* 4. Construir adjuntos */
  const { pdfUrl } = req.body
  const attachments = []

  /* Adjunto: PDF de la OC (generado en el frontend) */
  if (pdfUrl) {
    try {
      const resp = await fetch(pdfUrl)
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer())
        attachments.push({ filename: `OC_${oc.numero}.pdf`, content: buf, contentType: 'application/pdf' })
      }
    } catch { /* adjunto opcional, no bloquear */ }
  }

  /* Adjunto: comprobante de pago legacy (voucher único) */
  if (oc.voucher?.url) {
    try {
      const resp = await fetch(oc.voucher.url)
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer())
        const ext = (oc.voucher.nombre || 'comprobante.pdf').split('.').pop().toLowerCase()
        attachments.push({ filename: `comprobante_pago_${oc.numero}.${ext}`, content: buf })
      }
    } catch { /* adjunto opcional, no bloquear */ }
  }

  /* Adjuntos: array de comprobantes (nuevo sistema) */
  if (Array.isArray(oc.comprobantes)) {
    for (let i = 0; i < oc.comprobantes.length; i++) {
      const comp = oc.comprobantes[i]
      if (!comp?.url) continue
      try {
        const resp = await fetch(comp.url)
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer())
          const ext = (comp.nombre || 'comprobante.pdf').split('.').pop().toLowerCase()
          attachments.push({ filename: `comprobante_${i + 1}_${oc.numero}.${ext}`, content: buf })
        }
      } catch { /* adjunto opcional, no bloquear */ }
    }
  }

  /* 5. Enviar email */
  try {
    const transporter = createTransporter()
    await transporter.sendMail({
      from:    `"MAMKAM" <${process.env.SMTP_USER}>`,
      to:      proveedorEmail,
      cc:      'contacto@mamkam.cl',
      subject: `Orden de Compra ${oc.numero} - MAMKAM`,
      html:    buildEmailHTML(oc),
      attachments,
    })
  } catch (mailErr) {
    return res.status(500).json({ ok: false, error: `Error al enviar email: ${mailErr.message}` })
  }

  /* 6. Actualizar estado */
  const { error: updErr } = await supabase
    .from('compras')
    .update({ estado: 'enviada' })
    .eq('id', id)
  if (updErr) return res.status(500).json({ ok: false, error: updErr.message })

  res.json({ ok: true })
})

module.exports = router
