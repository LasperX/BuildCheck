import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { UserActions } from '@/components/admin/admin-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { requireAdmin } from '@/lib/session';
import { ADMIN_LIST_SIZE, listUsers } from '@/server/queries/admin';

export const metadata: Metadata = { title: 'จัดการผู้ใช้ · BuildCheck' };

// /admin/users (หัวข้อ 5.2) ค้นหา ดูกิจกรรม เปลี่ยนสิทธิ์ ระงับ/ปลดระงับ
// หน้าแอดมินแสดงอีเมลได้ เพราะเห็นเฉพาะแอดมิน (หน้าสาธารณะไม่แสดง)

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function UsersContent({
  searchParams,
}: {
  searchParams: PageProps<'/admin/users'>['searchParams'];
}) {
  const admin = await requireAdmin();
  const raw = await searchParams;
  const q = one(raw.q)?.slice(0, 80);
  const statusRaw = one(raw.status);
  const status = statusRaw === 'banned' || statusRaw === 'admin' ? statusRaw : undefined;
  const page = Math.max(1, Math.min(1000, Number(one(raw.page)) || 1));
  const { rows, total } = await listUsers({ q, status, page });
  const pages = Math.max(1, Math.ceil(total / ADMIN_LIST_SIZE));
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (p > 1) params.set('page', String(p));
    return `/admin/users${params.size ? `?${params}` : ''}`;
  };

  return (
    <>
      <form
        action="/admin/users"
        className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_auto]"
      >
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
          />
          <Input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="ค้นหาชื่อ ชื่อผู้ใช้ หรืออีเมล"
            aria-label="ค้นหาผู้ใช้"
            className="pl-9"
          />
        </div>
        <NativeSelect name="status" defaultValue={status ?? ''} aria-label="กรองสถานะ">
          <option value="">ทุกคน</option>
          <option value="banned">ถูกระงับ</option>
          <option value="admin">แอดมิน</option>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          ค้นหา
        </Button>
      </form>
      <p className="mb-2 text-xs text-muted-foreground">
        ทั้งหมด {total.toLocaleString('th-TH')} คน
      </p>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="p-3 text-left font-normal">
                ผู้ใช้
              </th>
              <th scope="col" className="p-3 text-left font-normal">
                สถานะ
              </th>
              <th scope="col" className="p-3 text-right font-normal">
                สเปก
              </th>
              <th scope="col" className="p-3 text-right font-normal">
                คอมเมนต์
              </th>
              <th scope="col" className="p-3 text-left font-normal">
                สมัครเมื่อ
              </th>
              <th scope="col" className="p-3 text-right font-normal">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id} className="border-b border-border align-top last:border-0">
                <td className="p-3">
                  <p className="font-medium">
                    {user.username ? (
                      <Link href={`/u/${user.username}`} className="hover:underline">
                        {user.displayName}
                      </Link>
                    ) : (
                      user.displayName
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.username ? `@${user.username} · ` : ''}
                    {user.email}
                  </p>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {user.role === 'admin' && <Badge variant="brand">แอดมิน</Badge>}
                    {user.banned && <Badge variant="err">ถูกระงับ</Badge>}
                    {!user.emailVerified && <Badge variant="neutral">ยังไม่ยืนยันอีเมล</Badge>}
                  </div>
                  {user.banReason && (
                    <p className="mt-1 text-xs text-muted-foreground">เหตุผล: {user.banReason}</p>
                  )}
                </td>
                <td className="p-3 text-right font-mono">{user.buildCount}</td>
                <td className="p-3 text-right font-mono">{user.commentCount}</td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">
                  {user.createdAt.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
                </td>
                <td className="p-3">
                  <UserActions
                    userId={user.id}
                    name={user.displayName}
                    role={user.role}
                    banned={user.banned}
                    emailVerified={user.emailVerified}
                    isSelf={user.id === admin.id}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  ไม่พบผู้ใช้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="หน้า" className="mt-4 flex items-center justify-center gap-2">
          {page > 1 && (
            <Button asChild variant="secondary" size="sm">
              <Link href={href(page - 1)}>
                <ChevronLeft aria-hidden />
                ก่อนหน้า
              </Link>
            </Button>
          )}
          <span className="font-mono text-sm">
            {page} / {pages}
          </span>
          {page < pages && (
            <Button asChild variant="secondary" size="sm">
              <Link href={href(page + 1)}>
                ถัดไป
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          )}
        </nav>
      )}
    </>
  );
}

export default function AdminUsersPage({ searchParams }: PageProps<'/admin/users'>) {
  return (
    <>
      <h1 className="mb-4 t-h1">จัดการผู้ใช้</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
