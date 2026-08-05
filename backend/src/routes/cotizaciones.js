const { Router } = require('express')
const supabase = require('../lib/supabase.js')
const { requireAuth, requireRole } = require('../middleware/auth.js')

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*, cotizacion_items(*)')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ data })
})

router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*, cotizacion_items(*)')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'No encontrada' })
  res.json({ data })
})

router.post('/', requireAuth, async (req, res) => {
  const { items, ...cotData } = req.body
  const { data: cot, error } = await supabase
    .from('cotizaciones')
    .insert([cotData])
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })

  if (items?.length) {
    const rows = items.map((i) => ({ ...i, cotizacion_id: cot.id }))
    await supabase.from('cotizacion_items').insert(rows)
  }

  res.status(201).json({ data: cot })
})

router.patch('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('cotizaciones')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })

  if (req.body.estado) {
    sincronizarEstadoProyecto(supabase, req.params.id).catch((e) =>
      console.error('[sincronizarEstadoProyecto]', e)
    )
  }

  res.json({ data })
})

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { error } = await supabase.from('cotizaciones').delete().eq('id', req.params.id)
  if (error) return res.status(400).json({ error: error.message })
  res.status(204).end()
})

/* ── Sincronización automática de estado de proyecto ─────────── */
const COT_TO_PROYECTO_ESTADO = {
  borrador:     'planificacion',
  enviada:      'planificacion',
  visita:       'planificacion',
  aprobada:     'planificacion',
  en_ejecucion: 'ejecucion',
  ejecutada:    'cierre',
  cerrada:      'cierre',
  rechazada:    'cancelado',
  perdida:      'cancelado',
}
const PRIORIDAD = { planificacion: 1, ejecucion: 2, cierre: 3 }

async function sincronizarEstadoProyecto(supabase, cotizacionId) {
  // Proyectos que contienen esta cotización
  const { data: linksProyecto } = await supabase
    .from('proyecto_cotizaciones')
    .select('proyecto_id')
    .eq('cotizacion_id', cotizacionId)

  if (!linksProyecto?.length) return

  for (const { proyecto_id } of linksProyecto) {
    // Todas las cotizaciones del proyecto
    const { data: linksCot } = await supabase
      .from('proyecto_cotizaciones')
      .select('cotizacion_id')
      .eq('proyecto_id', proyecto_id)

    if (!linksCot?.length) continue

    const { data: cots } = await supabase
      .from('cotizaciones')
      .select('estado')
      .in('id', linksCot.map((l) => l.cotizacion_id))

    if (!cots?.length) continue

    const mapped = cots.map((c) => COT_TO_PROYECTO_ESTADO[c.estado]).filter(Boolean)
    const nonCancelado = mapped.filter((e) => e !== 'cancelado')
    const nuevoEstado = nonCancelado.length
      ? nonCancelado.reduce((best, e) => (PRIORIDAD[e] ?? 0) > (PRIORIDAD[best] ?? 0) ? e : best)
      : 'cancelado'

    // Solo actualiza si cambió (optimización, no excepción de lógica)
    const { data: actual } = await supabase
      .from('proyectos').select('estado').eq('id', proyecto_id).single()
    if (actual?.estado === nuevoEstado) continue

    await supabase
      .from('proyectos')
      .update({ estado: nuevoEstado, archivado: nuevoEstado === 'cierre' })
      .eq('id', proyecto_id)
  }
}

/* ── SMTP transporter ─────────────────────────────────────────── */
function createTransporter() {
  const nodemailer = require('nodemailer')
  return nodemailer.createTransport({
    host:       process.env.SMTP_HOST,
    port:       parseInt(process.env.SMTP_PORT || '587'),
    secure:     false,
    requireTLS: true,
    tls:        { rejectUnauthorized: false },
    family:     4,
    auth:       { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

function formatCLP(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n ?? 0)
}

function formatDate(str) {
  if (!str) return ''
  const [y, m, d] = str.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function buildCotizacionEmailHTML(cot) {
  const items = Array.isArray(cot.items) ? cot.items : []

  const itemRows = items.map(i => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b">
        <strong>${i.producto ?? ''}</strong>
        ${i.incluir_descripcion && i.descripcion ? `<br><span style="font-size:12px;color:#64748b">${i.descripcion}</span>` : ''}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:14px;color:#475569">${i.cantidad ?? 1}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;color:#475569">${formatCLP(i.valor_unitario)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;font-weight:600;color:#0f172a">${formatCLP((i.cantidad ?? 1) * (i.valor_unitario ?? 0))}</td>
    </tr>`).join('')

  const condicionesPago = Array.isArray(cot.condiciones_pago) ? cot.condiciones_pago : []
  const condicionesHTML = condicionesPago.length ? `
      <tr>
        <td style="padding:0 36px 24px">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8">Condiciones de pago</p>
          ${condicionesPago.map(cp => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569">
              <span>${cp.descripcion ?? ''}</span>
              <span style="font-weight:600;color:#0f172a">${formatCLP(cp.monto)}</span>
            </div>`).join('')}
        </td>
      </tr>` : ''

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">

      <tr>
        <td style="background:#1e293b;padding:28px 36px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Cotización</div>
                <div style="color:#ffffff;font-size:28px;font-weight:900;letter-spacing:-0.5px">${cot.numero ?? ''}</div>
                <div style="color:#64748b;font-size:13px;margin-top:4px">Fecha: ${formatDate(cot.fecha)}</div>
              </td>
              <td align="right">
                <div style="background:#6366f1;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:4px 12px;border-radius:20px;display:inline-block">${cot.estado ?? 'borrador'}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:28px 36px 0">
          <p style="margin:0;font-size:15px;color:#334155">Estimado/a <strong>${cot.cliente ?? 'cliente'}</strong>,</p>
          <p style="margin:12px 0 0;font-size:14px;color:#64748b;line-height:1.6">
            Nos complace presentarle la siguiente cotización preparada por <strong>MAMKAM</strong>.
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:24px 36px">
          <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8">Detalle</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b">Descripción</th>
                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b">Cant.</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b">Precio Unit.</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b">Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 36px 24px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:16px">
            <tr>
              <td style="font-size:13px;color:#64748b;padding:4px 16px">Subtotal Neto</td>
              <td style="font-size:13px;color:#64748b;text-align:right;padding:4px 16px">${formatCLP(cot.neto)}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#64748b;padding:4px 16px">IVA (19%)</td>
              <td style="font-size:13px;color:#64748b;text-align:right;padding:4px 16px">${formatCLP(cot.iva)}</td>
            </tr>
            <tr style="border-top:2px solid #e2e8f0">
              <td style="font-size:16px;font-weight:700;color:#0f172a;padding:10px 16px">Total Cotización</td>
              <td style="font-size:20px;font-weight:900;color:#6366f1;text-align:right;padding:10px 16px">${formatCLP(cot.total)}</td>
            </tr>
          </table>
        </td>
      </tr>

      ${condicionesHTML}

      ${cot.observaciones ? `
      <tr>
        <td style="padding:0 36px 24px">
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:#92400e">Observaciones</p>
            <p style="margin:0;font-size:14px;color:#78350f">${cot.observaciones}</p>
          </div>
        </td>
      </tr>` : ''}

      <tr>
        <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center">
          <p style="margin:0;font-size:12px;color:#94a3b8">Esta cotización tiene una validez de 30 días desde su emisión.</p>
          <p style="margin:8px 0 0;font-size:13px;color:#64748b;font-weight:600">Equipo MAMKAM &nbsp;|&nbsp; contacto@mamkam.cl</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

/* ── POST /:id/enviar-email ─────────────────────────────────────── */
router.post('/:id/enviar-email', async (req, res) => {
  console.log('[enviar-email] request recibida, id:', req.params.id)
  try {
    const { id } = req.params
    const { mensaje, pdfBase64 } = req.body
    console.log('[email backend] pdfBase64 recibido:', !!pdfBase64, 'length:', pdfBase64?.length)

    const { data: cot, error: cotErr } = await supabase
      .from('cotizaciones')
      .select('*')
      .eq('id', id)
      .single()

    if (cotErr || !cot) return res.status(404).json({ success: false, error: { message: 'Cotización no encontrada' } })

    if (!cot.email) {
      return res.status(400).json({ success: false, error: { message: 'La cotización no tiene email de cliente' } })
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      const { error: updErr } = await supabase
        .from('cotizaciones').update({ estado: 'enviada' }).eq('id', id)
      if (updErr) return res.status(500).json({ success: false, error: { message: updErr.message } })
      return res.json({ success: true, modo: 'sin_smtp', warning: 'SMTP no configurado: estado actualizado pero email no enviado.' })
    }

    try {
      const transporter = createTransporter()

      const htmlBody = `
        <p>${mensaje || 'Estimado cliente, adjunto encontrará nuestra cotización.'}</p>
        <p>Monto total: ${formatCLP(cot.total)}</p>
        <br>
        <p>Saludos,<br>Equipo MAMKAM<br>contacto@mamkam.cl</p>
      `

      const attachments = pdfBase64
        ? [{ filename: `Cotizacion-${cot.numero}-MAMKAM.pdf`, content: Buffer.from(pdfBase64, 'base64'), contentType: 'application/pdf' }]
        : []

      await transporter.sendMail({
        from:    `"MAMKAM" <${process.env.SMTP_USER}>`,
        to:      cot.email,
        cc:      'contacto@mamkam.cl',
        subject: `Cotización ${cot.numero} - MAMKAM`,
        html:    htmlBody,
        attachments,
      })

      await supabase
        .from('cotizaciones').update({ estado: 'enviada' }).eq('id', id)

      return res.json({ success: true, mensaje: 'Correo enviado correctamente' })
    } catch (mailErr) {
      console.error('[Email Cotizacion] Error nodemailer:', mailErr.message, mailErr.code, mailErr.response)
      return res.status(500).json({ success: false, error: { message: `Error al enviar email: ${mailErr.message}` } })
    }
  } catch (err) {
    console.error('[enviar-email] ERROR NO CAPTURADO:', err.message, err.stack)
    return res.status(500).json({ success: false, error: { message: err.message } })
  }
})

/* ── POST /:id/enviar-email-ejecucion ──────────────────────────── */
router.post('/:id/enviar-email-ejecucion', async (req, res) => {
  try {
    const { id } = req.params
    const { destinatario, mensaje, fotosIds = [], comprobantesIncluidos = [], fotosManuales = [] } = req.body

    if (!destinatario) {
      return res.status(400).json({ success: false, error: { message: 'El destinatario es requerido' } })
    }

    const { data: cot, error: cotErr } = await supabase
      .from('cotizaciones')
      .select('*')
      .eq('id', id)
      .single()
    if (cotErr || !cot) return res.status(404).json({ success: false, error: { message: 'Cotización no encontrada' } })

    // Calcular saldo en backend a partir de DB
    const condiciones       = cot.condiciones_pago    ?? []
    const pagosComprobantes = cot.pagos_comprobantes  ?? []
    const condicionesConSaldo = condiciones.map(cp => {
      const monto  = cp.monto || Math.round((cot.total || 0) * (cp.porcentaje || 0) / 100)
      const pagado = pagosComprobantes
        .filter(p => String(p.condicion_id) === String(cp.id))
        .reduce((s, p) => s + (Number(p.monto) || 0), 0)
      return { descripcion: cp.descripcion, monto, pagado, saldo: monto - pagado }
    })
    const totalPagado = pagosComprobantes.reduce((s, p) => s + (Number(p.monto) || 0), 0)
    const totalSaldo  = (cot.total || 0) - totalPagado

    // Descargar fotos seleccionadas
    const attachments = []
    if (fotosIds.length) {
      const { data: fotos } = await supabase
        .from('visita_fotos')
        .select('id, url, nombre_archivo')
        .in('id', fotosIds)
      for (const foto of (fotos || [])) {
        try {
          const resp = await fetch(foto.url)
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const buf  = Buffer.from(await resp.arrayBuffer())
          attachments.push({ filename: foto.nombre_archivo || `foto-${foto.id}.jpg`, content: buf })
        } catch (e) {
          console.error(`[enviar-email-ejecucion] Error descargando foto ${foto.id}:`, e.message)
        }
      }
    }

    // Descargar comprobantes seleccionados
    for (const idx of comprobantesIncluidos) {
      const comp = pagosComprobantes[idx]
      if (!comp?.url) continue
      try {
        const resp = await fetch(comp.url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const buf  = Buffer.from(await resp.arrayBuffer())
        attachments.push({ filename: comp.nombre || comp.nombre_archivo || `comprobante-${idx + 1}.pdf`, content: buf })
      } catch (e) {
        console.error(`[enviar-email-ejecucion] Error descargando comprobante ${idx}:`, e.message)
      }
    }

    // Adjuntar fotos manuales (base64, sin persistir)
    for (const f of fotosManuales) {
      if (!f?.base64 || !f?.nombre) continue
      try {
        attachments.push({ filename: f.nombre, content: Buffer.from(f.base64, 'base64') })
      } catch (e) {
        console.error(`[enviar-email-ejecucion] Error procesando foto manual "${f.nombre}":`, e.message)
      }
    }

    // Advertencia de tamaño total
    const totalBytes = attachments.reduce((s, a) => s + (a.content?.length || 0), 0)
    if (totalBytes > 15 * 1024 * 1024) {
      console.warn(`[enviar-email-ejecucion] AVISO: adjuntos totales = ${(totalBytes / 1024 / 1024).toFixed(1)} MB — puede exceder límite SMTP (15 MB)`)
    }

    // Construir HTML
    const saldoRows = condicionesConSaldo.map(c => `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:8px 12px;font-size:13px;color:#475569">${c.descripcion || '—'}</td>
        <td style="padding:8px 12px;font-size:13px;color:#475569;text-align:right">${formatCLP(c.monto)}</td>
        <td style="padding:8px 12px;font-size:13px;color:#059669;text-align:right">${formatCLP(c.pagado)}</td>
        <td style="padding:8px 12px;font-size:13px;font-weight:600;color:${c.saldo > 0 ? '#dc2626' : '#059669'};text-align:right">${formatCLP(c.saldo)}</td>
      </tr>`).join('')

    const mensajeHtml = (mensaje || '').replace(/\n/g, '<br>')
    const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
      <tr>
        <td style="background:#0d9488;padding:28px 36px">
          <div style="color:#fff;font-size:22px;font-weight:900">Proyecto Finalizado</div>
          <div style="color:#99f6e4;font-size:13px;margin-top:4px">Cotización ${cot.numero} · ${cot.cliente || ''}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 36px 16px">
          <div style="font-size:14px;color:#334155;line-height:1.7">${mensajeHtml}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 36px 28px">
          <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8">Detalle de saldo pendiente</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase">Condición</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase">Total</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase">Pagado</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase">Saldo</th>
              </tr>
            </thead>
            <tbody>${saldoRows || '<tr><td colspan="4" style="padding:12px;color:#94a3b8;text-align:center;font-size:13px">Sin condiciones de pago definidas</td></tr>'}</tbody>
            <tfoot>
              <tr style="background:#f8fafc;border-top:2px solid #e2e8f0">
                <td style="padding:10px 12px;font-weight:700;font-size:14px;color:#0f172a" colspan="2">Total pendiente</td>
                <td style="padding:10px 12px;text-align:right;font-weight:700;color:#059669">${formatCLP(totalPagado)}</td>
                <td style="padding:10px 12px;text-align:right;font-weight:900;font-size:16px;color:${totalSaldo > 0 ? '#dc2626' : '#059669'}">${formatCLP(totalSaldo)}</td>
              </tr>
            </tfoot>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center">
          <p style="margin:0;font-size:13px;color:#64748b;font-weight:600">Equipo MAMKAM &nbsp;|&nbsp; contacto@mamkam.cl</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      await supabase.from('cotizaciones').update({
        email_ejecucion_enviado: true,
        email_ejecucion_fecha:   new Date().toISOString(),
        email_ejecucion_mensaje: mensaje,
      }).eq('id', id)
      return res.json({ success: true, modo: 'sin_smtp', warning: 'SMTP no configurado: estado actualizado pero email no enviado.' })
    }

    try {
      const transporter = createTransporter()
      await transporter.sendMail({
        from:        `"MAMKAM" <${process.env.SMTP_USER}>`,
        to:          destinatario,
        cc:          'contacto@mamkam.cl',
        subject:     `Proyecto finalizado — Cotización ${cot.numero} — MAMKAM`,
        html:        htmlBody,
        attachments,
      })
    } catch (mailErr) {
      console.error('[enviar-email-ejecucion] Error nodemailer:', mailErr.message)
      return res.status(500).json({ success: false, error: { message: `Error al enviar email: ${mailErr.message}` } })
    }

    await supabase.from('cotizaciones').update({
      email_ejecucion_enviado: true,
      email_ejecucion_fecha:   new Date().toISOString(),
      email_ejecucion_mensaje: mensaje,
    }).eq('id', id)

    return res.json({ success: true, mensaje: 'Correo de término enviado correctamente' })

  } catch (err) {
    console.error('[enviar-email-ejecucion] ERROR:', err.message, err.stack)
    return res.status(500).json({ success: false, error: { message: err.message } })
  }
})

/* ── Backfill: recalcular estado de TODOS los proyectos existentes ── */
// Endpoint temporal — llamar UNA sola vez desde Postman/navegador con token admin.
// Eliminar o dejar inactivo una vez verificado el resultado.
router.post('/admin/backfill-proyectos', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: links } = await supabase
      .from('proyecto_cotizaciones')
      .select('proyecto_id')

    if (!links?.length) return res.json({ proyectosConCotizacion: 0, actualizados: 0, cambios: [] })

    const proyectoIds = [...new Set(links.map((l) => l.proyecto_id))]
    const cambios = []

    for (const proyectoId of proyectoIds) {
      const { data: linksCot } = await supabase
        .from('proyecto_cotizaciones')
        .select('cotizacion_id')
        .eq('proyecto_id', proyectoId)

      if (!linksCot?.length) continue

      const { data: cots } = await supabase
        .from('cotizaciones')
        .select('estado')
        .in('id', linksCot.map((l) => l.cotizacion_id))

      if (!cots?.length) continue

      const mapped     = cots.map((c) => COT_TO_PROYECTO_ESTADO[c.estado]).filter(Boolean)
      const nonCancel  = mapped.filter((e) => e !== 'cancelado')
      const nuevoEstado = nonCancel.length
        ? nonCancel.reduce((best, e) => (PRIORIDAD[e] ?? 0) > (PRIORIDAD[best] ?? 0) ? e : best)
        : 'cancelado'

      const { data: actual } = await supabase
        .from('proyectos')
        .select('id, codigo, nombre, estado')
        .eq('id', proyectoId)
        .single()

      if (!actual) continue
      if (actual.estado === nuevoEstado) continue

      await supabase
        .from('proyectos')
        .update({ estado: nuevoEstado, archivado: nuevoEstado === 'cierre' })
        .eq('id', proyectoId)

      cambios.push({ id: proyectoId, codigo: actual.codigo, nombre: actual.nombre, antes: actual.estado, despues: nuevoEstado })
    }

    res.json({ proyectosConCotizacion: proyectoIds.length, actualizados: cambios.length, cambios })
  } catch (err) {
    console.error('[backfill-proyectos]', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
