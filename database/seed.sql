-- ============================================================
-- ERP MAMKAM - Datos de prueba (seed)
-- ============================================================

-- Usuarios (contraseña: admin123 / vendedor123)
-- bcrypt hash de "admin123" con salt rounds 10
insert into usuarios (email, nombre, rol, password_hash) values
  ('admin@mamkam.cl',    'Administrador MAMKAM', 'admin',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
  ('vendedor@mamkam.cl', 'Juan Pérez',           'vendedor', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
on conflict (email) do nothing;

-- Trabajadores
insert into trabajadores (nombre, rut, telefono, cargo, sueldo, fecha_ingreso, estado) values
  ('Pedro Martínez Silva',   '12.345.678-9', '+56912345678', 'Jefe de Obra',       1200000, '2022-03-15', 'activo'),
  ('Ana López Reyes',        '11.222.333-4', '+56923456789', 'Electricista',        850000, '2023-01-10', 'activo'),
  ('Carlos Soto Muñoz',      '13.444.555-6', '+56934567890', 'Pintor',              780000, '2022-08-20', 'activo'),
  ('María Fernández Torres', '14.555.666-7', '+56945678901', 'Administradora',     1050000, '2021-06-01', 'activo'),
  ('Juan Torres Lara',       '15.666.777-8', '+56956789012', 'Gasfíter',            820000, '2023-05-15', 'activo'),
  ('Rosa Contreras Pino',    '16.777.888-9', '+56967890123', 'Asistente Contable',  720000, '2022-11-30', 'inactivo')
on conflict (rut) do nothing;

-- Cotizaciones
insert into cotizaciones (numero, cliente, email, telefono, estado, total, observaciones) values
  ('COT-2024-0001', 'Constructora Aconcagua',  'compras@aconcagua.cl',   '+56222345678', 'aprobada',  1450000, 'Entrega en obra, coordinar con jefe de terreno'),
  ('COT-2024-0002', 'Santiago Castro',          'scastro@gmail.com',      '+56912345678', 'enviada',    890000, null),
  ('COT-2024-0003', 'Inversiones XYZ Ltda.',   'admin@xyz.cl',           '+56232345678', 'borrador',  2100000, 'Pendiente de revisión de precios'),
  ('COT-2024-0004', 'María González',           'mgonzalez@correo.cl',   '+56956789012', 'rechazada',  650000, 'Cliente solicitó cotizar más adelante'),
  ('COT-2024-0005', 'Hotel Premium Santiago',  'finanzas@hotelpremium.cl','+56223456789','aprobada',  3800000, 'Proyecto urgente, inicio inmediato')
on conflict (numero) do nothing;

-- Movimientos bancarios
insert into movimientos_bancarios (fecha, descripcion, tipo, monto, referencia, conciliado) values
  ('2024-05-02', 'Pago cotización COT-0001 - Constructora Aconcagua', 'abono', 1450000, 'TRF-2024-001', true),
  ('2024-05-05', 'Compra materiales Construmarket',                   'cargo',  320000, 'PAG-2024-001', true),
  ('2024-05-10', 'Abono parcial Hotel Premium Santiago',              'abono',  950000, 'TRF-2024-002', true),
  ('2024-05-12', 'Pago sueldos primera quincena',                     'cargo',  780000, 'PAG-2024-002', false),
  ('2024-05-15', 'Transferencia cliente Santiago Castro',             'abono',  445000, 'TRF-2024-003', false),
  ('2024-05-18', 'Pago factura Sodimac materiales eléctricos',        'cargo',  156000, 'PAG-2024-003', false);
