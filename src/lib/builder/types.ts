import type { EnginePart, Issue, UsageType } from '@/lib/compat';

// ชนิดข้อมูลที่หน้าจัดสเปกกับ API คุยกัน ใช้ได้ทั้งสองฝั่ง

/** อะไหล่ที่มีข้อมูลสเปกครบสำหรับ Engine และข้อมูลแสดงผล */
export type BuilderPart = EnginePart & {
  slug: string;
  brandId: number;
  imageUrl: string | null;
  isActive: boolean;
  specVerified: boolean;
  chips: string[];
  /** จำนวนสเปกที่ใช้ชิ้นนี้ ใช้เรียงตามความนิยม */
  uses: number;
};

/** ปัญหาแบบย่อที่ส่งไปกับรายการในหน้าต่างเลือก */
export type CandidateIssue = Pick<Issue, 'code' | 'level' | 'title' | 'message'>;

export type CandidateItem = Omit<BuilderPart, 'spec'> & {
  compatible: boolean;
  /** ปัญหาร้ายแรงที่สุดที่เกิดขึ้นถ้าเลือกชิ้นนี้ ไม่มี = เข้ากันได้ */
  issue: CandidateIssue | null;
};

export type CandidatesResponse = {
  items: CandidateItem[];
  total: number;
  /** จำนวนชิ้นที่ถูกซ่อนเพราะกรองอัจฉริยะ */
  hidden: number;
  page: number;
  pageSize: number;
};

export const USAGE_LABELS: Record<UsageType, string> = {
  gaming: 'เล่นเกม',
  office: 'ทำงานออฟฟิศ',
  creator: 'ตัดต่อ/กราฟิก',
  streaming: 'สตรีม',
};

export const VISIBILITY_LABELS = {
  unlisted: 'ทุกคนที่มีลิงก์ (ไม่แสดงในหน้าชุมชน)',
  public: 'สาธารณะ (แสดงในหน้าชุมชน)',
  private: 'ส่วนตัว (เฉพาะฉัน)',
} as const;

export type Visibility = keyof typeof VISIBILITY_LABELS;

/** แปลงรายการในสเปกเป็นพารามิเตอร์ URL สั้นๆ เช่น "12x1,15x2" (รหัสอะไหล่ x จำนวน) */
export const encodeBuildParam = (items: { partId: number; quantity: number }[]) =>
  items.map((item) => `${item.partId}x${item.quantity}`).join(',');
