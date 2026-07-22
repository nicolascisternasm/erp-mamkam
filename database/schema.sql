-- ============================================================
-- ERP MAMKAM - Schema Principal
-- Supabase / PostgreSQL
-- ============================================================
-- Fuente de verdad: el frontend (frontend/src/services/supabase.js)
-- escribe directo a estas tablas. Mantener nombres y columnas
-- alineados con los mappers `toX` / `fromX` de ese archivo.
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- USUARIOS
-- ============================================================
create table if not exists usuarios (
  id              uuid primary key default uuid_generate_v4(),
  empresa_id      uuid,
  email           text unique not null,
  nombre          text not null,
  apellidos       text,
  rut             text,
  telefono        text,
  rol             text not null
                    check (rol in ('admin', 'vendedor', 'gerente', 'contador', 'rrhh', 'compras', 'tesoreria')),
  password_hash   text not null,
  hash_method     varchar(10) default 'bcrypt',
  activo          boolean default true,
  ultimo_acceso   timestamptz,
  reset_token     varchar(10),
  reset_token_exp timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- TRABAJADORES
-- ============================================================
create table if not exists trabajadores (
  id             uuid primary key default uuid_generate_v4(),
  empresa_id     uuid not null,
  nombre         text not null,
  rut            text not null,
  email          text,
  telefono       text,
  cargo          text not null,
  sueldo         numeric(12,2) not null check (sueldo > 0),
  fecha_ingreso  date not null default current_date,
  estado         text not null default 'activo' check (estado in ('activo', 'inactivo')),
  app_activa     boolean default false,
  puede_cotizar  boolean default false,
  puede_oc       boolean default false,
  puede_rrhh     boolean default false,
  puede_finanzas boolean default false,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (empresa_id, rut)
);

-- ============================================================
-- COTIZACIONES
-- Los items y condiciones de pago se guardan como JSONB
-- (el frontend no usa tablas relacionales hijas).
-- ============================================================
create table if not exists cotizaciones (
  id               uuid primary key default uuid_generate_v4(),
  empresa_id       uuid not null,
  usuario_id       text,
  numero           text not null,
  fecha            date not null default current_date,
  cliente          text not null,
  comuna           text,
  direccion        text,
  telefono         text,
  email            text,
  estado           text not null default 'borrador'
                     check (estado in ('borrador', 'enviada', 'aprobada', 'rechazada')),
  items            jsonb not null default '[]'::jsonb,
  condiciones_pago jsonb,
  neto             numeric(14,2) not null default 0,
  iva              numeric(14,2) not null default 0,
  total            numeric(14,2) not null default 0,
  observaciones    text,
  enviado_whatsapp boolean default false,
  enviado_email    boolean default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (empresa_id, numero)
);

-- ============================================================
-- PROVEEDORES
-- ============================================================
create table if not exists proveedores (
  id         uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null,
  nombre     text not null,
  rut        text not null,
  email      text,
  telefono   text,
  direccion  text,
  comuna     text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (empresa_id, rut)
);

-- ============================================================
-- COMPRAS (Órdenes de Compra)
-- Antes llamada `ordenes_compra` en el schema; el nombre real
-- en Supabase y en el frontend es `compras`.
-- Los items se guardan como JSONB.
-- ============================================================
create table if not exists compras (
  id                  uuid primary key default uuid_generate_v4(),
  empresa_id          uuid not null,
  numero              text not null,
  fecha               date not null default current_date,
  proveedor_id        uuid references proveedores(id) on delete set null,
  proveedor           text not null,
  proveedor_rut       text,
  cotizacion_id       uuid references cotizaciones(id) on delete set null,
  cotizacion_numero   text,
  cotizacion_cliente  text,
  estado              text not null default 'creada'
                        check (estado in ('creada', 'pagada', 'retirada')),
  items               jsonb not null default '[]'::jsonb,
  monto               numeric(14,2) not null default 0,
  voucher             text,
  factura_verificada  jsonb,
  observaciones       text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (empresa_id, numero)
);

-- ============================================================
-- DOCUMENTOS (RRHH)
-- Antes llamada `documentos_rrhh` en el schema; el nombre real
-- en Supabase y en el frontend es `documentos`.
-- ============================================================
create table if not exists documentos (
  id            uuid primary key default uuid_generate_v4(),
  empresa_id    uuid not null,
  trabajador_id uuid references trabajadores(id) on delete set null,
  tipo          text not null check (tipo in ('contrato', 'anexo', 'liquidacion', 'reglamento')),
  nombre        text not null,
  storage_path  text,
  tamano        text,
  fecha         date not null default current_date,
  created_at    timestamptz default now()
);

-- ============================================================
-- MOVIMIENTOS (cartolas / flujo bancario)
-- Antes llamada `movimientos_bancarios` en el schema; el nombre
-- real en Supabase y en el frontend es `movimientos`.
-- ============================================================
create table if not exists movimientos (
  id          uuid primary key default uuid_generate_v4(),
  empresa_id  uuid not null,
  fecha       date not null,
  descripcion text not null,
  tipo        text not null check (tipo in ('ingreso', 'egreso')),
  monto       numeric(14,2) not null check (monto > 0),
  conciliado  boolean default false,
  created_at  timestamptz default now()
);

-- ============================================================
-- GASTOS (boletas/facturas operacionales desde app móvil)
-- ============================================================
create table if not exists gastos (
  id               uuid primary key default uuid_generate_v4(),
  empresa_id       uuid not null,
  trabajador_id    uuid references trabajadores(id) on delete set null,
  trabajador_nombre text,
  fecha_gasto      date not null default current_date,
  monto            numeric(14,2) not null check (monto > 0),
  moneda           text default 'CLP',
  categoria        text,
  comercio         text,
  rut_comercio     text,
  numero_documento text,
  tipo_documento   text,
  descripcion      text,
  foto_url         text,
  estado           text default 'pendiente'
                     check (estado in ('pendiente', 'aprobado', 'rechazado', 'aprobada', 'rechazada')),
  latitud          numeric(10,7),
  longitud         numeric(10,7),
  creado_en        timestamptz default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_usuarios_empresa       on usuarios(empresa_id);
create index if not exists idx_usuarios_email         on usuarios(email);
create index if not exists idx_trabajadores_empresa   on trabajadores(empresa_id);
create index if not exists idx_trabajadores_estado    on trabajadores(estado);
create index if not exists idx_cotizaciones_empresa   on cotizaciones(empresa_id);
create index if not exists idx_cotizaciones_estado    on cotizaciones(estado);
create index if not exists idx_cotizaciones_cliente   on cotizaciones(cliente);
create index if not exists idx_proveedores_empresa    on proveedores(empresa_id);
create index if not exists idx_compras_empresa        on compras(empresa_id);
create index if not exists idx_compras_estado         on compras(estado);
create index if not exists idx_compras_cotizacion     on compras(cotizacion_id);
create index if not exists idx_documentos_empresa     on documentos(empresa_id);
create index if not exists idx_documentos_trabajador  on documentos(trabajador_id);
create index if not exists idx_movimientos_empresa    on movimientos(empresa_id);
create index if not exists idx_movimientos_fecha      on movimientos(fecha);
create index if not exists idx_movimientos_conciliado on movimientos(conciliado);
create index if not exists idx_gastos_empresa         on gastos(empresa_id);
create index if not exists idx_gastos_fecha           on gastos(fecha_gasto);

-- ============================================================
-- FUNCIÓN: updated_at automático
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_usuarios_updated_at
  before update on usuarios
  for each row execute function set_updated_at();

create or replace trigger trg_trabajadores_updated_at
  before update on trabajadores
  for each row execute function set_updated_at();

create or replace trigger trg_cotizaciones_updated_at
  before update on cotizaciones
  for each row execute function set_updated_at();

create or replace trigger trg_proveedores_updated_at
  before update on proveedores
  for each row execute function set_updated_at();

create or replace trigger trg_compras_updated_at
  before update on compras
  for each row execute function set_updated_at();

-- ============================================================
-- NOTAS
-- ============================================================
-- Tablas adicionales en Supabase no definidas aquí (ver código):
--   empresas_tenant, empresas (legacy), audit_log     → database/migration_erp.sql
--   facturas_sii, solicitudes_vacaciones,
--   solicitudes_omitir_colacion, marcaciones,
--   horarios_trabajadores                             → creadas fuera de schema.sql
--
-- Row Level Security (RLS): deshabilitado por ahora. Habilitar
-- cuando se integre con Supabase Auth nativo.
-- ============================================================
