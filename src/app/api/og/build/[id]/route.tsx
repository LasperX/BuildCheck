import { ImageResponse } from 'next/og';

import { USAGE_LABELS } from '@/lib/builder/types';
import { loadOgFonts, OG_FONT_FAMILY } from '@/lib/og-fonts';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_LABELS } from '@/lib/parts/spec-fields';
import { getSession } from '@/lib/session';
import { buildIdSchema } from '@/lib/validators/builds';
import { canViewBuild, getBuildWithItems } from '@/server/queries/builds';

// รูปสรุปสเปก 1200 × 630 สำหรับโพสต์ลงโซเชียลและพรีวิวลิงก์ (หัวข้อ 3.3)
// สร้างจากข้อมูลในฐานข้อมูลทุกครั้ง สเปกส่วนตัวเปิดได้เฉพาะเจ้าของ

const STATUS = {
  ok: { text: 'เข้ากันได้ทั้งหมด', color: '#15803d', bg: '#dcfce7' },
  warning: { text: 'มีข้อควรระวัง', color: '#a16207', bg: '#fef9c3' },
  error: { text: 'มีชิ้นที่ใส่ด้วยกันไม่ได้', color: '#b91c1c', bg: '#fee2e2' },
} as const;

export async function GET(request: Request, { params }: RouteContext<'/api/og/build/[id]'>) {
  const id = buildIdSchema.safeParse((await params).id);
  if (!id.success) return new Response('ไม่พบสเปก', { status: 404 });

  const [found, session] = await Promise.all([getBuildWithItems(id.data), getSession()]);
  if (!found || !canViewBuild(found.build, session?.user)) {
    return new Response('ไม่พบสเปก', { status: 404 });
  }
  const { build, items } = found;
  const status = STATUS[build.compatStatus];
  const rows = items.slice(0, 8);

  const image = new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 56,
        background: '#f8fafc',
        fontFamily: OG_FONT_FAMILY,
        color: '#0f172a',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: '#1d4ed8' }}>
          BuildCheck
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 24,
            padding: '6px 18px',
            borderRadius: 999,
            color: status.color,
            background: status.bg,
          }}
        >
          {status.text}
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, marginTop: 20 }}>
        {build.title.length > 40 ? `${build.title.slice(0, 40)}…` : build.title}
      </div>
      <div style={{ display: 'flex', fontSize: 24, color: '#475569', marginTop: 4 }}>
        {USAGE_LABELS[build.usageType]} · โดย {build.ownerName}
      </div>
      <div style={{ display: 'flex', flex: 1, gap: 40, marginTop: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 6 }}>
          {rows.map((item) => (
            <div key={item.partId} style={{ display: 'flex', fontSize: 22 }}>
              <span style={{ width: 210, color: '#64748b' }}>
                {CATEGORY_LABELS[item.part.categorySlug]}
              </span>
              <span style={{ flex: 1 }}>
                {`${item.part.brandName} ${item.part.model}`.slice(0, 38)}
                {item.quantity > 1 ? ` × ${item.quantity}` : ''}
              </span>
            </div>
          ))}
          {items.length > rows.length && (
            <div style={{ display: 'flex', fontSize: 20, color: '#64748b' }}>
              และอีก {items.length - rows.length} รายการ
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: 300,
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 22, color: '#64748b' }}>ราคารวม</span>
            <span style={{ fontSize: 48, fontWeight: 700 }}>{formatBaht(build.totalPrice)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 22, color: '#64748b' }}>กำลังไฟโดยประมาณ</span>
            <span style={{ fontSize: 36, fontWeight: 700 }}>{build.totalWatt} W</span>
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: await loadOgFonts(),
      headers: {
        'Cache-Control': 'private, max-age=60',
        ...(new URL(request.url).searchParams.has('download')
          ? { 'Content-Disposition': `attachment; filename="buildcheck-${build.id}.png"` }
          : {}),
      },
    },
  );
  return image;
}
