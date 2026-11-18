import { join, sep } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { thumbnailSource } = await import('@/server/og/part-thumbnail');

// รูปอะไหล่ในรูปสรุปสเปก: เซิร์ฟเวอร์ดึงรูปได้เฉพาะไฟล์ในเว็บเองและที่เก็บรูปของเรา

const STORAGE = 'https://storage.example.test';
const PUBLIC_DIR = join(process.cwd(), 'public');

describe('thumbnailSource', () => {
  it('ไฟล์ในเว็บเอง (/uploads) อ่านจากโฟลเดอร์ public', () => {
    expect(thumbnailSource('/uploads/parts/a.webp', STORAGE)).toEqual({
      kind: 'file',
      path: join(PUBLIC_DIR, 'uploads', 'parts', 'a.webp'),
    });
    // ตัด query ทิ้ง และถอดรหัสชื่อไฟล์
    expect(thumbnailSource('/uploads/parts/a%20b.webp?v=1', STORAGE)).toEqual({
      kind: 'file',
      path: join(PUBLIC_DIR, 'uploads', 'parts', 'a b.webp'),
    });
  });

  it('ห้ามออกนอกโฟลเดอร์ public ด้วย ../', () => {
    expect(thumbnailSource('/../.env', STORAGE)).toBeNull();
    expect(thumbnailSource('/uploads/../../package.json', STORAGE)).toBeNull();
    expect(thumbnailSource('/%2e%2e/.env', STORAGE)).toBeNull();
    const inside = thumbnailSource('/uploads/../uploads/x.png', STORAGE);
    expect(inside?.kind === 'file' && inside.path.startsWith(PUBLIC_DIR + sep)).toBe(true);
  });

  it('ลิงก์ที่เก็บรูปของเรา ดึงผ่านเน็ต', () => {
    expect(thumbnailSource(`${STORAGE}/buildcheck/parts/x.webp`, STORAGE)).toEqual({
      kind: 'url',
      url: `${STORAGE}/buildcheck/parts/x.webp`,
    });
  });

  it('ลิงก์อื่นไม่ดึง รวมโดเมนที่แค่ขึ้นต้นเหมือนกัน และลิงก์ที่ไม่มี scheme', () => {
    expect(thumbnailSource('https://evil.example.test/x.webp', STORAGE)).toBeNull();
    expect(thumbnailSource(`${STORAGE}.evil.test/x.webp`, STORAGE)).toBeNull();
    expect(thumbnailSource('//evil.example.test/x.webp', STORAGE)).toBeNull();
    expect(thumbnailSource('http://169.254.169.254/latest', STORAGE)).toBeNull();
    // ยังไม่ได้ตั้งที่เก็บรูป: ลิงก์ภายนอกไม่ดึงเลย
    expect(thumbnailSource(`${STORAGE}/x.webp`, null)).toBeNull();
  });

  it('ไม่มีรูป หรือชื่อไฟล์เข้ารหัสผิด คืน null', () => {
    expect(thumbnailSource(null, STORAGE)).toBeNull();
    expect(thumbnailSource('', STORAGE)).toBeNull();
    expect(thumbnailSource('/uploads/%E0%A4%A.png', STORAGE)).toBeNull();
  });
});
