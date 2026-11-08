// คำอธิบายช่องสเปกของแต่ละหมวด เป็นแหล่งเดียวที่ทั้งฟอร์มหลังบ้านและไฟล์ CSV ใช้ร่วมกัน
// เพิ่มช่องที่นี่ที่เดียว ฟอร์มและหัวคอลัมน์ CSV จะเปลี่ยนตาม

export const CATEGORY_SLUGS = [
  'cpu',
  'motherboard',
  'ram',
  'gpu',
  'storage',
  'psu',
  'case',
  'cooler',
] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export type SpecFieldKind =
  | 'text'
  | 'int'
  | 'decimal'
  | 'bool'
  | 'enum'
  | 'list' // หลายค่า คั่นด้วย | เช่น ATX|mATX
  | 'intList' // ตัวเลขหลายค่า เช่น 240|360
  | 'connectors'; // ช่องไฟ เช่น 8pin:1|6pin:2

export type SpecField = {
  key: string;
  csv: string;
  label: string;
  kind: SpecFieldKind;
  options?: readonly string[];
  required?: boolean;
  hint?: string;
};

export const FORM_FACTORS = ['ATX', 'mATX', 'ITX', 'EATX'] as const;
export const MEMORY_TYPES = ['DDR4', 'DDR5'] as const;
export const STORAGE_TYPES = ['NVMe', 'SATA_SSD', 'HDD'] as const;
export const STORAGE_INTERFACES = ['M2', 'SATA'] as const;
export const PSU_EFFICIENCIES = [
  'White',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Titanium',
] as const;
export const PSU_FORM_FACTORS = ['ATX', 'SFX'] as const;
export const PSU_MODULAR = ['none', 'semi', 'full'] as const;
export const SIDE_PANELS = ['glass', 'mesh', 'solid'] as const;
export const COOLER_TYPES = ['air', 'aio'] as const;

export const SPEC_FIELDS: Record<CategorySlug, SpecField[]> = {
  cpu: [
    {
      key: 'socket',
      csv: 'socket',
      label: 'Socket',
      kind: 'text',
      required: true,
      hint: 'เช่น AM5',
    },
    {
      key: 'generation',
      csv: 'generation',
      label: 'รุ่น (Generation)',
      kind: 'text',
      required: true,
      hint: 'ต้องตรงกับรายการในเมนบอร์ด ใช้กับ R02, R03',
    },
    { key: 'cores', csv: 'cores', label: 'จำนวนคอร์', kind: 'int', required: true },
    { key: 'threads', csv: 'threads', label: 'จำนวนเธรด', kind: 'int', required: true },
    { key: 'baseClockGhz', csv: 'base_clock_ghz', label: 'ความเร็วพื้นฐาน (GHz)', kind: 'decimal' },
    {
      key: 'boostClockGhz',
      csv: 'boost_clock_ghz',
      label: 'ความเร็วสูงสุด (GHz)',
      kind: 'decimal',
    },
    { key: 'tdpWatt', csv: 'tdp_watt', label: 'TDP (W)', kind: 'int', required: true },
    { key: 'hasIgpu', csv: 'has_igpu', label: 'มีกราฟิกในตัว', kind: 'bool', hint: 'ใช้กับ R18' },
    { key: 'includesCooler', csv: 'includes_cooler', label: 'มีพัดลมแถม', kind: 'bool' },
    {
      key: 'memoryTypes',
      csv: 'memory_types',
      label: 'ชนิดแรมที่รองรับ',
      kind: 'list',
      options: MEMORY_TYPES,
      required: true,
      hint: 'คั่นด้วย | เช่น DDR4|DDR5',
    },
    {
      key: 'perfScore',
      csv: 'perf_score',
      label: 'คะแนนประสิทธิภาพ (0–100)',
      kind: 'int',
      required: true,
    },
  ],
  motherboard: [
    { key: 'socket', csv: 'socket', label: 'Socket', kind: 'text', required: true },
    { key: 'chipset', csv: 'chipset', label: 'ชิปเซ็ต', kind: 'text', required: true },
    {
      key: 'formFactor',
      csv: 'form_factor',
      label: 'ขนาดบอร์ด',
      kind: 'enum',
      options: FORM_FACTORS,
      required: true,
    },
    {
      key: 'memoryType',
      csv: 'memory_type',
      label: 'ชนิดแรม',
      kind: 'enum',
      options: MEMORY_TYPES,
      required: true,
    },
    { key: 'memorySlots', csv: 'memory_slots', label: 'จำนวนช่องแรม', kind: 'int', required: true },
    {
      key: 'maxMemoryGb',
      csv: 'max_memory_gb',
      label: 'แรมสูงสุด (GB)',
      kind: 'int',
      required: true,
    },
    {
      key: 'maxMemorySpeed',
      csv: 'max_memory_speed',
      label: 'ความเร็วแรมสูงสุด (MT/s)',
      kind: 'int',
      required: true,
    },
    { key: 'm2Slots', csv: 'm2_slots', label: 'ช่อง M.2', kind: 'int', required: true },
    { key: 'sataPorts', csv: 'sata_ports', label: 'พอร์ต SATA', kind: 'int', required: true },
    {
      key: 'supportedGenerations',
      csv: 'supported_generations',
      label: 'รุ่น CPU ที่ใช้ได้ทันที',
      kind: 'list',
      required: true,
      hint: 'คั่นด้วย |',
    },
    {
      key: 'biosUpdateGenerations',
      csv: 'bios_update_generations',
      label: 'รุ่น CPU ที่ต้องอัปเดต BIOS ก่อน',
      kind: 'list',
      hint: 'คั่นด้วย | เว้นว่างได้',
    },
    { key: 'wifi', csv: 'wifi', label: 'มี Wi-Fi', kind: 'bool' },
  ],
  ram: [
    {
      key: 'type',
      csv: 'type',
      label: 'ชนิด',
      kind: 'enum',
      options: MEMORY_TYPES,
      required: true,
    },
    {
      key: 'capacityPerStickGb',
      csv: 'capacity_per_stick_gb',
      label: 'ความจุต่อแถว (GB)',
      kind: 'int',
      required: true,
    },
    {
      key: 'sticksInKit',
      csv: 'sticks_in_kit',
      label: 'จำนวนแถวในชุด',
      kind: 'enum',
      options: ['1', '2'],
      required: true,
    },
    { key: 'speedMts', csv: 'speed_mts', label: 'ความเร็ว (MT/s)', kind: 'int', required: true },
    { key: 'casLatency', csv: 'cas_latency', label: 'CAS Latency', kind: 'int' },
    { key: 'rgb', csv: 'rgb', label: 'มี RGB', kind: 'bool' },
  ],
  gpu: [
    { key: 'chipset', csv: 'chipset', label: 'ชิปประมวลผล', kind: 'text', required: true },
    { key: 'vramGb', csv: 'vram_gb', label: 'VRAM (GB)', kind: 'int', required: true },
    {
      key: 'lengthMm',
      csv: 'length_mm',
      label: 'ความยาว (mm)',
      kind: 'int',
      required: true,
      hint: 'ใช้กับ R09',
    },
    { key: 'slotWidth', csv: 'slot_width', label: 'ความหนา (ช่อง)', kind: 'decimal' },
    { key: 'tbpWatt', csv: 'tbp_watt', label: 'TBP (W)', kind: 'int', required: true },
    {
      key: 'powerConnectors',
      csv: 'power_connectors',
      label: 'ช่องเสียบไฟ',
      kind: 'connectors',
      required: true,
      hint: 'รูปแบบ ชื่อ:จำนวน เช่น 8pin:1|6pin:1 ถ้าไม่ต้องต่อไฟให้ใส่ none:0',
    },
    {
      key: 'perfScore',
      csv: 'perf_score',
      label: 'คะแนนประสิทธิภาพ (0–100)',
      kind: 'int',
      required: true,
    },
  ],
  storage: [
    {
      key: 'type',
      csv: 'type',
      label: 'ชนิด',
      kind: 'enum',
      options: STORAGE_TYPES,
      required: true,
    },
    {
      key: 'interface',
      csv: 'interface',
      label: 'ช่องเชื่อมต่อ',
      kind: 'enum',
      options: STORAGE_INTERFACES,
      required: true,
    },
    { key: 'capacityGb', csv: 'capacity_gb', label: 'ความจุ (GB)', kind: 'int', required: true },
    { key: 'readMbps', csv: 'read_mbps', label: 'ความเร็วอ่าน (MB/s)', kind: 'int' },
    { key: 'writeMbps', csv: 'write_mbps', label: 'ความเร็วเขียน (MB/s)', kind: 'int' },
  ],
  psu: [
    { key: 'wattage', csv: 'wattage', label: 'กำลังไฟ (W)', kind: 'int', required: true },
    {
      key: 'efficiency',
      csv: 'efficiency',
      label: '80 Plus',
      kind: 'enum',
      options: PSU_EFFICIENCIES,
      required: true,
    },
    {
      key: 'formFactor',
      csv: 'form_factor',
      label: 'ขนาด',
      kind: 'enum',
      options: PSU_FORM_FACTORS,
      required: true,
    },
    {
      key: 'modular',
      csv: 'modular',
      label: 'Modular',
      kind: 'enum',
      options: PSU_MODULAR,
      required: true,
    },
    {
      key: 'pcieConnectors',
      csv: 'pcie_connectors',
      label: 'สายไฟการ์ดจอ',
      kind: 'connectors',
      required: true,
      hint: 'รูปแบบ ชื่อ:จำนวน เช่น 8pin:2 ใช้ชื่อเดียวกับการ์ดจอ',
    },
  ],
  case: [
    {
      key: 'supportedFormFactors',
      csv: 'supported_form_factors',
      label: 'ขนาดบอร์ดที่รองรับ',
      kind: 'list',
      options: FORM_FACTORS,
      required: true,
      hint: 'คั่นด้วย | เช่น ATX|mATX|ITX',
    },
    {
      key: 'maxGpuLengthMm',
      csv: 'max_gpu_length_mm',
      label: 'การ์ดจอยาวสุด (mm)',
      kind: 'int',
      required: true,
    },
    {
      key: 'maxCoolerHeightMm',
      csv: 'max_cooler_height_mm',
      label: 'ซิงก์ลมสูงสุด (mm)',
      kind: 'int',
      required: true,
    },
    {
      key: 'radiatorSupportMm',
      csv: 'radiator_support_mm',
      label: 'หม้อน้ำที่รองรับ (mm)',
      kind: 'intList',
      hint: 'คั่นด้วย | เช่น 240|360',
    },
    {
      key: 'psuFormFactors',
      csv: 'psu_form_factors',
      label: 'ขนาด PSU ที่รองรับ',
      kind: 'list',
      options: PSU_FORM_FACTORS,
      required: true,
      hint: 'คั่นด้วย | เช่น ATX|SFX',
    },
    { key: 'includedFans', csv: 'included_fans', label: 'พัดลมแถม (ตัว)', kind: 'int' },
    {
      key: 'sidePanel',
      csv: 'side_panel',
      label: 'ฝาข้าง',
      kind: 'enum',
      options: SIDE_PANELS,
      required: true,
    },
  ],
  cooler: [
    {
      key: 'type',
      csv: 'type',
      label: 'ชนิด',
      kind: 'enum',
      options: COOLER_TYPES,
      required: true,
    },
    {
      key: 'supportedSockets',
      csv: 'supported_sockets',
      label: 'Socket ที่รองรับ',
      kind: 'list',
      required: true,
      hint: 'คั่นด้วย | เช่น AM5|LGA1700',
    },
    {
      key: 'heightMm',
      csv: 'height_mm',
      label: 'ความสูง (mm)',
      kind: 'int',
      hint: 'จำเป็นสำหรับซิงก์ลม',
    },
    {
      key: 'radiatorMm',
      csv: 'radiator_mm',
      label: 'ขนาดหม้อน้ำ (mm)',
      kind: 'int',
      hint: 'จำเป็นสำหรับชุดน้ำ',
    },
    {
      key: 'maxTdpWatt',
      csv: 'max_tdp_watt',
      label: 'รับ TDP ได้สูงสุด (W)',
      kind: 'int',
      required: true,
    },
  ],
};

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  cpu: 'CPU',
  motherboard: 'เมนบอร์ด',
  ram: 'แรม',
  gpu: 'การ์ดจอ',
  storage: 'อุปกรณ์เก็บข้อมูล',
  psu: 'PSU',
  case: 'เคส',
  cooler: 'ชุดระบายความร้อน',
};

export function isCategorySlug(value: unknown): value is CategorySlug {
  return typeof value === 'string' && (CATEGORY_SLUGS as readonly string[]).includes(value);
}

/** แปลงค่าสเปกเป็นข้อความที่คนอ่าน ใช้ร่วมกันในหน้ารายละเอียดอะไหล่และหน้าตรวจสเปกของแอดมิน */
export function formatSpecValue(value: unknown, kind: SpecFieldKind): string {
  if (value === null || value === undefined || value === '') return '—';
  if (kind === 'bool') return value ? 'มี' : 'ไม่มี';
  if (kind === 'connectors') {
    return (
      Object.entries(value as Record<string, number>)
        .map(([name, count]) => `${name} × ${count}`)
        .join(', ') || '—'
    );
  }
  if (Array.isArray(value)) return value.join(', ') || '—';
  return String(value);
}
