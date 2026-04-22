// Mock data para Tratto — CRM B2B mexicano
// Oportunidades con sub-items (productos de cotización) para mostrar knowledge graph

const ETAPAS = {
  nueva:      { label: 'Nueva',       dot: 'var(--stage-new)'   },
  cotizacion: { label: 'Cotización',  dot: 'var(--stage-quote)' },
  presentada: { label: 'Presentada',  dot: 'var(--stage-sent)'  },
  negociacion:{ label: 'Negociación', dot: 'var(--stage-neg)'   },
  cerrada:    { label: 'Cerrada',     dot: 'var(--stage-won)'   },
  perdida:    { label: 'Perdida',     dot: 'var(--stage-lost)'  },
};

const RESPONSABLES = [
  { id: 'ep', nombre: 'Efraín Ponce',    inicial: 'EP', tono: '#c2410c' },
  { id: 'ml', nombre: 'María López',     inicial: 'ML', tono: '#0891b2' },
  { id: 'jr', nombre: 'Jorge Ramírez',   inicial: 'JR', tono: '#7c3aed' },
  { id: 'am', nombre: 'Ana Medina',      inicial: 'AM', tono: '#16a34a' },
];

// Productos del catálogo (para sub-items de cotización)
const CATALOGO = [
  { sku: 'UNI-POL-NVY', nombre: 'Polo institucional azul marino',   precio: 285,   unidad: 'pieza' },
  { sku: 'UNI-PAN-GRS', nombre: 'Pantalón gabardina gris',          precio: 420,   unidad: 'pieza' },
  { sku: 'UNI-CHA-RFL', nombre: 'Chamarra reflectante industrial',  precio: 1180,  unidad: 'pieza' },
  { sku: 'UNI-BOT-SEG', nombre: 'Bota de seguridad punta acero',    precio: 890,   unidad: 'par'   },
  { sku: 'UNI-CAS-BLA', nombre: 'Casco blanco ANSI Z89.1',          precio: 340,   unidad: 'pieza' },
  { sku: 'MED-KIT-BAS', nombre: 'Kit primeros auxilios básico',     precio: 650,   unidad: 'kit'   },
  { sku: 'MED-MAS-N95', nombre: 'Mascarilla N95 (caja 20)',         precio: 480,   unidad: 'caja'  },
  { sku: 'OFI-MOC-EJE', nombre: 'Mochila ejecutiva institucional',  precio: 560,   unidad: 'pieza' },
  { sku: 'OFI-GOR-LOG', nombre: 'Gorra bordada con logo',           precio: 180,   unidad: 'pieza' },
  { sku: 'OFI-PLA-ID',  nombre: 'Placa de identificación',          precio: 95,    unidad: 'pieza' },
];

// Ayudante: genera sub-items de productos para una cotización
function makeSubitems(n, seed) {
  const out = [];
  let used = new Set();
  for (let i = 0; i < n; i++) {
    let idx = (seed * 7 + i * 3) % CATALOGO.length;
    while (used.has(idx)) idx = (idx + 1) % CATALOGO.length;
    used.add(idx);
    const prod = CATALOGO[idx];
    const cant = 10 + ((seed + i) * 13) % 240;
    out.push({ ...prod, cantidad: cant, subtotal: prod.precio * cant });
  }
  return out;
}

const INSTITUCIONES = {
  PEMEX:    { nombre: 'PEMEX',                            tipo: 'Paraestatal',          siglas: 'PEM' },
  CFE:      { nombre: 'Comisión Federal de Electricidad', tipo: 'Paraestatal',          siglas: 'CFE' },
  UNAM:     { nombre: 'Universidad Nacional Autónoma',    tipo: 'Universidad pública',  siglas: 'UAM' },
  IPN:      { nombre: 'Instituto Politécnico Nacional',   tipo: 'Universidad pública',  siglas: 'IPN' },
  ISSSTE:   { nombre: 'ISSSTE',                           tipo: 'Salud pública',        siglas: 'ISS' },
  SEP:      { nombre: 'Secretaría de Educación Pública',  tipo: 'Secretaría',           siglas: 'SEP' },
  CEMEX:    { nombre: 'CEMEX',                            tipo: 'Corporativo',          siglas: 'CMX' },
  BBVA:     { nombre: 'BBVA México',                      tipo: 'Banca',                siglas: 'BBV' },
  FEMSA:    { nombre: 'FEMSA',                            tipo: 'Corporativo',          siglas: 'FEM' },
  TEC:      { nombre: 'Tec de Monterrey',                 tipo: 'Universidad privada',  siglas: 'TEC' },
  HOSP_AB:  { nombre: 'Hospital Ángeles del Pedregal',    tipo: 'Hospital privado',     siglas: 'HAP' },
  SEGGOB:   { nombre: 'Secretaría de Seguridad Pública',  tipo: 'Secretaría',           siglas: 'SSP' },
};

const CONTACTOS = [
  { id: 'c1',  nombre: 'Ana Sofía González',  puesto: 'Dir. Compras',     institucion: 'PEMEX',   tel: '55 4521 8800', mail: 'asgonzalez@pemex.mx' },
  { id: 'c2',  nombre: 'Jorge Luis Ramírez',  puesto: 'Gte. Adquisiciones', institucion: 'CEMEX', tel: '81 8888 4400', mail: 'jramirez@cemex.com' },
  { id: 'c3',  nombre: 'Gabriela Mendoza',    puesto: 'Coord. Suministros', institucion: 'UNAM',  tel: '55 5622 1000', mail: 'gmendoza@unam.mx' },
  { id: 'c4',  nombre: 'Ricardo Jiménez M.',  puesto: 'Jefe de Uniformes',  institucion: 'CFE',   tel: '55 5229 4400', mail: 'rjimenez@cfe.mx' },
  { id: 'c5',  nombre: 'Fernanda Ruiz Fuentes',puesto: 'Dir. Procurement',  institucion: 'BBVA',  tel: '55 5226 2663', mail: 'fruiz@bbva.com' },
  { id: 'c6',  nombre: 'Diego Navarro Robles', puesto: 'Coord. Materiales', institucion: 'IPN',   tel: '55 5729 6000', mail: 'dnavarro@ipn.mx' },
  { id: 'c7',  nombre: 'María Rodríguez López',puesto: 'Jefa de Compras',   institucion: 'UNAM',  tel: '55 5622 1001', mail: 'mrodriguez@unam.mx' },
  { id: 'c8',  nombre: 'Roberto Sánchez R.',   puesto: 'Rector Adjunto',    institucion: 'TEC',   tel: '81 8358 2000', mail: 'rsanchez@tec.mx' },
  { id: 'c9',  nombre: 'Patricia Flores Díaz', puesto: 'Oficial Mayor',     institucion: 'SEGGOB',tel: '55 1103 6000', mail: 'pflores@ssp.gob.mx' },
  { id: 'c10', nombre: 'Fernando Ortiz Vega',  puesto: 'Gte. Operaciones',  institucion: 'CFE',   tel: '55 5229 4401', mail: 'fortiz@cfe.mx' },
  { id: 'c11', nombre: 'Daniela Vargas Romero',puesto: 'Dir. Compras',      institucion: 'FEMSA', tel: '81 8328 6000', mail: 'dvargas@femsa.com' },
  { id: 'c12', nombre: 'Héctor Domínguez',     puesto: 'Subsecretario',     institucion: 'SEP',   tel: '55 3601 1000', mail: 'hdominguez@sep.gob.mx' },
  { id: 'c13', nombre: 'Claudia Rivera Campos',puesto: 'Jefa Adquisiciones',institucion: 'ISSSTE',tel: '55 5140 9617', mail: 'crivera@issste.gob.mx' },
  { id: 'c14', nombre: 'Carlos Hernández',     puesto: 'Dir. Administración',institucion: 'HOSP_AB',tel: '55 5449 5500', mail: 'chernandez@angeles.com' },
  { id: 'c15', nombre: 'Laura Martínez Torres',puesto: 'Gte. Compras',      institucion: 'HOSP_AB',tel: '55 5449 5501', mail: 'lmartinez@angeles.com' },
  { id: 'c16', nombre: 'Miguel Ángel Herrera', puesto: 'Coord. Clínico',    institucion: 'HOSP_AB',tel: '55 5449 5502', mail: 'mherrera@angeles.com' },
  { id: 'c17', nombre: 'Valeria Castro Medina',puesto: 'Oficial Compras',   institucion: 'SEP',   tel: '55 3601 1001', mail: 'vcastro@sep.gob.mx' },
  { id: 'c18', nombre: 'Alejandro Morales',    puesto: 'Dir. Campus',       institucion: 'TEC',   tel: '81 8358 2001', mail: 'amorales@tec.mx' },
  { id: 'c19', nombre: 'Mónica Espinoza',      puesto: 'Gte. Adquisiciones',institucion: 'FEMSA', tel: '81 8328 6001', mail: 'mespinoza@femsa.com' },
];

const OPORTUNIDADES = [
  { id: '83571326', nombre: 'Contrato 2026',           institucion: 'PEMEX',   etapa: 'nueva',       responsable: 'ep', fecha: '24 abr 2026', contactoId: 'c1',  monto: 285000,   cotId: null,         creado: '12 abr 2026', seed: 1 },
  { id: '36189376', nombre: 'Licitación Q2',           institucion: 'CEMEX',   etapa: 'cotizacion',  responsable: 'ep', fecha: '28 abr 2026', contactoId: 'c2',  monto: 450000,   cotId: 'COT-0241',    creado: '10 abr 2026', seed: 2 },
  { id: '22109672', nombre: 'Renovación anual',        institucion: 'UNAM',    etapa: 'presentada',  responsable: 'ml', fecha: '02 may 2026', contactoId: 'c3',  monto: 125000,   cotId: 'COT-0238',    creado: '05 abr 2026', seed: 3 },
  { id: '68547946', nombre: 'Uniformes generales',     institucion: 'CFE',     etapa: 'cerrada',     responsable: 'ep', fecha: '06 may 2026', contactoId: 'c4',  monto: 780000,   cotId: 'COT-0230',    creado: '28 mar 2026', seed: 4 },
  { id: '60144243', nombre: 'Equipo médico',           institucion: 'BBVA',    etapa: 'negociacion', responsable: 'jr', fecha: '10 may 2026', contactoId: 'c5',  monto: 920000,   cotId: 'COT-0239',    creado: '08 abr 2026', seed: 5 },
  { id: '62036530', nombre: 'Dotación invierno',       institucion: 'IPN',     etapa: 'cotizacion',  responsable: 'am', fecha: '14 may 2026', contactoId: 'c6',  monto: 340000,   cotId: 'COT-0242',    creado: '15 abr 2026', seed: 6 },
  { id: '30796622', nombre: 'Suministro escolar',      institucion: 'UNAM',    etapa: 'presentada',  responsable: 'ml', fecha: '18 may 2026', contactoId: 'c7',  monto: 150000,   cotId: 'COT-0237',    creado: '02 abr 2026', seed: 7 },
  { id: '42283235', nombre: 'Contrato marco',          institucion: 'TEC',     etapa: 'cerrada',     responsable: 'jr', fecha: '22 may 2026', contactoId: 'c8',  monto: 1250000,  cotId: 'COT-0228',    creado: '20 mar 2026', seed: 8 },
  { id: '45708869', nombre: 'Proyecto especial',       institucion: 'SEGGOB',  etapa: 'nueva',       responsable: 'ep', fecha: '26 may 2026', contactoId: 'c9',  monto: 420000,   cotId: null,         creado: '18 abr 2026', seed: 9 },
  { id: '31667219', nombre: 'Uniformes administrativos',institucion: 'CFE',    etapa: 'presentada',  responsable: 'ep', fecha: '30 may 2026', contactoId: 'c10', monto: 680000,   cotId: 'COT-0236',    creado: '01 abr 2026', seed: 10 },
  { id: '32806100', nombre: 'Pedido emergente',        institucion: 'FEMSA',   etapa: 'presentada',  responsable: 'am', fecha: '03 jun 2026', contactoId: 'c11', monto: 95000,    cotId: 'COT-0235',    creado: '30 mar 2026', seed: 11 },
  { id: '26625362', nombre: 'Acuerdo trianual',        institucion: 'SEP',     etapa: 'cerrada',     responsable: 'ml', fecha: '07 jun 2026', contactoId: 'c12', monto: 1880000,  cotId: 'COT-0225',    creado: '15 mar 2026', seed: 12 },
  { id: '93087641', nombre: 'Contrato anual',          institucion: 'ISSSTE',  etapa: 'nueva',       responsable: 'jr', fecha: '11 jun 2026', contactoId: 'c13', monto: 560000,   cotId: null,         creado: '16 abr 2026', seed: 13 },
  { id: '84979829', nombre: 'Suministro inicial',      institucion: 'HOSP_AB', etapa: 'cotizacion',  responsable: 'ep', fecha: '15 jun 2026', contactoId: 'c14', monto: 320000,   cotId: 'COT-0243',    creado: '17 abr 2026', seed: 14 },
  { id: '99696130', nombre: 'Renovación flota',        institucion: 'HOSP_AB', etapa: 'presentada',  responsable: 'am', fecha: '19 jun 2026', contactoId: 'c15', monto: 720000,   cotId: 'COT-0234',    creado: '29 mar 2026', seed: 15 },
  { id: '10412493', nombre: 'Pedido especial',         institucion: 'HOSP_AB', etapa: 'cerrada',     responsable: 'jr', fecha: '23 jun 2026', contactoId: 'c16', monto: 180000,   cotId: 'COT-0222',    creado: '10 mar 2026', seed: 16 },
  { id: '48556841', nombre: 'Dotación verano',         institucion: 'SEP',     etapa: 'nueva',       responsable: 'ml', fecha: '27 jun 2026', contactoId: 'c17', monto: 250000,   cotId: null,         creado: '19 abr 2026', seed: 17 },
  { id: '85888463', nombre: 'Proyecto piloto',         institucion: 'TEC',     etapa: 'cotizacion',  responsable: 'ep', fecha: '01 jul 2026', contactoId: 'c18', monto: 410000,   cotId: 'COT-0244',    creado: '18 abr 2026', seed: 18 },
  { id: '52533449', nombre: 'Contrato multi-sede',     institucion: 'FEMSA',   etapa: 'presentada',  responsable: 'am', fecha: '05 jul 2026', contactoId: 'c19', monto: 890000,   cotId: 'COT-0233',    creado: '27 mar 2026', seed: 19 },
];

// Computa sub-items para cada oportunidad
OPORTUNIDADES.forEach(op => {
  const n = 3 + (op.seed % 4);
  op.productos = makeSubitems(n, op.seed);
});

Object.assign(window, {
  ETAPAS, RESPONSABLES, CATALOGO, INSTITUCIONES, CONTACTOS, OPORTUNIDADES,
});
