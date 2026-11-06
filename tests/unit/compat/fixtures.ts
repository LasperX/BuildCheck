// อะไหล่สมมติสำหรับทดสอบ ไม่ใช่สเปกของรุ่นจริง ตัวเลขตั้งขึ้นเพื่อให้ชนเงื่อนไขของแต่ละกฎ
import type {
  CaseSpec,
  CoolerSpec,
  CpuSpec,
  EngineItem,
  EnginePart,
  GpuSpec,
  ItemCondition,
  MotherboardSpec,
  PartOf,
  PsuSpec,
  RamSpec,
  StorageSpec,
} from '@/lib/compat';

let nextId = 1;
const base = (model: string, price: number) => ({
  id: nextId++,
  brandName: 'ทดสอบ',
  model,
  price,
  powerWatt: null as number | null,
  releaseYear: 2024 as number | null,
});

export const cpu = (spec: Partial<CpuSpec> = {}, price = 6000): PartOf<'cpu'> => ({
  ...base('CPU-A', price),
  categorySlug: 'cpu',
  spec: {
    socket: 'AM5',
    generation: 'Gen-A',
    cores: 6,
    threads: 12,
    baseClockGhz: 3.8,
    boostClockGhz: 5.0,
    tdpWatt: 65,
    hasIgpu: true,
    includesCooler: true,
    memoryTypes: ['DDR5'],
    perfScore: 60,
    ...spec,
  },
});

export const motherboard = (
  spec: Partial<MotherboardSpec> = {},
  extra: { powerWatt?: number | null; price?: number } = {},
): PartOf<'motherboard'> => ({
  ...base('MB-A', extra.price ?? 5000),
  powerWatt: extra.powerWatt ?? null,
  categorySlug: 'motherboard',
  spec: {
    socket: 'AM5',
    chipset: 'X-600',
    formFactor: 'ATX',
    memoryType: 'DDR5',
    memorySlots: 4,
    maxMemoryGb: 128,
    maxMemorySpeed: 6400,
    m2Slots: 2,
    sataPorts: 4,
    supportedGenerations: ['Gen-A'],
    biosUpdateGenerations: [],
    wifi: false,
    ...spec,
  },
});

export const ram = (spec: Partial<RamSpec> = {}, price = 2000): PartOf<'ram'> => ({
  ...base('RAM-A', price),
  categorySlug: 'ram',
  spec: {
    type: 'DDR5',
    capacityPerStickGb: 16,
    sticksInKit: 2,
    speedMts: 6000,
    casLatency: 30,
    rgb: false,
    ...spec,
  },
});

export const gpu = (spec: Partial<GpuSpec> = {}, price = 12000): PartOf<'gpu'> => ({
  ...base('GPU-A', price),
  categorySlug: 'gpu',
  spec: {
    chipset: 'G-100',
    vramGb: 8,
    lengthMm: 300,
    slotWidth: 2,
    tbpWatt: 220,
    powerConnectors: { '8pin': 1 },
    perfScore: 66,
    ...spec,
  },
});

export const storage = (spec: Partial<StorageSpec> = {}, price = 1500): PartOf<'storage'> => ({
  ...base('SSD-A', price),
  categorySlug: 'storage',
  spec: {
    type: 'NVMe',
    interface: 'M2',
    capacityGb: 1000,
    readMbps: 5000,
    writeMbps: 4000,
    ...spec,
  },
});

export const psu = (spec: Partial<PsuSpec> = {}, price = 2500): PartOf<'psu'> => ({
  ...base('PSU-A', price),
  categorySlug: 'psu',
  spec: {
    wattage: 650,
    efficiency: 'gold',
    formFactor: 'ATX',
    modular: 'full',
    pcieConnectors: { '8pin': 2 },
    ...spec,
  },
});

export const pcCase = (spec: Partial<CaseSpec> = {}, price = 2000): PartOf<'case'> => ({
  ...base('CASE-A', price),
  categorySlug: 'case',
  spec: {
    supportedFormFactors: ['ATX', 'mATX', 'ITX'],
    maxGpuLengthMm: 350,
    maxCoolerHeightMm: 165,
    radiatorSupportMm: [240, 360],
    psuFormFactors: ['ATX'],
    includedFans: 3,
    sidePanel: 'glass',
    ...spec,
  },
});

export const cooler = (spec: Partial<CoolerSpec> = {}, price = 1200): PartOf<'cooler'> => ({
  ...base('COOLER-A', price),
  categorySlug: 'cooler',
  spec: {
    type: 'air',
    supportedSockets: ['AM5', 'LGA1700'],
    heightMm: 155,
    radiatorMm: null,
    maxTdpWatt: 180,
    ...spec,
  },
});

export const item = (
  part: EnginePart,
  quantity = 1,
  condition: ItemCondition = 'new',
  extra: Partial<EngineItem> = {},
): EngineItem => ({ part, quantity, condition, ...extra });

/** สเปกครบ 8 หมวดที่ผ่านทุกกฎ ใช้เป็นจุดตั้งต้นแล้วเปลี่ยนทีละชิ้นในแต่ละเทสต์ */
export function goodBuild() {
  return {
    cpu: cpu({ includesCooler: false }),
    motherboard: motherboard(),
    ram: ram(),
    gpu: gpu(),
    storage: storage(),
    psu: psu(),
    pcCase: pcCase(),
    cooler: cooler(),
  };
}

export type BuildParts = ReturnType<typeof goodBuild>;

export const toItems = (parts: Partial<Record<keyof BuildParts, EnginePart>>): EngineItem[] =>
  Object.values(parts)
    .filter((part): part is EnginePart => Boolean(part))
    .map((part) => item(part));
