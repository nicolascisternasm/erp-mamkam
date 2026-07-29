-- ============================================================
-- seed-visita-preguntas.sql
-- Inserta todas las preguntas del checklist de visitas.
-- Fuente: frontend/src/modules/cotizaciones/visitaChecklists.js
-- Empresa: 22101e7c-ce32-49dc-9a8f-4ea25fc00d2f
--
-- Ejecutar UNA sola vez en Supabase SQL Editor.
-- ============================================================

-- Limpia filas previas de esta empresa para evitar duplicados
DELETE FROM visita_preguntas
WHERE empresa_id = '22101e7c-ce32-49dc-9a8f-4ea25fc00d2f';

-- ── INSERT ───────────────────────────────────────────────────
INSERT INTO visita_preguntas
  (empresa_id, producto, label, critical, orden, activo)
VALUES

-- ── GENERAL (2 preguntas) ────────────────────────────────────
  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'general',
   'Inicio estimado de instalación', false, 1, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'general',
   'Fecha de entrega estimada', false, 2, true),

-- ── TOLDO VELA (12 preguntas) ────────────────────────────────
  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela',
   '¿Cuáles son las medidas del área a cubrir? (ancho x largo en metros)', true, 1, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela',
   '¿Cuántos puntos de anclaje hay disponibles? ¿En qué están? (muro, columna, piso)', true, 2, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela',
   '¿El cliente prefiere tela permeable (sombra) o impermeable (lluvia)?', true, 3, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela',
   '¿Qué color o colores prefiere el cliente?', true, 4, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela',
   '¿Cuál es la altura libre disponible en el punto más alto del área?', false, 5, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela',
   '¿Hay obstáculos en el área? (árboles, columnas, cables, voladizos)', false, 6, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela',
   '¿El toldo debe ser fijo o retráctil / enrollable?', false, 7, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela',
   '¿La zona tiene vientos fuertes o lluvia frecuente?', false, 8, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela',
   '¿Requiere iluminación integrada?', false, 9, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela',
   '¿Hay restricciones de colores por normativa del conjunto o edificio?', false, 10, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela',
   '¿El cliente tiene preferencia de material para la estructura? (acero, aluminio, madera)', false, 11, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'toldo_vela',
   '¿Hay algo adicional que el cliente haya solicitado o comentado?', false, 12, true),

-- ── CAUCHO CONTINUO (13 preguntas) ───────────────────────────
  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿Cuáles son las medidas del área? (largo x ancho en metros)', true, 1, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿Cuál es el uso principal? (zona infantil, deportivo, gym, peatonal, industrial)', true, 2, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿Qué hay actualmente en el piso? (concreto, tierra, baldosa, asfalto)', true, 3, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿Hay niños menores de 12 años que van a usar el espacio?', true, 4, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿Cuál es el estado del piso actual? (bueno, grietas, humedad, irregular)', false, 5, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿Hay estructuras elevadas de las que se pueda caer? ¿A qué altura?', false, 6, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿Qué nivel de tráfico tendrá el área? (bajo, medio, alto)', false, 7, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿El cliente prefiere algún color específico o diseño?', false, 8, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿Requiere logotipo, líneas o diseño personalizado?', false, 9, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿Tiene pendiente o desagüe existente?', false, 10, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿El acceso al lugar es amplio o restringido?', false, 11, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿Requiere bordes o rampas de acceso en caucho?', false, 12, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'caucho_continuo',
   '¿Hay algo adicional que el cliente haya solicitado o comentado?', false, 13, true),

-- ── PASTO SINTÉTICO (14 preguntas) ───────────────────────────
  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿Cuáles son las medidas del área? (largo x ancho en metros)', true, 1, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿Cuál es el uso principal? (fútbol, decorativo, jardín, terraza, zona infantil)', true, 2, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿Qué hay actualmente en el piso? (tierra, concreto, baldosa, asfalto)', true, 3, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿El terreno está nivelado o tiene desniveles?', true, 4, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿Requiere preparación de terreno antes de instalar? ¿Qué tipo? (nivelación, demolición, relleno)', false, 5, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿Hay raíces, vegetación o humedad en el suelo?', false, 6, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿El espacio es interior o exterior?', false, 7, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿Hay mascotas en el lugar? (define tipo de fibra)', false, 8, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿El cliente tiene preferencia de color de pasto?', false, 9, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿Requiere líneas de demarcación o cancha? ¿De qué deporte?', false, 10, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿Tiene sistema de drenaje o necesita uno?', false, 11, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿Hay restricciones de acceso para maquinaria o materiales?', false, 12, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿El cliente tiene presupuesto definido o referencia de calidad?', false, 13, true),

  ('22101e7c-ce32-49dc-9a8f-4ea25fc00d2f', 'pasto_sintetico',
   '¿Hay algo adicional que el cliente haya solicitado o comentado?', false, 14, true);
