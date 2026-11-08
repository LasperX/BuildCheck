import { ImageResponse } from 'next/og';

import { loadOgFonts, OG_FONT_FAMILY } from '@/lib/og-fonts';

// รูปตัวอย่างตอนแชร์ลิงก์เว็บใน LINE / Facebook / X ใช้กับทุกหน้าที่ไม่ได้กำหนดรูปเอง
// (หน้าสเปกของสมาชิกใช้รูปสรุปสเปกของตัวเองที่ /api/og/build/[id])
// สร้างครั้งเดียวตอน build เพราะเนื้อหาคงที่

export const alt = 'BuildCheck เว็บจัดสเปกคอมพิวเตอร์พร้อมตรวจความเข้ากันได้ของอุปกรณ์';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CHECKS = ['Socket ตรงกัน', 'แรม DDR4 / DDR5', 'การ์ดจอใส่เคสได้', 'PSU ไฟพอ'];

export default async function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: '#f8fafc',
        fontFamily: OG_FONT_FAMILY,
        color: '#0f172a',
      }}
    >
      <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: '#1d4ed8' }}>
        BuildCheck
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, lineHeight: 1.25 }}>
          จัดสเปกคอมให้ใส่กันได้จริง ตั้งแต่ครั้งแรก
        </div>
        <div style={{ display: 'flex', fontSize: 32, color: '#475569', lineHeight: 1.5 }}>
          เลือกอะไหล่ทีละชิ้น ระบบบอกทันทีว่าใส่กันได้ไหม ไฟพอไหม และราคารวมเท่าไหร่
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {CHECKS.map((text) => (
            <div
              key={text}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 20px',
                borderRadius: 999,
                background: '#dcfce7',
                color: '#15803d',
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {/* วาดเครื่องหมายถูกเป็น SVG เพราะฟอนต์ไม่มีตัวอักษร ✓ */}
              <svg width="24" height="24" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  fill="none"
                  stroke="#15803d"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>,
    { ...size, fonts: await loadOgFonts() },
  );
}
