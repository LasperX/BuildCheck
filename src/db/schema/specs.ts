import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  varchar,
} from 'drizzle-orm/pg-core';

import { parts } from './parts';

// หัวข้อ 6.3 สเปกเฉพาะหมวด (8 ตาราง) ใช้ part_id เป็นทั้ง PK และ FK จึงเป็นความสัมพันธ์ 1:1 กับ parts
// คอมเมนต์ท้ายคอลัมน์บอกว่ากฎตรวจข้อไหนใช้ค่านี้

export const motherboardFormFactor = pgEnum('motherboard_form_factor', [
  'ATX',
  'mATX',
  'ITX',
  'EATX',
]);
export const memoryType = pgEnum('memory_type', ['DDR4', 'DDR5']);
export const storageType = pgEnum('storage_type', ['NVMe', 'SATA_SSD', 'HDD']);
export const storageInterface = pgEnum('storage_interface', ['M2', 'SATA']);
export const psuEfficiency = pgEnum('psu_efficiency', [
  'White',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Titanium',
]);
export const psuFormFactor = pgEnum('psu_form_factor', ['ATX', 'SFX']);
export const psuModular = pgEnum('psu_modular', ['none', 'semi', 'full']);
export const caseSidePanel = pgEnum('case_side_panel', ['glass', 'mesh', 'solid']);
export const coolerType = pgEnum('cooler_type', ['air', 'aio']);

// ช่องไฟ เช่น { "8pin": 1 } ใช้กับ R16
export type PowerConnectors = Record<string, number>;

const partIdPk = () =>
  integer('part_id')
    .primaryKey()
    .references(() => parts.id, { onDelete: 'cascade' });

export const cpuSpecs = pgTable(
  'cpu_specs',
  {
    partId: partIdPk(),
    socket: varchar('socket', { length: 20 }).notNull(), // R01, R12
    generation: varchar('generation', { length: 30 }).notNull(), // R02, R03
    cores: smallint('cores').notNull(),
    threads: smallint('threads').notNull(),
    baseClockGhz: numeric('base_clock_ghz', { precision: 4, scale: 2, mode: 'number' }),
    boostClockGhz: numeric('boost_clock_ghz', { precision: 4, scale: 2, mode: 'number' }),
    tdpWatt: integer('tdp_watt').notNull(), // R13, สูตรวัตต์
    hasIgpu: boolean('has_igpu').notNull().default(false), // R18
    includesCooler: boolean('includes_cooler').notNull().default(false),
    memoryTypes: varchar('memory_types', { length: 10 }).array().notNull(),
    perfScore: smallint('perf_score').notNull(),
  },
  (t) => [
    index('cpu_specs_socket_idx').on(t.socket),
    check('cpu_specs_perf_score_range', sql`${t.perfScore} BETWEEN 0 AND 100`),
  ],
);

export const motherboardSpecs = pgTable(
  'motherboard_specs',
  {
    partId: partIdPk(),
    socket: varchar('socket', { length: 20 }).notNull(), // R01
    chipset: varchar('chipset', { length: 20 }).notNull(),
    formFactor: motherboardFormFactor('form_factor').notNull(), // R08
    memoryType: memoryType('memory_type').notNull(), // R04
    memorySlots: smallint('memory_slots').notNull(), // R05
    maxMemoryGb: smallint('max_memory_gb').notNull(), // R06
    maxMemorySpeed: integer('max_memory_speed').notNull(), // R07
    m2Slots: smallint('m2_slots').notNull(), // R17
    sataPorts: smallint('sata_ports').notNull(), // R17
    supportedGenerations: varchar('supported_generations', { length: 30 }).array().notNull(), // R02
    biosUpdateGenerations: varchar('bios_update_generations', { length: 30 })
      .array()
      .notNull()
      .default(sql`ARRAY[]::varchar[]`), // R03
    wifi: boolean('wifi').notNull().default(false),
  },
  (t) => [index('motherboard_specs_socket_idx').on(t.socket)],
);

export const ramSpecs = pgTable(
  'ram_specs',
  {
    partId: partIdPk(),
    type: memoryType('type').notNull(), // R04
    capacityPerStickGb: smallint('capacity_per_stick_gb').notNull(), // R06
    sticksInKit: smallint('sticks_in_kit').notNull(), // R05, R06, สูตรวัตต์
    speedMts: integer('speed_mts').notNull(), // R07
    casLatency: smallint('cas_latency'),
    rgb: boolean('rgb').notNull().default(false),
  },
  (t) => [
    index('ram_specs_type_idx').on(t.type),
    check('ram_specs_sticks_range', sql`${t.sticksInKit} IN (1, 2)`),
  ],
);

export const gpuSpecs = pgTable(
  'gpu_specs',
  {
    partId: partIdPk(),
    chipset: varchar('chipset', { length: 40 }).notNull(),
    vramGb: smallint('vram_gb').notNull(),
    lengthMm: smallint('length_mm').notNull(), // R09
    slotWidth: numeric('slot_width', { precision: 3, scale: 1, mode: 'number' }),
    tbpWatt: integer('tbp_watt').notNull(), // สูตรวัตต์
    powerConnectors: jsonb('power_connectors').$type<PowerConnectors>().notNull(), // R16
    perfScore: smallint('perf_score').notNull(),
  },
  (t) => [check('gpu_specs_perf_score_range', sql`${t.perfScore} BETWEEN 0 AND 100`)],
);

export const storageSpecs = pgTable('storage_specs', {
  partId: partIdPk(),
  type: storageType('type').notNull(), // สูตรวัตต์
  interface: storageInterface('interface').notNull(), // R17
  capacityGb: integer('capacity_gb').notNull(),
  readMbps: integer('read_mbps'),
  writeMbps: integer('write_mbps'),
});

export const psuSpecs = pgTable('psu_specs', {
  partId: partIdPk(),
  wattage: integer('wattage').notNull(), // R14
  efficiency: psuEfficiency('efficiency').notNull(),
  formFactor: psuFormFactor('form_factor').notNull(), // R15
  modular: psuModular('modular').notNull(),
  pcieConnectors: jsonb('pcie_connectors').$type<PowerConnectors>().notNull(), // R16
});

export const caseSpecs = pgTable('case_specs', {
  partId: partIdPk(),
  supportedFormFactors: varchar('supported_form_factors', { length: 10 }).array().notNull(), // R08
  maxGpuLengthMm: smallint('max_gpu_length_mm').notNull(), // R09
  maxCoolerHeightMm: smallint('max_cooler_height_mm').notNull(), // R10
  radiatorSupportMm: smallint('radiator_support_mm')
    .array()
    .notNull()
    .default(sql`ARRAY[]::smallint[]`), // R11
  psuFormFactors: varchar('psu_form_factors', { length: 10 }).array().notNull(), // R15
  includedFans: smallint('included_fans').notNull().default(0),
  sidePanel: caseSidePanel('side_panel').notNull(),
});

export const coolerSpecs = pgTable(
  'cooler_specs',
  {
    partId: partIdPk(),
    type: coolerType('type').notNull(), // สูตรวัตต์
    supportedSockets: varchar('supported_sockets', { length: 20 }).array().notNull(), // R12
    heightMm: smallint('height_mm'), // R10 เฉพาะซิงก์ลม
    radiatorMm: smallint('radiator_mm'), // R11 เฉพาะชุดน้ำ
    maxTdpWatt: integer('max_tdp_watt').notNull(), // R13
  },
  (t) => [
    // ซิงก์ลมต้องมีความสูง ชุดน้ำต้องมีขนาดหม้อน้ำ กันข้อมูลขาดจนกฎ R10/R11 ตรวจไม่ได้
    check(
      'cooler_specs_dimension_by_type',
      sql`(${t.type} = 'air' AND ${t.heightMm} IS NOT NULL) OR (${t.type} = 'aio' AND ${t.radiatorMm} IS NOT NULL)`,
    ),
  ],
);
