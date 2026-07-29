-- ============================================================
-- seed-visita-preguntas.sql
-- Inserta todas las preguntas del checklist de visitas.
-- Fuente: frontend/src/modules/cotizaciones/visitaChecklists.js
-- Empresa: 22101e7c-ce32-49dc-9a8f-4ea25fc00d2f
--
-- Ejecutar UNA sola vez en Supabase SQL Editor.
-- Si la tabla no existe, crear primero con el bloque CREATE TABLE.
-- ============================================================

-- ── Crear tabla si no existe ─────────────────────────────────
CREATE TABLE IF NOT EXISTS visita_preguntas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID        NOT NULL,
  producto    TEXT        NOT NULL,
  pregunta_id TEXT        NOT NULL,
  texto       TEXT        NOT NULL,
  critical    BOOLEAN     NOT NULL DEFAULT false,
  orden       INTEGER     NOT NULL,
  kind        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, producto, pregunta_id)
);

-- ── INSERT ───────────────────────────────────────────────────
INSERT INTO visita_preguntas
  (empresa_id, producto, pregunta_id, texto, critical, orden, kind)
VALUES

-- ── GENERAL (2 preguntas) ────────────────────────────────────
  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'general', 'general-start',
   'Inicio estimado de instalación',
   false, 1, 'date'),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'general', 'general-end',
   'Fecha de entrega estimada',
   false, 2, 'date'),

-- ── TOLDO VELA (12 preguntas) ────────────────────────────────
  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela', 'q1',
   '¿Cuáles son las medidas del área a cubrir? (ancho x largo en metros)',
   true, 1, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela', 'q2',
   '¿Cuántos puntos de anclaje hay disponibles? ¿En qué están? (muro, columna, piso)',
   true, 2, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela', 'q3',
   '¿El cliente prefiere tela permeable (sombra) o impermeable (lluvia)?',
   true, 3, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela', 'q4',
   '¿Qué color o colores prefiere el cliente?',
   true, 4, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela', 'q5',
   '¿Cuál es la altura libre disponible en el punto más alto del área?',
   false, 5, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela', 'q6',
   '¿Hay obstáculos en el área? (árboles, columnas, cables, voladizos)',
   false, 6, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela', 'q7',
   '¿El toldo debe ser fijo o retráctil / enrollable?',
   false, 7, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela', 'q8',
   '¿La zona tiene vientos fuertes o lluvia frecuente?',
   false, 8, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela', 'q9',
   '¿Requiere iluminación integrada?',
   false, 9, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela', 'q10',
   '¿Hay restricciones de colores por normativa del conjunto o edificio?',
   false, 10, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela', 'q11',
   '¿El cliente tiene preferencia de material para la estructura? (acero, aluminio, madera)',
   false, 11, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela', 'q12',
   '¿Hay algo adicional que el cliente haya solicitado o comentado?',
   false, 12, null),

-- ── CAUCHO CONTINUO (13 preguntas) ───────────────────────────
  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q1',
   '¿Cuáles son las medidas del área? (largo x ancho en metros)',
   true, 1, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q2',
   '¿Cuál es el uso principal? (zona infantil, deportivo, gym, peatonal, industrial)',
   true, 2, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q3',
   '¿Qué hay actualmente en el piso? (concreto, tierra, baldosa, asfalto)',
   true, 3, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q4',
   '¿Hay niños menores de 12 años que van a usar el espacio?',
   true, 4, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q5',
   '¿Cuál es el estado del piso actual? (bueno, grietas, humedad, irregular)',
   false, 5, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q6',
   '¿Hay estructuras elevadas de las que se pueda caer? ¿A qué altura?',
   false, 6, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q7',
   '¿Qué nivel de tráfico tendrá el área? (bajo, medio, alto)',
   false, 7, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q8',
   '¿El cliente prefiere algún color específico o diseño?',
   false, 8, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q9',
   '¿Requiere logotipo, líneas o diseño personalizado?',
   false, 9, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q10',
   '¿Tiene pendiente o desagüe existente?',
   false, 10, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q11',
   '¿El acceso al lugar es amplio o restringido?',
   false, 11, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q12',
   '¿Requiere bordes o rampas de acceso en caucho?',
   false, 12, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo', 'q13',
   '¿Hay algo adicional que el cliente haya solicitado o comentado?',
   false, 13, null),

-- ── PASTO SINTÉTICO (14 preguntas) ───────────────────────────
  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q1',
   '¿Cuáles son las medidas del área? (largo x ancho en metros)',
   true, 1, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q2',
   '¿Cuál es el uso principal? (fútbol, decorativo, jardín, terraza, zona infantil)',
   true, 2, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q3',
   '¿Qué hay actualmente en el piso? (tierra, concreto, baldosa, asfalto)',
   true, 3, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q4',
   '¿El terreno está nivelado o tiene desniveles?',
   true, 4, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q5',
   '¿Requiere preparación de terreno antes de instalar? ¿Qué tipo? (nivelación, demolición, relleno)',
   false, 5, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q6',
   '¿Hay raíces, vegetación o humedad en el suelo?',
   false, 6, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q7',
   '¿El espacio es interior o exterior?',
   false, 7, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q8',
   '¿Hay mascotas en el lugar? (define tipo de fibra)',
   false, 8, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q9',
   '¿El cliente tiene preferencia de color de pasto?',
   false, 9, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q10',
   '¿Requiere líneas de demarcación o cancha? ¿De qué deporte?',
   false, 10, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q11',
   '¿Tiene sistema de drenaje o necesita uno?',
   false, 11, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q12',
   '¿Hay restricciones de acceso para maquinaria o materiales?',
   false, 12, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q13',
   '¿El cliente tiene presupuesto definido o referencia de calidad?',
   false, 13, null),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico', 'q14',
   '¿Hay algo adicional que el cliente haya solicitado o comentado?',
   false, 14, null)

ON CONFLICT (empresa_id, producto, pregunta_id) DO NOTHING;
