import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { requireAdmin } from '@/lib/session';
import { listAdminLogs } from '@/server/queries/admin';

export const metadata: Metadata = { title: 'บันทึกการทำงาน · BuildCheck' };

// /admin/logs (หัวข้อ 3.9, 5.2) ใครแก้อะไร เมื่อไหร่ กรองตามคนและวันที่

const ACTION_LABELS: Record<string, string> = {
  'part.create': 'เพิ่มอะไหล่',
  'part.update': 'แก้อะไหล่',
  'part.price': 'ปรับราคา',
  'part.import': 'นำเข้า CSV',
  'part.hide': 'ซ่อนอะไหล่',
  'part.show': 'แสดงอะไหล่',
  'part.verify': 'ตรวจสเปกแล้ว',
  'part.unverify': 'ยกเลิกตรวจสเปก',
  'part.delete': 'ลบอะไหล่',
  'settings.update': 'แก้ค่าตั้งระบบ',
  'settings.used': 'แก้ค่าเสื่อมมือสอง',
  'used_report.approve': 'อนุมัติรายงานราคา',
  'used_report.reject': 'ปฏิเสธรายงานราคา',
  'used_survey.create': 'บันทึกราคาสำรวจ',
  'user.ban': 'ระงับผู้ใช้',
  'user.unban': 'ปลดระงับผู้ใช้',
  'user.role': 'เปลี่ยนสิทธิ์',
  'report.hide': 'ซ่อนเนื้อหาที่ถูกรายงาน',
  'report.dismiss': 'ปิดรายงาน (ไม่ผิดกติกา)',
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const isDate = (value: string | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;

/** แสดงค่าก่อน/หลังแบบย่อ ตัดให้สั้นไม่ให้ตารางยาวเกิน */
function summarize(value: unknown): string {
  if (value === undefined || value === null) return '–';
  const text = JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

async function LogsContent({
  searchParams,
}: {
  searchParams: PageProps<'/admin/logs'>['searchParams'];
}) {
  await requireAdmin();
  const raw = await searchParams;
  const adminId = one(raw.admin)?.slice(0, 100) || undefined;
  const from = isDate(one(raw.from));
  const to = isDate(one(raw.to));
  const before = Number(one(raw.before)) || undefined;
  const { rows, hasMore, admins } = await listAdminLogs({ adminId, from, to, before });
  const nextParams = new URLSearchParams();
  if (adminId) nextParams.set('admin', adminId);
  if (from) nextParams.set('from', from);
  if (to) nextParams.set('to', to);
  const last = rows.at(-1);
  if (last) nextParams.set('before', String(last.id));

  return (
    <>
      <form
        action="/admin/logs"
        className="mb-4 grid gap-2 sm:grid-cols-[200px_160px_160px_auto] sm:items-end"
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          แอดมิน
          <NativeSelect name="admin" defaultValue={adminId ?? ''}>
            <option value="">ทุกคน</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          ตั้งแต่วันที่
          <Input type="date" name="from" defaultValue={from} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          ถึงวันที่
          <Input type="date" name="to" defaultValue={to} />
        </label>
        <Button type="submit" variant="secondary">
          กรอง
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="p-3 text-left font-normal">
                เวลา
              </th>
              <th scope="col" className="p-3 text-left font-normal">
                แอดมิน
              </th>
              <th scope="col" className="p-3 text-left font-normal">
                การกระทำ
              </th>
              <th scope="col" className="p-3 text-left font-normal">
                เป้าหมาย
              </th>
              <th scope="col" className="p-3 text-left font-normal">
                ก่อน → หลัง
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((log) => (
              <tr key={log.id} className="border-b border-border align-top last:border-0">
                <td className="p-3 whitespace-nowrap text-muted-foreground">
                  {log.createdAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                </td>
                <td className="p-3">{log.adminName ?? 'บัญชีที่ลบแล้ว'}</td>
                <td className="p-3">{ACTION_LABELS[log.action] ?? log.action}</td>
                <td className="p-3 font-mono text-xs">
                  {log.targetType ?? '–'}
                  {log.targetId ? ` #${log.targetId}` : ''}
                </td>
                <td className="p-3 font-mono text-xs break-all text-muted-foreground">
                  {log.changes?.before !== undefined && (
                    <span className="block">ก่อน: {summarize(log.changes.before)}</span>
                  )}
                  <span className="block">หลัง: {summarize(log.changes?.after)}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  ไม่มีบันทึกในช่วงนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button asChild variant="secondary">
            <Link href={`/admin/logs?${nextParams}`}>ดูเก่ากว่านี้</Link>
          </Button>
        </div>
      )}
    </>
  );
}

export default function AdminLogsPage({ searchParams }: PageProps<'/admin/logs'>) {
  return (
    <>
      <h1 className="mb-4 t-h1">บันทึกการทำงาน</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <LogsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
