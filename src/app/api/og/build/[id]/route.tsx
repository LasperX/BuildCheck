import { ImageResponse } from 'next/og';

import { USAGE_LABELS } from '@/lib/builder/types';
import { loadOgFonts, OG_FONT_FAMILY } from '@/lib/og-fonts';
import { formatBaht } from '@/lib/parts/catalog';
import { CATEGORY_LABELS } from '@/lib/parts/spec-fields';
import { getSession } from '@/lib/session';
import { buildIdSchema } from '@/lib/validators/builds';
import { partThumbnail } from '@/server/og/part-thumbnail';
import { type BuildWithItems, canViewBuild, getBuildWithItems } from '@/server/queries/builds';

// รูปสรุปสเปก 1200 × 630 สำหรับโพสต์ลงโซเชียลและพรีวิวลิงก์ (หัวข้อ 3.3)
// สร้างจากข้อมูลในฐานข้อมูลทุกครั้ง สเปกส่วนตัวเปิดได้เฉพาะเจ้าของ
// อะไหล่แสดงเป็นการ์ด 2 คอลัมน์ มีรูปอะไหล่ ชิ้นที่ยังไม่มีรูปใช้ป้ายสีตามยี่ห้อแบบเดียวกับคลังอะไหล่

const STATUS = {
  ok: { text: 'เข้ากันได้ทั้งหมด', color: '#15803d', bg: '#dcfce7' },
  warning: { text: 'มีข้อควรระวัง', color: '#a16207', bg: '#fef9c3' },
  error: { text: 'มีชิ้นที่ใส่ด้วยกันไม่ได้', color: '#b91c1c', bg: '#fee2e2' },
} as const;

/** สีป้ายแทนรูปตามยี่ห้อ ชุดเดียวกับ BRAND_TINTS ใน components/parts/part-icon.tsx */
const BRAND_COLORS: Record<string, readonly [string, string]> = {
  amd: ['#b3261e', '#5c1410'],
  intel: ['#0b5cad', '#083566'],
  nvidia: ['#3f7d0c', '#1f4206'],
  msi: ['#3f3f46', '#18181b'],
  asus: ['#0e7490', '#083344'],
  gigabyte: ['#b4530a', '#5e2b05'],
  asrock: ['#7c5a2a', '#3b2a12'],
  sapphire: ['#1e3a8a', '#172554'],
};
const DEFAULT_COLORS = ['#475569', '#1e293b'] as const;

/** การ์ดอะไหล่ในรูปได้ 8 ใบ (4 แถว × 2) ถ้าเกิน ใบสุดท้ายบอกจำนวนที่เหลือแทน */
const MAX_CARDS = 8;
const THUMB = 64;
/**
 * ความกว้างการ์ด: (1200 − ขอบซ้ายขวา 48 × 2 − ช่องห่างคอลัมน์ราคา 36 − คอลัมน์ราคา 270 − ช่องห่างการ์ด 12) ÷ 2
 * กำหนดตายตัว ไม่ใช้ flex แบ่ง เพราะตัวสร้างรูปแบ่งตามความยาวข้อความ ทำให้การ์ดในแถวเดียวกันกว้างไม่เท่ากัน
 */
const CARD_WIDTH = 393;

type Item = BuildWithItems['items'][number];

function Thumbnail({ item, src }: { item: Item; src: string | null }) {
  if (src) {
    return (
      <div
        style={{
          display: 'flex',
          width: THUMB,
          height: THUMB,
          flexShrink: 0,
          borderRadius: 10,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ตัวสร้างรูป (Satori) ใช้ได้แค่ <img> ธรรมดา */}
        <img src={src} width={THUMB} height={THUMB} style={{ objectFit: 'contain' }} alt="" />
      </div>
    );
  }
  const [from, to] = BRAND_COLORS[item.part.brandName.toLowerCase()] ?? DEFAULT_COLORS;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: THUMB,
        height: THUMB,
        flexShrink: 0,
        borderRadius: 10,
        padding: 4,
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 700,
        textAlign: 'center',
        textTransform: 'uppercase',
      }}
    >
      {item.part.brandName.slice(0, 16)}
    </div>
  );
}

function PartCard({ item, src }: { item: Item; src: string | null }) {
  return (
    <div
      style={{
        display: 'flex',
        width: CARD_WIDTH,
        flexShrink: 0,
        alignItems: 'center',
        gap: 14,
        height: 80,
        padding: 7,
        borderRadius: 14,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
      }}
    >
      <Thumbnail item={item} src={src} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {/* จำนวนอยู่บรรทัดหมวด ชื่อรุ่นยาวแค่ไหนก็ไม่ถูกตัดหาย */}
        <div style={{ display: 'flex', fontSize: 14, color: '#64748b' }}>
          <span>
            {CATEGORY_LABELS[item.part.categorySlug]}
            {item.quantity > 1 ? ` × ${item.quantity}` : ''}
          </span>
          {item.condition !== 'new' && (
            <span style={{ marginLeft: 8, color: '#7c3aed' }}>มือสอง เกรด {item.condition}</span>
          )}
        </div>
        {/* ชื่อยาวเกิน 2 บรรทัดตัดท้ายเป็น … (ตัวสร้างรูปตัดบรรทัดให้เฉพาะ display: block) */}
        <div
          style={{
            display: 'block',
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.25,
            lineClamp: 2,
          }}
        >
          {`${item.part.brandName} ${item.part.model}`}
        </div>
      </div>
    </div>
  );
}

function MoreCard({ count }: { count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        width: CARD_WIDTH,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        height: 80,
        borderRadius: 14,
        border: '1px dashed #94a3b8',
        fontSize: 22,
        color: '#475569',
      }}
    >
      และอีก {count} รายการ
    </div>
  );
}

export async function GET(request: Request, { params }: RouteContext<'/api/og/build/[id]'>) {
  const id = buildIdSchema.safeParse((await params).id);
  if (!id.success) return new Response('ไม่พบสเปก', { status: 404 });

  const [found, session] = await Promise.all([getBuildWithItems(id.data), getSession()]);
  if (!found || !canViewBuild(found.build, session?.user)) {
    return new Response('ไม่พบสเปก', { status: 404 });
  }
  const { build, items } = found;
  const status = STATUS[build.compatStatus];

  const shown = items.length > MAX_CARDS ? items.slice(0, MAX_CARDS - 1) : items;
  const more = items.length - shown.length;
  const thumbnails = await Promise.all(shown.map((item) => partThumbnail(item.part.imageUrl)));
  const cards = [
    ...shown.map((item, index) => (
      <PartCard key={`${item.partId}-${index}`} item={item} src={thumbnails[index] ?? null} />
    )),
    ...(more > 0 ? [<MoreCard key="more" count={more} />] : []),
  ];
  const rows = Array.from({ length: Math.ceil(cards.length / 2) }, (_, row) =>
    cards.slice(row * 2, row * 2 + 2),
  );

  const image = new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 48,
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
      <div style={{ display: 'flex', fontSize: 42, fontWeight: 700, marginTop: 10 }}>
        {build.title.length > 44 ? `${build.title.slice(0, 44)}…` : build.title}
      </div>
      <div style={{ display: 'flex', fontSize: 22, color: '#475569' }}>
        {USAGE_LABELS[build.usageType]} · โดย {build.ownerName}
      </div>
      <div style={{ display: 'flex', flex: 1, gap: 36, marginTop: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 10 }}>
          {rows.map((row, index) => (
            <div key={index} style={{ display: 'flex', gap: 12 }}>
              {row}
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: 270,
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 22, color: '#64748b' }}>ราคารวม</span>
            <span style={{ fontSize: 44, fontWeight: 700 }}>{formatBaht(build.totalPrice)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 22, color: '#64748b' }}>กำลังไฟโดยประมาณ</span>
            <span style={{ fontSize: 34, fontWeight: 700 }}>{build.totalWatt} W</span>
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: '#64748b' }}>
            อะไหล่ {items.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
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
