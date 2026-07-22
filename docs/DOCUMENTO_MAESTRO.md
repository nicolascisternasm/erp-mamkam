# DOCUMENTO MAESTRO — ERP MAMKAM
**Versión:** 1.3.0  
**Fecha:** 2026-05-23  
**Estado:** Documento Vivo — sujeto a revisiones controladas  
**Clasificación:** Interno / Confidencial

---

## TABLA DE CONTENIDOS

1. [Visión General](#1-visión-general)
2. [Estado de Implementación](#2-estado-de-implementación)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Módulos del ERP](#4-módulos-del-erp)
5. [Flujos de Trabajo](#5-flujos-de-trabajo)
6. [Estados y Transiciones](#6-estados-y-transiciones)
7. [Relaciones entre Módulos](#7-relaciones-entre-módulos)
8. [Base de Datos](#8-base-de-datos)
9. [Automatizaciones](#9-automatizaciones)
10. [Permisos y Roles](#10-permisos-y-roles)
11. [Integración IA Documental](#11-integración-ia-documental)
12. [Frontend y Backend](#12-frontend-y-backend)
13. [Escalabilidad](#13-escalabilidad)
14. [Glosario](#14-glosario)

---

## 1. VISIÓN GENERAL

### 1.1 Descripción del Sistema

ERP MAMKAM es una plataforma empresarial modular de gestión integral diseñada para centralizar, automatizar y optimizar los procesos de negocio. Combina un núcleo transaccional robusto con capacidades de inteligencia artificial para procesamiento documental, análisis predictivo y asistencia operativa.

### 1.2 Principios de Diseño

| Principio | Descripción |
|-----------|-------------|
| **Modularidad** | Cada módulo es independiente y puede desplegarse o desactivarse sin afectar al núcleo |
| **API-First** | Toda funcionalidad expuesta mediante APIs RESTful y GraphQL documentadas |
| **IA-Nativa** | La inteligencia artificial no es un addon: está integrada en los flujos core |
| **Auditoría Total** | Toda acción queda registrada con usuario, timestamp y estado anterior/posterior |
| **Escalabilidad Horizontal** | El sistema crece añadiendo nodos, no reemplazando infraestructura |
| **Zero-Trust Security** | Autenticación y autorización en cada capa, sin confianza implícita |

### 1.3 Módulos Iniciales (v1.0)

```
ERP MAMKAM
├── COT  — Cotizaciones
├── OC   — Órdenes de Compra
├── RH   — Recursos Humanos
├── TRB  — Trabajadores
├── IAD  — IA Documental
├── FIN  — Finanzas y Conciliación
│   ├── FIN.BAN  — Cartolas y Cuentas Bancarias
│   ├── FIN.SII  — Documentos Tributarios (SII Chile)
│   ├── FIN.CON  — Conciliación Bancaria IA
│   ├── FIN.CAJ  — Caja Chica
│   └── FIN.ADL  — Adelantos de Trabajadores
└── CONT — Contabilidad
    ├── CONT.PUC — Plan Único de Cuentas
    ├── CONT.DIA — Libro Diario
    ├── CONT.MAY — Libro Mayor
    ├── CONT.IVA — Gestión IVA y F29
    ├── CONT.CEN — Centralizaciones
    ├── CONT.BAL — Estados Financieros (IFRS)
    ├── CONT.CIE — Cierres Contables
    └── CONT.AUD — Auditoría Contable
```

### 1.4 Roadmap de Módulos Futuros

| Fase | Módulo | Descripción |
|------|--------|-------------|
| v1.4 | **IAD** | IA Documental (procesamiento de documentos con Claude API) |
| v1.5 | **CONT** | Contabilidad completa (partida doble, IFRS, F29) |
| v1.6 | **INV** | Inventario y Bodega |
| v2.0 | **CRM** | Gestión de Clientes |
| v2.1 | **PROJ** | Gestión de Proyectos |

---

## 2. ESTADO DE IMPLEMENTACIÓN

> Esta sección refleja el estado real del código al **2026-05-23**. Los módulos marcados como ✅ están operativos. Los marcados como ⚠️ están parcialmente implementados. Los marcados como 🔲 son especificaciones planificadas aún no desarrolladas.

### 2.1 Estado por Módulo

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| **Autenticación** | ✅ Operativo | Login JWT, roles admin/vendedor, rutas protegidas |
| **COT — Cotizaciones** | ✅ Operativo | CRUD completo, envío WA/email, PDF, estados, items |
| **OC — Órdenes de Compra** | ✅ Operativo | CRUD básico, items, solo rol admin |
| **TRB — Trabajadores** | ✅ Operativo | CRUD completo, datos personales y laborales |
| **RRHH** | ⚠️ Parcial | Página base existente, sin funcionalidades avanzadas |
| **FIN — Finanzas** | ⚠️ Parcial | Movimientos, conciliación manual, importación CSV, gastos con foto |
| **Usuarios** | ⚠️ Parcial | Página existente, gestión básica |
| **Configuración** | ⚠️ Parcial | Página existente, ajustes generales |
| **IAD — IA Documental** | 🔲 Planificado | Solo en especificación técnica |
| **CONT — Contabilidad** | 🔲 Planificado | Solo en especificación técnica |
| **FIN.SII** | 🔲 Planificado | Integración SII en especificación técnica |
| **FIN.CAJ** | 🔲 Planificado | Caja chica en especificación técnica |
| **FIN.ADL** | 🔲 Planificado | Adelantos trabajadores en especificación técnica |

### 2.2 Stack Real Implementado

| Capa | Tecnología real | Nota |
|------|----------------|------|
| **Frontend** | React + JavaScript + TailwindCSS + React Router + Lucide React | Sin TypeScript, sin shadcn/ui |
| **Backend** | Node.js + Express 4 + JavaScript | Sin TypeScript, sin Prisma |
| **Base de datos** | Supabase (PostgreSQL cloud) | Vía `@supabase/supabase-js` |
| **Autenticación** | JWT (`jsonwebtoken`) + bcryptjs | Token de 7 días, sin refresh |
| **Email** | EmailJS (desde el frontend) | Sin Nodemailer en backend |
| **Roles** | `admin` y `vendedor` | RBAC simple en middleware |
| **Estado frontend** | React Context (`AppContext`) | Sin React Query ni Zustand |

### 2.3 Funcionalidades Reales por Módulo

#### Cotizaciones (COT) ✅
- Creación con items (producto, cantidad, valor unitario, descripción)
- Numeración automática (COT-YYYY-NNNN)
- Estados: `borrador` → `enviada` → `aprobada` / `rechazada`
- Envío por **WhatsApp** (link público con datos en URL en base64, sin BD)
- Envío por **email** vía EmailJS
- Página pública `/ver?d=...` para que el cliente vea su cotización
- Generación de **PDF** visual desde el detalle
- Al aprobar cotización → crea movimiento de ingreso en Finanzas automáticamente
- Al eliminar cotización aprobada → elimina movimiento de finanzas asociado

#### Órdenes de Compra (OC) ✅
- CRUD básico (solo rol admin)
- Items por OC
- Al pagar OC → crea movimiento de egreso en Finanzas

#### Trabajadores (TRB) ✅
- Campos: nombre, RUT, teléfono, cargo, sueldo, fecha_ingreso, estado
- Estados: `activo` / `inactivo`
- CRUD completo (solo admin)

#### Finanzas (FIN) ⚠️
- **Movimientos bancarios**: ingresos y egresos manuales o automáticos
- **Conciliación manual**: marcar/desmarcar movimientos como conciliados con confirmación
- **Importación de cartola CSV**: parser frontend que detecta automáticamente columnas (fecha, descripción, cargo, abono) de bancos chilenos (BCI, Santander, BancoEstado, etc.)
- **Auto-matching de cartola**: al importar, cruza movimientos del CSV con pendientes de conciliar por tipo y monto (±2%)
- **Gastos con foto de boleta**: registro de gastos con imagen adjunta (fotoUrl), categoría, comercio, RUT comercio, tipo de documento
- **Informe financiero**: por cobrar, cobrado, por pagar, pagado, saldo real, saldo proyectado
- **Filtros**: por tipo (ingreso/egreso), por estado (pendiente/conciliado), búsqueda por descripción
- **Categorías automáticas**: Venta (desde cotización), Pago OC, Gasto, Cartola, Manual

---

## 3. ARQUITECTURA DEL SISTEMA

### 3.1 Arquitectura Actual (MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
│   React + TailwindCSS + React Router + React Context           │
│   Vite (build)  │  Lucide React (íconos)  │  EmailJS (email)   │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTPS / fetch API
┌─────────────────────────────────▼───────────────────────────────┐
│                     BACKEND (Express API)                       │
│     JWT Auth  │  CORS  │  Rutas REST  │  Middleware de roles    │
│     Puerto 4000 · Node.js + Express 4 (JavaScript)             │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ Supabase JS SDK
┌─────────────────────────────────▼───────────────────────────────┐
│                    SUPABASE (Backend as a Service)              │
│   PostgreSQL  │  Auth (no usada, se usa JWT propio)             │
│   Storage (documentos/fotos)  │  Realtime (no usada aún)        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Arquitectura Objetivo (Roadmap)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAPA DE CLIENTE                          │
│   Web App (React + TS)  │  Mobile (futuro)  │  API Consumers    │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTPS
┌─────────────────────────────────▼───────────────────────────────┐
│                     REST API  (Express + TypeScript)            │
│     JWT Auth  │  RBAC  │  Routing  │  Middleware                │
└──────┬──────────────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────────┐
│                    CAPA DE PERSISTENCIA                         │
│   PostgreSQL (principal)  │  Redis (cache/sesiones)             │
│   S3/MinIO (documentos)   │  BullMQ (colas de trabajo)          │
└─────────────────────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────────┐
│                     CAPA DE IA (Futuro)                         │
│   Claude API (LLM)  │  OCR Engine  │  Clasificador Docs         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Rutas API Implementadas

```
Backend (http://localhost:4000)

GET  /api/health                          — Health check

POST /api/auth/login                      — Login con email/password → JWT

GET  /api/cotizaciones                    — Listar todas (con items)
GET  /api/cotizaciones/:id                — Obtener una
POST /api/cotizaciones                    — Crear (con items)
PATCH /api/cotizaciones/:id               — Actualizar
DELETE /api/cotizaciones/:id              — Eliminar (solo admin)

GET  /api/compras                         — Listar OC (solo admin)
POST /api/compras                         — Crear OC (solo admin)
PATCH /api/compras/:id                    — Actualizar OC (solo admin)

GET  /api/trabajadores                    — Listar (solo admin)
POST /api/trabajadores                    — Crear (solo admin)
PATCH /api/trabajadores/:id               — Actualizar (solo admin)
DELETE /api/trabajadores/:id              — Eliminar (solo admin)

GET  /api/finanzas/movimientos            — Listar movimientos bancarios
POST /api/finanzas/movimientos            — Crear movimiento
PATCH /api/finanzas/movimientos/:id/conciliar — Toggle conciliado
```

### 3.4 Entornos

| Entorno | Propósito | URL patrón |
|---------|-----------|------------|
| **development** | Desarrollo local | localhost:3000 (frontend) + localhost:4000 (backend) |
| **production** | Producción | app.mamkam.cl |

---

## 4. MÓDULOS DEL ERP

---

### 4.1 MÓDULO COT — Cotizaciones ✅ Implementado

**Propósito:** Gestionar el ciclo completo de cotizaciones hacia clientes, desde la creación hasta el cierre o conversión a orden.

#### 3.1.1 Entidades Principales

| Entidad | Descripción |
|---------|-------------|
| `Cotizacion` | Documento maestro de cotización |
| `CotizacionItem` | Línea de producto/servicio dentro de la cotización |
| `CotizacionVersion` | Historial de versiones de la cotización |
| `CotizacionAdjunto` | Archivos adjuntos (planos, fichas técnicas, etc.) |

#### 3.1.2 Atributos Clave de Cotización

```
Cotizacion {
  id               UUID        PK
  numero           VARCHAR     Autoincremental formateado (COT-YYYY-NNNN)
  version          INT         Default 1, incrementa en revisiones
  cliente_id       UUID        FK → clientes
  contacto_id      UUID        FK → contactos_cliente
  fecha_emision    DATE
  fecha_vencimiento DATE
  moneda           VARCHAR     CLP | USD | EUR
  tipo_cambio      DECIMAL     Si moneda ≠ CLP
  subtotal         DECIMAL
  descuento_global DECIMAL     %
  impuestos        DECIMAL     IVA u otros
  total            DECIMAL
  estado           ENUM        (ver sección 5.1)
  notas_internas   TEXT
  notas_cliente    TEXT
  condiciones_pago TEXT
  tiempo_entrega   VARCHAR
  validez_dias     INT
  creado_por       UUID        FK → usuarios
  asignado_a       UUID        FK → usuarios
  origen           ENUM        manual | ia_documental | api
  created_at       TIMESTAMP
  updated_at       TIMESTAMP
}
```

#### 4.1.3 Funcionalidades Implementadas ✅

- Creación con items (producto, cantidad, valor unitario, descripción opcional)
- Numeración automática (COT-YYYY-NNNN)
- Generación de PDF visual desde página de detalle
- Envío por **WhatsApp** (abre wa.me con link público y mensaje predefinido)
- Envío por **email** vía EmailJS (sin backend, configuración en frontend)
- **Página pública** `/ver?d=...` para que el cliente vea su cotización (datos embebidos en URL en base64, sin requerir BD)
- Cambio de estado manual desde listado (select inline)
- Al aprobar → crea movimiento de ingreso en Finanzas automáticamente
- Al eliminar una cotización aprobada → elimina el movimiento de finanzas asociado

#### 4.1.4 Pendiente de Implementar 🔲

- Versionado automático al editar cotización enviada
- Conversión directa a Orden de Compra desde la cotización
- Comparación entre versiones (diff visual)
- Duplicación de cotizaciones
- Tracking de apertura de email/link

---

### 4.2 MÓDULO OC — Órdenes de Compra ✅ Implementado (básico)

**Propósito:** Gestionar las órdenes de compra emitidas a proveedores, su aprobación, recepción y liquidación.

#### 3.2.1 Entidades Principales

| Entidad | Descripción |
|---------|-------------|
| `OrdenCompra` | Documento maestro de OC |
| `OrdenCompraItem` | Línea de producto/servicio |
| `Proveedor` | Empresa proveedora |
| `Recepcion` | Registro de recepción parcial o total |
| `RecepcionItem` | Detalle por ítem recibido |
| `AprobacionOC` | Registro de aprobaciones en cadena |

#### 3.2.2 Atributos Clave de OrdenCompra

```
OrdenCompra {
  id                UUID        PK
  numero            VARCHAR     OC-YYYY-NNNN
  proveedor_id      UUID        FK → proveedores
  contacto_id       UUID        FK → contactos_proveedor
  cotizacion_id     UUID        FK → cotizaciones (opcional)
  fecha_emision     DATE
  fecha_entrega_req DATE
  moneda            VARCHAR
  tipo_cambio       DECIMAL
  subtotal          DECIMAL
  impuestos         DECIMAL
  total             DECIMAL
  estado            ENUM        (ver sección 5.2)
  nivel_aprobacion  INT         Nivel actual en cadena de aprobación
  condiciones_pago  TEXT
  lugar_entrega     TEXT
  notas_proveedor   TEXT
  notas_internas    TEXT
  creado_por        UUID        FK → usuarios
  aprobado_por      UUID[]      Array de aprobadores
  created_at        TIMESTAMP
  updated_at        TIMESTAMP
}
```

#### 4.2.3 Estado de Implementación

**Implementado ✅:**
- CRUD básico de órdenes de compra (solo rol admin)
- Items por OC (código, descripción, cantidad, precio unitario)
- Al pagar OC → crea movimiento de egreso en Finanzas

**Pendiente 🔲:**
- Flujo de aprobación por rangos de monto
- Recepción parcial/total de productos
- Integración con FIN.SII (facturas de compra esperadas)
- Conversión desde Cotización aceptada

---

### 4.3 MÓDULO RH — Recursos Humanos ⚠️ Parcial

**Propósito:** Administrar los procesos de gestión de personas: contratación, documentación, evaluación, licencias y desvinculación.

#### 3.3.1 Entidades Principales

| Entidad | Descripción |
|---------|-------------|
| `Postulante` | Candidato en proceso de selección |
| `ProcesoSeleccion` | Pipeline de contratación |
| `Contrato` | Contrato laboral vigente o histórico |
| `Licencia` | Licencias médicas y permisos |
| `Evaluacion` | Evaluaciones de desempeño |
| `DocumentoLaboral` | Documentos asociados al trabajador |
| `HistorialLaboral` | Historial de cargos y cambios |

#### 4.3.2 Estado Actual

- Página `RRHHPage` existe en frontend (solo admin)
- Sin funcionalidades implementadas aún

#### 4.3.3 Sub-procesos Planificados 🔲

```
RH
├── Reclutamiento y Selección
│   ├── Publicación de vacantes
│   ├── Recepción de postulaciones
│   ├── Pipeline Kanban de candidatos
│   └── Generación de oferta laboral
├── Onboarding
│   ├── Checklist de ingreso
│   ├── Firma digital de contratos
│   └── Entrega de activos
├── Gestión de Personal
│   ├── Licencias médicas
│   ├── Permisos administrativos
│   ├── Vacaciones
│   └── Evaluaciones periódicas
└── Offboarding
    ├── Checklist de salida
    ├── Finiquito
    └── Devolución de activos
```

---

### 4.4 MÓDULO TRB — Trabajadores ✅ Implementado

**Propósito:** Repositorio central de información de todos los trabajadores activos, inactivos e históricos.

#### 3.4.1 Entidades Principales

```
Trabajador {
  id                UUID        PK
  rut               VARCHAR     Unique, validado
  nombres           VARCHAR
  apellidos         VARCHAR
  email_corporativo VARCHAR     Unique
  email_personal    VARCHAR
  telefono          VARCHAR
  fecha_nacimiento  DATE
  genero            ENUM
  nacionalidad      VARCHAR
  direccion         JSONB       { calle, numero, ciudad, region, pais }
  cargo_id          UUID        FK → cargos
  departamento_id   UUID        FK → departamentos
  jefe_directo_id   UUID        FK → trabajadores (self-ref)
  fecha_ingreso     DATE
  fecha_egreso      DATE        Null si activo
  tipo_contrato     ENUM        indefinido | plazo_fijo | honorarios | practicante
  estado            ENUM        activo | inactivo | licencia | vacaciones | suspendido
  nivel_acceso_erp  UUID        FK → roles
  foto_url          VARCHAR
  created_at        TIMESTAMP
  updated_at        TIMESTAMP
}
```

#### 4.4.2 Modelo de Datos Real (Tabla `trabajadores`)

```
trabajadores {
  id               UUID
  nombre           VARCHAR
  rut              VARCHAR (único)
  telefono         VARCHAR
  cargo            VARCHAR
  sueldo           DECIMAL
  fecha_ingreso    DATE
  estado           VARCHAR  ('activo' | 'inactivo')
}
```

#### 4.4.3 Pendiente 🔲

- Organigrama (jefe_directo_id)
- Cargos y departamentos como entidades separadas
- Historial laboral
- Integración con módulo RH (licencias, evaluaciones)

---

### 4.5 MÓDULO IAD — IA Documental 🔲 Planificado

**Propósito:** Procesar documentos entrantes (cotizaciones de proveedores, OC recibidas, contratos, etc.) mediante IA para extraer datos estructurados, clasificarlos y pre-poblar formularios del ERP.

#### 3.5.1 Capacidades

| Capacidad | Descripción |
|-----------|-------------|
| **OCR** | Extracción de texto de PDFs escaneados e imágenes |
| **Clasificación** | Identifica el tipo de documento automáticamente |
| **Extracción** | Parsea campos clave según el tipo de documento |
| **Validación** | Cruza datos extraídos contra maestros del ERP |
| **Pre-llenado** | Crea borradores en el módulo correspondiente |
| **Resumen** | Genera resumen ejecutivo del documento |
| **Alertas** | Detecta cláusulas inusuales o datos inconsistentes |

#### 3.5.2 Tipos de Documentos Soportados

```
Documentos Entrantes
├── Cotizaciones de Proveedores → Pre-llena OC
├── Facturas → Valida contra OC existente
├── Contratos Laborales → Extrae condiciones y plazos
├── Licencias Médicas → Registra en módulo RH
├── Finiquitos → Procesa y archiva
└── Documentos Genéricos → Clasifica y archiva
```

#### 3.5.3 Pipeline de Procesamiento

```
DOCUMENTO ENTRANTE
      │
      ▼
[1. Ingesta] ──── Upload API / Email / Integración
      │
      ▼
[2. OCR] ──────── Extracción de texto crudo
      │
      ▼
[3. Clasificación] ── LLM identifica tipo de documento
      │
      ▼
[4. Extracción] ──── LLM extrae campos según tipo
      │
      ▼
[5. Validación] ──── Cruza RUT, códigos, precios contra BD
      │
      ├── Confianza Alta (>85%) ──→ Borrador automático
      ├── Confianza Media (60-85%) ─→ Borrador + revisión humana
      └── Confianza Baja (<60%) ───→ Alerta + revisión completa
      │
      ▼
[6. Acción] ─────── Crea entidad en módulo destino
      │
      ▼
[7. Archivo] ────── Almacena doc original con metadatos
```

---

### 4.6 MÓDULO FIN — Finanzas y Conciliación ⚠️ Parcial

**Propósito:** Centralizar la gestión financiera operativa: cartolas bancarias, documentos tributarios del SII, y conciliación asistida por IA entre movimientos bancarios, facturas, caja chica y adelantos de trabajadores.

> Especificación completa en: [`docs/MODULO_FIN_FINANZAS.md`](./MODULO_FIN_FINANZAS.md)

#### 4.6.1 Estado Actual ⚠️

**Implementado:**
- Tabla `movimientos_bancarios` en Supabase con campos: fecha, descripción, tipo (abono/cargo), monto, referencia, conciliado
- API: GET, POST, PATCH `/:id/conciliar` (toggle)
- Frontend completo con informe financiero, filtros, conciliación manual
- **Importación de cartola CSV** con parser inteligente (detecta columnas automáticamente)
- **Auto-matching** al importar: cruza movimientos del CSV con pendientes por tipo+monto (±2%)
- **Módulo de gastos** con foto de boleta, categoría, comercio, RUT, estado (pendiente/aprobado/rechazado)
- Movimientos automáticos al aprobar cotizaciones y pagar OC
- Informe: por cobrar, cobrado, por pagar, pagado, saldo real, saldo proyectado

**Pendiente 🔲:** FIN.BAN (cuentas bancarias múltiples), FIN.SII (integración SII), FIN.CON (períodos de conciliación), FIN.CAJ (caja chica), FIN.ADL (adelantos)

#### 4.6.2 Sub-módulos (Especificación)

| Sub-módulo | Código | Descripción |
|-----------|--------|-------------|
| Cartolas y Cuentas Bancarias | `FIN.BAN` | Carga y parsing IA de cartolas de cualquier banco chileno |
| Documentos Tributarios SII | `FIN.SII` | Sincronización automática de facturas de compra/venta desde el RCV del SII |
| Conciliación Bancaria | `FIN.CON` | Motor IA que cruza movimientos bancarios con facturas, caja chica y adelantos |
| Caja Chica | `FIN.CAJ` | Fondos de caja chica, gastos, rendiciones y reposiciones |
| Adelantos de Trabajadores | `FIN.ADL` | Control de adelantos, cuotas y descuentos en remuneración |

#### 3.6.2 Capacidades IA del Módulo FIN

| Capacidad | Descripción |
|-----------|-------------|
| **Parsing de cartolas** | Detecta banco y formato automáticamente (Excel, CSV, OFX, PDF) |
| **Conciliación automática** | 4 fases: exacta, aproximada, agrupada, LLM fallback |
| **Extracción de boletas** | Foto de boleta caja chica → datos estructurados |
| **Informe narrativo** | Análisis mensual en lenguaje natural por IA |
| **Detección de anomalías** | Pagos duplicados, montos inusuales, diferencias injustificadas |
| **Proyección de flujo** | Flujo de caja estimado basado en histórico + documentos pendientes |

#### 3.6.3 Integración SII Chile

- Conexión mediante **certificado digital** (.pfx) del representante legal
- Sincronización del **Registro de Compras y Ventas (RCV)**
- DTEs soportados: Facturas (33), Facturas No Afectas (34), OC electrónicas (46), Notas de Crédito/Débito (56, 61), Guías de Despacho (52)
- Cruce automático con OC y COT del ERP para pre-conciliar

#### 3.6.4 Nuevos Roles del Módulo

| Rol | Código | Descripción |
|-----|--------|-------------|
| Contador | `CONTADOR` | Gestión completa del módulo FIN, cierre de períodos |
| Tesorería | `TESORERIA` | Carga de cartolas, conciliación operativa |

---

### 4.7 MÓDULO CONT — Contabilidad 🔲 Planificado

**Propósito:** Implementar la contabilidad de partida doble completa, integrada con todos los módulos del ERP. Genera asientos automáticos desde FIN, OC, RH y COT. Produce estados financieros IFRS, gestiona el IVA y los cierres contables mensuales y anuales.

> Especificación completa en: [`docs/MODULO_CONT_CONTABILIDAD.md`](./MODULO_CONT_CONTABILIDAD.md)

#### 3.7.1 Sub-módulos

| Sub-módulo | Código | Descripción |
|-----------|--------|-------------|
| Plan Único de Cuentas | `CONT.PUC` | Jerarquía de hasta 6 niveles, clases 1-9, compatible IFRS y normativa SII |
| Libro Diario | `CONT.DIA` | Registro cronológico de todos los asientos del período |
| Libro Mayor | `CONT.MAY` | Movimiento y saldo por cuenta, balance de comprobación |
| Gestión IVA | `CONT.IVA` | Débito/crédito fiscal, proporcionalidad, declaración F29 automática |
| Centralizaciones | `CONT.CEN` | Asientos resumen por tipo y período (ventas, compras, remuneraciones) |
| Estados Financieros | `CONT.BAL` | Balance IFRS, EERR, Flujo de Caja, Cambios en Patrimonio con narrativa IA |
| Cierres Contables | `CONT.CIE` | Cierre mensual y anual con proceso validado y auditable |
| Auditoría Contable | `CONT.AUD` | Inmutabilidad, log de cambios, firmas digitales de reportes |

#### 3.7.2 Asientos Automáticos (sin intervención manual)

| Evento origen | Módulo | Asiento generado |
|--------------|--------|-----------------|
| Factura de venta DTE 33 | FIN.SII / COT | VTA: Clientes / Ventas / IVA Débito |
| Factura de compra DTE 46 | FIN.SII / OC | CMP: Gasto-Costo / IVA Crédito / Proveedores |
| Movimiento bancario conciliado | FIN.BAN | BAN: Banco / Clientes o Proveedores |
| Rendición caja chica aprobada | FIN.CAJ | CAJ: Gastos / Caja Chica |
| Adelanto de trabajador pagado | FIN.ADL | BAN: Adelantos Trabajadores / Banco |
| Liquidación de sueldo aprobada | RH | REM: Remuneraciones / AFP / Isapre / Sueldos |
| Fin de mes (cron) | CONT | DEP: Depreciación / Provisiones |

#### 3.7.3 Capacidades IA del Módulo CONT

| Capacidad | Descripción |
|-----------|-------------|
| **Clasificación de cuentas** | IA propone cuenta de gasto/costo para cada factura de compra |
| **Detección de anomalías** | Asientos inusuales, montos fuera de rango, cuentas incorrectas |
| **Narrativa financiera** | EERR y Balance con análisis en lenguaje natural estilo CFO |
| **Asistente contable** | Chat para consultas sobre plan de cuentas, saldos y normativa |
| **Proyección de resultado** | Estimación del EERR de fin de año basada en el histórico |
| **Validación de asientos** | Detecta errores conceptuales antes de confirmar |

#### 3.7.4 Marco Normativo

- **IFRS / NIC adoptadas en Chile** — Base de presentación de estados financieros
- **Decreto Ley 825** — IVA 19%, declaración F29 mensual
- **Decreto Ley 824** — Impuesto de Primera Categoría, PPM, F22 anual
- **Circular SII N°45** — Formato libros tributarios

---

## 5. FLUJOS DE TRABAJO

### 5.1 Flujo: Cotización → Orden de Compra → Recepción

```
[CLIENTE SOLICITA]
      │
      ▼
[CREAR COTIZACIÓN] ──── Manual o desde IA Documental
      │
      ▼
[REVISAR Y ENVIAR]
      │
      ├── Cliente Acepta ──────────────────────────────────┐
      ├── Cliente Rechaza → FIN                            │
      └── Cliente Pide Cambios → [NUEVA VERSIÓN] ──────────┤
                                                           │
                                                           ▼
                                                   [CREAR OC desde COT]
                                                           │
                                                           ▼
                                                   [FLUJO DE APROBACIÓN]
                                                           │
                                                           ▼
                                                   [EMITIR OC al PROVEEDOR]
                                                           │
                                                           ▼
                                                   [RECEPCIÓN PARCIAL/TOTAL]
                                                           │
                                                           ▼
                                                   [LIQUIDACIÓN / FACTURA]
```

### 5.2 Flujo: Onboarding de Trabajador 🔲 Planificado

```
[POSTULANTE SELECCIONADO]
      │
      ▼
[OFERTA LABORAL] ──── Generada desde plantilla, enviada por email
      │
      ├── Acepta ──────────────────────────────────────────┐
      └── Rechaza → Cierre proceso                         │
                                                           ▼
                                                   [CREAR TRABAJADOR]
                                                           │
                                                           ▼
                                                   [GENERAR CONTRATO] ←── IA genera borrador
                                                           │
                                                           ▼
                                                   [FIRMA DIGITAL]
                                                           │
                                                           ▼
                                                   [CHECKLIST ONBOARDING]
                                                   ├── Acceso ERP
                                                   ├── Email corporativo
                                                   ├── Entrega activos
                                                   └── Inducción
                                                           │
                                                           ▼
                                                   [TRABAJADOR ACTIVO]
```

### 5.3 Flujo: Procesamiento IA Documental 🔲 Planificado

```
[DOCUMENTO LLEGA] ──── Email adjunto / Upload manual / API
      │
      ▼
[COLA DE PROCESAMIENTO] ──── BullMQ, prioridad configurable
      │
      ▼
[OCR + CLASIFICACIÓN] ──── Resultado: tipo + confianza
      │
      ▼
[EXTRACCIÓN DE CAMPOS] ──── JSON estructurado
      │
      ├── Confianza ≥ 85% ────→ Auto-procesa + notifica
      ├── Confianza 60-85% ───→ Borrador + solicita revisión
      └── Confianza < 60% ────→ Alerta + asigna revisor
      │
      ▼
[REVISIÓN HUMANA si aplica] ──── UI de validación campo por campo
      │
      ▼
[CREAR ENTIDAD EN ERP] ──── Cotización / OC / Contrato / etc.
      │
      ▼
[ARCHIVAR DOCUMENTO] ──── S3/MinIO + índice Elasticsearch
```

---

## 6. ESTADOS Y TRANSICIONES

### 6.1 Estados: Cotización ✅ Implementado

```
                    ┌─────────┐
              ┌────▶│ BORRADOR│──────────────────────┐
              │     └────┬────┘                       │
              │          │ Enviar                     │
              │          ▼                            │
              │     ┌─────────┐                       │
   Nueva      │     │ENVIADA  │◀────────────┐         │
   versión    │     └────┬────┘             │         │
              │          │                 │         │
              │    ┌─────┼─────┐           │         │
              │    ▼     ▼     ▼           │         │
              │  ACE   RECH  REVI     Nueva │         │
              │  PTADA AZADA SIÓN    vers.  │         │
              │    │           │           │         │
              │    │           └───────────┘         │
              │    ▼                                  │
              │  ┌──────────────┐                    │
              │  │  CONVERTIDA  │                    │
              │  │  (→ OC)      │                    │
              │  └──────────────┘                    │
              │                                      │
              │                              ┌───────▼───┐
              └──────────────────────────────│ CANCELADA │
                                             └───────────┘
```

**Estados implementados actualmente:**

| Estado | Descripción |
|--------|-------------|
| `borrador` | En edición, no enviada |
| `enviada` | Enviada al cliente (al enviar WA/email cambia automáticamente) |
| `aprobada` | Cliente confirmó (crea movimiento de ingreso en Finanzas) |
| `rechazada` | Cliente rechazó |

> Los estados `en_revision`, `convertida`, `cancelada` y `vencida` están especificados pero no implementados aún.

### 6.2 Estados: Orden de Compra 🔲 Parcialmente planificado

| Estado | Descripción |
|--------|-------------|
| `borrador` | En edición |
| `pendiente_aprobacion` | En flujo de aprobación |
| `aprobada` | Aprobación completa, lista para emitir |
| `emitida` | Enviada al proveedor |
| `confirmada` | Proveedor confirmó recepción |
| `en_transito` | Productos despachados |
| `recepcion_parcial` | Recibida parcialmente |
| `recibida` | Recepción completa |
| `facturada` | Factura recibida y validada |
| `cerrada` | Proceso completo |
| `cancelada` | Anulada |
| `rechazada` | Rechazada en aprobación |

### 6.3 Estados: Trabajador ✅ Implementado

| Estado | Descripción |
|--------|-------------|
| `activo` | Trabajando normalmente |
| `inactivo` | Desvinculado |

> Los estados `licencia`, `vacaciones` y `suspendido` están especificados pero no implementados aún.

### 6.4 Estados: Movimiento Bancario ✅ Implementado

| Estado | Descripción |
|--------|-------------|
| `conciliado: false` | Pendiente de conciliar |
| `conciliado: true` | Marcado como conciliado |

### 6.5 Estados: Documento IA 🔲 Planificado

| Estado | Descripción |
|--------|-------------|
| `en_cola` | Esperando procesamiento |
| `procesando` | En pipeline de IA |
| `revision_requerida` | Baja confianza, requiere humano |
| `procesado` | Completado sin errores |
| `error` | Fallo en procesamiento |
| `archivado` | Procesado y archivado |

---

## 7. RELACIONES ENTRE MÓDULOS

### 7.1 Relaciones Implementadas ✅

| Módulo Origen | Módulo Destino | Relación actual |
|---------------|----------------|-----------------|
| COT (aprobada) | FIN | Crea movimiento de ingreso automáticamente |
| COT (eliminada aprobada) | FIN | Elimina el movimiento de ingreso asociado |
| OC (pagada) | FIN | Crea movimiento de egreso automáticamente |
| Cartola CSV | FIN | Importa movimientos y auto-concilia con pendientes |

### 7.2 Mapa de Relaciones Objetivo

```
           ┌──────────┐
           │  IAD     │──── Procesa documentos para todos los módulos
           └────┬─────┘
                │ genera borradores
    ┌───────────┼──────────────┬────────────┐
    ▼           ▼              ▼            ▼
┌───────┐  ┌───────┐      ┌───────┐   ┌───────┐
│  COT  │  │  OC   │      │  RH   │   │  FIN  │
└───┬───┘  └───┬───┘      └───┬───┘   └───┬───┘
    │           │              │           │
    │ convierte │ recibe       │ gestiona  │ concilia
    └─────┬─────┘              │           │ facturas
          │                    ▼           │ movimientos
          │              ┌──────────┐      │
          │              │   TRB    │◀─────┘
          │              └──────────┘  adelantos /
          │                    │       remuneraciones
          └────────────────────┘
               aprobaciones / asignaciones

FIN ←── COT   (cotizaciones aceptadas generan facturas de venta esperadas)
FIN ←── OC    (órdenes de compra generan facturas de compra esperadas)
FIN ←── TRB   (trabajadores tienen adelantos y descuentos)
FIN ←── SII   (sincronización externa de DTEs)
FIN ──→ CONT  (conciliación y facturas SII disparan asientos automáticos)
CONT ──→ SII  (exporta F29 mensual, Libros de C/V, F22 anual)
RH ───→ CONT  (liquidaciones aprobadas generan asiento de remuneraciones)
OC ───→ CONT  (recepción de OC genera asiento de compra / CxP)
COT ──→ CONT  (factura emitida genera asiento de venta / CxC)
```

### 7.3 Tabla de Dependencias Objetivo

| Módulo Origen | Módulo Destino | Tipo Relación |
|---------------|----------------|---------------|
| COT | OC | COT puede convertirse en OC |
| COT | TRB | Cotización asignada a un trabajador |
| COT | FIN | Cotización aceptada → factura de venta esperada en FIN.SII |
| OC | TRB | OC creada y aprobada por trabajadores |
| OC | COT | OC puede referenciar COT de origen |
| OC | FIN | OC emitida → factura de compra esperada en FIN.SII |
| RH | TRB | RH gestiona el ciclo de vida de TRB |
| TRB | COT/OC | TRB participa como creador/aprobador |
| TRB | FIN | TRB tiene adelantos y pagos gestionados en FIN.ADL |
| IAD | COT/OC/RH/FIN | IAD genera borradores en cualquier módulo, incluyendo cartolas |
| FIN.SII | FIN.CON | Facturas SII son conciliadas contra movimientos bancarios |
| FIN.BAN | FIN.CON | Movimientos de cartola son la base de la conciliación |
| FIN.CAJ | FIN.CON | Movimientos de caja chica se concilian en períodos |
| FIN.ADL | FIN.CON | Pagos de adelantos se vinculan a movimientos bancarios |
| FIN.SII | CONT | Facturas SII conciliadas disparan asientos VTA/CMP automáticos |
| FIN.BAN | CONT | Movimientos conciliados disparan asientos BAN automáticos |
| FIN.CAJ | CONT | Rendiciones aprobadas disparan asiento CAJ automático |
| FIN.ADL | CONT | Adelantos pagados disparan asiento BAN en CONT |
| RH | CONT | Liquidaciones aprobadas disparan asiento REM centralizado |
| OC | CONT | Recepción de OC genera asiento de compra y CxP |
| COT | CONT | Factura emitida desde COT genera asiento VTA en CONT |
| CONT | SII | Exporta F29 mensual, libros tributarios, datos F22 anual |

---

## 8. BASE DE DATOS

### 8.1 Plataforma Actual

- **Supabase** (PostgreSQL cloud) — `@supabase/supabase-js` v2
- Tablas confirmadas: `usuarios`, `trabajadores`, `cotizaciones`, `cotizacion_items`, `ordenes_compra`, `oc_items`, `movimientos_bancarios`
- Sin migraciones formales aún (schema gestionado manualmente en Supabase Dashboard)
- Seed de prueba en `database/seed.sql`

### 8.2 Convenciones

- Motor: **PostgreSQL 16+**
- Todos los IDs: **UUID v4** (`gen_random_uuid()`)
- Timestamps: **TIMESTAMP WITH TIME ZONE** en UTC
- Soft deletes: columna `deleted_at TIMESTAMPTZ NULL`
- Auditoría: tabla `audit_log` centralizada
- Nomenclatura: `snake_case`, tablas en plural

### 8.3 Esquema Actual (Seed Confirmado)

```sql
-- Tablas confirmadas en database/seed.sql

-- usuarios: id, email, nombre, rol ('admin'|'vendedor'), password_hash
-- trabajadores: id, nombre, rut, telefono, cargo, sueldo, fecha_ingreso, estado
-- cotizaciones: id, numero, cliente, email, telefono, estado, total, observaciones, fecha
-- movimientos_bancarios: id, fecha, descripcion, tipo, monto, referencia, conciliado
```

### 8.4 Esquema Objetivo

```sql
-- USUARIOS Y AUTENTICACIÓN
CREATE TABLE usuarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  nombre_completo VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  rol_id          UUID REFERENCES roles(id),
  activo          BOOLEAN DEFAULT true,
  ultimo_acceso   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- ROLES Y PERMISOS
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(100) UNIQUE NOT NULL,
  descripcion TEXT,
  es_sistema  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permisos (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo   VARCHAR(50) NOT NULL,  -- COT, OC, RH, TRB, IAD
  accion   VARCHAR(50) NOT NULL,  -- crear, leer, editar, eliminar, aprobar
  recurso  VARCHAR(50)            -- propio, equipo, todos
);

CREATE TABLE roles_permisos (
  rol_id     UUID REFERENCES roles(id),
  permiso_id UUID REFERENCES permisos(id),
  PRIMARY KEY (rol_id, permiso_id)
);

-- TRABAJADORES
CREATE TABLE departamentos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(200) NOT NULL,
  codigo      VARCHAR(20) UNIQUE,
  padre_id    UUID REFERENCES departamentos(id),
  activo      BOOLEAN DEFAULT true
);

CREATE TABLE cargos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         VARCHAR(200) NOT NULL,
  departamento_id UUID REFERENCES departamentos(id),
  nivel          INT,
  activo         BOOLEAN DEFAULT true
);

CREATE TABLE trabajadores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rut               VARCHAR(12) UNIQUE NOT NULL,
  nombres           VARCHAR(150) NOT NULL,
  apellidos         VARCHAR(150) NOT NULL,
  email_corporativo VARCHAR(255) UNIQUE,
  email_personal    VARCHAR(255),
  telefono          VARCHAR(20),
  fecha_nacimiento  DATE,
  cargo_id          UUID REFERENCES cargos(id),
  departamento_id   UUID REFERENCES departamentos(id),
  jefe_directo_id   UUID REFERENCES trabajadores(id),
  fecha_ingreso     DATE NOT NULL,
  fecha_egreso      DATE,
  tipo_contrato     VARCHAR(30),
  estado            VARCHAR(30) DEFAULT 'activo',
  usuario_id        UUID REFERENCES usuarios(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- CLIENTES Y PROVEEDORES
CREATE TABLE empresas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rut         VARCHAR(12) UNIQUE,
  razon_social VARCHAR(300) NOT NULL,
  nombre_fantasia VARCHAR(300),
  tipo        VARCHAR(20) NOT NULL,  -- cliente | proveedor | ambos
  email       VARCHAR(255),
  telefono    VARCHAR(20),
  direccion   JSONB,
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contactos_empresa (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID REFERENCES empresas(id),
  nombres     VARCHAR(150),
  apellidos   VARCHAR(150),
  cargo       VARCHAR(150),
  email       VARCHAR(255),
  telefono    VARCHAR(20),
  es_principal BOOLEAN DEFAULT false
);

-- COTIZACIONES
CREATE TABLE cotizaciones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            VARCHAR(20) UNIQUE NOT NULL,
  version           INT DEFAULT 1,
  cotizacion_padre_id UUID REFERENCES cotizaciones(id),
  empresa_id        UUID REFERENCES empresas(id),
  contacto_id       UUID REFERENCES contactos_empresa(id),
  fecha_emision     DATE NOT NULL,
  fecha_vencimiento DATE,
  moneda            VARCHAR(3) DEFAULT 'CLP',
  tipo_cambio       DECIMAL(10,4) DEFAULT 1,
  subtotal          DECIMAL(14,2) DEFAULT 0,
  descuento_global  DECIMAL(5,2) DEFAULT 0,
  impuestos         DECIMAL(14,2) DEFAULT 0,
  total             DECIMAL(14,2) DEFAULT 0,
  estado            VARCHAR(30) DEFAULT 'borrador',
  notas_internas    TEXT,
  notas_cliente     TEXT,
  condiciones_pago  TEXT,
  tiempo_entrega    VARCHAR(100),
  validez_dias      INT DEFAULT 30,
  creado_por        UUID REFERENCES usuarios(id),
  asignado_a        UUID REFERENCES usuarios(id),
  origen            VARCHAR(20) DEFAULT 'manual',
  documento_iad_id  UUID,  -- FK → documentos_iad si viene de IA
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE cotizaciones_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id   UUID REFERENCES cotizaciones(id) ON DELETE CASCADE,
  orden           INT NOT NULL,
  codigo          VARCHAR(50),
  descripcion     TEXT NOT NULL,
  unidad          VARCHAR(20),
  cantidad        DECIMAL(12,4) NOT NULL,
  precio_unitario DECIMAL(14,2) NOT NULL,
  descuento       DECIMAL(5,2) DEFAULT 0,
  subtotal        DECIMAL(14,2) NOT NULL,
  notas           TEXT
);

-- ÓRDENES DE COMPRA
CREATE TABLE ordenes_compra (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              VARCHAR(20) UNIQUE NOT NULL,
  proveedor_id        UUID REFERENCES empresas(id),
  contacto_id         UUID REFERENCES contactos_empresa(id),
  cotizacion_id       UUID REFERENCES cotizaciones(id),
  fecha_emision       DATE NOT NULL,
  fecha_entrega_req   DATE,
  moneda              VARCHAR(3) DEFAULT 'CLP',
  tipo_cambio         DECIMAL(10,4) DEFAULT 1,
  subtotal            DECIMAL(14,2) DEFAULT 0,
  impuestos           DECIMAL(14,2) DEFAULT 0,
  total               DECIMAL(14,2) DEFAULT 0,
  estado              VARCHAR(30) DEFAULT 'borrador',
  nivel_aprobacion    INT DEFAULT 0,
  aprobacion_requerida INT DEFAULT 1,
  condiciones_pago    TEXT,
  lugar_entrega       TEXT,
  notas_proveedor     TEXT,
  notas_internas      TEXT,
  creado_por          UUID REFERENCES usuarios(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE TABLE ordenes_compra_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id  UUID REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  orden            INT NOT NULL,
  codigo           VARCHAR(50),
  descripcion      TEXT NOT NULL,
  unidad           VARCHAR(20),
  cantidad         DECIMAL(12,4) NOT NULL,
  precio_unitario  DECIMAL(14,2) NOT NULL,
  subtotal         DECIMAL(14,2) NOT NULL,
  cantidad_recibida DECIMAL(12,4) DEFAULT 0
);

CREATE TABLE aprobaciones_oc (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id  UUID REFERENCES ordenes_compra(id),
  nivel            INT NOT NULL,
  aprobador_id     UUID REFERENCES usuarios(id),
  estado           VARCHAR(20),  -- pendiente | aprobado | rechazado
  comentario       TEXT,
  fecha_accion     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- IA DOCUMENTAL
CREATE TABLE documentos_iad (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_original   VARCHAR(500) NOT NULL,
  tipo_mime         VARCHAR(100),
  tamano_bytes      BIGINT,
  storage_url       VARCHAR(1000) NOT NULL,
  tipo_documento    VARCHAR(50),   -- cotizacion_proveedor | oc | contrato | licencia | generico
  estado            VARCHAR(30) DEFAULT 'en_cola',
  confianza         DECIMAL(5,2),  -- 0-100
  datos_extraidos   JSONB,
  errores           JSONB,
  modulo_destino    VARCHAR(20),   -- COT | OC | RH | TRB
  entidad_creada_id UUID,          -- ID del registro creado en el módulo destino
  revisado_por      UUID REFERENCES usuarios(id),
  revisado_at       TIMESTAMPTZ,
  subido_por        UUID REFERENCES usuarios(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- AUDITORÍA
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla         VARCHAR(100) NOT NULL,
  registro_id   UUID NOT NULL,
  accion        VARCHAR(20) NOT NULL,  -- INSERT | UPDATE | DELETE
  datos_antes   JSONB,
  datos_despues JSONB,
  usuario_id    UUID REFERENCES usuarios(id),
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICACIONES
CREATE TABLE notificaciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID REFERENCES usuarios(id),
  tipo        VARCHAR(50) NOT NULL,
  titulo      VARCHAR(300) NOT NULL,
  mensaje     TEXT,
  datos       JSONB,
  leida       BOOLEAN DEFAULT false,
  leida_at    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.5 Índices Objetivo

```sql
-- Búsquedas frecuentes
CREATE INDEX idx_cotizaciones_estado ON cotizaciones(estado);
CREATE INDEX idx_cotizaciones_empresa ON cotizaciones(empresa_id);
CREATE INDEX idx_cotizaciones_asignado ON cotizaciones(asignado_a);
CREATE INDEX idx_oc_estado ON ordenes_compra(estado);
CREATE INDEX idx_oc_proveedor ON ordenes_compra(proveedor_id);
CREATE INDEX idx_trabajadores_estado ON trabajadores(estado);
CREATE INDEX idx_trabajadores_departamento ON trabajadores(departamento_id);
CREATE INDEX idx_documentos_iad_estado ON documentos_iad(estado);
CREATE INDEX idx_audit_tabla_registro ON audit_log(tabla, registro_id);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id, leida);

-- Búsqueda full-text
CREATE INDEX idx_cotizaciones_fts ON cotizaciones USING gin(
  to_tsvector('spanish', numero || ' ' || COALESCE(notas_cliente, ''))
);
```

---

## 9. AUTOMATIZACIONES

### 9.1 Automatizaciones Implementadas ✅

| Trigger | Acción |
|---------|--------|
| Cotización aprobada | Crea movimiento de ingreso en Finanzas |
| Cotización aprobada eliminada | Elimina el movimiento de ingreso asociado |
| OC pagada | Crea movimiento de egreso en Finanzas |
| Cartola CSV importada | Auto-concilia movimientos CSV con pendientes por tipo+monto |
| Envío WA/email cotización | Cambia estado a `enviada` si estaba en `borrador` |

### 9.2 Automatizaciones Planificadas 🔲

| Trigger | Acción Automática | Módulo |
|---------|-------------------|--------|
| Cotización creada | Notificar al asignado | COT |  
| Cotización enviada | Programar recordatorio en 3 días | COT |
| Cotización vencida | Auto-cambiar estado a `vencida` | COT |
| OC enviada a aprobación | Notificar a aprobadores del nivel | OC |
| OC aprobada (último nivel) | Notificar al creador + generar PDF | OC |
| OC rechazada | Notificar al creador con motivo | OC |
| Documento subido a IAD | Iniciar pipeline de procesamiento | IAD |
| IAD confianza < 60% | Asignar revisor + notificar | IAD |
| Trabajador creado | Enviar checklist de onboarding | TRB/RH |
| Licencia registrada | Notificar a jefe directo + RH | RH |
| Contrato por vencer (30 días) | Alerta a RH para renovación | RH |

### 9.3 Automatizaciones Programadas (Cron) 🔲 Planificado

| Frecuencia | Tarea |
|------------|-------|
| Diaria 00:00 | Verificar cotizaciones vencidas y actualizar estado |
| Diaria 08:00 | Enviar resumen de pendientes a cada usuario |
| Diaria 09:00 | Recordatorios de aprobaciones OC sin respuesta (+24h) |
| Semanal Lunes | Reporte de cotizaciones por ejecutivo |
| Mensual día 1 | Generar KPIs del mes anterior |

### 9.4 Motor de Automatizaciones 🔲 Planificado

Las automatizaciones se gestionan mediante **BullMQ** (colas Redis):

```
Colas:
├── iad-processing       (procesamiento de documentos IA, alta prioridad)
├── notifications        (envío de notificaciones en tiempo real)
├── emails               (envío de emails con reintentos)
├── scheduled-jobs       (tareas programadas)
└── pdf-generation       (generación asíncrona de PDFs)
```

---

## 10. PERMISOS Y ROLES

### 10.1 Roles Implementados ✅

| Rol | Acceso actual |
|-----|---------------|
| `admin` | Acceso total a todos los módulos y rutas |
| `vendedor` | Acceso a cotizaciones (propias), dashboard |

### 10.2 Roles Objetivo 🔲

| Rol | Código | Descripción |
|-----|--------|-------------|
| **Superadministrador** | `SUPER_ADMIN` | Acceso total al sistema y configuración |  
| **Administrador** | `ADMIN` | Gestión de usuarios, módulos y configuración general |
| **Gerente** | `GERENTE` | Visibilidad total de su área, aprobación de OC nivel 2 |
| **Jefe de Área** | `JEFE_AREA` | Gestión de su equipo, aprobación nivel 1 |
| **Ejecutivo Comercial** | `EJECUTIVO` | CRUD de cotizaciones propias |
| **Compras** | `COMPRAS` | CRUD de órdenes de compra |
| **RRHH** | `RRHH` | Gestión completa de módulos RH y TRB |
| **Contador** | `CONTADOR` | Gestión completa del módulo FIN, cierre de períodos, config SII |
| **Tesorería** | `TESORERIA` | Carga de cartolas, conciliación operativa, caja chica |
| **Trabajador** | `TRABAJADOR` | Acceso de solo lectura a su propia información y adelantos |
| **IA Processor** | `IA_PROCESSOR` | Rol de servicio para IAD y FIN (API only) |

### 10.3 Matriz de Permisos Objetivo 🔲

| Acción | SUPER_ADMIN | ADMIN | GERENTE | JEFE_AREA | EJECUTIVO | COMPRAS | RRHH | CONTADOR | TESORERIA | TRABAJADOR |
|--------|:-----------:|:-----:|:-------:|:---------:|:---------:|:-------:|:----:|:--------:|:---------:|:----------:|
| **COT — Crear** | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| **COT — Ver todas** | ✓ | ✓ | ✓ | equipo | propias | — | — | ✓ | — | — |
| **COT — Editar** | ✓ | ✓ | ✓ | equipo | propias | — | — | — | — | — |
| **COT — Eliminar** | ✓ | ✓ | — | — | — | — | — | — | — | — |
| **OC — Crear** | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| **OC — Ver todas** | ✓ | ✓ | ✓ | equipo | — | ✓ | — | ✓ | — | — |
| **OC — Aprobar Nv1** | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| **OC — Aprobar Nv2** | ✓ | ✓ | ✓ | — | — | — | — | — | — | — |
| **RH — CRUD** | ✓ | ✓ | — | — | — | — | ✓ | — | — | — |
| **RH — Ver** | ✓ | ✓ | ✓ | equipo | — | — | ✓ | — | — | propio |
| **TRB — Ver** | ✓ | ✓ | ✓ | equipo | — | — | ✓ | — | — | propio |
| **TRB — Editar** | ✓ | ✓ | — | — | — | — | ✓ | — | — | — |
| **IAD — Subir docs** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **IAD — Revisar** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **FIN.BAN — CRUD** | ✓ | ✓ | — | — | — | — | — | ✓ | ✓ | — |
| **FIN.BAN — Ver** | ✓ | ✓ | ✓ | — | — | — | — | ✓ | ✓ | — |
| **FIN.SII — Sync** | ✓ | ✓ | — | — | — | — | — | ✓ | — | — |
| **FIN.SII — Ver** | ✓ | ✓ | ✓ | — | — | ✓ | — | ✓ | ✓ | — |
| **FIN.CON — Ejecutar** | ✓ | ✓ | — | — | — | — | — | ✓ | ✓ | — |
| **FIN.CON — Cerrar** | ✓ | ✓ | — | — | — | — | — | ✓ | — | — |
| **FIN.CAJ — CRUD** | ✓ | ✓ | — | equipo | — | — | — | ✓ | ✓ | — |
| **FIN.ADL — Aprobar** | ✓ | ✓ | ✓ | — | — | — | ✓ | — | — | — |
| **FIN.ADL — Ver propio** | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | — | propio |
| **Config sistema** | ✓ | ✓ | — | — | — | — | — | — | — | — |
| **Config SII** | ✓ | ✓ | — | — | — | — | — | ✓ | — | — |

### 10.4 Implementación Actual de Permisos

- **Autenticación:** JWT (token único de 7 días, sin refresh token)
- **Autorización:** RBAC simple — middleware `requireRole('admin')` en rutas de backend
- **Frontend:** `ProtectedRoute` con prop `roles={['admin']}` para proteger vistas
- **Sidebar:** Items marcados `adminOnly: true` se ocultan para rol `vendedor`

---

## 11. INTEGRACIÓN IA DOCUMENTAL 🔲 Planificado

### 10.1 Stack Tecnológico IA

| Componente | Tecnología | Propósito |
|------------|------------|-----------|
| **LLM** | Claude API (claude-sonnet-4-6) | Clasificación, extracción, resumen |
| **OCR** | Tesseract / AWS Textract | Extracción de texto de imágenes |
| **Embeddings** | text-embedding-3-small | Búsqueda semántica de documentos |
| **Vector DB** | pgvector (PostgreSQL) | Almacenamiento de embeddings |
| **Storage** | MinIO / S3 | Almacenamiento de archivos originales |

### 10.2 Prompt System para Extracción

El sistema utiliza prompts estructurados con instrucciones específicas por tipo de documento:

```
Sistema: Eres un extractor de datos de documentos empresariales.
         Responde SIEMPRE en JSON válido con la estructura indicada.
         Si no encuentras un campo, usa null. No inventes datos.

Usuario: Documento tipo: [TIPO]
         Estructura esperada: [SCHEMA JSON]
         Texto del documento:
         ---
         [TEXTO EXTRAÍDO POR OCR]
         ---
```

### 10.3 Validación de Datos Extraídos

Después de la extracción, el sistema valida:

1. **RUT:** Formato y dígito verificador
2. **Empresa:** Existencia en maestro de empresas
3. **Montos:** Coherencia (subtotal + IVA ≈ total)
4. **Fechas:** Rangos válidos (no futuras si aplica)
5. **Productos:** Códigos contra catálogo interno (si existe)

### 10.4 Modelo de Confianza

```
Confianza = (
  peso_clasificacion * score_clasificacion +
  peso_campos_criticos * campos_criticos_encontrados / total_criticos +
  peso_validacion * validaciones_exitosas / total_validaciones
) * 100
```

### 10.5 Caché de Embeddings

Los documentos procesados generan embeddings para:
- Detección de documentos duplicados
- Búsqueda semántica en archivo documental
- Sugerencia de proveedores similares al crear OC

---

## 12. FRONTEND Y BACKEND

### 12.1 Stack Frontend Real ✅

| Tecnología | Uso |
|------------|-----|
| **React** (JavaScript, sin TS) | Framework UI |
| **Vite** | Build tool |
| **TailwindCSS** | Estilos utilitarios |
| **React Router v6** | Enrutamiento SPA |
| **Lucide React** | Íconos |
| **React Context** (`AppContext`, `AuthContext`) | Estado global (sin React Query ni Zustand) |
| **EmailJS** | Envío de emails desde frontend |
| **Base64 URL encoding** | Compartir cotizaciones públicas sin BD |

#### 12.1.1 Estructura de Directorios Frontend Real

```
frontend/
├── src/
│   ├── modules/
│   │   ├── auth/              # LoginPage, AuthContext
│   │   ├── dashboard/         # DashboardPage
│   │   ├── cotizaciones/      # CotizacionesPage, CotizacionForm, CotizacionDetalle, PublicCotizacionPage
│   │   ├── compras/           # ComprasPage, CompraForm, CompraDetalle
│   │   ├── trabajadores/      # TrabajadoresPage, TrabajadorForm
│   │   ├── rrhh/              # RRHHPage (básico)
│   │   ├── finanzas/          # FinanzasPage (movimientos + gastos)
│   │   ├── usuarios/          # UsuariosPage
│   │   └── configuracion/     # ConfiguracionPage
│   ├── layout/
│   │   ├── AppShell.jsx       # Layout principal con sidebar
│   │   ├── Sidebar.jsx        # Navegación lateral
│   │   └── Navbar.jsx         # Barra superior (móvil)
│   ├── components/            # Badge, EmptyState, Modal, Toast, WhatsAppShareModal
│   ├── context/               # AppContext (estado global)
│   ├── router/                # ProtectedRoute
│   ├── utils/                 # formatters, email (EmailJS)
│   ├── App.jsx                # Rutas principales
│   └── main.jsx
└── index.html
```

### 12.2 Stack Backend Real ✅

| Tecnología | Versión | Uso |
|------------|---------|-----|
| **Node.js** | LTS | Runtime |
| **Express** | 4.x | Framework HTTP (JavaScript, sin TypeScript) |
| **@supabase/supabase-js** | 2.x | Cliente PostgreSQL vía Supabase |
| **jsonwebtoken** | 9.x | JWT tokens |
| **bcryptjs** | 2.x | Hash de contraseñas |
| **dotenv** | 16.x | Variables de entorno |
| **cors** | 2.x | CORS para el frontend |
| **nodemon** | 3.x | Hot reload en desarrollo |

#### 12.2.1 Estructura de Directorios Backend Real

```
backend/
├── src/
│   ├── routes/
│   │   ├── auth.js           # POST /login
│   │   ├── cotizaciones.js   # CRUD cotizaciones + items
│   │   ├── compras.js        # CRUD órdenes de compra + items
│   │   ├── trabajadores.js   # CRUD trabajadores
│   │   └── finanzas.js       # Movimientos bancarios
│   ├── middleware/
│   │   └── auth.js           # requireAuth, requireRole
│   ├── lib/
│   │   └── supabase.js       # Cliente Supabase
│   └── server.js             # Entry point, Express app
├── .env.example
└── package.json
```

### 12.3 API Design

#### Convenciones REST

```
GET    /api/v1/cotizaciones              # Listar (con filtros y paginación)
GET    /api/v1/cotizaciones/:id          # Obtener una
POST   /api/v1/cotizaciones              # Crear
PATCH  /api/v1/cotizaciones/:id          # Actualizar parcial
DELETE /api/v1/cotizaciones/:id          # Eliminar (soft)

POST   /api/v1/cotizaciones/:id/enviar   # Acción de estado
POST   /api/v1/cotizaciones/:id/aprobar  # Acción de estado
POST   /api/v1/cotizaciones/:id/convertir-oc  # Acción especial
```

#### Respuesta Estándar

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 20,
    "totalPages": 5
  }
}
```

#### Respuesta de Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos de entrada inválidos",
    "details": [
      { "field": "fecha_vencimiento", "message": "Debe ser mayor a hoy" }
    ]
  }
}
```

---

## 13. ESCALABILIDAD

### 12.1 Estrategia de Escalamiento

#### Corto Plazo (1-50 usuarios concurrentes)
- Single server con PostgreSQL y Redis locales
- Workers BullMQ en el mismo proceso
- Almacenamiento de archivos en servidor o MinIO local

#### Mediano Plazo (50-500 usuarios concurrentes)
- Backend escalado horizontalmente (múltiples instancias)
- PostgreSQL con réplicas de lectura
- Redis Cluster
- Workers BullMQ en procesos/servidores dedicados
- CDN para assets del frontend
- S3 o MinIO distribuido para documentos

#### Largo Plazo (500+ usuarios / multi-empresa)
- **Multi-tenancy:** Base de datos por empresa o schema separado por empresa
- **Microservicios:** Separar módulos de alto tráfico (IAD, notificaciones)
- **Event Sourcing:** Para auditoría completa y replay de eventos
- **Read models:** CQRS para reportes y dashboards complejos
- **Edge caching:** CDN con caché de API para consultas frecuentes

### 12.2 Multi-Tenancy

El sistema está diseñado para soportar múltiples empresas (tenants):

```sql
-- Todas las tablas principales incluyen:
empresa_tenant_id  UUID  REFERENCES tenants(id)

-- Row Level Security en PostgreSQL
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cotizaciones
  USING (empresa_tenant_id = current_setting('app.tenant_id')::UUID);
```

### 12.3 Monitoreo y Observabilidad

| Herramienta | Propósito |
|-------------|-----------|
| **OpenTelemetry** | Trazas distribuidas |
| **Prometheus** | Métricas de sistema |
| **Grafana** | Dashboards de métricas |
| **Sentry** | Error tracking en tiempo real |
| **Elasticsearch** | Centralización de logs |

### 12.4 SLOs Objetivo

| Métrica | Objetivo |
|---------|----------|
| Disponibilidad | 99.5% mensual |
| Latencia API P95 | < 500ms |
| Latencia API P99 | < 2000ms |
| Procesamiento IAD | < 30s por documento |
| Tiempo de recuperación (RTO) | < 4 horas |
| Pérdida máxima de datos (RPO) | < 1 hora |

---

## 14. GLOSARIO

| Término | Definición |
|---------|------------|
| **COT** | Módulo de Cotizaciones |
| **OC** | Orden de Compra |
| **RH** | Recursos Humanos |
| **TRB** | Módulo de Trabajadores |
| **IAD** | IA Documental |
| **LLM** | Large Language Model (modelo de lenguaje de IA) |
| **OCR** | Reconocimiento Óptico de Caracteres |
| **RBAC** | Control de Acceso Basado en Roles |
| **JWT** | JSON Web Token (estándar de autenticación) |
| **API** | Application Programming Interface |
| **CRUD** | Create, Read, Update, Delete |
| **DDD** | Domain-Driven Design |
| **ORM** | Object-Relational Mapper |
| **CDN** | Content Delivery Network |
| **SLO** | Service Level Objective |
| **RTO** | Recovery Time Objective |
| **RPO** | Recovery Point Objective |
| **Multi-tenancy** | Arquitectura que permite múltiples clientes en la misma instancia |
| **Soft delete** | Eliminación lógica (marca como eliminado sin borrar físicamente) |
| **Embedding** | Representación vectorial numérica de texto para búsqueda semántica |
| **FIN** | Módulo de Finanzas y Conciliación |
| **SII** | Servicio de Impuestos Internos (Chile) |
| **RCV** | Registro de Compras y Ventas del SII |
| **DTE** | Documento Tributario Electrónico (facturas, guías, notas de crédito) |
| **Cartola** | Extracto bancario del movimiento de una cuenta corriente |
| **Conciliación** | Proceso de cruzar movimientos bancarios con documentos tributarios |
| **OFX/QFX** | Open Financial Exchange — formato estándar de exportación bancaria |
| **Caja Chica** | Fondo de efectivo para gastos menores y urgentes |
| **Rendición** | Proceso de justificar los gastos realizados con caja chica |
| **Adelanto** | Anticipo de remuneración o préstamo otorgado a un trabajador |
| **Certificado Digital** | Archivo .pfx con firma electrónica para autenticación ante el SII |
| **Folio** | Número correlativo asignado por el SII a cada DTE |
| **Hash SHA256** | Huella digital única de un archivo para detectar duplicados |
| **CONT** | Módulo de Contabilidad |
| **PUC** | Plan Único de Cuentas |
| **IFRS** | International Financial Reporting Standards (norma contable internacional) |
| **NIC** | Normas Internacionales de Contabilidad (versión en español de las IFRS) |
| **DL 824** | Decreto Ley 824 — Ley de Impuesto a la Renta de Chile |
| **DL 825** | Decreto Ley 825 — Ley de IVA de Chile |
| **Partida Doble** | Sistema contable donde todo débito tiene un crédito igual |
| **Asiento Contable** | Registro de una transacción en el libro diario |
| **Libro Diario** | Registro cronológico de todos los asientos contables |
| **Libro Mayor** | Registro de movimientos y saldo por cuenta contable |
| **Balance de Comprobación** | Resumen de saldos de todas las cuentas activas |
| **EERR** | Estado de Resultados (Pérdidas y Ganancias) |
| **PPE** | Propiedad, Planta y Equipo (activos fijos) |
| **F29** | Formulario 29 SII — Declaración mensual de IVA y retenciones |
| **F22** | Formulario 22 SII — Declaración anual de impuesto a la renta |
| **PPM** | Pago Provisional Mensual (anticipo del impuesto a la renta) |
| **IVA Débito Fiscal** | IVA recargado en ventas (pasivo) |
| **IVA Crédito Fiscal** | IVA soportado en compras (activo deducible) |
| **Centralización** | Asiento resumen de múltiples documentos del período |
| **Centro de Costo** | Dimensión adicional para análisis de gastos por área |
| **SOD** | Segregation of Duties — separación de funciones para control interno |
| **EBIT** | Earnings Before Interest and Taxes (resultado operacional) |
| **CxC** | Cuentas por Cobrar |
| **CxP** | Cuentas por Pagar |

---

## DOCUMENTOS RELACIONADOS

| Documento | Descripción |
|-----------|-------------|
| [`MODULO_FIN_FINANZAS.md`](./MODULO_FIN_FINANZAS.md) | Especificación técnica completa del módulo FIN |
| [`MODULO_CONT_CONTABILIDAD.md`](./MODULO_CONT_CONTABILIDAD.md) | Especificación técnica completa del módulo CONT |

---

*Documento Maestro ERP MAMKAM — v1.3.0*  
*Actualizado el 2026-05-23 para reflejar el estado real del código*  
*Próxima revisión: al completar IAD o CONT*
