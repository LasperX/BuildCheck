import { vi } from 'vitest';

// เตรียมสภาพแวดล้อมให้ Server Actions ทำงานนอก Next.js
//   - next/headers: คืน Header ของ "ผู้ใช้ปัจจุบัน" ที่เทสต์ตั้งไว้ (คุกกี้ Session จริงจาก Better Auth)
//   - next/cache: ล้างแคชไม่มีผลในเทสต์ จึงเป็นฟังก์ชันว่าง
//   - next/server after(): รันงานเบื้องหลังทันที
// การตรวจสิทธิ์ใช้โค้ดจริงทั้งหมด (lib/session → Better Auth → ตาราง sessions) ไม่ได้ mock

try {
  process.loadEnvFile('.env');
} catch {
  // บน CI ใช้ Environment Variables
}

export const requestState: { headers: Headers } = { headers: new Headers() };

vi.mock('next/headers', () => ({
  headers: async () => requestState.headers,
  cookies: async () => ({
    get: (name: string) => {
      const match = requestState.headers.get('cookie')?.match(new RegExp(`${name}=([^;]+)`));
      return match ? { name, value: match[1] } : undefined;
    },
    getAll: () => [],
    set: () => undefined,
    delete: () => undefined,
    has: () => false,
  }),
}));

vi.mock('next/cache', () => ({
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: unknown) => {
    // งานเบื้องหลังของ Better Auth (ส่งอีเมล) ไม่ต้องรอ และไม่ให้ Error ทำให้เทสต์ล้ม
    Promise.resolve(typeof task === 'function' ? (task as () => unknown)() : task).catch(() => {});
  },
}));
