const mk = (items) =>
  items.map((x, i) => ({
    id: `q${i + 1}`,
    label: x.q,
    critical: x.critical ?? false,
    answer: '',
    done: false,
  }))

export const PREGUNTAS_GENERALES = [
  { id: 'general-start', label: 'Inicio estimado de instalación', critical: false, answer: '', done: false, general: true, kind: 'date' },
  { id: 'general-end',   label: 'Fecha de entrega estimada',      critical: false, answer: '', done: false, general: true, kind: 'date' },
]

export const PREGUNTAS_TOLDO_VELA = mk([
  { q: '¿Cuáles son las medidas del área a cubrir? (ancho x largo en metros)',          critical: true },
  { q: '¿Cuántos puntos de anclaje hay disponibles? ¿En qué están? (muro, columna, piso)', critical: true },
  { q: '¿El cliente prefiere tela permeable (sombra) o impermeable (lluvia)?',          critical: true },
  { q: '¿Qué color o colores prefiere el cliente?',                                     critical: true },
  { q: '¿Cuál es la altura libre disponible en el punto más alto del área?' },
  { q: '¿Hay obstáculos en el área? (árboles, columnas, cables, voladizos)' },
  { q: '¿El toldo debe ser fijo o retráctil / enrollable?' },
  { q: '¿La zona tiene vientos fuertes o lluvia frecuente?' },
  { q: '¿Requiere iluminación integrada?' },
  { q: '¿Hay restricciones de colores por normativa del conjunto o edificio?' },
  { q: '¿El cliente tiene preferencia de material para la estructura? (acero, aluminio, madera)' },
  { q: '¿Hay algo adicional que el cliente haya solicitado o comentado?' },
])

export const PREGUNTAS_CAUCHO_CONTINUO = mk([
  { q: '¿Cuáles son las medidas del área? (largo x ancho en metros)',                    critical: true },
  { q: '¿Cuál es el uso principal? (zona infantil, deportivo, gym, peatonal, industrial)', critical: true },
  { q: '¿Qué hay actualmente en el piso? (concreto, tierra, baldosa, asfalto)',          critical: true },
  { q: '¿Hay niños menores de 12 años que van a usar el espacio?',                       critical: true },
  { q: '¿Cuál es el estado del piso actual? (bueno, grietas, humedad, irregular)' },
  { q: '¿Hay estructuras elevadas de las que se pueda caer? ¿A qué altura?' },
  { q: '¿Qué nivel de tráfico tendrá el área? (bajo, medio, alto)' },
  { q: '¿El cliente prefiere algún color específico o diseño?' },
  { q: '¿Requiere logotipo, líneas o diseño personalizado?' },
  { q: '¿Tiene pendiente o desagüe existente?' },
  { q: '¿El acceso al lugar es amplio o restringido?' },
  { q: '¿Requiere bordes o rampas de acceso en caucho?' },
  { q: '¿Hay algo adicional que el cliente haya solicitado o comentado?' },
])

export const PREGUNTAS_PASTO_SINTETICO = mk([
  { q: '¿Cuáles son las medidas del área? (largo x ancho en metros)',                         critical: true },
  { q: '¿Cuál es el uso principal? (fútbol, decorativo, jardín, terraza, zona infantil)',      critical: true },
  { q: '¿Qué hay actualmente en el piso? (tierra, concreto, baldosa, asfalto)',               critical: true },
  { q: '¿El terreno está nivelado o tiene desniveles?',                                       critical: true },
  { q: '¿Requiere preparación de terreno antes de instalar? ¿Qué tipo? (nivelación, demolición, relleno)' },
  { q: '¿Hay raíces, vegetación o humedad en el suelo?' },
  { q: '¿El espacio es interior o exterior?' },
  { q: '¿Hay mascotas en el lugar? (define tipo de fibra)' },
  { q: '¿El cliente tiene preferencia de color de pasto?' },
  { q: '¿Requiere líneas de demarcación o cancha? ¿De qué deporte?' },
  { q: '¿Tiene sistema de drenaje o necesita uno?' },
  { q: '¿Hay restricciones de acceso para maquinaria o materiales?' },
  { q: '¿El cliente tiene presupuesto definido o referencia de calidad?' },
  { q: '¿Hay algo adicional que el cliente haya solicitado o comentado?' },
])

const PRODUCT_MAP = {
  'Toldo Vela':       PREGUNTAS_TOLDO_VELA,
  'Pasto Sintético':  PREGUNTAS_PASTO_SINTETICO,
  'Caucho Continuo':  PREGUNTAS_CAUCHO_CONTINUO,
}

export function buildChecklist(productos) {
  const general = PREGUNTAS_GENERALES.map(q => ({ ...q }))
  const unique = (productos || []).filter((p, i, arr) => arr.indexOf(p) === i)
  if (unique.length === 0) return general
  const out = [...general]
  unique.forEach(p => {
    const preguntas = PRODUCT_MAP[p]
    if (!preguntas) return
    preguntas.forEach(q => {
      out.push({ ...q, id: `${p}-${q.id}`, product: p })
    })
  })
  return out
}
