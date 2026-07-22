const API_URL = import.meta.env.VITE_SHEETS_API_URL

export const isApiConfigured = () => Boolean(API_URL)

async function get(sheet) {
  const res  = await fetch(`${API_URL}?sheet=${encodeURIComponent(sheet)}`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.error)
  return json.data
}

async function write(action, sheet, payload) {
  const res = await fetch(API_URL, {
    method:   'POST',
    headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
    body:     JSON.stringify({ action, sheet, ...payload }),
    redirect: 'follow',
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error)
  return json.data
}

export const SheetsAPI = {
  // ── Lectura ──────────────────────────────────────────────────────────
  getCotizaciones:  () => get('Cotizaciones'),
  getCompras:       () => get('Compras'),
  getTrabajadores:  () => get('Trabajadores'),
  getMovimientos:   () => get('Movimientos'),
  getDocumentos:    () => get('Documentos'),

  // ── Cotizaciones ─────────────────────────────────────────────────────
  insertCotizacion: (data) => write('insert', 'Cotizaciones', { data }),
  updateCotizacion: (data) => write('update', 'Cotizaciones', { data }),
  deleteCotizacion: (id)   => write('delete', 'Cotizaciones', { id }),

  // ── Compras ───────────────────────────────────────────────────────────
  insertCompra: (data) => write('insert', 'Compras', { data }),
  updateCompra: (data) => write('update', 'Compras', { data }),

  // ── Trabajadores ──────────────────────────────────────────────────────
  insertTrabajador: (data) => write('insert', 'Trabajadores', { data }),
  updateTrabajador: (data) => write('update', 'Trabajadores', { data }),
  deleteTrabajador: (id)   => write('delete', 'Trabajadores', { id }),

  // ── Movimientos ───────────────────────────────────────────────────────
  insertMovimiento: (data) => write('insert', 'Movimientos', { data }),
  updateMovimiento: (data) => write('update', 'Movimientos', { data }),

  // ── Documentos ────────────────────────────────────────────────────────
  insertDocumento:  (data) => write('insert', 'Documentos', { data }),
  deleteDocumento:  (id)   => write('delete', 'Documentos', { id }),
}
