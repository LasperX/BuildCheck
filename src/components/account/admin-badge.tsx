import { cn } from '@/lib/utils';

// ป้ายติ๊กถูกสีฟ้าข้างชื่อแอดมิน แบบเดียวกับบัญชียืนยันตัวตนของ X / Facebook / Instagram
// ให้ผู้ใช้รู้ว่าสเปกหรือคอมเมนต์นี้มาจากทีมดูแล BuildCheck
// ป้ายอิงจาก role ในฐานข้อมูลเท่านั้น ผู้ใช้ตั้งชื่อหรือรูปให้เหมือนแอดมินก็ไม่ได้ป้ายนี้

export type UserRole = 'member' | 'admin';

const LABEL = 'แอดมิน BuildCheck';

export function AdminBadge({
  role,
  size = 16,
  className,
}: {
  role: UserRole | null | undefined;
  size?: number;
  className?: string;
}) {
  if (role !== 'admin') return null;
  return (
    <span
      role="img"
      aria-label={LABEL}
      title={LABEL}
      className={cn('inline-flex shrink-0 align-[-0.15em]', className)}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        {/* วงหยัก 12 แฉกแบบป้ายยืนยัน + เครื่องหมายถูกสีขาว */}
        <path
          fill="var(--admin-badge, #1d9bf0)"
          d="M12 1.5l2.3 1.7 2.8-.4 1.1 2.6 2.6 1.1-.4 2.8L22.1 12l-1.7 2.3.4 2.8-2.6 1.1-1.1 2.6-2.8-.4L12 22.1l-2.3-1.7-2.8.4-1.1-2.6-2.6-1.1.4-2.8L1.9 12l1.7-2.3-.4-2.8 2.6-1.1 1.1-2.6 2.8.4z"
        />
        <path
          d="M7.8 12.3l2.7 2.7 5.7-5.8"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
