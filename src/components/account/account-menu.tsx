import Link from 'next/link';

import { AccountDropdown } from '@/components/account/account-dropdown';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/session';

/** ส่วนบัญชีบนแถบเมนู อ่าน Session จึงต้องอยู่ใน Suspense ส่วนอื่นของหน้ายังโหลดได้ทันที */
export async function AccountMenu() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">เข้าสู่ระบบ</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/register">สมัครสมาชิก</Link>
        </Button>
      </div>
    );
  }

  return (
    <AccountDropdown
      displayName={session.user.name}
      image={session.user.image ?? null}
      isAdmin={session.user.role === 'admin'}
    />
  );
}
