// ══════════════════════════════════════════════════════════════════════
//  MAMKAM ERP — Google Apps Script API
// ══════════════════════════════════════════════════════════════════════
//
//  INSTRUCCIONES DE INSTALACIÓN:
//  1. Abre tu Google Sheet → Extensiones → Apps Script
//  2. Borra todo y pega este código completo
//  3. Guarda (Ctrl+S)
//  4. Ejecuta la función "setupSheet" UNA SOLA VEZ para crear las hojas
//     (Selecciona setupSheet en el menú desplegable → clic en ▶ Ejecutar)
//  5. Despliega como Web App:
//     Implementar → Nueva implementación → Tipo: Aplicación web
//     - Ejecutar como: Yo (la cuenta del propietario)
//     - Quién tiene acceso: Cualquier usuario
//  6. Copia la URL que te entrega y ponla en tu .env:
//     VITE_SHEETS_API_URL=https://script.google.com/macros/s/TU_ID/exec
//
// ══════════════════════════════════════════════════════════════════════

// ── Configuración de hojas ────────────────────────────────────────────

const SCHEMA = {
  Cotizaciones: [
    'id','numero','fecha','cliente','comuna','direccion',
    'telefono','email','estado','neto','iva','total',
    'observaciones','enviadoWhatsapp','enviadoEmail','items_json',
  ],
  Compras: [
    'id','numero','fecha','proveedor','estado',
    'cotizacionId','cotizacionNumero','monto','observaciones','items_json',
  ],
  Trabajadores: [
    'id','nombre','rut','telefono','cargo','sueldo','fechaIngreso','estado',
  ],
  Movimientos: [
    'id','fecha','descripcion','tipo','monto','conciliado',
  ],
  Documentos: [
    'id','trabajadorId','tipo','nombre','fecha','tamaño',
  ],
}

// ── Setup (ejecutar solo una vez) ─────────────────────────────────────

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()

  Object.entries(SCHEMA).forEach(([name, headers]) => {
    let ws = ss.getSheetByName(name)
    if (!ws) ws = ss.insertSheet(name)

    const headerRange = ws.getRange(1, 1, 1, headers.length)
    headerRange.setValues([headers])
    headerRange.setFontWeight('bold')
    headerRange.setBackground('#1e293b')
    headerRange.setFontColor('#f8fafc')
    ws.setFrozenRows(1)

    // Ajustar ancho de columnas
    ws.autoResizeColumns(1, headers.length)
  })

  SpreadsheetApp.getUi().alert(
    '✅ Hojas creadas correctamente.\n\n' +
    'Ahora despliega el script como Web App:\n' +
    'Implementar → Nueva implementación → Aplicación web'
  )
}

// ── Lectura (GET) ──────────────────────────────────────────────────────

function doGet(e) {
  try {
    const sheet = e.parameter.sheet
    if (!sheet) return respond({ ok: false, error: 'Falta parámetro: sheet' })
    const rows = readSheet(sheet)
    return respond({ ok: true, data: rows })
  } catch (err) {
    return respond({ ok: false, error: err.message })
  }
}

// ── Escritura (POST) ───────────────────────────────────────────────────

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents)
    const { sheet, action, data, id } = body

    if (!sheet)  return respond({ ok: false, error: 'Falta parámetro: sheet' })
    if (!action) return respond({ ok: false, error: 'Falta parámetro: action' })

    switch (action) {
      case 'insert': return respond({ ok: true, data: insertRow(sheet, data) })
      case 'update': return respond({ ok: true, data: updateRow(sheet, data) })
      case 'delete': return respond({ ok: true, data: deleteRow(sheet, id)   })
      default:       return respond({ ok: false, error: 'Acción desconocida: ' + action })
    }
  } catch (err) {
    return respond({ ok: false, error: err.message })
  }
}

// ── Helpers internos ───────────────────────────────────────────────────

function getSheet(name) {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name)
  if (!ws) throw new Error('Hoja no encontrada: ' + name)
  return ws
}

function readSheet(name) {
  const ws   = getSheet(name)
  const data = ws.getDataRange().getValues()
  if (data.length < 2) return []
  const headers = data[0]
  return data
    .slice(1)
    .filter(row => row[0] !== '' && row[0] !== null && row[0] !== undefined)
    .map(row => rowToObj(headers, row))
}

function rowToObj(headers, row) {
  const obj = {}
  headers.forEach((h, i) => {
    if (h === 'items_json') {
      try   { obj.items = row[i] ? JSON.parse(row[i]) : [] }
      catch { obj.items = [] }
    } else {
      obj[h] = castValue(row[i])
    }
  })
  return obj
}

function objToRow(headers, data) {
  return headers.map(h => {
    if (h === 'items_json') return JSON.stringify(data.items || [])
    const v = data[h]
    return v !== undefined && v !== null ? v : ''
  })
}

function castValue(v) {
  if (v === 'true'  || v === true)  return true
  if (v === 'false' || v === false) return false
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd')
  return v
}

function insertRow(name, data) {
  const ws      = getSheet(name)
  const headers = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0]
  ws.appendRow(objToRow(headers, data))
  return { inserted: true, id: data.id }
}

function updateRow(name, data) {
  const ws  = getSheet(name)
  const all = ws.getDataRange().getValues()
  const headers = all[0]
  const idCol   = headers.indexOf('id')

  for (let i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(data.id)) {
      ws.getRange(i + 1, 1, 1, headers.length).setValues([objToRow(headers, data)])
      return { updated: true }
    }
  }
  throw new Error('Registro no encontrado: ' + data.id)
}

function deleteRow(name, id) {
  const ws  = getSheet(name)
  const all = ws.getDataRange().getValues()
  const idCol = all[0].indexOf('id')

  for (let i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(id)) {
      ws.deleteRow(i + 1)
      return { deleted: true }
    }
  }
  throw new Error('Registro no encontrado: ' + id)
}

function respond(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON)
}
