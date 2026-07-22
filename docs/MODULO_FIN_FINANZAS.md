# MÓDULO FIN — FINANZAS Y CONCILIACIÓN
**ERP MAMKAM — Especificación Técnica y Funcional**  
**Versión:** 1.0.0  
**Fecha:** 2026-05-19  
**Estado:** Definición Inicial

---

## TABLA DE CONTENIDOS

1. [Visión General del Módulo](#1-visión-general-del-módulo)
2. [Entidades y Modelo de Datos](#2-entidades-y-modelo-de-datos)
3. [Sub-módulos](#3-sub-módulos)
4. [Flujos de Trabajo](#4-flujos-de-trabajo)
5. [Estados y Transiciones](#5-estados-y-transiciones)
6. [Integración SII Chile](#6-integración-sii-chile)
7. [Procesamiento IA de Cartolas](#7-procesamiento-ia-de-cartolas)
8. [Motor de Conciliación](#8-motor-de-conciliación)
9. [Base de Datos — Esquema Completo](#9-base-de-datos--esquema-completo)
10. [API Endpoints](#10-api-endpoints)
11. [Automatizaciones y Alertas](#11-automatizaciones-y-alertas)
12. [Permisos del Módulo](#12-permisos-del-módulo)
13. [Dashboard e Informes](#13-dashboard-e-informes)

---

## 1. VISIÓN GENERAL DEL MÓDULO

### 1.1 Propósito

El módulo FIN centraliza la gestión financiera operativa de la empresa. Permite cargar cartolas bancarias de cualquier banco chileno, sincronizar automáticamente los documentos tributarios desde el SII, y ejecutar un motor de conciliación asistido por IA que cruza movimientos bancarios contra facturas de compra/venta, movimientos de caja chica y adelantos de trabajadores.

### 1.2 Capacidades Principales

| Capacidad | Descripción |
|-----------|-------------|
| **Carga de Cartolas** | Soporte para Excel, CSV, OFX/QFX y PDF de cualquier banco chileno |
| **Parsing IA** | La IA interpreta el formato del banco automáticamente sin configuración manual |
| **Sincronización SII** | Descarga automática de DTEs desde el RCV del SII vía certificado digital |
| **Conciliación Bancaria** | Cruce inteligente movimiento ↔ documento con sugerencias IA |
| **Conciliación Caja Chica** | Rendición y cuadre de fondos de caja chica |
| **Adelantos Trabajadores** | Control de adelantos, descuentos y saldo pendiente |
| **Reportes Financieros** | Libro de banco, flujo de caja, resumen mensual con IA |
| **Alertas Inteligentes** | Detección de anomalías, pagos duplicados, diferencias de monto |

### 1.3 Sub-módulos

```
FIN — Finanzas y Conciliación
├── FIN.BAN  — Cartolas y Cuentas Bancarias
├── FIN.SII  — Documentos Tributarios (SII)
├── FIN.CON  — Conciliación Bancaria
├── FIN.CAJ  — Caja Chica
└── FIN.ADL  — Adelantos de Trabajadores
```

### 1.4 Relaciones con Otros Módulos

```
FIN ←──── OC    (Órdenes de compra generan facturas de compra esperadas)
FIN ←──── COT   (Cotizaciones aceptadas generan facturas de venta esperadas)
FIN ←──── TRB   (Trabajadores tienen adelantos y descuentos en nómina)
FIN ←──── IAD   (IA Documental procesa cartolas y documentos financieros)
FIN ──────────→ (Futuro: CONT — Contabilidad, exporta asientos contables)
```

---

## 2. ENTIDADES Y MODELO DE DATOS

### 2.1 Mapa de Entidades

```
CuentaBancaria
    │
    ├──▶ Cartola ──▶ MovimientoBancario ──▶ ConciliacionItem
    │                                              │
    │                                              │ cruza con
    │                                              ▼
    │                                       FacturaSII
    │                                       MovimientoCajaChica
    │                                       PagoAdelanto
    │
    ├──▶ CajaChica ──▶ MovimientoCajaChica ──▶ RendicionCajaChica
    │
    └──▶ AdelantoTrabajador ──▶ PagoAdelanto
```

### 2.2 Descripción de Entidades

| Entidad | Propósito |
|---------|-----------|
| `CuentaBancaria` | Cuenta bancaria registrada de la empresa |
| `Cartola` | Archivo de cartola subido (cabecera) |
| `MovimientoBancario` | Cada transacción individual dentro de la cartola |
| `FacturaSII` | DTE obtenido del SII (factura compra o venta) |
| `SyncSII` | Registro de cada sincronización con el SII |
| `ConciliacionPeriodo` | Período de conciliación (semanal o mensual) |
| `ConciliacionItem` | Par conciliado: movimiento ↔ documento |
| `CajaChica` | Fondo de caja chica |
| `MovimientoCajaChica` | Gasto o reposición de caja chica |
| `RendicionCajaChica` | Proceso de rendición y cuadre del fondo |
| `AdelantoTrabajador` | Adelanto de sueldo o préstamo a trabajador |
| `PagoAdelanto` | Descuento o pago parcial del adelanto |

---

## 3. SUB-MÓDULOS

---

### 3.1 FIN.BAN — Cartolas y Cuentas Bancarias

#### 3.1.1 Cuentas Bancarias Registradas

Cada empresa puede tener múltiples cuentas bancarias registradas:

```
CuentaBancaria {
  id                UUID        PK
  banco             VARCHAR     BancoEstado | Santander | BCI | Scotiabank
                                | BICE | Itaú | Security | Falabella | Otro
  nombre_banco      VARCHAR     Nombre completo del banco
  tipo_cuenta       ENUM        corriente | vista | ahorro | chequera_electronica
  numero_cuenta     VARCHAR     Enmascarado en UI (**** **** 1234)
  rut_titular       VARCHAR
  nombre_titular    VARCHAR
  moneda            VARCHAR     CLP | USD | EUR
  activa            BOOLEAN
  saldo_ultimo      DECIMAL     Último saldo conocido
  saldo_fecha       DATE        Fecha del último saldo
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
}
```

#### 3.1.2 Formatos de Cartola Soportados

| Banco | Formatos disponibles |
|-------|---------------------|
| BancoEstado | Excel (.xls, .xlsx), PDF |
| Santander | Excel (.xlsx), CSV |
| BCI | Excel (.xlsx), CSV, PDF |
| Scotiabank | Excel (.xlsx), OFX |
| BICE | Excel (.xlsx), CSV |
| Itaú | Excel (.xlsx), PDF |
| Security | Excel (.xlsx), PDF |
| Cualquier banco | OFX/QFX (estándar universal) |
| Cualquier banco | PDF (parsing IA) |

#### 3.1.3 Campos Extraídos de una Cartola

```
MovimientoBancario {
  id                UUID        PK
  cartola_id        UUID        FK → cartolas
  cuenta_id         UUID        FK → cuentas_bancarias
  fecha             DATE        Fecha del movimiento
  fecha_valor       DATE        Fecha valor (puede diferir)
  descripcion       TEXT        Glosa original del banco
  descripcion_norm  TEXT        Glosa normalizada por IA
  tipo              ENUM        abono | cargo
  monto             DECIMAL     Siempre positivo
  saldo             DECIMAL     Saldo tras el movimiento
  numero_doc        VARCHAR     Número de cheque, transferencia, etc.
  categoria_ia      VARCHAR     Categoría sugerida por IA
  estado_concil     ENUM        pendiente | conciliado | ignorado | excepcion
  origen_cartola    VARCHAR     Banco de origen (para validación)
  hash_unico        VARCHAR     SHA256 para detección de duplicados
  created_at        TIMESTAMPTZ
}
```

---

### 3.2 FIN.SII — Documentos Tributarios Electrónicos

#### 3.2.1 Tipos de DTE Gestionados

| Código SII | Tipo Documento | Dirección |
|-----------|---------------|-----------|
| 33 | Factura Electrónica | Venta (emitida) |
| 34 | Factura No Afecta Electrónica | Venta (emitida) |
| 56 | Nota de Débito Electrónica | Venta (emitida) |
| 61 | Nota de Crédito Electrónica | Venta (emitida) |
| 46 | Factura de Compra Electrónica | Compra (recibida) |
| 52 | Guía de Despacho Electrónica | Compra/Venta |

#### 3.2.2 Entidad FacturaSII

```
FacturaSII {
  id                UUID        PK
  tipo_dte          INT         Código SII (33, 34, 46, 56, 61, 52)
  direccion         ENUM        emitida | recibida
  folio             INT         Número de folio SII
  rut_emisor        VARCHAR
  razon_social_emisor VARCHAR
  rut_receptor      VARCHAR
  razon_social_receptor VARCHAR
  fecha_emision     DATE
  fecha_vencimiento DATE
  monto_neto        DECIMAL
  iva               DECIMAL
  monto_total       DECIMAL
  estado_sii        VARCHAR     Aceptado | Rechazado | En proceso
  estado_acuse      VARCHAR     Acuse de recibo del receptor
  xml_url           VARCHAR     URL del XML DTE almacenado
  estado_concil     ENUM        pendiente | conciliada | parcial | excepcion
  oc_relacionada_id UUID        FK → ordenes_compra (si aplica)
  cot_relacionada_id UUID       FK → cotizaciones (si aplica)
  sync_sii_id       UUID        FK → sync_sii (batch de sincronización)
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
}
```

#### 3.2.3 Sincronización SII

```
SyncSII {
  id              UUID        PK
  tipo            ENUM        compras | ventas | ambos
  periodo_mes     INT         Mes del período (1-12)
  periodo_anio    INT
  estado          ENUM        en_proceso | completado | error
  total_registros INT
  registros_nuevos INT
  registros_actualizados INT
  errores         JSONB
  iniciado_por    UUID        FK → usuarios
  iniciado_at     TIMESTAMPTZ
  completado_at   TIMESTAMPTZ
}
```

---

### 3.3 FIN.CON — Conciliación Bancaria

#### 3.3.1 Período de Conciliación

```
ConciliacionPeriodo {
  id                UUID        PK
  cuenta_id         UUID        FK → cuentas_bancarias
  tipo              ENUM        semanal | mensual
  fecha_desde       DATE
  fecha_hasta       DATE
  estado            ENUM        abierto | en_proceso | revisado | cerrado
  saldo_inicial     DECIMAL
  saldo_final       DECIMAL
  total_abonos      DECIMAL
  total_cargos      DECIMAL
  total_conciliado  DECIMAL
  total_pendiente   DECIMAL
  diferencia        DECIMAL     Debe ser 0 al cerrar
  resumen_ia        TEXT        Análisis narrativo generado por IA
  creado_por        UUID        FK → usuarios
  cerrado_por       UUID        FK → usuarios
  cerrado_at        TIMESTAMPTZ
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
}
```

#### 3.3.2 Ítem de Conciliación

```
ConciliacionItem {
  id                    UUID        PK
  periodo_id            UUID        FK → conciliacion_periodos
  movimiento_id         UUID        FK → movimientos_bancarios
  tipo_contraparte      ENUM        factura_sii | caja_chica | adelanto
                                    | oc | otro
  contraparte_id        UUID        ID en la tabla correspondiente
  monto_movimiento      DECIMAL
  monto_documento       DECIMAL
  diferencia            DECIMAL
  metodo_conciliacion   ENUM        automatico_ia | manual | sugerido_ia
  confianza_ia          DECIMAL     0-100
  estado                ENUM        propuesto | aceptado | rechazado
  notas                 TEXT
  conciliado_por        UUID        FK → usuarios
  conciliado_at         TIMESTAMPTZ
  created_at            TIMESTAMPTZ
}
```

---

### 3.4 FIN.CAJ — Caja Chica

#### 3.4.1 Fondo de Caja Chica

```
CajaChica {
  id              UUID        PK
  nombre          VARCHAR     Ej: "Caja Chica Oficina Central"
  responsable_id  UUID        FK → trabajadores
  monto_asignado  DECIMAL     Fondo máximo autorizado
  saldo_actual    DECIMAL
  activa          BOOLEAN     DEFAULT true
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}
```

#### 3.4.2 Movimiento de Caja Chica

```
MovimientoCajaChica {
  id              UUID        PK
  caja_id         UUID        FK → cajas_chicas
  fecha           DATE
  tipo            ENUM        gasto | reposicion
  concepto        TEXT
  categoria       VARCHAR     Movilización | Almuerzo | Insumos | Correos | Otro
  monto           DECIMAL
  documento_url   VARCHAR     Foto del recibo/boleta
  numero_boleta   VARCHAR
  proveedor       VARCHAR
  rut_proveedor   VARCHAR
  estado_concil   ENUM        pendiente | conciliado | rechazado
  registrado_por  UUID        FK → usuarios
  aprobado_por    UUID        FK → usuarios
  created_at      TIMESTAMPTZ
}
```

#### 3.4.3 Rendición de Caja Chica

```
RendicionCajaChica {
  id              UUID        PK
  caja_id         UUID        FK → cajas_chicas
  periodo_desde   DATE
  periodo_hasta   DATE
  monto_inicial   DECIMAL
  total_gastos    DECIMAL
  monto_reposicion DECIMAL    Lo que se solicita para reponer
  estado          ENUM        borrador | enviada | aprobada | rechazada | pagada
  movimientos     UUID[]      Array de IDs de movimientos incluidos
  aprobado_por    UUID        FK → usuarios
  notas           TEXT
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}
```

---

### 3.5 FIN.ADL — Adelantos de Trabajadores

#### 3.5.1 Adelanto

```
AdelantoTrabajador {
  id                UUID        PK
  trabajador_id     UUID        FK → trabajadores
  tipo              ENUM        adelanto_sueldo | prestamo | anticipo_gastos
  monto_total       DECIMAL
  monto_pendiente   DECIMAL     Saldo por descontar
  cuotas            INT         Número de cuotas acordadas (0 = monto único)
  monto_cuota       DECIMAL
  fecha_otorgamiento DATE
  fecha_primer_descuento DATE
  motivo            TEXT
  estado            ENUM        activo | pagado | condonado | anulado
  aprobado_por      UUID        FK → usuarios
  metodo_pago_inicial ENUM      transferencia | efectivo | caja_chica
  movimiento_bancario_id UUID   FK → movimientos_bancarios (si se pagó por banco)
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
}
```

#### 3.5.2 Pago / Descuento de Adelanto

```
PagoAdelanto {
  id              UUID        PK
  adelanto_id     UUID        FK → adelantos_trabajadores
  fecha           DATE
  monto           DECIMAL
  tipo            ENUM        descuento_remuneracion | transferencia | efectivo
  movimiento_id   UUID        FK → movimientos_bancarios (si aplica)
  periodo_remu    VARCHAR     Ej: "2026-05" (si es descuento en liquidación)
  estado_concil   ENUM        pendiente | conciliado
  notas           TEXT
  registrado_por  UUID        FK → usuarios
  created_at      TIMESTAMPTZ
}
```

---

## 4. FLUJOS DE TRABAJO

### 4.1 Flujo: Carga y Procesamiento de Cartola

```
[USUARIO SUBE CARTOLA]
  (Excel / CSV / OFX / PDF)
        │
        ▼
[VALIDACIÓN ARCHIVO]
  ├── Formato soportado? ──No──▶ Error con mensaje claro
  └── Sí
        │
        ▼
[QUEUE: PROCESAMIENTO IAD]
  Prioridad alta, cola: fin-cartola-processing
        │
        ▼
[DETECCIÓN DE BANCO Y FORMATO]
  IA identifica: banco, período, columnas, formato de fecha
        │
        ▼
[EXTRACCIÓN DE MOVIMIENTOS]
  Parsea cada fila → MovimientoBancario[]
        │
        ▼
[DETECCIÓN DE DUPLICADOS]
  Calcula hash SHA256 por (cuenta, fecha, monto, descripción)
  ├── Duplicado detectado ──▶ Marcar, no insertar, notificar
  └── Nuevo ──▶ Insertar
        │
        ▼
[NORMALIZACIÓN Y CATEGORIZACIÓN IA]
  Para cada movimiento:
  ├── Normaliza descripción (elimina ruido bancario)
  ├── Asigna categoría (Proveedores, Remuneraciones, Impuestos...)
  └── Detecta patrones (RUT en glosa, N° factura, etc.)
        │
        ▼
[NOTIFICACIÓN AL USUARIO]
  "Cartola procesada: N movimientos importados,
   M posibles duplicados, P ya conciliados automáticamente"
        │
        ▼
[INICIO DE SUGERENCIAS IA]
  Motor de conciliación corre en background
```

### 4.2 Flujo: Sincronización SII

```
[TRIGGER: Manual / Automático mensual]
        │
        ▼
[AUTENTICACIÓN CON SII]
  Certificado digital (.pfx) + RUT empresa
        │
        ▼
[CONSULTA RCV SII]
  Período: mes/año seleccionado
  Tipos: compras + ventas
        │
        ▼
[DESCARGA DE DTEs]
  Para cada documento:
  ├── ¿Ya existe en BD? ──Sí──▶ Actualizar estado si cambió
  └── No ──▶ Insertar nuevo FacturaSII
        │
        ▼
[CRUCE CON OC Y COT]
  IA busca OC relacionada (por proveedor + monto ≈ total factura)
  IA busca COT relacionada (por cliente + monto ≈ total factura)
        │
        ▼
[ACTUALIZACIÓN ESTADO CONCILIACIÓN]
  Si factura ya tiene movimiento bancario coincidente → auto-conciliar
        │
        ▼
[REPORTE DE SYNC]
  Nuevos: N | Actualizados: M | Errores: P
```

### 4.3 Flujo: Conciliación Bancaria IA

```
[ABRIR PERÍODO DE CONCILIACIÓN]
  Seleccionar: cuenta, rango de fechas (semanal/mensual)
        │
        ▼
[MOTOR IA — FASE 1: COINCIDENCIAS EXACTAS]
  Busca pares donde:
  - monto_movimiento == monto_documento (±0.01 por redondeo)
  - fecha_movimiento dentro de ±5 días de fecha_vencimiento
  - RUT del movimiento == RUT del documento
  → Confianza: 95-100%
        │
        ▼
[MOTOR IA — FASE 2: COINCIDENCIAS APROXIMADAS]
  Busca pares donde:
  - montos similares (±2%)
  - fechas cercanas (±15 días)
  - Coincidencia parcial de RUT o nombre en glosa
  → Confianza: 60-94%
        │
        ▼
[MOTOR IA — FASE 3: AGRUPACIONES]
  Un movimiento puede corresponder a N facturas (pago agrupado)
  N movimientos pueden corresponder a 1 factura (pago en cuotas)
  → Confianza según suma y coincidencias
        │
        ▼
[PRESENTACIÓN AL USUARIO]
  Vista tres columnas:
  │ MOVIMIENTOS BANCARIOS │ SUGERENCIAS IA │ DOCUMENTOS SII │
  Con score de confianza, botones Aceptar/Rechazar/Vincular manual
        │
        ├── Aceptar sugerencia ──▶ ConciliacionItem estado=aceptado
        ├── Rechazar sugerencia ──▶ ConciliacionItem estado=rechazado
        │                          IA aprende para futuras conciliaciones
        └── Vincular manual ──────▶ ConciliacionItem metodo=manual
        │
        ▼
[CIERRE DEL PERÍODO]
  Verificar diferencia = 0
  ├── diferencia ≠ 0 ──▶ Alerta, no permite cerrar sin justificación
  └── diferencia = 0 ──▶ Período cerrado, genera informe IA
```

### 4.4 Flujo: Rendición de Caja Chica

```
[RESPONSABLE REGISTRA GASTOS]
  Foto boleta/recibo → IA extrae: monto, fecha, proveedor, concepto
        │
        ▼
[ACUMULACIÓN DE GASTOS]
  Dashboard del responsable muestra:
  - Saldo inicial del período
  - Gastos registrados
  - Saldo disponible
        │
        ▼
[SOLICITUD DE RENDICIÓN]
  Responsable envía rendición cuando:
  - Saldo bajo umbral configurado, O
  - Fin del período
        │
        ▼
[REVISIÓN POR APROBADOR]
  Revisa cada gasto:
  ├── Aprueba ──▶ Solicita reposición del monto
  └── Rechaza ítem ──▶ Trabajador debe devolver monto rechazado
        │
        ▼
[REPOSICIÓN]
  Transferencia bancaria al responsable
  → Se registra en MovimientoBancario como conciliado automáticamente
```

### 4.5 Flujo: Adelanto de Trabajador

```
[SOLICITUD DE ADELANTO]
  Trabajador solicita o RRHH registra
        │
        ▼
[APROBACIÓN]
  Jefe directo → RRHH → (Gerencia si monto > umbral)
        │
        ▼
[PAGO DEL ADELANTO]
  Opción A: Transferencia bancaria
            → Al pagar, vincular MovimientoBancario correspondiente
  Opción B: Efectivo caja chica
            → Registrar en MovimientoCajaChica
        │
        ▼
[PLAN DE DESCUENTOS]
  Sistema genera cuotas automáticas:
  - Descuento en liquidación mensual
  - Cantidad de cuotas según acuerdo
        │
        ▼
[SEGUIMIENTO MENSUAL]
  Cada período de nómina:
  ├── Sistema muestra adelantos pendientes por trabajador
  ├── Confirma descuento en liquidación
  └── Actualiza saldo pendiente
        │
        ▼
[CIERRE]
  Cuando monto_pendiente = 0 → Estado: pagado
  Genera comprobante para trabajador
```

---

## 5. ESTADOS Y TRANSICIONES

### 5.1 Estados: MovimientoBancario

```
pendiente ──────────────────────────────────▶ conciliado
    │                                              │
    ├──▶ sugerido (IA propuso match)               │
    │       └──▶ aceptado ──────────────────▶ conciliado
    │       └──▶ rechazado ──────────────▶ pendiente
    │
    └──▶ ignorado (no requiere conciliación: comisiones, etc.)
    └──▶ excepcion (diferencia justificada y documentada)
```

| Estado | Descripción |
|--------|-------------|
| `pendiente` | Importado, sin conciliar |
| `sugerido` | IA propuso un match, esperando confirmación |
| `conciliado` | Vinculado a documento, diferencia = 0 |
| `conciliado_parcial` | Vinculado, pero queda diferencia menor justificada |
| `ignorado` | Marcado como no conciliable (comisiones, intereses) |
| `excepcion` | Diferencia documentada y aprobada |

### 5.2 Estados: FacturaSII

| Estado | Descripción |
|--------|-------------|
| `pendiente` | Importada, sin movimiento bancario asociado |
| `conciliada` | Movimiento bancario encontrado y vinculado |
| `parcial` | Pagada parcialmente |
| `excepcion` | Diferencia justificada (descuento, nota de crédito) |
| `anulada` | Nota de crédito total o rechazo SII |

### 5.3 Estados: ConciliacionPeriodo

| Estado | Descripción |
|--------|-------------|
| `abierto` | Período creado, trabajando |
| `en_revision` | Esperando revisión del responsable |
| `observado` | Con observaciones del revisor |
| `cerrado` | Conciliación completa y aprobada |

### 5.4 Estados: AdelantoTrabajador

| Estado | Descripción |
|--------|-------------|
| `pendiente_aprobacion` | Solicitado, sin aprobar |
| `aprobado` | Aprobado, pendiente de pago |
| `activo` | Pagado al trabajador, con saldo pendiente de descuento |
| `pagado` | Descuento completo, saldo = 0 |
| `condonado` | Perdonado por decisión de la empresa |
| `anulado` | Cancelado antes de pagar |

---

## 6. INTEGRACIÓN SII CHILE

### 6.1 Método de Conexión

El SII de Chile permite acceso programático al **Registro de Compras y Ventas (RCV)** mediante:

1. **Certificado Digital:** Archivo `.pfx` con clave privada del representante legal o autorizado
2. **Token de Sesión:** Se obtiene enviando el certificado firmado al endpoint de autenticación SII
3. **APIs REST SII:** Consulta de documentos por período, RUT y tipo

```
CONFIGURACIÓN REQUERIDA (por empresa):
├── RUT Empresa (con DV)
├── Certificado Digital (.pfx)
├── Contraseña del certificado
└── Ambiente: certificacion | produccion
```

### 6.2 Endpoints SII Utilizados

| Endpoint | Propósito |
|----------|-----------|
| `POST /cgi_dte/UF1/TKNR` | Obtener token de sesión |
| `GET /cgi_dte/UF1/REC_ENT` | Registros de compras del período |
| `GET /cgi_dte/UF1/REC_EMS` | Registros de ventas del período |
| `GET /cgi_dte/UF1/DTE_INFO` | Detalle de un DTE específico |
| `GET /cgi_dte/UF1/ESTADO_DTE` | Estado de aceptación de un DTE |

### 6.3 Almacenamiento Seguro del Certificado

```
NUNCA almacenar el .pfx en la base de datos directamente.

Proceso seguro:
1. Usuario sube .pfx en UI → Transmitido por HTTPS
2. Backend lo encripta con AES-256 usando clave del vault
3. Almacenado en storage seguro (no S3 público)
4. Referencia cifrada en BD: certificado_ref VARCHAR
5. Para usar: descifrar en memoria → llamar SII → destruir en memoria
```

### 6.4 Estructura del Registro de Compras/Ventas

Datos obtenidos del RCV SII para cada documento:

```json
{
  "tipo_dte": 33,
  "folio": 12345,
  "rut_emisor": "76543210-8",
  "razon_social_emisor": "PROVEEDOR SA",
  "rut_receptor": "12345678-9",
  "fecha_emision": "2026-05-10",
  "monto_neto": 840336,
  "iva": 159664,
  "monto_total": 1000000,
  "estado": "ACEPTADO",
  "acuse_recibo": true
}
```

### 6.5 Manejo de Errores SII

| Error | Causa | Manejo |
|-------|-------|--------|
| `Token expirado` | Sesión caducó (2 horas) | Renovar token y reintentar |
| `RUT sin documentos` | Sin DTEs en el período | Registrar como sync exitoso vacío |
| `Certificado inválido` | Vencido o incorrecto | Alerta al administrador |
| `Servicio no disponible` | SII en mantenimiento | Reintentar con backoff exponencial |
| `Período no disponible` | Período aún no cerrado | Notificar y no procesar |

---

## 7. PROCESAMIENTO IA DE CARTOLAS

### 7.1 Estrategia de Parsing Inteligente

En lugar de configurar parsers por banco (frágil ante cambios de formato), se usa un pipeline IA:

```
ARCHIVO RECIBIDO
      │
      ▼
[DETECCIÓN DE TIPO]
  - PDF → Convertir a texto (pdftotext / OCR si escaneado)
  - Excel → Convertir a CSV normalizado
  - CSV/OFX → Usar directamente
      │
      ▼
[PROMPT IA — ANÁLISIS DE ESTRUCTURA]
  "Analiza este extracto de cartola bancaria chilena.
   Identifica: nombre del banco, período, número de cuenta,
   columnas (fecha, descripción, cargo, abono, saldo).
   Extrae los movimientos como JSON array."
      │
      ▼
[VALIDACIÓN DE CONSISTENCIA]
  saldo_final = saldo_inicial + sum(abonos) - sum(cargos)
  Si no cuadra → alerta, mostrar al usuario para revisión
      │
      ▼
[NORMALIZACIÓN DE GLOSAS]
  Prompt IA por lotes de 50 movimientos:
  "Para cada glosa bancaria, extrae:
   - rut_relacionado (si aparece)
   - numero_documento (N° factura, cheque, transferencia)
   - categoria (Proveedor|Cliente|Remuneración|Impuesto|Banco|Otro)
   - descripcion_limpia (sin códigos internos del banco)"
```

### 7.2 Prompt Sistema para Extracción de Cartola

```
Eres un experto en documentos financieros chilenos.
Tu tarea es extraer movimientos bancarios de cartolas en formato estructurado.

REGLAS ESTRICTAS:
1. Responde SOLO con JSON válido, sin texto adicional
2. Si no puedes leer un campo, usa null (nunca inventes)
3. Las fechas siempre en formato YYYY-MM-DD
4. Los montos siempre como número positivo (sin puntos de miles)
5. tipo: "abono" si entra dinero a la cuenta, "cargo" si sale

ESTRUCTURA ESPERADA:
{
  "banco": "string",
  "cuenta": "string | null",
  "periodo_desde": "YYYY-MM-DD",
  "periodo_hasta": "YYYY-MM-DD",
  "saldo_inicial": number,
  "saldo_final": number,
  "movimientos": [
    {
      "fecha": "YYYY-MM-DD",
      "descripcion": "string",
      "tipo": "abono | cargo",
      "monto": number,
      "saldo": number | null,
      "numero_doc": "string | null"
    }
  ]
}
```

### 7.3 Categorías de Movimientos

El sistema aprende y categoriza automáticamente:

| Categoría | Ejemplos de glosas |
|-----------|-------------------|
| `proveedor` | "TRANSFERENCIA A PROVEEDOR SA", "PAG FCT 001234" |
| `cliente` | "ABONO CLIENTE LTDA", "DEPOSITO EFECTIVO" |
| `remuneracion` | "PAGO REMUNERACIONES", "SUELDO MES" |
| `impuesto` | "PAG IVA", "TESORERIA GRAL REPUBLICA" |
| `banco` | "COMISION MANTENCION", "INTERES PRESTAMO" |
| `caja_chica` | "REPOSICION CAJA CHICA" |
| `adelanto` | "ADELANTO TRABAJADOR", "PRESTAMO PERSONAL" |
| `otro` | Resto no clasificado |

---

## 8. MOTOR DE CONCILIACIÓN

### 8.1 Algoritmo de Matching

El motor ejecuta 4 fases en orden de confianza decreciente:

#### FASE 1 — Coincidencia Exacta (Confianza 95-100%)

```
Para cada movimiento bancario pendiente:
  Buscar FacturaSII donde:
    ABS(movimiento.monto - factura.monto_total) <= 1  -- ±1 peso
    AND factura.fecha_vencimiento BETWEEN
        movimiento.fecha - 10 AND movimiento.fecha + 5
    AND (
      movimiento.descripcion_norm ILIKE '%' || factura.rut_emisor || '%'
      OR movimiento.numero_doc = factura.folio::text
    )
  → Si encuentra 1: match exacto, confianza 98%
  → Si encuentra 0: pasar a Fase 2
  → Si encuentra >1: conflicto, reportar al usuario
```

#### FASE 2 — Coincidencia por Monto y Fecha (Confianza 70-94%)

```
Buscar FacturaSII donde:
  ABS(movimiento.monto - factura.monto_total) / factura.monto_total <= 0.02
  AND factura.fecha_vencimiento BETWEEN
      movimiento.fecha - 20 AND movimiento.fecha + 10
  AND factura.rut_emisor = empresa conocida en BD

  Score = 100
         - (diferencia_monto_pct * 20)
         - (diferencia_dias * 1)
  → Si score >= 70: proponer como sugerencia
```

#### FASE 3 — Pago Agrupado (1 movimiento → N facturas)

```
Un movimiento bancario puede ser el pago de múltiples facturas.
Buscar combinaciones de FacturaSII donde:
  SUM(factura.monto_total) ≈ movimiento.monto (±2%)
  Todas del mismo proveedor
  Todas con vencimiento cercano al movimiento
  → Si encuentra combinación: proponer agrupación
```

#### FASE 4 — LLM como último recurso

```
Para movimientos sin match en fases 1-3:
  Llamar a Claude con:
  - Descripción del movimiento normalizada
  - Lista de facturas pendientes del mismo período
  - Historial de conciliaciones del mismo proveedor
  Pedir: "¿A qué factura/s corresponde este movimiento? Justifica."
  → Usar respuesta como sugerencia con confianza según justificación
```

### 8.2 Aprendizaje del Motor

Cada vez que el usuario acepta o rechaza una sugerencia, el sistema registra el feedback:

```
ConciliacionFeedback {
  movimiento_caracteristicas  JSONB   (rango monto, categoría, banco)
  documento_caracteristicas   JSONB   (tipo DTE, rango monto, proveedor)
  accion                      ENUM    aceptado | rechazado
  patron_glosa                VARCHAR Patrón aprendido de la descripción
}
```

Este feedback mejora los pesos del algoritmo de matching con el tiempo.

### 8.3 Informe IA de Conciliación

Al cerrar un período, la IA genera un informe narrativo:

```
PROMPT:
"Actúa como analista financiero. Analiza el siguiente resumen de
conciliación bancaria del período [FECHA_DESDE] al [FECHA_HASTA]
para la cuenta [BANCO] de la empresa [NOMBRE_EMPRESA].

DATOS:
- Total abonos: $X
- Total cargos: $X
- Facturas de venta conciliadas: N (total $X)
- Facturas de compra conciliadas: N (total $X)
- Movimientos sin conciliar: N (total $X)
- Caja chica conciliada: $X
- Adelantos pagados: $X

MOVIMIENTOS SIN CONCILIAR:
[listado de movimientos pendientes con descripción y monto]

Genera:
1. Resumen ejecutivo del período (2-3 párrafos)
2. Alertas o anomalías detectadas
3. Recomendaciones de acción para movimientos sin conciliar
4. Tendencias respecto al período anterior (si hay datos)"
```

---

## 9. BASE DE DATOS — ESQUEMA COMPLETO

```sql
-- CUENTAS BANCARIAS
CREATE TABLE cuentas_bancarias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banco             VARCHAR(50) NOT NULL,
  nombre_banco      VARCHAR(200) NOT NULL,
  tipo_cuenta       VARCHAR(30) NOT NULL,
  numero_cuenta_enc VARCHAR(500) NOT NULL,   -- encriptado AES-256
  numero_cuenta_mask VARCHAR(20),            -- últimos 4 dígitos visibles
  rut_titular       VARCHAR(12),
  nombre_titular    VARCHAR(300),
  moneda            VARCHAR(3) DEFAULT 'CLP',
  activa            BOOLEAN DEFAULT true,
  saldo_ultimo      DECIMAL(14,2),
  saldo_fecha       DATE,
  config_sii        JSONB,                   -- configuración SII vinculada
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- CARTOLAS
CREATE TABLE cartolas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id         UUID REFERENCES cuentas_bancarias(id),
  nombre_archivo    VARCHAR(500),
  tipo_archivo      VARCHAR(20),             -- xlsx | csv | ofx | pdf
  storage_url       VARCHAR(1000),
  banco_detectado   VARCHAR(100),
  periodo_desde     DATE,
  periodo_hasta     DATE,
  saldo_inicial     DECIMAL(14,2),
  saldo_final       DECIMAL(14,2),
  total_abonos      DECIMAL(14,2),
  total_cargos      DECIMAL(14,2),
  total_movimientos INT,
  movimientos_dupl  INT DEFAULT 0,
  estado            VARCHAR(30) DEFAULT 'procesando',
  error_detalle     TEXT,
  subido_por        UUID REFERENCES usuarios(id),
  procesado_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- MOVIMIENTOS BANCARIOS
CREATE TABLE movimientos_bancarios (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cartola_id        UUID REFERENCES cartolas(id),
  cuenta_id         UUID REFERENCES cuentas_bancarias(id),
  fecha             DATE NOT NULL,
  fecha_valor       DATE,
  descripcion       TEXT NOT NULL,
  descripcion_norm  TEXT,
  tipo              VARCHAR(10) NOT NULL,    -- abono | cargo
  monto             DECIMAL(14,2) NOT NULL,
  saldo             DECIMAL(14,2),
  numero_doc        VARCHAR(100),
  rut_relacionado   VARCHAR(12),
  categoria_ia      VARCHAR(50),
  estado_concil     VARCHAR(30) DEFAULT 'pendiente',
  hash_unico        VARCHAR(64) UNIQUE,      -- SHA256 para dedup
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- CONFIGURACIÓN SII
CREATE TABLE config_sii (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rut_empresa       VARCHAR(12) UNIQUE NOT NULL,
  certificado_ref   VARCHAR(500),           -- referencia al certificado cifrado
  certificado_vence DATE,
  ambiente          VARCHAR(20) DEFAULT 'produccion',
  activa            BOOLEAN DEFAULT true,
  ultimo_sync_compras DATE,
  ultimo_sync_ventas  DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- FACTURAS SII
CREATE TABLE facturas_sii (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_dte                INT NOT NULL,
  direccion               VARCHAR(10) NOT NULL,   -- emitida | recibida
  folio                   INT NOT NULL,
  rut_emisor              VARCHAR(12) NOT NULL,
  razon_social_emisor     VARCHAR(300),
  rut_receptor            VARCHAR(12) NOT NULL,
  razon_social_receptor   VARCHAR(300),
  fecha_emision           DATE NOT NULL,
  fecha_vencimiento       DATE,
  monto_neto              DECIMAL(14,2) DEFAULT 0,
  iva                     DECIMAL(14,2) DEFAULT 0,
  otros_impuestos         DECIMAL(14,2) DEFAULT 0,
  monto_total             DECIMAL(14,2) NOT NULL,
  estado_sii              VARCHAR(50),
  estado_acuse            VARCHAR(50),
  xml_url                 VARCHAR(1000),
  estado_concil           VARCHAR(30) DEFAULT 'pendiente',
  oc_relacionada_id       UUID REFERENCES ordenes_compra(id),
  cot_relacionada_id      UUID REFERENCES cotizaciones(id),
  sync_sii_id             UUID,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tipo_dte, folio, rut_emisor)
);

-- SYNC SII
CREATE TABLE sync_sii (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                  VARCHAR(20) NOT NULL,
  periodo_mes           INT NOT NULL,
  periodo_anio          INT NOT NULL,
  estado                VARCHAR(20) DEFAULT 'en_proceso',
  total_registros       INT DEFAULT 0,
  registros_nuevos      INT DEFAULT 0,
  registros_actualizados INT DEFAULT 0,
  errores               JSONB,
  iniciado_por          UUID REFERENCES usuarios(id),
  iniciado_at           TIMESTAMPTZ DEFAULT NOW(),
  completado_at         TIMESTAMPTZ
);

-- CONCILIACIÓN PERÍODOS
CREATE TABLE conciliacion_periodos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id         UUID REFERENCES cuentas_bancarias(id),
  tipo              VARCHAR(10) NOT NULL,    -- semanal | mensual
  fecha_desde       DATE NOT NULL,
  fecha_hasta       DATE NOT NULL,
  estado            VARCHAR(20) DEFAULT 'abierto',
  saldo_inicial     DECIMAL(14,2),
  saldo_final       DECIMAL(14,2),
  total_abonos      DECIMAL(14,2) DEFAULT 0,
  total_cargos      DECIMAL(14,2) DEFAULT 0,
  total_conciliado  DECIMAL(14,2) DEFAULT 0,
  total_pendiente   DECIMAL(14,2) DEFAULT 0,
  diferencia        DECIMAL(14,2) DEFAULT 0,
  resumen_ia        TEXT,
  creado_por        UUID REFERENCES usuarios(id),
  cerrado_por       UUID REFERENCES usuarios(id),
  cerrado_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- CONCILIACIÓN ÍTEMS
CREATE TABLE conciliacion_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id            UUID REFERENCES conciliacion_periodos(id),
  movimiento_id         UUID REFERENCES movimientos_bancarios(id),
  tipo_contraparte      VARCHAR(30) NOT NULL,
  contraparte_id        UUID NOT NULL,
  monto_movimiento      DECIMAL(14,2) NOT NULL,
  monto_documento       DECIMAL(14,2) NOT NULL,
  diferencia            DECIMAL(14,2) DEFAULT 0,
  metodo_conciliacion   VARCHAR(20),         -- automatico_ia | manual | sugerido_ia
  confianza_ia          DECIMAL(5,2),
  estado                VARCHAR(20) DEFAULT 'propuesto',
  notas                 TEXT,
  conciliado_por        UUID REFERENCES usuarios(id),
  conciliado_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- CAJA CHICA
CREATE TABLE cajas_chicas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            VARCHAR(200) NOT NULL,
  responsable_id    UUID REFERENCES trabajadores(id),
  monto_asignado    DECIMAL(14,2) NOT NULL,
  saldo_actual      DECIMAL(14,2) NOT NULL,
  umbral_reposicion DECIMAL(14,2),
  activa            BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE movimientos_caja_chica (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caja_id           UUID REFERENCES cajas_chicas(id),
  fecha             DATE NOT NULL,
  tipo              VARCHAR(20) NOT NULL,   -- gasto | reposicion
  concepto          TEXT NOT NULL,
  categoria         VARCHAR(50),
  monto             DECIMAL(14,2) NOT NULL,
  documento_url     VARCHAR(1000),
  numero_boleta     VARCHAR(50),
  proveedor         VARCHAR(300),
  rut_proveedor     VARCHAR(12),
  estado_concil     VARCHAR(30) DEFAULT 'pendiente',
  rendicion_id      UUID,
  registrado_por    UUID REFERENCES usuarios(id),
  aprobado_por      UUID REFERENCES usuarios(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rendiciones_caja_chica (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caja_id           UUID REFERENCES cajas_chicas(id),
  periodo_desde     DATE NOT NULL,
  periodo_hasta     DATE NOT NULL,
  monto_inicial     DECIMAL(14,2) NOT NULL,
  total_gastos      DECIMAL(14,2) NOT NULL,
  total_rechazado   DECIMAL(14,2) DEFAULT 0,
  monto_reposicion  DECIMAL(14,2),
  estado            VARCHAR(30) DEFAULT 'borrador',
  aprobado_por      UUID REFERENCES usuarios(id),
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ADELANTOS TRABAJADORES
CREATE TABLE adelantos_trabajadores (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trabajador_id             UUID REFERENCES trabajadores(id),
  tipo                      VARCHAR(30) NOT NULL,
  monto_total               DECIMAL(14,2) NOT NULL,
  monto_pendiente           DECIMAL(14,2) NOT NULL,
  cuotas                    INT DEFAULT 0,
  monto_cuota               DECIMAL(14,2),
  fecha_otorgamiento        DATE NOT NULL,
  fecha_primer_descuento    DATE,
  motivo                    TEXT,
  estado                    VARCHAR(30) DEFAULT 'pendiente_aprobacion',
  aprobado_por              UUID REFERENCES usuarios(id),
  metodo_pago_inicial       VARCHAR(20),
  movimiento_bancario_id    UUID REFERENCES movimientos_bancarios(id),
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pagos_adelanto (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adelanto_id       UUID REFERENCES adelantos_trabajadores(id),
  fecha             DATE NOT NULL,
  monto             DECIMAL(14,2) NOT NULL,
  tipo              VARCHAR(30) NOT NULL,
  movimiento_id     UUID REFERENCES movimientos_bancarios(id),
  periodo_remu      VARCHAR(7),             -- YYYY-MM
  estado_concil     VARCHAR(20) DEFAULT 'pendiente',
  notas             TEXT,
  registrado_por    UUID REFERENCES usuarios(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX idx_mov_ban_estado ON movimientos_bancarios(estado_concil);
CREATE INDEX idx_mov_ban_fecha ON movimientos_bancarios(fecha);
CREATE INDEX idx_mov_ban_cuenta ON movimientos_bancarios(cuenta_id);
CREATE INDEX idx_mov_ban_hash ON movimientos_bancarios(hash_unico);
CREATE INDEX idx_fact_sii_estado ON facturas_sii(estado_concil);
CREATE INDEX idx_fact_sii_rut_emisor ON facturas_sii(rut_emisor);
CREATE INDEX idx_fact_sii_fecha ON facturas_sii(fecha_emision);
CREATE INDEX idx_concil_periodo_cuenta ON conciliacion_periodos(cuenta_id);
CREATE INDEX idx_concil_items_movimiento ON conciliacion_items(movimiento_id);
CREATE INDEX idx_adelantos_trabajador ON adelantos_trabajadores(trabajador_id, estado);
```

---

## 10. API ENDPOINTS

```
-- Cuentas Bancarias
GET    /api/v1/fin/cuentas
POST   /api/v1/fin/cuentas
PATCH  /api/v1/fin/cuentas/:id
DELETE /api/v1/fin/cuentas/:id

-- Cartolas
GET    /api/v1/fin/cartolas
POST   /api/v1/fin/cartolas/upload          -- Multipart upload
GET    /api/v1/fin/cartolas/:id
GET    /api/v1/fin/cartolas/:id/movimientos
DELETE /api/v1/fin/cartolas/:id

-- Movimientos Bancarios
GET    /api/v1/fin/movimientos              -- Filtros: cuenta, fecha, estado, categoría
GET    /api/v1/fin/movimientos/:id
PATCH  /api/v1/fin/movimientos/:id          -- Actualizar categoría, estado
POST   /api/v1/fin/movimientos/:id/ignorar
POST   /api/v1/fin/movimientos/:id/excepcion

-- SII
GET    /api/v1/fin/sii/config
PUT    /api/v1/fin/sii/config               -- Guardar configuración + certificado
POST   /api/v1/fin/sii/sync                 -- Iniciar sincronización manual
GET    /api/v1/fin/sii/sync/:id             -- Estado del sync
GET    /api/v1/fin/sii/facturas             -- Filtros: tipo, direccion, estado, fecha
GET    /api/v1/fin/sii/facturas/:id

-- Conciliación
GET    /api/v1/fin/conciliacion/periodos
POST   /api/v1/fin/conciliacion/periodos    -- Crear período
GET    /api/v1/fin/conciliacion/periodos/:id
POST   /api/v1/fin/conciliacion/periodos/:id/ejecutar-ia  -- Correr motor IA
GET    /api/v1/fin/conciliacion/periodos/:id/sugerencias
POST   /api/v1/fin/conciliacion/items/:id/aceptar
POST   /api/v1/fin/conciliacion/items/:id/rechazar
POST   /api/v1/fin/conciliacion/items       -- Vincular manual
POST   /api/v1/fin/conciliacion/periodos/:id/cerrar
GET    /api/v1/fin/conciliacion/periodos/:id/informe-ia  -- Informe narrativo

-- Caja Chica
GET    /api/v1/fin/caja-chica
POST   /api/v1/fin/caja-chica
GET    /api/v1/fin/caja-chica/:id
GET    /api/v1/fin/caja-chica/:id/movimientos
POST   /api/v1/fin/caja-chica/:id/movimientos
POST   /api/v1/fin/caja-chica/:id/rendiciones
GET    /api/v1/fin/caja-chica/rendiciones/:id
POST   /api/v1/fin/caja-chica/rendiciones/:id/aprobar
POST   /api/v1/fin/caja-chica/rendiciones/:id/rechazar

-- Adelantos
GET    /api/v1/fin/adelantos
POST   /api/v1/fin/adelantos
GET    /api/v1/fin/adelantos/:id
POST   /api/v1/fin/adelantos/:id/aprobar
POST   /api/v1/fin/adelantos/:id/pagar
POST   /api/v1/fin/adelantos/:id/pagos     -- Registrar descuento/pago
GET    /api/v1/fin/adelantos/trabajador/:trabajador_id

-- Dashboard
GET    /api/v1/fin/dashboard                -- KPIs financieros generales
GET    /api/v1/fin/dashboard/flujo-caja     -- Flujo de caja del período
GET    /api/v1/fin/dashboard/pendientes     -- Resumen de pendientes de conciliación
```

---

## 11. AUTOMATIZACIONES Y ALERTAS

### 11.1 Triggers Automáticos

| Trigger | Acción | Destinatario |
|---------|--------|-------------|
| Cartola subida | Iniciar pipeline IA procesamiento | Sistema |
| Cartola procesada | Notificar resultado con resumen | Usuario que subió |
| Movimiento sin conciliar > 30 días | Alerta escalada | Contador / Admin |
| Factura SII vencida sin pago conciliado | Alerta de pago pendiente | Compras |
| Saldo caja chica < umbral | Notificar responsable para rendición | Responsable caja |
| Adelanto sin descuento en 2 períodos | Alerta | RRHH |
| Diferencia conciliación > 0 al cerrar | Bloquear cierre + alerta | Contador |
| Certificado SII vence en 30 días | Alerta para renovación | Admin |

### 11.2 Cron Jobs

| Frecuencia | Tarea |
|------------|-------|
| Diario 06:00 | Sync SII automático del mes en curso |
| Diario 07:00 | Detección de movimientos sin conciliar > 15 días |
| Lunes 08:00 | Resumen semanal de conciliación por cuenta |
| Día 25 de cada mes | Alerta de cierre de período mensual pendiente |
| Día 1 de cada mes | Auto-crear período mensual de conciliación |

### 11.3 Colas de Procesamiento

```
Colas BullMQ para módulo FIN:
├── fin-cartola-parse       (procesamiento IA de cartola subida)
├── fin-sii-sync            (sincronización con SII)
├── fin-conciliacion-ia     (motor de conciliación automática)
├── fin-informe-ia          (generación de informes narrativos IA)
└── fin-notificaciones-fin  (alertas y notificaciones financieras)
```

---

## 12. PERMISOS DEL MÓDULO

### 12.1 Roles con Acceso FIN

| Rol | Nivel de Acceso |
|-----|----------------|
| `SUPER_ADMIN` | Total |
| `ADMIN` | Total |
| `GERENTE` | Lectura total, aprobación adelantos |
| `CONTADOR` | *(nuevo rol sugerido)* CRUD total del módulo FIN |
| `JEFE_AREA` | Ver dashboard, aprobar caja chica de su área |
| `RRHH` | Ver y gestionar adelantos de trabajadores |
| `TESORERIA` | *(nuevo rol sugerido)* CRUD cartolas, cuentas, conciliación |
| `TRABAJADOR` | Ver solo sus propios adelantos |

### 12.2 Nuevo Rol: CONTADOR

```
Permisos exclusivos del rol CONTADOR:
- FIN.BAN: CRUD completo
- FIN.SII: sync, lectura, configurar
- FIN.CON: CRUD completo, cerrar períodos
- FIN.CAJ: CRUD completo, aprobar rendiciones
- FIN.ADL: lectura, conciliar pagos
- Exportar reportes financieros
- Ver libro de banco completo
```

### 12.3 Nuevo Rol: TESORERIA

```
Permisos del rol TESORERIA:
- FIN.BAN: subir cartolas, ver movimientos
- FIN.SII: ver facturas
- FIN.CON: ejecutar conciliación, proponer matches
- FIN.CAJ: registrar movimientos, solicitar rendiciones
- FIN.ADL: registrar pagos
```

---

## 13. DASHBOARD E INFORMES

### 13.1 Dashboard Principal FIN

```
┌─────────────────────────────────────────────────────────────────┐
│  RESUMEN FINANCIERO — Mayo 2026                                 │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│ Saldo Banco  │ Por Cobrar   │ Por Pagar    │ Caja Chica         │
│ $X.XXX.XXX   │ $X.XXX.XXX   │ $X.XXX.XXX   │ $XXX.XXX           │
│ ▲ +5% vs mes │ N facturas   │ N facturas   │ N fondos activos   │
└──────────────┴──────────────┴──────────────┴────────────────────┘

┌─────────────────────────────┐  ┌──────────────────────────────┐
│ CONCILIACIÓN MAYO 2026      │  │ ALERTAS                      │
│ ████████░░ 78% conciliado   │  │ ⚠ 3 facturas vencidas sin    │
│ Conciliados: $X.XXX.XXX     │  │   pago                       │
│ Pendientes:  $XXX.XXX       │  │ ⚠ Caja chica bajo umbral     │
│ [Ver detalle]               │  │ ℹ 2 adelantos por descontar  │
└─────────────────────────────┘  └──────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ANÁLISIS IA — Resumen del mes                                  │
│  "Este mes se registraron N movimientos bancarios por un total  │
│   de $X. La conciliación está al 78%. Los 3 movimientos sin     │
│   conciliar corresponden principalmente a transferencias sin    │
│   referencia identificable. Se recomienda contactar al          │
│   proveedor RUT XX.XXX.XXX-X para confirmar N° de factura."    │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 Informes Disponibles

| Informe | Descripción | Frecuencia |
|---------|-------------|------------|
| Libro de Banco | Todos los movimientos por cuenta y período | A demanda |
| Conciliación Bancaria | Detalle de conciliados vs pendientes | Mensual |
| Facturas por Cobrar | DTEs emitidos sin pago conciliado | A demanda |
| Facturas por Pagar | DTEs recibidos sin pago conciliado | A demanda |
| Libro de Compras SII | Formato compatible con SII | Mensual |
| Libro de Ventas SII | Formato compatible con SII | Mensual |
| Caja Chica | Historial y rendiciones por fondo | A demanda |
| Adelantos Trabajadores | Estado y saldos por trabajador | A demanda |
| Flujo de Caja | Proyección basada en histórico + IA | Semanal |
| Resumen Ejecutivo IA | Análisis narrativo del período | Mensual |

---

*Módulo FIN — ERP MAMKAM v1.0.0*  
*Especificación técnica inicial — sujeta a refinamiento durante desarrollo*
