# MÓDULO CONT — CONTABILIDAD
**ERP MAMKAM — Especificación Técnica y Funcional**  
**Versión:** 1.0.0  
**Fecha:** 2026-05-19  
**Estado:** Definición Inicial  
**Marco Normativo:** IFRS / NIC adoptadas en Chile — Ley de Impuesto a la Renta — SII

---

## TABLA DE CONTENIDOS

1. [Visión General del Módulo](#1-visión-general-del-módulo)
2. [Plan de Cuentas](#2-plan-de-cuentas)
3. [Asientos Contables y Asientos Automáticos](#3-asientos-contables-y-asientos-automáticos)
4. [Libro Diario](#4-libro-diario)
5. [Libro Mayor](#5-libro-mayor)
6. [Gestión del IVA](#6-gestión-del-iva)
7. [Centralizaciones](#7-centralizaciones)
8. [Estados Financieros](#8-estados-financieros)
9. [Cierres Contables](#9-cierres-contables)
10. [Auditoría Contable](#10-auditoría-contable)
11. [Integración con Módulo FIN](#11-integración-con-módulo-fin)
12. [IA Contable](#12-ia-contable)
13. [Flujos Contables](#13-flujos-contables)
14. [Estados y Transiciones](#14-estados-y-transiciones)
15. [Base de Datos — Esquema Completo](#15-base-de-datos--esquema-completo)
16. [API Endpoints](#16-api-endpoints)
17. [Automatizaciones y Alertas](#17-automatizaciones-y-alertas)
18. [Permisos del Módulo](#18-permisos-del-módulo)

---

## 1. VISIÓN GENERAL DEL MÓDULO

### 1.1 Propósito

El módulo CONT implementa la contabilidad de partida doble completa del sistema ERP MAMKAM, integrada de forma nativa con todos los módulos operacionales. Recibe eventos contables automáticamente desde FIN (conciliación bancaria, facturas SII), OC, RH y COT, generando asientos sin intervención manual. La IA contable asiste en clasificación de cuentas, detección de errores, generación de estados financieros narrativos y alertas de inconsistencias.

### 1.2 Marco Normativo

| Norma | Aplicación |
|-------|-----------|
| **IFRS / NIC** | Base contable para presentación de estados financieros |
| **Decreto Ley 824** | Ley de Impuesto a la Renta Chile |
| **Decreto Ley 825** | Ley de IVA Chile (tasa 19%) |
| **Circular SII N°45** | Formato libro de compras y ventas |
| **NIC 1** | Presentación de estados financieros |
| **NIC 7** | Estado de flujos de efectivo |
| **NIC 12** | Impuesto a las ganancias |

### 1.3 Capacidades Principales

| Capacidad | Descripción |
|-----------|-------------|
| **Partida Doble** | Todo asiento cumple débito = crédito, validado en tiempo real |
| **Asientos Automáticos** | Eventos de FIN, OC, RH y COT generan asientos sin intervención |
| **Multi-período** | Gestión simultánea de períodos abiertos y cerrados |
| **Multi-moneda** | Registro en moneda extranjera con reexpresión automática |
| **Plan de Cuentas Flexible** | Jerarquía configurable hasta 6 niveles |
| **IVA Completo** | Débito, crédito fiscal, proporcionalidad, declaración F29 |
| **Estados Financieros IFRS** | Balance, EERR, Flujo de Caja, Cambios en Patrimonio |
| **Cierre Mensual/Anual** | Proceso controlado con reversiones automáticas |
| **IA Contable** | Clasificación, alertas, análisis y narrativas financieras |

### 1.4 Sub-módulos

```
CONT — Contabilidad
├── CONT.PUC  — Plan Único de Cuentas
├── CONT.DIA  — Libro Diario
├── CONT.MAY  — Libro Mayor
├── CONT.IVA  — Gestión IVA y Declaraciones
├── CONT.CEN  — Centralizaciones
├── CONT.BAL  — Balances y Estados Financieros
├── CONT.CIE  — Cierres Contables
└── CONT.AUD  — Auditoría Contable
```

### 1.5 Relaciones con Otros Módulos

```
FIN.SII  ──────▶ CONT  (facturas SII → asientos de compra/venta)
FIN.BAN  ──────▶ CONT  (conciliación bancaria → asientos de banco)
FIN.CAJ  ──────▶ CONT  (rendición caja chica → asientos de gastos)
FIN.ADL  ──────▶ CONT  (adelantos trabajadores → asientos de préstamos)
OC       ──────▶ CONT  (recepción OC → asiento de compra / cuentas x pagar)
COT      ──────▶ CONT  (factura emitida → asiento de venta / cuentas x cobrar)
RH       ──────▶ CONT  (liquidaciones → asiento de remuneraciones)
CONT     ──────▶ SII   (exporta F29, libros tributarios, F22)
```

---

## 2. PLAN DE CUENTAS

### 2.1 Estructura Jerárquica

El Plan Único de Cuentas (PUC) tiene hasta 6 niveles de profundidad:

```
CLASE (1 dígito)
  └── GRUPO (2 dígitos)
        └── CUENTA PRINCIPAL (4 dígitos)
              └── SUBCUENTA (6 dígitos)
                    └── AUXILIAR (8 dígitos)
                          └── DETALLE (10 dígitos)
```

**Ejemplo:**
```
1          → ACTIVO
1.1        → Activo Corriente
1.1.01     → Disponible
1.1.01.01  → Caja
1.1.01.02  → Banco (por cuenta bancaria)
1.1.01.02.01 → BancoEstado Cta. Cte. ****1234
```

### 2.2 Clases del Plan de Cuentas

| Clase | Código | Nombre | Naturaleza | EERR / Balance |
|-------|--------|--------|-----------|----------------|
| 1 | `1` | **ACTIVO** | Deudora | Balance |
| 2 | `2` | **PASIVO** | Acreedora | Balance |
| 3 | `3` | **PATRIMONIO** | Acreedora | Balance |
| 4 | `4` | **INGRESOS OPERACIONALES** | Acreedora | EERR |
| 5 | `5` | **COSTO DE VENTAS** | Deudora | EERR |
| 6 | `6` | **GASTOS OPERACIONALES** | Deudora | EERR |
| 7 | `7` | **INGRESOS NO OPERACIONALES** | Acreedora | EERR |
| 8 | `8` | **GASTOS NO OPERACIONALES** | Deudora | EERR |
| 9 | `9` | **CUENTAS DE ORDEN** | — | Fuera de balance |

### 2.3 Plan de Cuentas Base (PUC MAMKAM)

```
╔══════════════════════════════════════════════════════════════╗
║  CLASE 1 — ACTIVO                                            ║
╠══════════════════════════════════════════════════════════════╣
║  1.1   ACTIVO CORRIENTE                                      ║
║  1.1.01  Disponible                                          ║
║    1.1.01.01  Caja General                                   ║
║    1.1.01.02  Cajas Chicas                                   ║
║    1.1.01.03  Bancos (una subcuenta por cuenta bancaria)     ║
║  1.1.02  Inversiones Financieras Temporales                  ║
║    1.1.02.01  Depósitos a Plazo                              ║
║    1.1.02.02  Fondos Mutuos                                  ║
║  1.1.03  Deudores Comerciales y Otras CxC                    ║
║    1.1.03.01  Clientes Nacionales                            ║
║    1.1.03.02  Clientes Extranjeros                           ║
║    1.1.03.03  Documentos por Cobrar                          ║
║    1.1.03.04  Provisión Deudores Incobrables (-)             ║
║  1.1.04  IVA Crédito Fiscal                                  ║
║    1.1.04.01  IVA Crédito Fiscal del Período                 ║
║    1.1.04.02  IVA Crédito Fiscal Acumulado                   ║
║  1.1.05  Otros Activos Corrientes                            ║
║    1.1.05.01  Anticipo a Proveedores                         ║
║    1.1.05.02  Adelantos a Trabajadores                       ║
║    1.1.05.03  Gastos Pagados por Anticipado                  ║
║    1.1.05.04  Impuestos por Recuperar (PPM)                  ║
║  1.1.06  Existencias / Inventarios                           ║
║    1.1.06.01  Mercaderías                                    ║
║    1.1.06.02  Materias Primas                                ║
║    1.1.06.03  Productos en Proceso                           ║
║    1.1.06.04  Productos Terminados                           ║
║                                                              ║
║  1.2   ACTIVO NO CORRIENTE                                   ║
║  1.2.01  Propiedad, Planta y Equipo (PPE)                    ║
║    1.2.01.01  Terrenos                                       ║
║    1.2.01.02  Edificios y Construcciones                     ║
║    1.2.01.03  Maquinaria y Equipos                           ║
║    1.2.01.04  Vehículos                                      ║
║    1.2.01.05  Equipos de Computación                         ║
║    1.2.01.06  Mobiliario y Equipamiento                      ║
║    1.2.01.09  Depreciación Acumulada (-)                     ║
║  1.2.02  Activos Intangibles                                 ║
║    1.2.02.01  Software y Licencias                           ║
║    1.2.02.02  Marcas y Patentes                              ║
║    1.2.02.09  Amortización Acumulada (-)                     ║
║  1.2.03  Inversiones Permanentes                             ║
║  1.2.04  Activos por Impuesto Diferido                       ║
╠══════════════════════════════════════════════════════════════╣
║  CLASE 2 — PASIVO                                            ║
╠══════════════════════════════════════════════════════════════╣
║  2.1   PASIVO CORRIENTE                                      ║
║  2.1.01  Proveedores y CxP Comerciales                       ║
║    2.1.01.01  Proveedores Nacionales                         ║
║    2.1.01.02  Proveedores Extranjeros                        ║
║    2.1.01.03  Documentos por Pagar                           ║
║  2.1.02  IVA Débito Fiscal                                   ║
║    2.1.02.01  IVA Débito Fiscal del Período                  ║
║  2.1.03  Otros Impuestos por Pagar                           ║
║    2.1.03.01  PPM por Enterar                                ║
║    2.1.03.02  Impuesto de Primera Categoría                  ║
║    2.1.03.03  Retenciones por Pagar (honorarios)             ║
║  2.1.04  Remuneraciones y Previsión                          ║
║    2.1.04.01  Sueldos por Pagar                              ║
║    2.1.04.02  AFP por Pagar                                  ║
║    2.1.04.03  Isapre / Fonasa por Pagar                      ║
║    2.1.04.04  Vacaciones por Pagar (provisión)               ║
║    2.1.04.05  Gratificaciones por Pagar (provisión)          ║
║  2.1.05  Préstamos Bancarios CP                              ║
║  2.1.06  Porción CP de Deuda LP                              ║
║  2.1.07  Otros Pasivos Corrientes                            ║
║                                                              ║
║  2.2   PASIVO NO CORRIENTE                                   ║
║  2.2.01  Préstamos Bancarios LP                              ║
║  2.2.02  Leasing Financiero LP                               ║
║  2.2.03  Pasivos por Impuesto Diferido                       ║
║  2.2.04  Provisiones LP                                      ║
║    2.2.04.01  Provisión Indemnización por Años de Servicio   ║
╠══════════════════════════════════════════════════════════════╣
║  CLASE 3 — PATRIMONIO                                        ║
╠══════════════════════════════════════════════════════════════╣
║  3.1.01  Capital Pagado                                      ║
║  3.1.02  Reservas                                            ║
║  3.1.03  Utilidades Retenidas                                ║
║  3.1.04  Utilidad / Pérdida del Ejercicio                    ║
║  3.1.05  Otras Reservas (ORI — IFRS)                         ║
╠══════════════════════════════════════════════════════════════╣
║  CLASE 4 — INGRESOS OPERACIONALES                            ║
╠══════════════════════════════════════════════════════════════╣
║  4.1.01  Ventas de Bienes                                    ║
║  4.1.02  Ventas de Servicios                                 ║
║  4.1.03  Ventas Exentas de IVA                               ║
║  4.1.04  Descuentos y Devoluciones sobre Ventas (-)          ║
╠══════════════════════════════════════════════════════════════╣
║  CLASE 5 — COSTO DE VENTAS                                   ║
╠══════════════════════════════════════════════════════════════╣
║  5.1.01  Costo de Mercaderías Vendidas                       ║
║  5.1.02  Costo de Servicios Prestados                        ║
║  5.1.03  Mano de Obra Directa                                ║
╠══════════════════════════════════════════════════════════════╣
║  CLASE 6 — GASTOS OPERACIONALES                              ║
╠══════════════════════════════════════════════════════════════╣
║  6.1   GASTOS DE ADMINISTRACIÓN                              ║
║    6.1.01  Remuneraciones Administración                     ║
║    6.1.02  Honorarios                                        ║
║    6.1.03  Arriendos                                         ║
║    6.1.04  Servicios Básicos                                 ║
║    6.1.05  Comunicaciones y TI                               ║
║    6.1.06  Materiales y Útiles de Oficina                    ║
║    6.1.07  Seguros                                           ║
║    6.1.08  Depreciación y Amortización                       ║
║    6.1.09  Gastos de Representación                          ║
║    6.1.10  Movilización y Viáticos                           ║
║    6.1.11  Servicios Externos                                ║
║    6.1.99  Otros Gastos de Administración                    ║
║  6.2   GASTOS DE VENTAS                                      ║
║    6.2.01  Remuneraciones Ventas                             ║
║    6.2.02  Comisiones sobre Ventas                           ║
║    6.2.03  Publicidad y Marketing                            ║
║    6.2.04  Fletes y Distribución                             ║
╠══════════════════════════════════════════════════════════════╣
║  CLASE 7 — INGRESOS NO OPERACIONALES                         ║
╠══════════════════════════════════════════════════════════════╣
║  7.1.01  Intereses Ganados                                   ║
║  7.1.02  Diferencias de Cambio Favorables                    ║
║  7.1.03  Utilidad en Venta de Activos                        ║
║  7.1.04  Otros Ingresos Fuera de Explotación                 ║
╠══════════════════════════════════════════════════════════════╣
║  CLASE 8 — GASTOS NO OPERACIONALES                           ║
╠══════════════════════════════════════════════════════════════╣
║  8.1.01  Intereses y Gastos Financieros                      ║
║  8.1.02  Diferencias de Cambio Desfavorables                 ║
║  8.1.03  Pérdida en Venta de Activos                         ║
║  8.1.04  Impuesto de Primera Categoría                       ║
║  8.1.05  Gastos No Deducibles                                ║
╠══════════════════════════════════════════════════════════════╣
║  CLASE 9 — CUENTAS DE ORDEN                                  ║
╠══════════════════════════════════════════════════════════════╣
║  9.1.01  Bienes de Terceros en Custodia (Deudora)            ║
║  9.1.02  Bienes de Terceros en Custodia (Acreedora)          ║
║  9.1.03  Garantías Entregadas (Deudora)                      ║
║  9.1.04  Garantías Entregadas (Acreedora)                    ║
╚══════════════════════════════════════════════════════════════╝
```

### 2.4 Propiedades de una Cuenta

```
CuentaContable {
  codigo            VARCHAR     Ej: "1.1.03.01"
  nombre            VARCHAR     Ej: "Clientes Nacionales"
  nivel             INT         1-6
  clase             INT         1-9
  tipo              ENUM        activo | pasivo | patrimonio |
                                ingreso | costo | gasto | orden
  naturaleza        ENUM        deudora | acreedora
  permite_movimiento BOOLEAN    false en cuentas de grupo/clase
  requiere_centro_costo BOOLEAN
  requiere_proyecto BOOLEAN
  requiere_rut_tercero BOOLEAN  Para cuentas de clientes/proveedores
  moneda_extranjera BOOLEAN
  activa            BOOLEAN
  cuenta_padre_id   UUID
}
```

### 2.5 Centros de Costo

El plan de cuentas se complementa con centros de costo para análisis dimensional:

```
CentroCosto {
  codigo    VARCHAR   Ej: "ADM", "VTA", "OPS", "TI"
  nombre    VARCHAR
  activo    BOOLEAN
}
```

Toda cuenta de clase 5, 6 puede requerir centro de costo para distribución de gastos.

---

## 3. ASIENTOS CONTABLES Y ASIENTOS AUTOMÁTICOS

### 3.1 Estructura de un Asiento Contable

```
AsientoContable {
  numero          INT         Correlativo del período (Nro Asiento)
  periodo_id      UUID        FK → periodos_contables
  fecha           DATE        Fecha del hecho económico
  tipo            ENUM        (ver 3.2)
  origen          ENUM        manual | automatico
  modulo_origen   VARCHAR     FIN | OC | COT | RH | CONT
  referencia_id   UUID        ID en el módulo origen
  glosa           TEXT        Descripción del asiento
  moneda          VARCHAR     CLP | USD | EUR
  tipo_cambio     DECIMAL     Si moneda ≠ CLP
  total_debe      DECIMAL     Suma de líneas débito
  total_haber     DECIMAL     Suma de líneas crédito
  estado          ENUM        borrador | confirmado | anulado
  creado_por      UUID
  confirmado_por  UUID
  anulado_por     UUID
  asiento_reverso_id UUID     Si es reverso de otro asiento
}

LineaAsiento {
  asiento_id      UUID
  numero_linea    INT
  cuenta_id       UUID        FK → cuentas_contables
  centro_costo_id UUID        FK → centros_costo (opcional)
  proyecto_id     UUID        FK → proyectos (opcional)
  rut_tercero     VARCHAR     RUT cliente/proveedor (opcional)
  glosa           TEXT
  debe            DECIMAL     DEFAULT 0
  haber           DECIMAL     DEFAULT 0
  -- CHECK (debe >= 0 AND haber >= 0)
  -- CHECK (debe = 0 OR haber = 0)  -- no puede tener ambos
}
```

### 3.2 Tipos de Asiento

| Tipo | Código | Descripción | Origen |
|------|--------|-------------|--------|
| Apertura | `APE` | Asiento de apertura del ejercicio | Automático cierre |
| Venta | `VTA` | Factura de venta emitida | Automático COT/FIN.SII |
| Compra | `CMP` | Factura de compra recibida | Automático OC/FIN.SII |
| Banco | `BAN` | Movimiento bancario conciliado | Automático FIN.BAN |
| Caja | `CAJ` | Movimiento de caja chica | Automático FIN.CAJ |
| Remuneración | `REM` | Liquidación de sueldo | Automático RH |
| Honorario | `HON` | Boleta de honorarios | Automático FIN.SII |
| Depreciación | `DEP` | Depreciación/Amortización mensual | Automático cron |
| IVA | `IVA` | Declaración IVA F29 | Automático cierre mes |
| Provisión | `PRO` | Provisiones varias | Manual/Automático |
| Reverso | `REV` | Reverso de asiento anterior | Automático |
| Ajuste | `AJU` | Ajuste de fin de período | Manual |
| Cierre | `CIE` | Asiento de cierre anual | Automático cierre año |
| General | `GEN` | Asiento manual libre | Manual |

### 3.3 Asientos Automáticos por Evento

#### 3.3.1 Factura de Venta Emitida (COT → FIN.SII → CONT)

**Trigger:** Factura de venta sincronizada desde SII (tipo DTE 33 ó 34, dirección `emitida`)

```
ASIENTO TIPO: VTA
Glosa: "Factura N° {folio} — {razon_social_receptor}"

DEBE:
  1.1.03.01 Clientes Nacionales          $monto_total

HABER:
  4.1.01 Ventas de Bienes                $monto_neto
  2.1.02.01 IVA Débito Fiscal Período    $iva

── Si factura exenta (DTE 34):
DEBE:
  1.1.03.01 Clientes Nacionales          $monto_total
HABER:
  4.1.03 Ventas Exentas de IVA           $monto_total
```

#### 3.3.2 Nota de Crédito Emitida (DTE 61)

```
ASIENTO TIPO: VTA
Glosa: "Nota de Crédito N° {folio} — {razon_social_receptor}"

DEBE:
  4.1.04 Descuentos y Devoluciones s/Ventas  $monto_neto
  2.1.02.01 IVA Débito Fiscal Período         $iva

HABER:
  1.1.03.01 Clientes Nacionales               $monto_total
```

#### 3.3.3 Factura de Compra Recibida (OC → FIN.SII → CONT)

**Trigger:** Factura de compra sincronizada desde SII (tipo DTE 46, dirección `recibida`)

```
ASIENTO TIPO: CMP
Glosa: "Factura N° {folio} — {razon_social_emisor}"

DEBE:
  5.1.01 Costo de Mercaderías / 6.1.xx Gasto   $monto_neto
  1.1.04.01 IVA Crédito Fiscal del Período      $iva

HABER:
  2.1.01.01 Proveedores Nacionales               $monto_total

── La cuenta de débito (costo vs gasto) la sugiere la IA
   según la categoría del proveedor y la descripción de la factura
```

#### 3.3.4 Pago a Proveedor (FIN.BAN → CONT)

**Trigger:** Movimiento bancario conciliado con factura de compra

```
ASIENTO TIPO: BAN
Glosa: "Pago proveedor {razon_social} — {descripcion_movimiento}"

DEBE:
  2.1.01.01 Proveedores Nacionales    $monto_total

HABER:
  1.1.01.03.XX Banco {nombre}         $monto_total
```

#### 3.3.5 Cobro a Cliente (FIN.BAN → CONT)

**Trigger:** Movimiento bancario conciliado con factura de venta

```
ASIENTO TIPO: BAN
Glosa: "Cobro cliente {razon_social} — Fac. N° {folio}"

DEBE:
  1.1.01.03.XX Banco {nombre}     $monto_total

HABER:
  1.1.03.01 Clientes Nacionales   $monto_total
```

#### 3.3.6 Liquidación de Sueldo (RH → CONT)

**Trigger:** Liquidación mensual aprobada en módulo RH

```
ASIENTO TIPO: REM
Glosa: "Remuneraciones {mes/año} — {departamento}"

DEBE:
  6.1.01 Remuneraciones Administración   $sueldo_bruto_adm
  6.2.01 Remuneraciones Ventas           $sueldo_bruto_vta

HABER:
  2.1.04.02 AFP por Pagar                $total_afp
  2.1.04.03 Isapre/Fonasa por Pagar      $total_salud
  2.1.04.01 Sueldos por Pagar            $liquido_a_pagar

── Asiento de pago (al transferir sueldos):
DEBE:
  2.1.04.01 Sueldos por Pagar            $liquido_a_pagar
HABER:
  1.1.01.03.XX Banco                     $liquido_a_pagar
```

#### 3.3.7 Rendición de Caja Chica (FIN.CAJ → CONT)

**Trigger:** Rendición de caja chica aprobada

```
ASIENTO TIPO: CAJ
Glosa: "Rendición Caja Chica {nombre_caja} — {periodo}"

DEBE:
  6.1.XX [Cuenta de gasto según categoría]   $monto_gasto_1
  6.1.XX [Cuenta de gasto según categoría]   $monto_gasto_2
  ...

HABER:
  1.1.01.02 Cajas Chicas                     $total_gastos

── Reposición de caja:
DEBE:
  1.1.01.02 Cajas Chicas                     $monto_reposicion
HABER:
  1.1.01.03.XX Banco                         $monto_reposicion
```

#### 3.3.8 Adelanto a Trabajador (FIN.ADL → CONT)

```
ASIENTO TIPO: BAN
Glosa: "Adelanto trabajador {nombre} — {motivo}"

── Al otorgar el adelanto:
DEBE:
  1.1.05.02 Adelantos a Trabajadores    $monto_adelanto
HABER:
  1.1.01.03.XX Banco                    $monto_adelanto

── Al descontar en liquidación:
DEBE:
  2.1.04.01 Sueldos por Pagar           $monto_cuota
HABER:
  1.1.05.02 Adelantos a Trabajadores    $monto_cuota
```

#### 3.3.9 Depreciación Mensual (Automático Cron)

```
ASIENTO TIPO: DEP
Glosa: "Depreciación activos fijos {mes/año}"

DEBE:
  6.1.08 Depreciación y Amortización    $total_dep_mes
HABER:
  1.2.01.09 Depreciación Acumulada PPE  $dep_ppe
  1.2.02.09 Amortización Acumulada Int  $amort_int
```

#### 3.3.10 Boleta de Honorarios (FIN.SII → CONT)

```
ASIENTO TIPO: HON
Glosa: "Honorarios {nombre_prestador} — Boleta N° {folio}"

DEBE:
  6.1.02 Honorarios                     $monto_honorario
HABER:
  2.1.03.03 Retenciones por Pagar       $retencion_10pct
  2.1.01.01 Proveedores (honorarios)    $liquido_a_pagar
```

### 3.4 Reglas de Validación de Asientos

Todo asiento debe cumplir estas reglas antes de confirmarse:

```
1. PARTIDA DOBLE:     SUM(debe) = SUM(haber)  (diferencia máx: $1 por redondeo)
2. PERÍODO ABIERTO:   La fecha del asiento debe caer en un período no cerrado
3. CUENTAS ACTIVAS:   Todas las cuentas usadas deben estar activas
4. CUENTAS DETALLE:   Solo se puede imputar a cuentas con permite_movimiento = true
5. GLOSA OBLIGATORIA: Tanto en cabecera como en cada línea
6. LÍNEAS MÍNIMAS:    Al menos 2 líneas (una débito, una crédito)
7. MONTOS POSITIVOS:  debe >= 0 AND haber >= 0 en cada línea
8. EXCLUSIÓN MUST/HAB: Cada línea solo puede tener debe > 0 OR haber > 0, no ambos
```

---

## 4. LIBRO DIARIO

### 4.1 Definición

El Libro Diario es el registro cronológico de todos los asientos contables del período. En ERP MAMKAM, el libro diario es la vista filtrada y ordenada de la tabla `asientos_contables` con sus líneas.

### 4.2 Vista del Libro Diario

```
LIBRO DIARIO
Período: Mayo 2026 | Empresa: MAMKAM SpA

N° Asiento  Fecha       Tipo  Cuenta          Glosa                    Debe        Haber
──────────────────────────────────────────────────────────────────────────────────────────
001/2026    01-05-2026  VTA   1.1.03.01       Factura 1001 - Cliente   1.190.000
                              4.1.01          Venta servicios                        1.000.000
                              2.1.02.01       IVA Débito Fiscal                        190.000
──────────────────────────────────────────────────────────────────────────────────────────
002/2026    02-05-2026  CMP   6.1.04          Fac. 456 - Proveedor       500.000
                              1.1.04.01       IVA Crédito Fiscal          95.000
                              2.1.01.01       Proveedores                             595.000
──────────────────────────────────────────────────────────────────────────────────────────
                                              TOTALES DEL PERÍODO:     1.785.000   1.785.000
```

### 4.3 Filtros del Libro Diario

| Filtro | Descripción |
|--------|-------------|
| Período (mes/año) | Obligatorio |
| Rango de fechas | Opcional, dentro del período |
| Tipo de asiento | VTA, CMP, BAN, REM, etc. |
| Número de asiento | Búsqueda por número correlativo |
| Cuenta contable | Muestra solo asientos que tocan esa cuenta |
| Centro de costo | Filtra por dimensión |
| Estado | Borrador / Confirmado / Anulado |
| Origen | Manual / Automático |
| Módulo origen | FIN / OC / RH / COT |

### 4.4 Numeración de Asientos

- Formato: `{SECUENCIA}/{AÑO}` — Ej: `0142/2026`
- La secuencia es correlativa por empresa y año
- Al anular un asiento, su número queda reservado (no se reutiliza)
- Los asientos anulados generan un asiento reverso con nuevo número

### 4.5 Exportación

El Libro Diario se puede exportar en:
- **Excel** (.xlsx) con formato estándar
- **PDF** firmado digitalmente
- **CSV** para importación en otros sistemas
- **XML SII** para cumplimiento tributario

---

## 5. LIBRO MAYOR

### 5.1 Definición

El Libro Mayor presenta el movimiento de cada cuenta contable por separado, mostrando débitos, créditos y saldo acumulado, en formato de "T" contable.

### 5.2 Vista del Libro Mayor

```
LIBRO MAYOR — Cuenta: 1.1.03.01 Clientes Nacionales
Período: Enero – Mayo 2026

Fecha       N° Asiento  Glosa                         Debe        Haber      Saldo
─────────────────────────────────────────────────────────────────────────────────────
01-01-2026  APE/2026    Saldo inicial                                        2.500.000
05-01-2026  012/2026    Factura 990 — Cliente ABC      1.190.000             3.690.000
15-01-2026  018/2026    Cobro Fac. 990 — Cliente ABC               1.190.000 2.500.000
02-02-2026  034/2026    Factura 991 — Cliente XYZ        595.000             3.095.000
...
                        SALDO AL 31-05-2026:            X.XXX.XXX  X.XXX.XXX 3.095.000
                        Naturaleza: DEUDORA
```

### 5.3 Balance de Comprobación (Balanza de Saldos)

El balance de comprobación muestra todas las cuentas con movimiento en el período:

```
BALANCE DE COMPROBACIÓN
Período: Mayo 2026

                          MOVIMIENTOS DEL MES        SALDOS ACUMULADOS
Cuenta          Nombre    Debe        Haber        Deudor      Acreedor
─────────────────────────────────────────────────────────────────────────
1.1.01.03  Banco BCI      5.000.000   3.000.000   15.000.000
1.1.03.01  Clientes       2.500.000   1.800.000    3.200.000
2.1.01.01  Proveedores      900.000   1.200.000                  800.000
2.1.02.01  IVA Débito          —       475.000                  475.000
1.1.04.01  IVA Crédito     225.000         —         225.000
4.1.01     Ventas               —     2.500.000                2.500.000
6.1.01     Remuneraciones  1.800.000       —       8.500.000
...
─────────────────────────────────────────────────────────────────────────
TOTALES:              XX.XXX.XXX  XX.XXX.XXX  XX.XXX.XXX  XX.XXX.XXX
                      ✓ Debe = Haber (partida doble verificada)
```

---

## 6. GESTIÓN DEL IVA

### 6.1 Estructura del IVA en Chile

| Concepto | Cuenta | Naturaleza |
|----------|--------|-----------|
| IVA Débito Fiscal (ventas) | 2.1.02.01 | Pasivo / Acreedora |
| IVA Crédito Fiscal (compras) | 1.1.04.01 | Activo / Deudora |
| IVA a Pagar neto | Débito − Crédito | Si débito > crédito |
| Remanente crédito | Crédito − Débito | Si crédito > débito |

**Tasa vigente:** 19% sobre monto neto afecto.

### 6.2 Determinación del IVA Mensual

```
AL CIERRE DE CADA MES:

IVA Débito Fiscal    = Σ IVA de facturas emitidas del período
IVA Crédito Fiscal   = Σ IVA de facturas recibidas del período

Si Débito > Crédito:
  IVA a Pagar = Débito − Crédito
  ASIENTO IVA:
    DEBE:  2.1.02.01 IVA Débito Fiscal   $debito
    HABER: 1.1.04.01 IVA Crédito Fiscal  $credito
    HABER: 2.1.03.01 PPM por Enterar     $ppm (si aplica)
    HABER: 2.1.07    IVA Neto a Pagar    $neto_a_pagar

Si Crédito > Débito:
  Remanente = Crédito − Débito (se arrastra al período siguiente)
  ASIENTO IVA:
    DEBE:  2.1.02.01 IVA Débito Fiscal   $debito
    HABER: 1.1.04.01 IVA Crédito Fiscal  $debito  (absorbe el débito)
    (el remanente queda en 1.1.04.02 IVA Crédito Acumulado)
```

### 6.3 Declaración F29 (Formulario 29 SII)

El sistema genera automáticamente los datos del F29 mensual:

```
F29 — Declaración Mensual de IVA y Retenciones

SECCIÓN IVA:
  Línea 1:  Débito Fiscal del período                     $XXX
  Línea 5:  Crédito Fiscal del período                    $XXX
  Línea 6:  Remanente crédito mes anterior                $XXX
  Línea 7:  Crédito fiscal total (5+6)                    $XXX
  Línea 39: Remanente crédito mes actual (7>1)            $XXX
  Línea 40: IVA determinado a pagar (1>7)                 $XXX

SECCIÓN RETENCIONES:
  Línea 50: Retención honorarios (10%)                    $XXX
  Línea 55: PPM (Pago Provisional Mensual)                $XXX

TOTAL A PAGAR:                                            $XXX
```

### 6.4 Proporcionalidad del IVA

Para empresas con operaciones afectas y exentas, el sistema calcula el factor de proporcionalidad:

```
Factor = Ventas Afectas / (Ventas Afectas + Ventas Exentas)
Crédito Recuperable = Crédito Fiscal Total × Factor
Crédito No Recuperable → Gasto (6.1.99)
```

### 6.5 IVA en Moneda Extranjera

Las facturas en USD o EUR se convierten al tipo de cambio del día de emisión para efectos tributarios. El sistema almacena tanto el monto original como el equivalente en CLP.

---

## 7. CENTRALIZACIONES

### 7.1 Definición

La centralización es el proceso de consolidar múltiples documentos del período en un único asiento contable resumen. En ERP MAMKAM, la centralización opera en dos modos:

| Modo | Descripción |
|------|-------------|
| **Documento a Documento** | Cada factura genera su propio asiento (default, máximo detalle) |
| **Centralizado Mensual** | Un asiento resumen por tipo de documento por mes |
| **Centralizado Semanal** | Un asiento resumen por semana |

El modo se configura por tipo de documento y por módulo.

### 7.2 Centralización de Ventas

```
CENTRALIZACIÓN MENSUAL DE VENTAS — Mayo 2026

Incluye: 45 facturas emitidas entre 01-05-2026 y 31-05-2026

ASIENTO CENTRALIZADOR VTA/MAY2026:
  Glosa: "Centralización ventas Mayo 2026 — 45 documentos"

  DEBE:
    1.1.03.01 Clientes Nacionales         $total_con_iva_afectas
    1.1.03.01 Clientes Nacionales         $total_exentas

  HABER:
    4.1.01 Ventas de Bienes/Servicios     $total_neto_afecto
    4.1.03 Ventas Exentas                 $total_exento
    2.1.02.01 IVA Débito Fiscal           $total_iva
```

### 7.3 Centralización de Compras

```
CENTRALIZACIÓN MENSUAL DE COMPRAS — Mayo 2026

Incluye: 28 facturas recibidas

ASIENTO CENTRALIZADOR CMP/MAY2026:
  DEBE:
    6.1.XX / 5.1.XX Gastos/Costos         $total_neto (por cuenta)
    1.1.04.01 IVA Crédito Fiscal          $total_iva

  HABER:
    2.1.01.01 Proveedores Nacionales      $total_con_iva
```

### 7.4 Centralización de Remuneraciones

```
CENTRALIZACIÓN REMUNERACIONES — Mayo 2026

ASIENTO:
  DEBE:
    6.1.01 Remuneraciones (por centro costo)  $sueldo_bruto
  HABER:
    2.1.04.02 AFP por Pagar                   $total_afp
    2.1.04.03 Isapre/Fonasa por Pagar         $total_salud
    2.1.03.03 Retenciones (impuesto único)    $impuesto_unico
    2.1.04.01 Sueldos por Pagar               $liquido_total
```

### 7.5 Libro de Centralizaciones

El sistema mantiene un registro de todas las centralizaciones emitidas:

```
CentralizacionRegistro {
  id              UUID
  tipo            VARCHAR     ventas | compras | remuneraciones | banco | etc.
  periodo_id      UUID
  modo            VARCHAR     documento | semanal | mensual
  fecha_desde     DATE
  fecha_hasta     DATE
  total_documentos INT
  asiento_id      UUID        Asiento generado
  generado_por    UUID
  created_at      TIMESTAMPTZ
}
```

---

## 8. ESTADOS FINANCIEROS

### 8.1 Balance General (Estado de Situación Financiera)

Generado bajo IFRS (NIC 1), con comparativo período anterior:

```
BALANCE GENERAL — MAMKAM SpA
Al 31 de Mayo 2026 (en CLP $)

                                          May-2026      Dic-2025
ACTIVOS
  ACTIVOS CORRIENTES
    Efectivo y Equivalentes             15.000.000    12.500.000
    Deudores Comerciales                 8.200.000     6.800.000
    IVA Crédito Fiscal                     450.000       320.000
    Otros Activos Corrientes               750.000       600.000
    TOTAL ACTIVOS CORRIENTES            24.400.000    20.220.000

  ACTIVOS NO CORRIENTES
    Propiedad, Planta y Equipo (neto)   12.500.000    13.200.000
    Activos Intangibles (neto)           1.800.000     2.100.000
    TOTAL ACTIVOS NO CORRIENTES         14.300.000    15.300.000

TOTAL ACTIVOS                           38.700.000    35.520.000

PASIVOS
  PASIVOS CORRIENTES
    Proveedores                          4.500.000     3.800.000
    IVA Débito Fiscal                      280.000       195.000
    Remuneraciones y Previsión           1.200.000     1.100.000
    Otros Pasivos Corrientes               350.000       290.000
    TOTAL PASIVOS CORRIENTES             6.330.000     5.385.000

  PASIVOS NO CORRIENTES
    Préstamos Bancarios LP               8.000.000     9.000.000
    TOTAL PASIVOS NO CORRIENTES          8.000.000     9.000.000

TOTAL PASIVOS                           14.330.000    14.385.000

PATRIMONIO
    Capital Pagado                      15.000.000    15.000.000
    Utilidades Retenidas                 6.000.000     4.500.000
    Utilidad del Ejercicio               3.370.000     1.635.000
TOTAL PATRIMONIO                        24.370.000    21.135.000

TOTAL PASIVOS + PATRIMONIO              38.700.000    35.520.000
```

### 8.2 Estado de Resultados (EERR)

```
ESTADO DE RESULTADOS — MAMKAM SpA
Período: Enero – Mayo 2026 (en CLP $)

                                        Ene-May 2026   Ene-May 2025
INGRESOS OPERACIONALES
  Ventas de Servicios                   45.000.000     38.000.000
  Ventas de Bienes                       8.500.000      7.200.000
  Descuentos sobre Ventas                 (250.000)      (180.000)
  INGRESOS OPERACIONALES NETOS          53.250.000     45.020.000

COSTO DE VENTAS
  Costo de Servicios                    18.000.000     15.500.000
  Costo de Bienes Vendidos               5.200.000      4.300.000
  TOTAL COSTO DE VENTAS                 23.200.000     19.800.000

MARGEN BRUTO                            30.050.000     25.220.000
  Margen Bruto %                             56,4%          56,0%

GASTOS OPERACIONALES
  Gastos de Administración              14.500.000     12.800.000
  Gastos de Ventas                       8.200.000      7.100.000
  Depreciación y Amortización            1.400.000      1.350.000
  TOTAL GASTOS OPERACIONALES            24.100.000     21.250.000

RESULTADO OPERACIONAL (EBIT)             5.950.000      3.970.000
  Margen EBIT %                              11,2%           8,8%

INGRESOS (GASTOS) NO OPERACIONALES
  Intereses Ganados                        120.000         85.000
  Gastos Financieros                      (480.000)      (520.000)
  Diferencias de Cambio (neto)             (30.000)        45.000
  TOTAL NO OPERACIONAL                    (390.000)      (390.000)

RESULTADO ANTES DE IMPUESTO              5.560.000      3.580.000
  Impuesto de Primera Categoría (27%)   (1.501.200)      (967.000)
  PPM acumulado                          (688.800)       (978.000)

RESULTADO NETO DEL PERÍODO               3.370.000      1.635.000
```

### 8.3 Estado de Flujo de Efectivo

Método indirecto (NIC 7):

```
ESTADO DE FLUJO DE EFECTIVO — MAMKAM SpA
Período: Enero – Mayo 2026

ACTIVIDADES DE OPERACIÓN
  Resultado del período                             3.370.000
  Ajustes por:
    Depreciación y amortización                     1.400.000
    Variación deudores comerciales                 (1.400.000)
    Variación proveedores                             700.000
    Variación IVA neto                               (115.000)
    Variación otros activos/pasivos corrientes         45.000
  FLUJO NETO ACTIVIDADES OPERACIÓN                 4.000.000

ACTIVIDADES DE INVERSIÓN
  Compra PPE                                         (700.000)
  FLUJO NETO ACTIVIDADES INVERSIÓN                   (700.000)

ACTIVIDADES DE FINANCIAMIENTO
  Pago de préstamos bancarios                      (1.000.000)
  FLUJO NETO ACTIVIDADES FINANCIAMIENTO            (1.000.000)

VARIACIÓN NETA EN EFECTIVO                          2.300.000
Saldo inicial efectivo (01-01-2026)                12.700.000
SALDO FINAL EFECTIVO (31-05-2026)                  15.000.000
```

### 8.4 Estado de Cambios en el Patrimonio

```
ESTADO DE CAMBIOS EN EL PATRIMONIO

                    Capital  Reservas  Ut. Ret.  Ut. Ejerc.  Total
Saldo 31-12-2025  15.000.000     —    4.500.000   1.635.000  21.135.000
Distribución ut.       —         —    1.635.000  (1.635.000)      —
Resultado período      —         —        —       3.370.000   3.370.000
Saldo 31-05-2026  15.000.000     —    6.135.000   3.370.000  24.505.000
```

### 8.5 Ratios Financieros Automáticos

El sistema calcula y monitorea automáticamente:

| Ratio | Fórmula | Alerta si |
|-------|---------|-----------|
| Liquidez Corriente | Activo Cte / Pasivo Cte | < 1.0 |
| Razón Ácida | (Activo Cte − Inventario) / Pasivo Cte | < 0.8 |
| Endeudamiento | Pasivo Total / Patrimonio | > 2.0 |
| Margen Bruto | Margen Bruto / Ingresos | < umbral config. |
| Margen EBIT | EBIT / Ingresos | Tendencia negativa |
| Rotación CxC | Ingresos / Deudores | Deterioro |
| Días de Cobro | (Deudores / Ventas) × 30 | > 60 días |
| Días de Pago | (Proveedores / Compras) × 30 | > 90 días |

---

## 9. CIERRES CONTABLES

### 9.1 Tipos de Cierre

| Tipo | Frecuencia | Descripción |
|------|-----------|-------------|
| **Cierre Mensual** | Mensual | Congela el período, genera resumen IVA, no más movimientos |
| **Pre-cierre Anual** | Anual | Ajustes finales antes del cierre definitivo |
| **Cierre Anual** | Anual | Cierre definitivo, traspasa resultado a patrimonio |

### 9.2 Proceso de Cierre Mensual

```
PROCESO: Cierre Mes Mayo 2026

PASO 1 — PRE-VALIDACIONES (automáticas)
  ☐ Todos los asientos en borrador están confirmados o eliminados
  ☐ Balance de comprobación cuadra (Debe = Haber)
  ☐ Conciliación bancaria FIN cerrada para el período
  ☐ No hay movimientos bancarios pendientes sin asiento
  ☐ IVA calculado y declaración F29 generada
  ☐ Rendiciones de caja chica del período cerradas

PASO 2 — DETERMINACIÓN IVA
  ☐ Consolidar IVA Débito vs Crédito del mes
  ☐ Generar asiento de determinación IVA (tipo IVA)
  ☐ Calcular y registrar PPM si aplica

PASO 3 — PROVISIONES AUTOMÁTICAS
  ☐ Generar asiento de depreciación del mes
  ☐ Provisión vacaciones (1/12 anual por trabajador)
  ☐ Provisión gratificaciones (si corresponde)
  ☐ Provisión indemnización por años de servicio

PASO 4 — CIERRE DEL PERÍODO
  ☐ Cambiar estado del período a "cerrado"
  ☐ Guardar saldos de cierre por cuenta
  ☐ Crear período siguiente como "abierto"
  ☐ Traspasar saldos de cuentas de balance al período siguiente
  ☐ Generar informe IA de cierre

RESULTADO:
  El período queda CERRADO — no se permiten más asientos en él
  Solo el SUPER_ADMIN o CONTADOR puede re-abrir un período cerrado
  (deja trazabilidad de auditoría con motivo obligatorio)
```

### 9.3 Proceso de Cierre Anual

```
PROCESO: Cierre Anual 2026

PASO 1 — PRE-CIERRE (diciembre, disponible todo el mes)
  ☐ Todos los meses del año cerrados
  ☐ Ajustes de valorización activos (si aplica IFRS)
  ☐ Reversión de provisiones que no correspondan
  ☐ Ajuste impuesto diferido

PASO 2 — CÁLCULO RESULTADO DEL EJERCICIO
  ☐ Consolidar todas las cuentas de resultado (clases 4-8)
  ☐ Resultado = Σ Ingresos (4,7) − Σ Costos/Gastos (5,6,8)
  ☐ Generar asiento de determinación resultado

PASO 3 — ASIENTO DE CIERRE ANUAL
  ASIENTO CIERRE:
  Glosa: "Cierre ejercicio 2026"

  Si Utilidad:
    DEBE:  4.1.01 Ventas              $ingresos
           7.1.01 Otros Ingresos      $otros_ing
    HABER: 5.1.01 Costo Ventas        $costos
           6.x.xx Gastos              $gastos
           8.x.xx Gastos No Op.       $gastos_no_op
           3.1.04 Utilidad Ejercicio  $resultado_neto

  Si Pérdida:
    (inverso — 3.1.04 queda con saldo deudor)

PASO 4 — ASIENTO DE APERTURA SIGUIENTE EJERCICIO
  ASIENTO APERTURA:
  Glosa: "Saldo inicial ejercicio 2027"
  Copia saldos de todas las cuentas de balance (clases 1, 2, 3)
  Traspasa Utilidad Ejercicio → Utilidades Retenidas

PASO 5 — BLOQUEO DEFINITIVO
  Año 2026 queda en estado "cerrado_definitivo"
  Solo accesible para consulta y reportes, no editable
  Registro inmutable en auditoría
```

### 9.4 Reversiones

Si se detecta un error en un período cerrado:

```
PROCESO DE REVERSIÓN:

1. Contador/Admin solicita re-apertura temporal del período
   → Requiere aprobación de GERENTE o ADMIN
   → Motivo obligatorio, queda en auditoría

2. Se registra la re-apertura con:
   - Usuario que solicita
   - Usuario que aprueba
   - Motivo
   - Timestamp

3. Se corrige el asiento o se genera asiento de corrección

4. Se vuelve a cerrar el período
   → Nuevo proceso de cierre completo
   → Informe de cambios respecto al cierre anterior

Alternativa sin re-apertura:
  Registrar asiento de corrección en el período actual
  con referencia al período corregido (preferred por auditoría)
```

---

## 10. AUDITORÍA CONTABLE

### 10.1 Trazabilidad Total

Cada acción sobre datos contables queda registrada:

```
AuditoriaContable {
  id              UUID        PK
  tabla           VARCHAR     asientos_contables | lineas_asiento | etc.
  registro_id     UUID        ID del registro afectado
  accion          VARCHAR     INSERT | UPDATE | DELETE | CONFIRM | CANCEL
                              | PERIOD_CLOSE | PERIOD_REOPEN
  datos_antes     JSONB       Estado anterior del registro
  datos_despues   JSONB       Estado posterior del registro
  usuario_id      UUID
  ip_address      INET
  justificacion   TEXT        Obligatorio en re-aperturas y anulaciones
  created_at      TIMESTAMPTZ
}
```

### 10.2 Reglas de Inmutabilidad

| Acción | Restricción |
|--------|-------------|
| Editar asiento confirmado | PROHIBIDO — solo anular y rehacer |
| Eliminar asiento | PROHIBIDO — solo anular (queda en historial) |
| Editar líneas de asiento confirmado | PROHIBIDO |
| Anular asiento de período cerrado | Requiere re-apertura + aprobación |
| Modificar plan de cuentas | Solo cuentas sin movimientos pueden eliminarse |
| Eliminar cuenta con movimientos | PROHIBIDO — solo desactivar |

### 10.3 Log de Acceso Contable

Adicionalmente al log de cambios, se registra cada consulta sensible:

```
AccesoContable {
  usuario_id      UUID
  accion          VARCHAR   ver_balance | exportar_eerr | ver_mayor | etc.
  parametros      JSONB     Filtros usados (período, cuenta, etc.)
  ip_address      INET
  created_at      TIMESTAMPTZ
}
```

### 10.4 Firmas Digitales de Documentos

Los reportes contables oficiales (balance, EERR, libro diario) llevan:
- Hash SHA256 del contenido en el momento de generación
- Timestamp de emisión
- Usuario que lo generó
- Número de versión del documento

Esto garantiza que los reportes no fueron alterados después de generados.

### 10.5 Alertas de Auditoría Automáticas

| Alerta | Condición |
|--------|-----------|
| Asiento muy grande | Asiento > 3x el promedio del período |
| Cuenta inusual | Asiento en cuenta con baja actividad histórica |
| Horario inusual | Asiento registrado fuera del horario laboral |
| Anulación masiva | Más de 3 asientos anulados en el día por el mismo usuario |
| Re-apertura de período | Cualquier re-apertura genera alerta a GERENTE y ADMIN |
| Descuadre detectado | Balance de comprobación descuadrado |
| Asiento sin referencia | Asiento manual sin glosa descriptiva |

---

## 11. INTEGRACIÓN CON MÓDULO FIN

### 11.1 Flujo de Datos FIN → CONT

```
FIN.SII (Factura recibida/emitida)
      │
      ├── Estado conciliación = "conciliada" ──▶ Genera asiento VTA o CMP
      │
      └── IA clasifica cuenta de costo/gasto ──▶ Propone cuenta 5.x o 6.x

FIN.BAN (Movimiento bancario conciliado)
      │
      ├── Conciliado con Factura Venta ──▶ Asiento BAN cobro
      ├── Conciliado con Factura Compra ──▶ Asiento BAN pago
      ├── Conciliado con Caja Chica ──▶ Asiento BAN reposición
      └── Conciliado con Adelanto ──▶ Asiento BAN adelanto/descuento

FIN.CAJ (Rendición caja chica aprobada)
      │
      └── Para cada gasto: genera línea en asiento centralizador CAJ

FIN.ADL (Adelanto otorgado / cuota descontada)
      │
      ├── Otorgado ──▶ Asiento BAN adelanto
      └── Descontado ──▶ Línea en asiento REM
```

### 11.2 Conciliación Contable-Bancaria

El sistema verifica la consistencia entre los registros contables y los bancarios:

```
VERIFICACIÓN DIARIA:
  Saldo cuenta 1.1.01.03.XX (Banco) en CONT
  debe coincidir con
  Saldo real en FIN.BAN para la misma cuenta

  Si difieren → Alerta automática al CONTADOR
  Causas comunes:
  - Movimiento conciliado en FIN pero asiento aún en borrador en CONT
  - Asiento anulado en CONT sin actualizar conciliación en FIN
  - Error de tipeo en monto
```

### 11.3 Centro de Costo desde FIN

Al generar asientos desde FIN, el sistema asigna centros de costo automáticamente:

| Origen del gasto | Centro de Costo asignado |
|-----------------|-------------------------|
| Factura con OC del área Administración | ADM |
| Factura con OC del área Ventas | VTA |
| Remuneraciones por departamento | Código del departamento |
| Caja chica por área | Área del responsable |
| Sin clasificación | `GEN` (General, requiere revisión) |

---

## 12. IA CONTABLE

### 12.1 Capacidades de IA en el Módulo CONT

| Función | Descripción |
|---------|-------------|
| **Clasificación de cuentas** | Sugiere cuenta de débito/crédito según descripción y contexto |
| **Clasificación de gastos** | Asigna cuenta de gasto 6.x a facturas de compra automáticamente |
| **Detección de anomalías** | Identifica asientos inusuales o inconsistentes |
| **Análisis de tendencias** | Detecta variaciones significativas respecto a períodos anteriores |
| **Narrativa financiera** | Genera texto explicativo de los estados financieros |
| **Asistente contable** | Chat para preguntas sobre el plan de cuentas y normativa |
| **Validación de asientos** | Detecta errores conceptuales antes de confirmar |
| **Proyecciones** | Estima resultado del ejercicio en base al histórico |

### 12.2 Clasificación Automática de Gastos

Cuando llega una factura de compra desde FIN.SII, la IA propone la cuenta de gasto:

```
PROMPT SISTEMA:
"Eres un contador chileno experto en IFRS y normativa SII.
 Dado el siguiente documento de compra, determina:
 1. La cuenta contable de débito más apropiada del plan de cuentas
 2. El centro de costo más probable
 3. Si es gasto deducible tributariamente (sí/no)
 4. Justificación en una línea

 REGLAS:
 - Usa solo cuentas del plan de cuentas proporcionado
 - Si tienes duda entre costo (5.x) y gasto (6.x), elige según si
   el bien/servicio es parte directa del producto vendido
 - Si es servicio de mantención de computadores → 6.1.05
 - Si es combustible de vehículo comercial → 6.2.04
 - Nunca uses cuentas de balance (1.x, 2.x, 3.x) como destino de gasto

 FACTURA:
 Proveedor: {razon_social}  RUT: {rut}
 Descripción: {descripcion_items}
 Monto neto: ${monto_neto}
 Historial compras anteriores al mismo proveedor: {historico}"
```

### 12.3 Detección de Anomalías

El motor de anomalías corre al confirmar cada asiento:

```
REGLAS DE DETECCIÓN:

1. MONTO INUSUAL:
   Asiento > percentil 95 del tipo de asiento en los últimos 12 meses
   → Alerta "Monto inusualmente alto para este tipo de operación"

2. CUENTA INUSUAL PARA EL PROVEEDOR:
   Proveedor X siempre va a cuenta 6.1.04 (servicios básicos)
   Nuevo asiento lo lleva a 6.1.09 (representación)
   → Alerta "Cuenta de gasto diferente a histórico del proveedor"

3. ASIENTO COMPENSATORIO:
   Débito y crédito en cuentas que se anulan entre sí sin movimiento real
   → Alerta "Posible asiento de compensación sin sustento"

4. PERÍODO INCORRECTO:
   Factura del mes anterior registrada en el mes actual
   → Alerta "La fecha del documento no corresponde al período"

5. DESCUADRE:
   SUM(debe) ≠ SUM(haber) (más de $1 de diferencia)
   → Error bloqueante, no permite confirmar
```

### 12.4 Narrativa Financiera IA

Al generar el balance o EERR, el sistema ofrece análisis en lenguaje natural:

```
PROMPT:
"Actúa como CFO de una empresa chilena. Analiza los siguientes
 estados financieros y genera:

 1. RESUMEN EJECUTIVO (3 párrafos):
    - Desempeño del período vs período anterior
    - Principales variaciones y sus causas probables
    - Situación financiera y de liquidez

 2. ALERTAS (bullet points):
    - Ratios que requieren atención
    - Tendencias preocupantes
    - Oportunidades identificadas

 3. RECOMENDACIONES (3 acciones concretas)

 DATOS:
 [Estados financieros en JSON]
 [Comparativo período anterior]
 [Ratios calculados]"
```

### 12.5 Asistente Contable (Chat)

El módulo incluye un asistente conversacional para el equipo contable:

```
Ejemplos de consultas soportadas:

"¿Cómo contabilizo una nota de crédito de un proveedor?"
→ El asistente explica el asiento y ofrece crearlo directamente

"¿Cuál es el saldo de la cuenta de clientes al cierre de abril?"
→ Consulta en tiempo real y muestra el saldo

"Muéstrame todos los asientos del proveedor RUT 76.XXX.XXX-X en mayo"
→ Filtra y presenta el detalle

"¿Cuánto IVA debo declarar este mes?"
→ Calcula y muestra el resumen F29

"¿Qué gastos no son deducibles tributariamente este año?"
→ Lista asientos en cuentas marcadas como no deducibles
```

---

## 13. FLUJOS CONTABLES

### 13.1 Flujo: Ciclo Venta Completo

```
[COTIZACIÓN ACEPTADA]
       │
       ▼
[FACTURA EMITIDA (DTE 33)]
  → SII recepciona y valida
       │
       ▼
[FIN.SII sincroniza factura]
       │
       ▼
[CONT genera ASIENTO VTA automático]
  DEBE:  Clientes        $total
  HABER: Ventas          $neto
  HABER: IVA Débito      $iva
       │
       ▼
[CLIENTE PAGA — movimiento bancario llega]
       │
       ▼
[FIN.CON concilia movimiento con factura]
       │
       ▼
[CONT genera ASIENTO BAN automático]
  DEBE:  Banco           $total
  HABER: Clientes        $total
       │
       ▼
[CUENTA CLIENTES queda en CERO para esta factura]
```

### 13.2 Flujo: Ciclo Compra Completo

```
[ORDEN DE COMPRA EMITIDA]
       │
       ▼
[PROVEEDOR EMITE FACTURA (DTE 46)]
  SII valida → FIN.SII sincroniza
       │
       ▼
[CONT genera ASIENTO CMP automático]
  DEBE:  Gasto/Costo     $neto   ← IA clasifica cuenta
  DEBE:  IVA Crédito     $iva
  HABER: Proveedores      $total
       │
       ▼
[EMPRESA PAGA — transferencia bancaria]
       │
       ▼
[FIN.CON concilia movimiento con factura]
       │
       ▼
[CONT genera ASIENTO BAN automático]
  DEBE:  Proveedores     $total
  HABER: Banco           $total
       │
       ▼
[CUENTA PROVEEDORES queda en CERO para esta factura]
```

### 13.3 Flujo: Cierre de Mes

```
[DÍA 1 DEL MES SIGUIENTE]
       │
       ▼
[USUARIO INICIA CIERRE MENSUAL]
       │
       ▼
[SISTEMA EJECUTA PRE-VALIDACIONES]
  ├── PASA → Continúa
  └── FALLA → Muestra lista de problemas pendientes
       │
       ▼
[ASIENTOS AUTOMÁTICOS DE CIERRE]
  ├── Depreciación del mes
  ├── Provisión vacaciones
  ├── Provisión gratificaciones
  └── Determinación IVA
       │
       ▼
[USUARIO REVISA Y CONFIRMA ASIENTOS]
       │
       ▼
[CIERRE DEL PERÍODO]
  - Estado período → "cerrado"
  - Saldos de cierre guardados
  - Nuevo período creado
       │
       ▼
[INFORME IA DE CIERRE GENERADO]
  - Resumen del mes
  - Variaciones relevantes
  - Alertas para el siguiente período
       │
       ▼
[EXPORTACIÓN F29 PARA DECLARACIÓN SII]
```

### 13.4 Flujo: Remuneraciones

```
[LIQUIDACIONES APROBADAS EN RH]
       │
       ▼
[CONT recibe evento de liquidaciones]
       │
       ▼
[IA clasifica por centro de costo]
  (según departamento del trabajador)
       │
       ▼
[GENERA ASIENTO REM centralizado]
  DEBE:  Remuneraciones ADM/VTA/OPS    $bruto_x_area
  HABER: AFP por Pagar                 $total_afp
  HABER: Isapre/Fonasa                 $total_salud
  HABER: Impuesto Único Ret.           $imp_unico
  HABER: Sueldos por Pagar             $liquido
       │
       ▼
[PAGO DE SUELDOS (transferencia bancaria)]
  FIN.BAN registra transferencias masivas
       │
       ▼
[CONT genera ASIENTO BAN de pago]
  DEBE:  Sueldos por Pagar             $liquido
  HABER: Banco                         $liquido
       │
       ▼
[PAGO PREVISIÓN (AFP, Salud, Impuesto)]
  Al pagar cada institución:
  DEBE:  AFP/Isapre/SII               $monto
  HABER: Banco                        $monto
```

---

## 14. ESTADOS Y TRANSICIONES

### 14.1 Estados: Período Contable

```
abierto ──▶ en_cierre ──▶ cerrado ──▶ cerrado_definitivo
                │               │
                └── (validación  └── re_abierto ──▶ cerrado
                     fallida)         (requiere aprobación,
                     vuelve a         solo en período no definitivo)
                     abierto
```

| Estado | Descripción | Permite nuevos asientos |
|--------|-------------|------------------------|
| `abierto` | Período activo, acepta movimientos | Sí |
| `en_cierre` | Proceso de cierre iniciado | Solo automáticos |
| `cerrado` | Cierre mensual completado | No |
| `re_abierto` | Re-apertura temporal aprobada | Sí (con auditoría) |
| `cerrado_definitivo` | Cierre anual, inmutable | No |

### 14.2 Estados: Asiento Contable

```
borrador ──▶ confirmado ──▶ [inmutable]
    │              │
    └── eliminado  └── anulado ──▶ [genera asiento reverso automático]
```

| Estado | Descripción | Editable |
|--------|-------------|---------|
| `borrador` | En preparación, no afecta libros | Sí |
| `confirmado` | Publicado en libros contables | No |
| `anulado` | Anulado, con asiento reverso | No |
| `eliminado` | Borrador eliminado antes de confirmar | — |

### 14.3 Estados: Declaración F29

| Estado | Descripción |
|--------|-------------|
| `calculando` | Sistema procesando datos del mes |
| `borrador` | Calculada, pendiente de revisión |
| `revisada` | Contador revisó, lista para pagar |
| `pagada` | Monto enterado al SII |
| `rectificada` | Re-declaración por corrección |

---

## 15. BASE DE DATOS — ESQUEMA COMPLETO

```sql
-- PERÍODOS CONTABLES
CREATE TABLE periodos_contables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes             INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio            INT NOT NULL,
  nombre          VARCHAR(20) NOT NULL,           -- Ej: "Mayo 2026"
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  estado          VARCHAR(30) DEFAULT 'abierto',
  cerrado_por     UUID REFERENCES usuarios(id),
  cerrado_at      TIMESTAMPTZ,
  reabierto_por   UUID REFERENCES usuarios(id),
  reabierto_at    TIMESTAMPTZ,
  motivo_reapertura TEXT,
  saldo_inicio    JSONB,                          -- {cuenta_id: saldo} al inicio
  saldo_fin       JSONB,                          -- {cuenta_id: saldo} al cierre
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (mes, anio)
);

-- PLAN DE CUENTAS
CREATE TABLE cuentas_contables (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                VARCHAR(20) UNIQUE NOT NULL,
  nombre                VARCHAR(300) NOT NULL,
  descripcion           TEXT,
  nivel                 INT NOT NULL CHECK (nivel BETWEEN 1 AND 6),
  clase                 INT NOT NULL CHECK (clase BETWEEN 1 AND 9),
  tipo                  VARCHAR(20) NOT NULL,
  naturaleza            VARCHAR(10) NOT NULL,     -- deudora | acreedora
  permite_movimiento    BOOLEAN DEFAULT false,
  requiere_centro_costo BOOLEAN DEFAULT false,
  requiere_rut_tercero  BOOLEAN DEFAULT false,
  requiere_proyecto     BOOLEAN DEFAULT false,
  es_moneda_extranjera  BOOLEAN DEFAULT false,
  es_tributaria         BOOLEAN DEFAULT true,     -- deducible tributariamente
  cuenta_padre_id       UUID REFERENCES cuentas_contables(id),
  activa                BOOLEAN DEFAULT true,
  cuenta_sii_codigo     VARCHAR(10),              -- código SII si aplica
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- CENTROS DE COSTO
CREATE TABLE centros_costo (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo    VARCHAR(20) UNIQUE NOT NULL,
  nombre    VARCHAR(200) NOT NULL,
  activo    BOOLEAN DEFAULT true
);

-- ASIENTOS CONTABLES
CREATE TABLE asientos_contables (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              INT NOT NULL,
  periodo_id          UUID REFERENCES periodos_contables(id),
  fecha               DATE NOT NULL,
  tipo                VARCHAR(5) NOT NULL,        -- VTA CMP BAN CAJ REM HON DEP IVA PRO REV AJU CIE APE GEN
  origen              VARCHAR(15) DEFAULT 'manual',
  modulo_origen       VARCHAR(10),               -- FIN OC COT RH CONT
  referencia_id       UUID,
  referencia_tipo     VARCHAR(50),               -- factura_sii | movimiento_bancario | etc.
  glosa               TEXT NOT NULL,
  moneda              VARCHAR(3) DEFAULT 'CLP',
  tipo_cambio         DECIMAL(10,4) DEFAULT 1,
  total_debe          DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_haber         DECIMAL(14,2) NOT NULL DEFAULT 0,
  estado              VARCHAR(15) DEFAULT 'borrador',
  asiento_origen_id   UUID REFERENCES asientos_contables(id),  -- si es reverso
  creado_por          UUID REFERENCES usuarios(id),
  confirmado_por      UUID REFERENCES usuarios(id),
  confirmado_at       TIMESTAMPTZ,
  anulado_por         UUID REFERENCES usuarios(id),
  anulado_at          TIMESTAMPTZ,
  motivo_anulacion    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (numero, periodo_id),
  CHECK (ABS(total_debe - total_haber) <= 1)     -- partida doble ±1 por redondeo
);

-- LÍNEAS DE ASIENTO
CREATE TABLE lineas_asiento (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asiento_id        UUID REFERENCES asientos_contables(id) ON DELETE CASCADE,
  numero_linea      INT NOT NULL,
  cuenta_id         UUID REFERENCES cuentas_contables(id),
  centro_costo_id   UUID REFERENCES centros_costo(id),
  rut_tercero       VARCHAR(12),
  nombre_tercero    VARCHAR(300),
  glosa             TEXT,
  debe              DECIMAL(14,2) NOT NULL DEFAULT 0,
  haber             DECIMAL(14,2) NOT NULL DEFAULT 0,
  debe_me           DECIMAL(14,2) DEFAULT 0,     -- moneda extranjera
  haber_me          DECIMAL(14,2) DEFAULT 0,
  CHECK (debe >= 0 AND haber >= 0),
  CHECK (NOT (debe > 0 AND haber > 0))           -- exclusión débito/crédito
);

-- SALDOS POR CUENTA (materialized, actualizado en cada asiento confirmado)
CREATE TABLE saldos_cuenta (
  cuenta_id     UUID REFERENCES cuentas_contables(id),
  periodo_id    UUID REFERENCES periodos_contables(id),
  saldo_inicial DECIMAL(14,2) DEFAULT 0,
  total_debe    DECIMAL(14,2) DEFAULT 0,
  total_haber   DECIMAL(14,2) DEFAULT 0,
  saldo_final   DECIMAL(14,2) GENERATED ALWAYS AS
                (saldo_inicial + total_debe - total_haber) STORED,
  PRIMARY KEY (cuenta_id, periodo_id)
);

-- GESTIÓN IVA
CREATE TABLE declaraciones_iva (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id              UUID REFERENCES periodos_contables(id) UNIQUE,
  iva_debito              DECIMAL(14,2) DEFAULT 0,
  iva_credito             DECIMAL(14,2) DEFAULT 0,
  remanente_anterior      DECIMAL(14,2) DEFAULT 0,
  iva_neto                DECIMAL(14,2),         -- debito - credito - remanente
  remanente_siguiente     DECIMAL(14,2) DEFAULT 0,
  ppm                     DECIMAL(14,2) DEFAULT 0,
  retenciones_honorarios  DECIMAL(14,2) DEFAULT 0,
  total_a_pagar           DECIMAL(14,2),
  estado                  VARCHAR(20) DEFAULT 'borrador',
  asiento_iva_id          UUID REFERENCES asientos_contables(id),
  pagado_at               TIMESTAMPTZ,
  pagado_por              UUID REFERENCES usuarios(id),
  folio_f29               VARCHAR(20),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ACTIVOS FIJOS (para depreciación automática)
CREATE TABLE activos_fijos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            VARCHAR(30) UNIQUE,
  descripcion       VARCHAR(300) NOT NULL,
  cuenta_id         UUID REFERENCES cuentas_contables(id),
  cuenta_dep_id     UUID REFERENCES cuentas_contables(id),
  fecha_adquisicion DATE NOT NULL,
  valor_adquisicion DECIMAL(14,2) NOT NULL,
  vida_util_meses   INT NOT NULL,
  valor_residual    DECIMAL(14,2) DEFAULT 0,
  dep_mensual       DECIMAL(14,2),               -- calculada: (valor - residual) / vida_util
  dep_acumulada     DECIMAL(14,2) DEFAULT 0,
  valor_libro       DECIMAL(14,2),
  estado            VARCHAR(20) DEFAULT 'activo',
  baja_fecha        DATE,
  baja_motivo       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- CENTRALIZACIONES
CREATE TABLE centralizaciones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo              VARCHAR(30) NOT NULL,
  periodo_id        UUID REFERENCES periodos_contables(id),
  modo              VARCHAR(20) NOT NULL,         -- documento | semanal | mensual
  fecha_desde       DATE NOT NULL,
  fecha_hasta       DATE NOT NULL,
  total_documentos  INT DEFAULT 0,
  asiento_id        UUID REFERENCES asientos_contables(id),
  generado_por      UUID REFERENCES usuarios(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ESTADOS FINANCIEROS GENERADOS
CREATE TABLE estados_financieros (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            VARCHAR(30) NOT NULL,           -- balance | eerr | flujo_caja | patrimonio
  periodo_id      UUID REFERENCES periodos_contables(id),
  periodo_comp_id UUID REFERENCES periodos_contables(id),  -- comparativo
  datos           JSONB NOT NULL,                 -- estructura del estado financiero
  narrativa_ia    TEXT,                           -- análisis generado por IA
  hash_contenido  VARCHAR(64),                    -- SHA256 para integridad
  generado_por    UUID REFERENCES usuarios(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- AUDITORIA CONTABLE
CREATE TABLE auditoria_contable (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla           VARCHAR(100) NOT NULL,
  registro_id     UUID NOT NULL,
  accion          VARCHAR(30) NOT NULL,
  datos_antes     JSONB,
  datos_despues   JSONB,
  usuario_id      UUID REFERENCES usuarios(id),
  ip_address      INET,
  justificacion   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- CONFIGURACIÓN CONTABLE
CREATE TABLE config_contable (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_caja_default         UUID REFERENCES cuentas_contables(id),
  cuenta_banco_default        UUID REFERENCES cuentas_contables(id),
  cuenta_clientes_default     UUID REFERENCES cuentas_contables(id),
  cuenta_proveedores_default  UUID REFERENCES cuentas_contables(id),
  cuenta_iva_debito           UUID REFERENCES cuentas_contables(id),
  cuenta_iva_credito          UUID REFERENCES cuentas_contables(id),
  cuenta_resultado            UUID REFERENCES cuentas_contables(id),
  tasa_iva                    DECIMAL(5,2) DEFAULT 19.00,
  tasa_ppm                    DECIMAL(5,2) DEFAULT 1.00,
  tasa_retencion_hon          DECIMAL(5,2) DEFAULT 10.00,
  modo_centralizacion         VARCHAR(20) DEFAULT 'documento',
  mes_inicio_ejercicio        INT DEFAULT 1,
  moneda_funcional            VARCHAR(3) DEFAULT 'CLP',
  norma_contable              VARCHAR(10) DEFAULT 'IFRS',
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES CLAVE
CREATE INDEX idx_asientos_periodo ON asientos_contables(periodo_id);
CREATE INDEX idx_asientos_fecha ON asientos_contables(fecha);
CREATE INDEX idx_asientos_tipo ON asientos_contables(tipo, estado);
CREATE INDEX idx_asientos_estado ON asientos_contables(estado);
CREATE INDEX idx_asientos_origen ON asientos_contables(modulo_origen, referencia_id);
CREATE INDEX idx_lineas_asiento ON lineas_asiento(asiento_id);
CREATE INDEX idx_lineas_cuenta ON lineas_asiento(cuenta_id);
CREATE INDEX idx_lineas_tercero ON lineas_asiento(rut_tercero);
CREATE INDEX idx_saldos_periodo ON saldos_cuenta(periodo_id);
CREATE INDEX idx_auditoria_tabla ON auditoria_contable(tabla, registro_id);
CREATE INDEX idx_activos_fijos_estado ON activos_fijos(estado);
```

---

## 16. API ENDPOINTS

```
-- Períodos Contables
GET    /api/v1/cont/periodos
POST   /api/v1/cont/periodos
GET    /api/v1/cont/periodos/:id
POST   /api/v1/cont/periodos/:id/iniciar-cierre
POST   /api/v1/cont/periodos/:id/confirmar-cierre
POST   /api/v1/cont/periodos/:id/reabrir

-- Plan de Cuentas
GET    /api/v1/cont/cuentas                        -- árbol completo
GET    /api/v1/cont/cuentas?nivel=4&activa=true    -- filtros
POST   /api/v1/cont/cuentas
GET    /api/v1/cont/cuentas/:id
PATCH  /api/v1/cont/cuentas/:id
DELETE /api/v1/cont/cuentas/:id                    -- solo si sin movimientos

-- Asientos Contables
GET    /api/v1/cont/asientos                       -- Filtros: periodo, tipo, estado, cuenta
POST   /api/v1/cont/asientos                       -- Crear borrador
GET    /api/v1/cont/asientos/:id
PATCH  /api/v1/cont/asientos/:id                   -- Solo borradores
POST   /api/v1/cont/asientos/:id/confirmar
POST   /api/v1/cont/asientos/:id/anular
POST   /api/v1/cont/asientos/ia/clasificar         -- IA sugiere cuentas para un doc

-- Libro Diario
GET    /api/v1/cont/libro-diario                   -- ?periodo=2026-05&tipo=VTA
GET    /api/v1/cont/libro-diario/exportar          -- PDF | Excel | CSV

-- Libro Mayor
GET    /api/v1/cont/libro-mayor/:cuenta_id         -- ?desde=2026-01&hasta=2026-05
GET    /api/v1/cont/libro-mayor/:cuenta_id/exportar

-- Balance de Comprobación
GET    /api/v1/cont/balance-comprobacion           -- ?periodo=2026-05
GET    /api/v1/cont/balance-comprobacion/exportar

-- IVA
GET    /api/v1/cont/iva/declaraciones
GET    /api/v1/cont/iva/declaraciones/:periodo_id
POST   /api/v1/cont/iva/declaraciones/:periodo_id/calcular
POST   /api/v1/cont/iva/declaraciones/:periodo_id/marcar-pagada
GET    /api/v1/cont/iva/declaraciones/:periodo_id/f29          -- Exporta datos F29

-- Centralizaciones
GET    /api/v1/cont/centralizaciones
POST   /api/v1/cont/centralizaciones/generar       -- {tipo, periodo_id, modo}
GET    /api/v1/cont/centralizaciones/:id

-- Estados Financieros
GET    /api/v1/cont/estados/balance-general        -- ?periodo=2026-05&comparativo=2025-12
GET    /api/v1/cont/estados/eerr                   -- ?desde=2026-01&hasta=2026-05
GET    /api/v1/cont/estados/flujo-caja
GET    /api/v1/cont/estados/cambios-patrimonio
GET    /api/v1/cont/estados/:tipo/exportar         -- PDF firmado
GET    /api/v1/cont/estados/:tipo/narrativa-ia     -- Análisis narrativo IA

-- Activos Fijos
GET    /api/v1/cont/activos-fijos
POST   /api/v1/cont/activos-fijos
PATCH  /api/v1/cont/activos-fijos/:id
POST   /api/v1/cont/activos-fijos/:id/dar-baja
GET    /api/v1/cont/activos-fijos/depreciacion     -- ?periodo=2026-05

-- Asistente IA
POST   /api/v1/cont/ia/chat                        -- Chat contable
POST   /api/v1/cont/ia/clasificar-factura          -- {factura_data} → {cuenta_sugerida}
GET    /api/v1/cont/ia/anomalias                   -- ?periodo=2026-05
GET    /api/v1/cont/ia/proyeccion                  -- Proyección EERR resto del año

-- Configuración
GET    /api/v1/cont/config
PUT    /api/v1/cont/config
```

---

## 17. AUTOMATIZACIONES Y ALERTAS

### 17.1 Triggers Automáticos

| Trigger | Acción Automática | Responsable |
|---------|-------------------|-------------|
| Factura SII conciliada (FIN) | Generar asiento VTA o CMP | Sistema |
| Movimiento bancario conciliado (FIN) | Generar asiento BAN | Sistema |
| Rendición caja chica aprobada (FIN) | Generar asiento CAJ | Sistema |
| Adelanto pagado (FIN) | Generar asiento BAN adelanto | Sistema |
| Liquidaciones aprobadas (RH) | Generar asiento REM | Sistema |
| Período abierto (día 1 del mes) | Crear nuevo período, traspasar saldos | Sistema |
| Asiento generado con descuadre | Alerta bloqueante + log | Sistema |
| Asiento en cuenta inusual | Alerta al Contador | Sistema |
| Período sin cierre (día 10 del mes sig.) | Recordatorio al Contador | Sistema |

### 17.2 Cron Jobs Contables

| Frecuencia | Tarea |
|------------|-------|
| Diario 01:00 | Generar asiento de depreciación del mes (si no existe) |
| Diario 02:00 | Verificar consistencia saldo banco CONT vs FIN |
| Diario 07:00 | Alertas de anomalías detectadas en el día anterior |
| Día 1 del mes | Crear período del mes, traspasar saldos |
| Día 5 del mes | Recordatorio: cerrar período anterior |
| Día 12 del mes | Calcular automáticamente declaración IVA del mes anterior |
| Día 20 del mes | Alerta si F29 no ha sido marcada como pagada |
| Mensual día 1 | Provisión automática vacaciones y gratificaciones |

### 17.3 Alertas Contables

| Alerta | Condición | Destinatario |
|--------|-----------|-------------|
| Descuadre en asiento | SUM(debe) ≠ SUM(haber) | Bloqueante (no se guarda) |
| Período sin cerrar > 15 días | Estado "abierto" después del día 15 del mes sig. | Contador + Admin |
| IVA a pagar > umbral configurado | Monto F29 supera X | Gerente + Contador |
| Gasto inusual detectado | Asiento > 3x promedio histórico | Contador |
| Cuenta banco descuadrada | Saldo CONT ≠ saldo FIN.BAN | Contador |
| Activo fijo totalmente depreciado | valor_libro = 0 | Contador |
| Balance negativo en cuenta de activo | Saldo deudor en cuenta acreedora | Contador (error probable) |
| Re-apertura de período cerrado | Cualquier re-apertura | Gerente + Admin |

### 17.4 Colas de Procesamiento

```
Colas BullMQ para módulo CONT:
├── cont-asientos-automaticos  (generación de asientos desde otros módulos)
├── cont-depreciacion          (cálculo y asiento de depreciación mensual)
├── cont-iva-calculo           (determinación IVA mensual)
├── cont-estados-financieros   (generación de EERR, balance, etc.)
├── cont-ia-clasificacion      (clasificación IA de cuentas)
└── cont-alertas               (detección y envío de alertas)
```

---

## 18. PERMISOS DEL MÓDULO

### 18.1 Roles con Acceso CONT

| Rol | Nivel de Acceso |
|-----|----------------|
| `SUPER_ADMIN` | Total, incluyendo re-apertura definitiva |
| `ADMIN` | Total excepto re-apertura definitiva |
| `GERENTE` | Lectura total: libros, estados financieros, ratios |
| `CONTADOR` | CRUD completo del módulo, cierre de períodos, asientos manuales |
| `TESORERIA` | Ver libros, ver estados financieros, sin asientos manuales |
| `RRHH` | Ver asientos de remuneraciones propios del módulo RH |
| `JEFE_AREA` | Ver estados financieros de su área/centro de costo |
| `TRABAJADOR` | Sin acceso al módulo CONT |

### 18.2 Matriz de Permisos CONT

| Acción | SUPER_ADMIN | ADMIN | GERENTE | CONTADOR | TESORERIA | JEFE_AREA |
|--------|:-----------:|:-----:|:-------:|:--------:|:---------:|:---------:|
| Ver Libro Diario | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Ver Libro Mayor | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Ver Balance Comprobación | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Ver Estados Financieros | ✓ | ✓ | ✓ | ✓ | ✓ | parcial |
| Crear Asiento Manual | ✓ | ✓ | — | ✓ | — | — |
| Confirmar Asiento | ✓ | ✓ | — | ✓ | — | — |
| Anular Asiento | ✓ | ✓ | — | ✓ | — | — |
| Cerrar Período | ✓ | ✓ | — | ✓ | — | — |
| Re-abrir Período Cerrado | ✓ | ✓ | — | — | — | — |
| Gestionar Plan de Cuentas | ✓ | ✓ | — | ✓ | — | — |
| Ver IVA / F29 | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Marcar F29 Pagada | ✓ | ✓ | — | ✓ | ✓ | — |
| Exportar Reportes | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Config Contable | ✓ | ✓ | — | ✓ | — | — |
| Ver Auditoría Contable | ✓ | ✓ | — | ✓ | — | — |
| Gestionar Activos Fijos | ✓ | ✓ | — | ✓ | — | — |
| Chat IA Contable | ✓ | ✓ | ✓ | ✓ | ✓ | — |

### 18.3 Separación de Funciones (SOD)

Para cumplir con controles internos básicos:

| Incompatibilidad | Descripción |
|-----------------|-------------|
| Crear asiento + Aprobar mismo asiento | El mismo usuario no puede crear Y confirmar un asiento > $5.000.000 |
| Registrar pago + Conciliar banco | En empresas grandes, roles TESORERIA y CONTADOR deben ser personas distintas |
| Gestionar plan de cuentas + Registrar asientos en esas cuentas | Alerta (no bloqueo) si el mismo usuario hace ambas acciones el mismo día |

---

*Módulo CONT — ERP MAMKAM v1.0.0*  
*Especificación técnica inicial — sujeta a refinamiento durante desarrollo*  
*Marco normativo: IFRS / NIC adoptadas en Chile | Ley de Impuesto a la Renta | Ley de IVA*
