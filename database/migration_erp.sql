-- ============================================================
-- ERP MAMKAM - Migración principal
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- 1. Columnas faltantes en usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS apellidos      TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_id     UUID;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono       TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rut            TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS hash_method    VARCHAR(10) DEFAULT 'sha256';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso  TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token    VARCHAR(10);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_exp TIMESTAMPTZ;

-- 2. Ampliar el check de rol (el schema original solo permite 'admin' y 'vendedor')
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('admin', 'vendedor', 'gerente', 'contador', 'rrhh', 'compras', 'tesoreria'));

-- 3. Tabla de empresas tenant (multi-tenant ERP)
CREATE TABLE IF NOT EXISTS empresas_tenant (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rut             TEXT UNIQUE NOT NULL,
  razon_social    TEXT NOT NULL,
  nombre_fantasia TEXT,
  email_contacto  TEXT NOT NULL,
  telefono        TEXT,
  plan            TEXT DEFAULT 'basico',
  activo          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de auditoría
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID NOT NULL,
  empresa_id  UUID,
  accion      VARCHAR(50) NOT NULL,
  tabla       VARCHAR(100) NOT NULL,
  registro_id UUID,
  detalle     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. usuario_id en cotizaciones (para asociar cotizaciones a usuarios del ERP)
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS usuario_id TEXT;

-- 7. creado_por en cotizaciones (nombre del vendedor que creó la cotización)
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS creado_por TEXT;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_creado_por ON cotizaciones(creado_por);

-- 8. estado_total en cotizaciones (para cotizaciones sin condiciones de pago: pendiente/facturado/pagado)
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS estado_total TEXT DEFAULT 'pendiente';

-- 6. Índices útiles
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa   ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email     ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_audit_empresa      ON audit_log(empresa_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor        ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_empresas_rut       ON empresas_tenant(rut);

-- 9. Cuentas de la empresa (obligaciones fijas y pagos únicos para proyección financiera)
CREATE TABLE IF NOT EXISTS cuentas_empresa (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id        UUID NOT NULL,
  nombre            TEXT NOT NULL,
  monto             INTEGER NOT NULL DEFAULT 0,
  categoria         TEXT DEFAULT 'otro',
  periodicidad      TEXT DEFAULT 'mensual',  -- 'mensual' | 'unica'
  dia_mes           SMALLINT,                -- 1-31, solo para periodicidad='mensual'
  fecha_vencimiento DATE,                    -- solo para periodicidad='unica'
  activa            BOOLEAN DEFAULT TRUE,
  pagada            BOOLEAN DEFAULT FALSE,   -- solo para periodicidad='unica'
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cuentas_empresa ON cuentas_empresa(empresa_id);

-- 10. Nuevos permisos de módulos en trabajadores y usuarios
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS puede_proyectos BOOLEAN DEFAULT false;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS puede_asesoria  BOOLEAN DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS puede_proyectos BOOLEAN DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS puede_asesoria  BOOLEAN DEFAULT false;

-- 11. datos_bancarios en empresas_tenant (para mostrar en cotizaciones)
ALTER TABLE empresas_tenant ADD COLUMN IF NOT EXISTS datos_bancarios JSONB;

-- 12. Facturas SII — tabla de compras y ventas electrónicas
CREATE TABLE IF NOT EXISTS facturas_sii (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id       UUID NOT NULL,
  tipo             TEXT NOT NULL DEFAULT 'compra',    -- 'compra' | 'venta'
  tipo_documento   TEXT DEFAULT 'FACTURA',
  folio            TEXT NOT NULL,
  rut_emisor       TEXT,
  razon_social     TEXT,
  fecha            DATE NOT NULL,
  neto             INTEGER DEFAULT 0,
  iva              INTEGER DEFAULT 0,
  total            INTEGER DEFAULT 0,
  estado           TEXT DEFAULT 'vigente',            -- 'vigente' | 'anulado' | 'reclamado'
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_facturas_sii_empresa ON facturas_sii(empresa_id);
CREATE INDEX IF NOT EXISTS idx_facturas_sii_tipo    ON facturas_sii(empresa_id, tipo);

-- Columnas para tablas facturas_sii ya existentes (sin las nuevas columnas)
ALTER TABLE facturas_sii ADD COLUMN IF NOT EXISTS tipo           TEXT DEFAULT 'compra';
ALTER TABLE facturas_sii ADD COLUMN IF NOT EXISTS tipo_documento TEXT DEFAULT 'FACTURA';
ALTER TABLE facturas_sii ADD COLUMN IF NOT EXISTS rut_emisor     TEXT;
ALTER TABLE facturas_sii ADD COLUMN IF NOT EXISTS razon_social   TEXT;
ALTER TABLE facturas_sii ADD COLUMN IF NOT EXISTS estado         TEXT DEFAULT 'vigente';

-- 13. Columnas adicionales para facturas_sii (soporte completo del RCV del SII)
ALTER TABLE facturas_sii ADD COLUMN IF NOT EXISTS numero_interno    TEXT;
ALTER TABLE facturas_sii ADD COLUMN IF NOT EXISTS tipo_doc          TEXT;
ALTER TABLE facturas_sii ADD COLUMN IF NOT EXISTS tipo_compra_venta TEXT;
ALTER TABLE facturas_sii ADD COLUMN IF NOT EXISTS rut_contraparte   TEXT;
ALTER TABLE facturas_sii ADD COLUMN IF NOT EXISTS fecha_recepcion   DATE;
ALTER TABLE facturas_sii ADD COLUMN IF NOT EXISTS monto_exento      INTEGER DEFAULT 0;
ALTER TABLE facturas_sii ADD COLUMN IF NOT EXISTS iva_no_recuperable INTEGER DEFAULT 0;

-- Restricción única para upsert por folio+empresa_id+tipo (importación sin duplicados)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facturas_sii_folio_empresa_tipo_key'
  ) THEN
    ALTER TABLE facturas_sii ADD CONSTRAINT facturas_sii_folio_empresa_tipo_key
      UNIQUE (folio, empresa_id, tipo);
  END IF;
END $$;

-- 14. Asesoría IA — conversaciones y mensajes
CREATE TABLE IF NOT EXISTS asesoria_conversaciones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id  UUID NOT NULL,
  usuario_id  TEXT NOT NULL,
  titulo      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asesoria_conv_empresa ON asesoria_conversaciones(empresa_id);

CREATE TABLE IF NOT EXISTS asesoria_mensajes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversacion_id  UUID NOT NULL REFERENCES asesoria_conversaciones(id) ON DELETE CASCADE,
  rol              TEXT NOT NULL,   -- 'user' | 'assistant'
  contenido        TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asesoria_msgs_conv ON asesoria_mensajes(conversacion_id);

-- 15. Remuneraciones — columnas en trabajadores + tabla liquidaciones
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS tipo_contrato    TEXT DEFAULT 'indefinido';
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS afp              TEXT DEFAULT 'Habitat';
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS porcentaje_afp   NUMERIC(5,2) DEFAULT 10.27;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS prevision_salud  TEXT DEFAULT 'Fonasa';
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS isapre           TEXT;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS monto_isapre     INTEGER DEFAULT 0;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS bono_fijo        INTEGER DEFAULT 0;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS colacion         INTEGER DEFAULT 0;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS movilizacion     INTEGER DEFAULT 0;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS sueldo_minimo    INTEGER DEFAULT 539000;

CREATE TABLE IF NOT EXISTS liquidaciones (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id               UUID NOT NULL,
  trabajador_id            UUID NOT NULL,
  trabajador_nombre        TEXT,
  trabajador_rut           TEXT,
  periodo                  TEXT NOT NULL,
  estado                   TEXT DEFAULT 'borrador',
  sueldo_base              INTEGER DEFAULT 0,
  bono_fijo                INTEGER DEFAULT 0,
  comision                 INTEGER DEFAULT 0,
  gratificacion            INTEGER DEFAULT 0,
  colacion                 INTEGER DEFAULT 0,
  movilizacion             INTEGER DEFAULT 0,
  otros_haberes            INTEGER DEFAULT 0,
  sueldo_bruto             INTEGER DEFAULT 0,
  base_imponible           INTEGER DEFAULT 0,
  afp                      TEXT,
  porcentaje_afp           NUMERIC(5,2) DEFAULT 0,
  descuento_afp            INTEGER DEFAULT 0,
  prevision_salud          TEXT,
  porcentaje_salud         NUMERIC(5,2) DEFAULT 7.0,
  descuento_salud          INTEGER DEFAULT 0,
  descuento_cesantia_trab  INTEGER DEFAULT 0,
  otros_descuentos         INTEGER DEFAULT 0,
  total_descuentos         INTEGER DEFAULT 0,
  sueldo_liquido           INTEGER DEFAULT 0,
  cesantia_empleador       INTEGER DEFAULT 0,
  mutual_empleador         INTEGER DEFAULT 0,
  costo_empresa            INTEGER DEFAULT 0,
  dias_trabajados          SMALLINT DEFAULT 30,
  tipo_contrato            TEXT DEFAULT 'indefinido',
  sueldo_es_liquido        BOOLEAN DEFAULT FALSE,
  sueldo_liquido_pactado   INTEGER DEFAULT 0,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_liquidaciones_trab_periodo ON liquidaciones(trabajador_id, periodo, empresa_id);
CREATE INDEX IF NOT EXISTS idx_liquidaciones_empresa ON liquidaciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_liquidaciones_periodo ON liquidaciones(empresa_id, periodo);

-- 16. Permisos de módulos nuevos en trabajadores
ALTER TABLE trabajadores
  ADD COLUMN IF NOT EXISTS puede_remuneraciones BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS puede_facturas       BOOLEAN DEFAULT false;

-- 17. Datos personales, dirección y bancarios en trabajadores
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS fecha_nacimiento       DATE;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS nacionalidad           TEXT DEFAULT 'Chilena';
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS estado_civil          TEXT DEFAULT 'soltero';
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS tipo_documento        TEXT DEFAULT 'RUT';
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS numero_documento      TEXT;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS fecha_vencimiento_visa DATE;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS direccion             TEXT;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS numero                TEXT;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS comuna                TEXT;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS ciudad                TEXT;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS region                TEXT;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS banco                 TEXT;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS tipo_cuenta           TEXT;
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS numero_cuenta         TEXT;
