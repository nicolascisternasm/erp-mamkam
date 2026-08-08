# DOCUMENTO MAESTRO — ERP MAMKAM
**Versión:** 1.10.0  
**Fecha:** 2026-08-08  
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
15. [Infraestructura y Deploy](#infraestructura-y-deploy)

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
│   └── VIS  — Visitas a terreno
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

> Esta sección refleja el estado real del código al **2026-07-29**. Los módulos marcados como ✅ están operativos. Los marcados como ⚠️ están parcialmente implementados. Los marcados como 🔲 son especificaciones planificadas aún no desarrolladas.

### 2.1 Estado por Módulo

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| **Autenticación** | ✅ Operativo | Login JWT, roles admin/vendedor, rutas protegidas |
| **COT — Cotizaciones** | ✅ Operativo | CRUD completo, envío WA/email, PDF, estados ampliados (incluye `en_ejecucion`, `ejecutada`), email de término de proyecto |
| **VIS — Visitas** | ✅ Operativo | Modal + App móvil, checklist dinámico desde Supabase, fotos/videos/documentos en Storage, estados unificados |
| **OC — Órdenes de Compra** | ✅ Operativo | CRUD básico, items, selector cotizaciones incluye `aprobada` y `en_ejecucion` |
| **TRB — Trabajadores** | ✅ Operativo | CRUD completo, datos personales y laborales |
| **RRHH** | ✅ Operativo | Documentos empresa/trabajador, gestión de tipos, amonestaciones con IA |
| **CRM** | ✅ Operativo | Lista + Kanban (drag-and-drop @dnd-kit), etiquetas con color, recordatorio visual, link WhatsApp, webhook Meta Lead Ads |
| **PROJ — Proyectos** | ✅ Operativo | Estado espejo de cotizaciones asociadas, archivado automático al cerrar, N:M con cotizaciones |
| **Backend Railway** | ✅ Operativo | Backend en Railway, deploy automático desde GitHub, Playwright/Chromium instalado en build |
| **FIN — Finanzas** | ⚠️ Parcial | Movimientos, conciliación manual, importación CSV, gastos con foto |
| **FIN.SII** | ✅ Operativo | RCV sincronizado vía Playwright (login real + facadeService), guardado en `facturas_sii`, clave en BD |
| **Usuarios** | ⚠️ Parcial | Página existente, gestión básica |
| **Configuración** | ⚠️ Parcial | Página existente, ajustes generales, tab Visitas (admin), tab Integraciones (Meta + SII) |
| **IAD — IA Documental** | 🔲 Planificado | Solo en especificación técnica |
| **CONT — Contabilidad** | 🔲 Planificado | Solo en especificación técnica |
| **FIN.CAJ** | 🔲 Planificado | Caja chica en especificación técnica |
| **FIN.ADL** | 🔲 Planificado | Adelantos trabajadores en especificación técnica |

### 2.2 Stack Real Implementado

| Capa | Tecnología real | Nota |
|------|----------------|------|
| **Frontend** | React + JavaScript + TailwindCSS + React Router + Lucide React | Sin TypeScript, sin shadcn/ui |
| **Backend** | Node.js + Express 4 + JavaScript | Sin TypeScript, sin Prisma |
| **Backend hosting** | Railway (antes cPanel/Passenger) | Deploy automático desde GitHub |
| **Webhook** | `erp-mamkam-production.up.railway.app` | Endpoint público de Meta Lead Ads |
| **Base de datos** | Supabase (PostgreSQL cloud) | Vía `@supabase/supabase-js` |
| **Autenticación** | JWT (`jsonwebtoken`) + bcryptjs | Token de 7 días, sin refresh |
| **Email** | EmailJS (frontend) + Nodemailer (backend, para email de término de proyecto) | Nodemailer usado en POST /cotizaciones/:id/enviar-email-ejecucion |
| **Browser automation** | Playwright + Chromium headless | Integración SII RCV — instalado en build de Railway vía buildCommand |
| **Roles** | `admin` y `vendedor` | RBAC simple en middleware |
| **Estado frontend** | React Context (`AppContext`) | Sin React Query ni Zustand |

### 2.3 Funcionalidades Reales por Módulo

#### Cotizaciones (COT) ✅
- Creación con items (producto, cantidad, valor unitario, descripción)
- Numeración automática (COT-YYYY-NNNN)
- Estados: `borrador` → `enviada` → `visita` → `aprobada` → `en_ejecucion` → `ejecutada` → `cerrada` (más `rechazada`/`perdida` como finales negativos)
- Envío por **WhatsApp** (link público con datos en URL en base64, sin BD)
- Envío por **email** vía EmailJS
- Página pública `/ver?d=...` para que el cliente vea su cotización
- Generación de **PDF** visual desde el detalle
- Al aprobar cotización → crea movimiento de ingreso en Finanzas automáticamente
- Al eliminar cotización aprobada → elimina movimiento de finanzas asociado
- **Botón flotante "Visita"** visible cuando estado es `aprobada`, `en_ejecucion` o `cerrada` → abre ModalVisita
- Al cambiar a `ejecutada` → abre **ModalEnviarEjecucion**: email de término de proyecto al cliente con fotos (visita_fotos), comprobantes de pago (pagos_comprobantes), saldo pendiente por condición, copia automática a contacto@mamkam.cl
- Columnas nuevas: `email_ejecucion_enviado` (bool), `email_ejecucion_fecha` (timestamptz), `email_ejecucion_mensaje` (text)
- Endpoint: `POST /cotizaciones/:id/enviar-email-ejecucion` — recalcula saldo en servidor, adjunta fotos/comprobantes vía Nodemailer
- Al cambiar estado hacia `aprobada`, `en_ejecucion`, `ejecutada`, `cerrada`, `rechazada`, `perdida` → dispara `sincronizarEstadoProyecto(cotizacionId)` para mantener estado del proyecto espejo

#### Visitas (VIS) ✅
- **ModalVisita.jsx** (ERP) y **App Mamkam Conecta** (Expo): ambas interfaces comparten las mismas tablas Supabase
- 4 tabs: **Datos** | **Checklist** | **Fotos** | **Resumen IA**
- **Tab Datos**: formulario de creación de visita; inserta en tabla `visitas`
- **Tab Checklist**: preguntas cargadas desde `visita_preguntas` (Supabase), NO hardcodeadas; respuestas guardadas con UPSERT debounced (600ms) en `visita_checklist`
- **Tab Fotos**: adjuntos guardados en tabla `visita_fotos` con tipo `'foto'` | `'video'` | `'documento'`; Storage buckets: `visitas-fotos`, `visitas-audios` (también guarda video), `visitas-documentos`
- **Estados unificados** (migración aplicada): solo `'planificada'` y `'ejecutada'` — eliminados vocabularios previos (`agendada`, `en_curso`, `realizada`, `completada`, `programada`, `resumida`)
- **Tab Configuración → Visitas** (solo admin): CRUD de preguntas del checklist por producto, toggle crítica, soft delete
- **seed SQL**: `backend/scripts/seed-visita-preguntas.sql` con 41 preguntas

#### Órdenes de Compra (OC) ✅
- CRUD básico (solo rol admin)
- Items por OC
- Al pagar OC → crea movimiento de egreso en Finanzas
- Selector de cotización para asociar a OC incluye estados `'aprobada'` y `'en_ejecucion'` (antes solo `'aprobada'`)

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

#### RRHH ✅
- Módulo Documentos con 2 cards: Empresa y Trabajadores
- Separación por `trabajador_id IS NULL` (empresa) / `IS NOT NULL` (trabajador)
- Gestión de tipos de documento (solo admin) con localStorage
- Módulo Amonestaciones con IA:
  * Formulario: trabajador, fecha, descripción, foto opcional
  * IA lee reglamento interno PDF y reescribe formalmente
  * Identifica artículo, título y página del reglamento infringido
  * Genera PDF con logo y nombre de empresa
  * Código correlativo: `AMONEST-2026-001`
  * Tabla `amonestaciones` en Supabase

#### CRM ✅
- Tabla `clientes` en Supabase; webhook Meta Lead Ads verificado y operativo
- **Vista Lista** con filtros por estado y búsqueda
- **Vista Kanban** (alternable): drag-and-drop con `@dnd-kit/core` entre 5 columnas de estado (`nuevo`, `contactado`, `en_proceso`, `cerrado`, `perdido`)
- **Etiquetas con color**: tablas `crm_etiquetas` (id, empresa_id, nombre, color) y `cliente_etiquetas` (N:M); CRUD completo vía `/api/crm/etiquetas` y `/api/crm/clientes/:id/etiquetas`
- **Campo `fecha_recordatorio`** (date): badge visual — rojo si venció, amarillo si vence en ≤2 días, verde si es más lejano, sin badge si no tiene fecha
- **Link WhatsApp** directo (`wa.me`) desde el teléfono del lead en todas las vistas

#### Proyectos (PROJ) ✅
- Estado del proyecto es **espejo calculado** de su(s) cotización(es) asociada(s) — no hay edición manual de estado
- **Mapeo cotización → proyecto:** `borrador/enviada/visita/aprobada` → `aprobada`; `en_ejecucion` → `en_ejecucion`; `ejecutada/cerrada` → `cierre`; `rechazada/perdida` → `cancelado`
- **Relación N:M** con cotizaciones via tabla `proyecto_cotizaciones`; si hay múltiples, se usa la más avanzada (salvo que todas sean `cancelado`)
- **Archivado automático**: cuando el estado calculado llega a `cerrada`, se activa `proyectos.archivado = true` → proyecto desaparece del listado normal, visible solo con toggle "Ver archivados"
- **`sincronizarEstadoProyecto(cotizacionId)`** en `cotizaciones.js` — se dispara en cada UPDATE de cotizaciones hacia estados relevantes
- Eliminado selector inline de estado; `PATCH /proyectos/:id/estado` quedó comentado en código (deprecado)
- **ProyectoForm.jsx**: filtro de cotizaciones disponibles incluye `'aprobada'` y `'en_ejecucion'` para asociar al crear proyecto

#### FIN.SII — Registro de Compras y Ventas ✅
- Sincronización vía **Playwright + Chromium headless** (Railway): navega el portal real del SII, hace login completo, intercepta `conversationId` de la SPA, llama a `facadeService` desde el contexto del browser
- Clave tributaria almacenada en `sii_config.clave_sii` por empresa (editable desde Configuración → Integraciones); `SII_CLAVE` como variable de entorno está **deprecada**
- Documentos guardados en `facturas_sii` con deduplicación por `sii_detalle_codigo` (bigint UNIQUE = `detCodigo` del SII)
- Ver sección 16 para documentación técnica completa del flujo

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
- Al cambiar a `ejecutada` → abre `ModalEnviarEjecucion.jsx` con: fotos del proyecto (de `visita_fotos` vía visitas del `cotizacion_id`), comprobantes de pago (`pagos_comprobantes`, con opción de adjuntar archivos nuevos), saldo pendiente desglosado por condición de pago, envío de correo con copia a `contacto@mamkam.cl`
- `POST /cotizaciones/:id/enviar-email-ejecucion`: recalcula saldo en servidor, descarga fotos/comprobantes y los adjunta vía Nodemailer
- Columnas nuevas: `email_ejecucion_enviado` (bool), `email_ejecucion_fecha` (timestamptz), `email_ejecucion_mensaje` (text)
- Cada UPDATE de estado dispara `sincronizarEstadoProyecto()` para mantener proyecto espejo

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
- Selector de cotización para asociar a OC incluye `'aprobada'` y `'en_ejecucion'`

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

### 4.8 MÓDULO VIS — Visitas a Terreno ✅ Operativo

**Propósito:** Registrar y gestionar visitas de técnicos/instaladores a terreno desde una cotización aprobada. Incluye checklist dinámico por producto, fotos/videos/documentos en Storage y resumen IA.

#### 4.8.1 Acceso al módulo

El módulo se activa desde `CotizacionDetalle.jsx` mediante un botón flotante (`fixed bottom-6 right-6`) visible cuando la cotización está en `aprobada`, `en_ejecucion` o `cerrada`. También accesible desde la App Mamkam Conecta (Expo).

#### 4.8.2 Componentes Frontend

| Archivo | Descripción |
|---------|-------------|
| `frontend/src/modules/cotizaciones/ModalVisita.jsx` | Modal overlay ERP con 4 tabs |
| `frontend/src/modules/cotizaciones/visitaChecklists.js` | Preguntas hardcodeadas (referencia histórica; fuente oficial es Supabase) |

#### 4.8.3 ModalVisita — Estructura

```
ModalVisita
├── Tab DATOS
│   ├── Fecha de visita
│   ├── Responsable (usuario actual)
│   ├── Instalador (select de trabajadores)
│   ├── Productos (checkboxes: Toldo Vela / Pasto Sintético / Caucho Continuo)
│   └── Notas
├── Tab CHECKLIST
│   ├── Selector de productos (si visita.productos está vacío)
│   ├── Preguntas cargadas desde visita_preguntas (Supabase, NO hardcodeadas)
│   ├── Agrupadas por: General / Toldo Vela / Pasto Sintético / Caucho Continuo
│   └── Respuestas guardadas con UPSERT debounced (600ms) en visita_checklist
├── Tab FOTOS
│   ├── Upload a Storage: fotos → bucket visitas-fotos, videos → visitas-audios,
│   │   documentos/planos → visitas-documentos
│   └── Registros en tabla visita_fotos (tipo: 'foto' | 'video' | 'documento')
└── Tab RESUMEN IA   (estructura implementada)
```

#### 4.8.4 Estados de visita (unificados)

| Estado | Descripción |
|--------|-------------|
| `planificada` | Visita agendada, aún no ejecutada |
| `ejecutada` | Visita realizada |

> Migración aplicada en ambos sistemas (ERP + App): eliminados `agendada`, `en_curso`, `realizada`, `completada`, `programada`, `resumida`.

#### 4.8.5 Normalización de nombres de producto

```js
LABEL_TO_SNAKE = { 'Toldo Vela': 'toldo_vela', 'Pasto Sintético': 'pasto_sintetico', 'Caucho Continuo': 'caucho_continuo' }
SNAKE_TO_LABEL = { 'toldo_vela': 'Toldo Vela', 'pasto_sintetico': 'Pasto Sintético', 'caucho_continuo': 'Caucho Continuo' }
```

#### 4.8.6 Tablas Supabase

| Tabla | Descripción |
|-------|-------------|
| `visitas` | Registro de cada visita a terreno |
| `visita_preguntas` | Preguntas del checklist configurables por empresa y producto |
| `visita_checklist` | Respuestas por visita y pregunta |
| `visita_fotos` | Adjuntos multimedia por visita (foto, video, documento) |

#### 4.8.7 Pendientes

- Rediseño tabs App: Home con lista visitas planificadas + calendario; tab Checklist sin fechas; guardado progresivo entre tabs
- Botones "Google Calendar" y "Recordar WhatsApp" pendiente en `ModalVisita.jsx` del ERP (solo existen en la App hoy)
- Implementar Tab Resumen IA (llamada a Claude API)

---

### 4.9 MÓDULO PROJ — Proyectos ✅ Operativo

**Propósito:** Agrupar cotizaciones en un proyecto, con estado calculado automáticamente como espejo del estado de sus cotizaciones.

#### 4.9.1 Regla de estado (calculado, no editable manualmente)

| Estado cotizaciones asociadas | Estado proyecto |
|-------------------------------|-----------------|
| `borrador` / `enviada` / `visita` / `aprobada` | `aprobada` |
| `en_ejecucion` | `en_ejecucion` |
| `ejecutada` / `cerrada` | `cierre` → dispara archivado |
| `rechazada` / `perdida` (todas) | `cancelado` |

- Si hay N cotizaciones asociadas (N:M via `proyecto_cotizaciones`), se usa la más avanzada, salvo que TODAS sean `cancelado`
- Al llegar a estado `cierre`: `proyectos.archivado = true` → desaparece del listado normal

#### 4.9.2 Función de sincronización

`sincronizarEstadoProyecto(cotizacionId)` en `backend/src/routes/cotizaciones.js`:
- Se dispara automáticamente en UPDATE de cotizaciones hacia: `aprobada`, `en_ejecucion`, `ejecutada`, `cerrada`, `rechazada`, `perdida`
- Calcula el estado más avanzado entre todas las cotizaciones del proyecto
- Hace PATCH en `proyectos` con el estado calculado y `archivado` si corresponde

#### 4.9.3 Frontend

- `ProyectoForm.jsx`: selector de cotizaciones para asociar incluye `'aprobada'` y `'en_ejecucion'`
- Estado NO editable inline — se eliminó el selector; `PATCH /proyectos/:id/estado` comentado en código
- Toggle "Ver archivados" para acceder a proyectos completados

---

### 4.10 MÓDULO CRM ✅ Operativo

**Propósito:** Gestión de leads y clientes, con captación automática desde Meta Lead Ads y seguimiento visual.

#### 4.10.1 Funcionalidades implementadas

| Feature | Descripción |
|---------|-------------|
| **Vista Lista** | Filtros por estado, búsqueda por nombre/email/teléfono |
| **Vista Kanban** | Drag-and-drop (@dnd-kit/core) entre 5 columnas de estado |
| **Etiquetas** | Sistema de etiquetas con color; N:M entre clientes y etiquetas |
| **Recordatorio** | Campo `fecha_recordatorio`: badge rojo/amarillo/verde según vencimiento |
| **Link WhatsApp** | `wa.me/{telefono}` desde teléfono del lead en todas las vistas |
| **Webhook Meta** | `/api/crm/webhook` — leads automáticos desde Facebook Lead Ads |

#### 4.10.2 Tablas

| Tabla | Descripción |
|-------|-------------|
| `clientes` | Leads/clientes; incluye `fecha_recordatorio` (date) |
| `crm_etiquetas` | id, empresa_id, nombre, color, created_at |
| `cliente_etiquetas` | cliente_id + etiqueta_id (N:M) |

#### 4.10.3 Pendiente

- Recordatorio automático por WhatsApp (pausado): infraestructura lista (`services/whatsapp.js`, Meta Cloud API), falta aprobar template `'recordatorio_contacto_lead'` en Meta Business Manager

---

### 4.11 MÓDULO FIN.SII — Registro de Compras y Ventas ✅ Operativo

**Propósito:** Sincronizar automáticamente el RCV del SII hacia la tabla `facturas_sii`, usando Playwright para navegar el portal real del SII con autenticación completa.

#### 4.11.1 Por qué Playwright (no axios/fetch)

El portal del SII usa un WAF que detecta el fingerprint TLS/HTTP2 del cliente (JA3, orden de headers, ALPN). Un cliente HTTP convencional "camina distinto" a un navegador real aunque replique headers idénticos — el bloqueo ocurre incluso desde IP residencial. Confirmado empíricamente: solo un navegador Chromium real navegando el flujo humano completo evita el rechazo.

#### 4.11.2 Flujo de autenticación (obligatorio, no se puede acortar)

```
1. GET https://www.sii.cl (establece cookies iniciales)
2. Navegar a misiir.sii.cl → redirige al formulario de login (zeusr.sii.cl)
3. Teclear RUT+DV CONCATENADOS SIN separador en #rutcntr
   (ej: rut=78348727, dv=6 → teclear "783487276")
   — usar pressSequentially(delay=200ms), NO .fill()
   — el campo tiene listener JS que reformatea en vivo
4. Submit → URL destino normal: misiir.sii.cl/cgi_misii/siihome.cgi
5. Navegar explícitamente a https://www4.sii.cl/consdcvinternetui/#/index
6. Interceptar primer request getDatosInicio → extraer conversationId
```

#### 4.11.3 conversationId — crítico

**NUNCA** generar con `crypto.randomUUID()`. El SII rechaza cualquier conversationId no inicializado por su propia SPA con: *"El token no es valido: NO Existen Datos"*.

Se debe interceptar via `page.on('request')` el request que la SPA dispara sola a `getDatosInicio` al cargar `#/index` y extraer `body.metaData.conversationId`. Ese mismo valor se reutiliza en todas las llamadas de la sesión.

#### 4.11.4 Endpoints y payloads (ingeniería inversa — no documentados por el SII)

Todos son `POST` a `https://www4.sii.cl/consdcvinternetui/services/data/facadeService/{endpoint}`, ejecutados con `page.evaluate(fetch(..., { credentials: 'include' }))` desde dentro del browser (no desde Node con axios — el SII rechaza llamadas externas aunque usen cookies correctas).

| Endpoint | Payload `data` clave | Nota |
|----------|---------------------|------|
| `getResumen` | `{ rutEmisor, dvEmisor, ptributario, estadoContab: 'REGISTRO', operacion: 'COMPRA'\|'VENTA', busquedaInicial: true }` | Filtrar respuesta: `dcvTipoIngresoDoc === 'DET_ELE' \| 'DET_PAP'`; usar `rsmnTipoDocInteger` como `codTipoDoc` |
| `getDetalleCompra` | `{ ..., operacion: 'COMPRA', estadoContab: 'REGISTRO', accionRecaptcha: 'RCV_DETC', tokenRecaptcha: 't-o-k-e-n-web' }` | ⚠️ payload DISTINTO a Venta |
| `getDetalleVenta` | `{ ..., operacion: '', estadoContab: '', accionRecaptcha: 'RCV_DETV', tokenRecaptcha: 't-o-k-e-n-web' }` | `operacion` y `estadoContab` vacíos (no simétrico con Compra) |

#### 4.11.5 Infraestructura y configuración

| Variable / Config | Valor / Descripción |
|-------------------|---------------------|
| `PLAYWRIGHT_BROWSERS_PATH=0` | Chromium dentro de `node_modules`, persiste en imagen Railway |
| `SII_RUT`, `SII_DV` | Variables de entorno — RUT de la empresa (no cambia) |
| `sii_config.clave_sii` | Clave tributaria por empresa — editable desde Configuración → Integraciones → SII. `SII_CLAVE` env var **deprecada** |
| `railway.json` buildCommand | `"cd backend && npm install && npx playwright install --with-deps chromium"` — instalación obligatoria en build. **⚠️ nixpacks.toml es ignorado si existe buildCommand en railway.json** |
| `waitUntil: 'domcontentloaded'` | Usar en todos los `page.goto()` — el SII tiene analytics pesados (Adobe, Qualtrics, GA) que impiden que `networkidle` se cumpla en Railway |

#### 4.11.6 Deduplicación en BD

Columna `facturas_sii.sii_detalle_codigo` (bigint UNIQUE) = campo `detCodigo` del SII. Upsert con `onConflict: 'sii_detalle_codigo'` — más confiable que folio+rut porque el folio se repite entre emisores distintos.

#### 4.11.7 Mapeo de campos SII → `facturas_sii`

| Campo BD | Campo SII | Transformación |
|----------|-----------|----------------|
| `folio` | `detNroDoc` | `String()` |
| `rut_contraparte` | `detRutDoc` + `detDvDoc` | `"${detRutDoc}-${detDvDoc}"` |
| `razon_social` | `detRznSoc` | directo |
| `fecha` | `detFchDoc` | `"DD/MM/YYYY"` → `"YYYY-MM-DD"` |
| `fecha_recepcion` | `detFecRecepcion` | `"DD/MM/YYYY HH:mm:ss"` → ISO timestamp |
| `neto` | `detMntNeto` | `?? 0` |
| `iva` | `detMntIVA` | `?? 0` |
| `total` | `detMntTotal` | `?? 0` |
| `tipo_doc` | `detTipoDoc` | `String()` — numérico directo (33, 34…) |
| `sii_detalle_codigo` | `detCodigo` | directo |

#### 4.11.8 Ruta alternativa descartada: MIPE (Plan B)

Existe ruta alternativa via `www1.sii.cl/cgi-bin/Portal001/mipeAdminDocsRcp.cgi` con exportación XLS. Requiere doble login (empresa + representante legal). Abandonada a favor de RCV por complejidad y necesidad de clave adicional más sensible. Documentado aquí como respaldo si el SII cambia su portal de RCV.

#### 4.11.9 Advertencia de mantenimiento

Este flujo depende de la estructura **actual** del portal SII (nombres de endpoints, campos de formulario, comportamiento de la SPA Angular). Un rediseño del portal o cambio de WAF puede romperlo completamente. Para diagnosticar: usar Playwright en modo `headless: false` con listeners `page.on('request'/'response')` para capturar el tráfico real nuevo.

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
| `visita` | Visita a terreno programada o ejecutada |
| `aprobada` | Cliente confirmó (crea movimiento de ingreso en Finanzas) |
| `en_ejecucion` | Trabajo en curso; cotización seleccionable en OC |
| `ejecutada` | Trabajo terminado; dispara email de término de proyecto |
| `cerrada` | Proceso completo |
| `rechazada` | Cliente rechazó |
| `perdida` | Oportunidad perdida |

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
- Tablas confirmadas: `usuarios`, `trabajadores`, `cotizaciones`, `cotizacion_items`, `ordenes_compra`, `oc_items`, `movimientos_bancarios`, `amonestaciones`, `clientes`, `visitas`, `visita_preguntas`, `visita_checklist`, `visita_fotos`, `proyectos`, `proyecto_cotizaciones`, `crm_etiquetas`, `cliente_etiquetas`, `facturas_sii`, `sii_config`, `integraciones`
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

### 8.3.1 Tablas Nuevas Implementadas (v1.6)

```sql
-- AMONESTACIONES (módulo RRHH — generadas con IA sobre el reglamento interno)
amonestaciones {
  id                  UUID        PK
  empresa_id          UUID
  trabajador_id       UUID
  codigo              VARCHAR     Correlativo AMONEST-YYYY-NNN
  fecha               DATE
  descripcion_admin   TEXT        Descripción libre del hecho (input del admin)
  descripcion_ia      TEXT        Reescritura formal generada por la IA
  articulo_reglamento VARCHAR     Artículo infringido
  titulo_reglamento   VARCHAR     Título del artículo
  pagina_reglamento   VARCHAR     Página del reglamento
  foto_url            VARCHAR     Foto de respaldo (opcional, Storage)
  pdf_url             VARCHAR     PDF generado (Storage)
  estado              VARCHAR     'activa' | 'anulada'
  created_at          TIMESTAMPTZ
}

-- CLIENTES (módulo CRM — leads de Meta y manuales)
clientes {
  id             UUID        PK
  empresa_id     UUID
  nombre         VARCHAR
  email          VARCHAR
  telefono       VARCHAR
  mensaje        TEXT
  fuente         VARCHAR     'meta_leads' | 'manual'
  fuente_detalle VARCHAR     Nombre del formulario de Meta u origen
  estado         VARCHAR     'nuevo' | 'contactado' | 'en_proceso' | 'cerrado' | 'perdido'
  created_at     TIMESTAMPTZ
  updated_at     TIMESTAMPTZ
}
```

**Cambios a la tabla `gastos`:**
- Columnas agregadas: `cuenta_contable_id`, `tipo_documento_id`
- CHECK constraints eliminados: `gastos_categoria_check`, `gastos_tipo_documento_check`

### 8.3.2 Tablas Nuevas Implementadas (v1.8 — Módulo Visitas)

```sql
-- VISITAS (registro de visita a terreno desde una cotización aprobada)
visitas {
  id              UUID        PK
  empresa_id      UUID
  cotizacion_id   UUID        FK → cotizaciones
  fecha           DATE
  responsable     VARCHAR     Nombre del responsable
  instalador_id   UUID        FK → trabajadores (opcional)
  productos       TEXT[]      Array de productos en snake_case ['toldo_vela', ...]
  notas           TEXT
  estado          VARCHAR     'pendiente' | 'realizada' | 'cancelada'
  created_at      TIMESTAMPTZ
}

-- VISITA_PREGUNTAS (checklist configurable por empresa y producto)
visita_preguntas {
  id          UUID        PK
  empresa_id  UUID
  producto    VARCHAR     'general' | 'toldo_vela' | 'pasto_sintetico' | 'caucho_continuo'
  label       TEXT        Texto de la pregunta
  critical    BOOLEAN     Si es una pregunta crítica (marcada visualmente)
  orden       INT         Orden de aparición dentro del grupo
  activo      BOOLEAN     Soft delete (false = eliminada)
  created_at  TIMESTAMPTZ
}
-- NOTA: RLS está habilitado en esta tabla. Si no hay políticas SELECT activas,
-- las consultas devuelven [] con error: null. Fix: DISABLE ROW LEVEL SECURITY
-- o CREATE POLICY "allow_select" ON visita_preguntas FOR SELECT USING (true);

-- VISITA_CHECKLIST (respuestas del checklist por visita)
visita_checklist {
  id             UUID        PK
  visita_id      UUID        FK → visitas
  pregunta_id    UUID        FK → visita_preguntas
  pregunta_label TEXT        Copia del label al momento de responder
  respuesta      TEXT
  critical       BOOLEAN
  created_at     TIMESTAMPTZ
  -- Constraint único: (visita_id, pregunta_id) — permite UPSERT
}
```

**Seed SQL:** `backend/scripts/seed-visita-preguntas.sql`
- 41 preguntas totales: 2 general + 12 toldo_vela + 13 caucho_continuo + 14 pasto_sintetico
- Inicia con `DELETE ... WHERE empresa_id = '...'` para re-ejecución segura
- `empresa_id`: `22101e7c-ce32-49dc-9a8f-4ea25fc00d2f`

### 8.3.3 Tablas Nuevas Implementadas (v1.9 — Proyectos, CRM ampliado, Visitas fotos, FIN.SII)

```sql
-- VISITA_FOTOS (adjuntos multimedia por visita)
visita_fotos {
  id          UUID        PK
  visita_id   UUID        FK → visitas
  tipo        VARCHAR     CHECK ('foto' | 'video' | 'documento')
  url         VARCHAR     URL pública del archivo en Storage
  nombre      VARCHAR     Nombre original del archivo
  created_at  TIMESTAMPTZ
}
-- Storage buckets: visitas-fotos / visitas-audios (video) / visitas-documentos
-- CHECK constraint ampliado para incluir 'documento' (antes solo 'foto'/'video')

-- PROYECTOS
proyectos {
  id          UUID        PK
  empresa_id  UUID
  nombre      VARCHAR
  estado      VARCHAR     Calculado: 'aprobada'|'en_ejecucion'|'cierre'|'cancelado'
  archivado   BOOLEAN     DEFAULT false — true cuando estado llega a 'cierre'
  created_at  TIMESTAMPTZ
  updated_at  TIMESTAMPTZ
}

-- PROYECTO_COTIZACIONES (N:M)
proyecto_cotizaciones {
  proyecto_id    UUID    FK → proyectos
  cotizacion_id  UUID    FK → cotizaciones
  PRIMARY KEY (proyecto_id, cotizacion_id)
}

-- CRM_ETIQUETAS
crm_etiquetas {
  id          UUID        PK
  empresa_id  UUID
  nombre      VARCHAR
  color       VARCHAR     Código hex (ej: '#3B82F6')
  created_at  TIMESTAMPTZ
}

-- CLIENTE_ETIQUETAS (N:M)
cliente_etiquetas {
  cliente_id   UUID    FK → clientes
  etiqueta_id  UUID    FK → crm_etiquetas
  PRIMARY KEY (cliente_id, etiqueta_id)
}
-- Campo adicional en clientes: fecha_recordatorio DATE

-- SII_CONFIG (clave tributaria por empresa)
sii_config {
  empresa_id  UUID        PK
  rut         VARCHAR     NOT NULL (de SII_RUT env var al crear)
  clave_sii   VARCHAR     Clave tributaria cifrada en tránsito (HTTPS)
  updated_at  TIMESTAMPTZ
}

-- FACTURAS_SII (Registro de Compras y Ventas del SII)
facturas_sii {
  id                   TEXT        PK (UUID generado en JS)
  empresa_id           UUID
  tipo                 VARCHAR     'compra' | 'venta'
  tipo_doc             VARCHAR     Código numérico SII ('33', '34', '61'…)
  tipo_compra_venta    VARCHAR     DEFAULT ''
  folio                VARCHAR
  numero_interno       VARCHAR     DEFAULT ''
  rut_contraparte      VARCHAR     Formato "XXXXXXXX-X"
  razon_social         VARCHAR
  fecha                DATE        Formato ISO YYYY-MM-DD
  fecha_recepcion      TIMESTAMPTZ Opcional
  monto_exento         INTEGER     DEFAULT 0
  neto                 INTEGER     DEFAULT 0
  iva                  INTEGER     DEFAULT 0
  iva_no_recuperable   INTEGER     DEFAULT 0
  total                INTEGER     DEFAULT 0
  estado               VARCHAR     DEFAULT 'vigente'
  sii_detalle_codigo   BIGINT      UNIQUE — campo detCodigo del SII (deduplicación)
  created_at           TIMESTAMPTZ
}
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
| Cotización → `aprobada`/`en_ejecucion`/`ejecutada`/`cerrada`/`rechazada`/`perdida` | `sincronizarEstadoProyecto()` actualiza estado y archivado del proyecto asociado |
| Cotización → `ejecutada` | Abre `ModalEnviarEjecucion` con email de término al cliente |
| Sincronización SII RCV | `guardarDocumentosRCV()` hace upsert en `facturas_sii` con deduplicación por `sii_detalle_codigo` |

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
│   │   ├── cotizaciones/      # CotizacionesPage, CotizacionForm, CotizacionDetalle, PublicCotizacionPage, ModalVisita, visitaChecklists.js
│   │   ├── compras/           # ComprasPage, CompraForm, CompraDetalle
│   │   ├── trabajadores/      # TrabajadoresPage, TrabajadorForm
│   │   ├── rrhh/              # RRHHPage (básico)
│   │   ├── finanzas/          # FinanzasPage (movimientos + gastos)
│   │   ├── usuarios/          # UsuariosPage
│   │   └── configuracion/     # ConfiguracionPage (tabs: General, Usuarios, Visitas[admin])
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

## INFRAESTRUCTURA Y DEPLOY

### Repositorio
- **GitHub:** [github.com/nicolascisternasm/erp-mamkam](https://github.com/nicolascisternasm/erp-mamkam)
- Rama de producción: `master`

### Backend — Railway

El backend migró de cPanel/Passenger a **Railway**. Deploy automático al hacer push a `master`.

**`railway.json` (raíz del repo):**
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd backend && npm install && npx playwright install --with-deps chromium"
  },
  "deploy": {
    "startCommand": "node backend/src/server.js",
    "restartPolicyType": "ON_FAILURE"
  }
}
```
> ⚠️ El `buildCommand` en `railway.json` **bypasea completamente nixpacks.toml** — si hay un buildCommand explícito, cualquier `nixpacks.toml` en el repo es ignorado sin warning. La instalación de Chromium va en el buildCommand, no en nixpacks.

**Variables de entorno en Railway UI:**
| Variable | Descripción |
|----------|-------------|
| `ANTHROPIC_API_KEY` | IA (OCR de boletas, amonestaciones) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Autenticación |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | BD |
| `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN`, `META_EMPRESA_ID` | Webhook Meta Lead Ads |
| `SII_RUT`, `SII_DV` | RUT de la empresa (sin dígito verificador separado) |
| `PLAYWRIGHT_BROWSERS_PATH=0` | Chromium dentro de node_modules — persiste en imagen |
| ~~`SII_CLAVE`~~ | **Deprecada** — la clave tributaria vive en `sii_config.clave_sii` |

### Frontend — GitHub Pages / Hosting externo

Deploy automático del frontend a `app.mamkam.cl` via GitHub Actions al hacer push a `master`.

### Fix de routing SPA (legacy, antes en cPanel)
El `.htaccess` del ERP usaba `RewriteRule ^ index.html [QSA,END]`. Flag `END` (no `L`) para evitar reprocessing heredado del sitio padre. Ya no aplica con Railway.

---

## ROADMAP INTEGRACIONES Y CRM AVANZADO

### Fase 1 — Configuración Global: Integraciones (próxima)
- Página Configuración → Integraciones en el ERP
- Conexión OAuth con Meta/Facebook (botón "Conectar con Facebook")
- Almacena token por empresa en tabla `integraciones`
- Muestra página conectada, estado del token y opción de desconectar

### Fase 2 — CRM: Configuración de Formularios
- Pestaña "Configuración" dentro del módulo CRM
- Lista todos los formularios de Meta asociados a la página conectada
- Field Mapping visual: mapear campos del formulario Meta a campos del CRM
- Asignar responsable por formulario
- Activar/desactivar formularios

### Fase 3 — Bandeja Unificada (estilo Manychat)
- Nueva sección "Bandeja" en el CRM
- Unifica en una sola vista:
  * Leads de formularios Meta
  * Mensajes de WhatsApp Business
  * Mensajes directos de Instagram
  * Comentarios de Instagram
- Respuesta directa desde el ERP sin salir del sistema
- Asignación de conversaciones a vendedores
- Estados: nuevo, en atención, resuelto

### Fase 4 — WhatsApp Business API
- Integración con WhatsApp Business API (Meta)
- Recepción de mensajes entrantes → Bandeja unificada
- Envío de mensajes desde el ERP
- Plantillas de mensajes aprobadas por Meta
- Click-to-WhatsApp desde anuncios → CRM automático

### Fase 5 — Instagram
- Mensajes directos de Instagram → Bandeja unificada
- Comentarios en publicaciones → notificación y gestión
- Respuesta a comentarios desde el ERP

### Fase 6 — Arquitectura Multi-tenant SaaS
- Cada empresa se conecta a su propia cuenta de Meta via OAuth
- Tokens almacenados por empresa (tabla integraciones)
- Webhook único multi-tenant que identifica empresa por page_id
- Panel de administración de integraciones por empresa

---

## BUG CRÍTICO: ARCHIVO HUÉRFANO FacturasSIIPage.jsx

La ruta `/facturas` del ERP renderiza `modules/facturas/FacturasPage.jsx`, **NO** `modules/facturas-sii/FacturasSIIPage.jsx` (que existe en el repo pero nunca está importado en `App.jsx` — es código muerto). Varias sesiones de trabajo editaron por error el archivo equivocado (mismo propósito, nombre casi idéntico) sin que los cambios tuvieran ningún efecto visible, causando horas de debugging innecesario.

**ADVERTENCIA para el futuro:** antes de editar cualquier componente de Facturas, confirmar primero en `App.jsx` cuál es el componente realmente montado en la ruta. Considerar eliminar `FacturasSIIPage.jsx` por completo si no tiene ningún uso futuro planeado, para que no se repita la confusión.

---

## REMANENTE DE IVA ACUMULADO

Nuevo endpoint `GET /api/facturas/remanente-iva` (`backend/src/routes/facturas.js`), calcula el arrastre de remanente de crédito fiscal IVA mes a mes:

```
remanente_mes = max(0, remanente_anterior + iva_credito - iva_debito)
pago_del_mes  = (remanente_anterior + iva_credito - iva_debito) < 0
                ? abs(ese valor) : 0
```

Depende de que `facturas_sii.periodo` esté poblado (viene de `detPcarga` del SII, agregado en `guardarDocumentosRCV()` — los documentos sincronizados antes de ese fix no tenían `periodo` y requirieron resincronización). Si hay huecos entre el primer y último período con datos, el endpoint devuelve `periodosFaltantes` en vez de calcular un número incorrecto.

Tarjeta "Remanente de IVA Acumulado" visible en `FacturasPage.jsx` (el componente real). Validado manualmente: con datos de febrero a agosto 2026 sincronizados, el cálculo dio $9.557.421, consistente con la cifra que la contadora de la empresa manejaba de forma independiente (~$10 millones hace 1-2 meses antes del pago de julio).

---

## NOTA OPERATIVA: DEPLOY MANUAL DEL FRONTEND

Si el deploy automático del frontend falla con `"Error: Timeout (data socket)"` en el paso de `FTP-Deploy-Action` (GitHub Actions), es una falla transitoria de conexión con el servidor cPanel, no un problema de código. Soluciones en orden:

1. **Re-run failed jobs** en el Action que falló
2. Si persiste, **deploy manual:**
   - `npm run build` en `frontend/`
   - Subir por FTP (FileZilla) el contenido de `frontend/dist/` a `/public_html/erp.mamkam/`
   - Reemplazar `index.html` y los archivos `.js` con hash nuevo en `assets/`
   - Opcionalmente borrar los archivos `.js` viejos que ya no se referencian

---

## DOCUMENTOS RELACIONADOS

| Documento | Descripción |
|-----------|-------------|
| [`MODULO_FIN_FINANZAS.md`](./MODULO_FIN_FINANZAS.md) | Especificación técnica completa del módulo FIN |
| [`MODULO_CONT_CONTABILIDAD.md`](./MODULO_CONT_CONTABILIDAD.md) | Especificación técnica completa del módulo CONT |

---

## PENDIENTES ABIERTOS (v1.9)

- **App Visitas — rediseño tabs**: Home con lista visitas planificadas (no solo del día) bajo el calendario; tab Datos sin "Información del Proyecto" ni "Planos Adjuntos"; botones Google Calendar/Recordar WhatsApp también en `ModalVisita.jsx` del ERP; guardado progresivo entre tabs; tab Checklist sin fechas (mover a Datos)
- **Emisión DTE (SOAP)**: infraestructura de certificado digital lista (`obtenerSemilla`, `obtenerToken` en `services/sii.js`, `siiAgent` con `SSL_OP_LEGACY_SERVER_CONNECT` para TLS legacy de `palena.sii.cl`). Pendiente: firma XML + envío DTE + consulta de estado — proyecto aparte
- **Recordatorio WhatsApp CRM**: infraestructura lista (`services/whatsapp.js`, Meta Cloud API). Pendiente: crear y aprobar template `'recordatorio_contacto_lead'` (categoría Utility) en Meta Business Manager
- **Mapeo RCV → facturas ERP**: los documentos se guardan en `facturas_sii` pero aún no se cruzan automáticamente con cotizaciones u órdenes de compra del ERP

---

*Documento Maestro ERP MAMKAM — v1.10.0*  
*Actualizado el 2026-08-08 — Bug archivo huérfano FacturasSIIPage.jsx documentado; endpoint remanente IVA acumulado (GET /api/facturas/remanente-iva) validado con datos reales; sincronización RCV migrada a sesión única (COMPRA + VENTA en un solo login); nota operativa de deploy manual frontend vía FTP*  
*Próxima revisión: al implementar mapeo RCV→facturas ERP, emisión DTE, o rediseño tabs App Visitas*
