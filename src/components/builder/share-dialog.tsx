'use client';

import { Check, Copy, ExternalLink, ImageDown } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { VISIBILITY_LABELS, type Visibility } from '@/lib/builder/types';
import { shareBuild, type ShareResult } from '@/server/actions/builds';

/**
 * แชร์สเปก: ลิงก์สั้น QR Code และเลือกว่าใครเห็นได้ (หัวข้อ 3.3)
 * ผู้เยี่ยมชมต้องสมัครก่อน เพราะลิงก์ต้องชี้ไปสเปกที่บันทึกในระบบ (มติในหัวข้อ C)
 */
export function ShareDialog({
  open,
  onOpenChange,
  loggedIn,
  ensureSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loggedIn: boolean;
  /** บันทึกให้ก่อนถ้ายังไม่เคยบันทึก แล้วคืนรหัสสเปก */
  ensureSaved: () => Promise<string | null>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>แชร์สเปกนี้</DialogTitle>
          <DialogDescription>
            {loggedIn
              ? 'ส่งลิงก์หรือให้เพื่อนสแกน QR เพื่อเปิดดูสเปก'
              : 'สมัครสมาชิกฟรีเพื่อสร้างลิงก์แชร์ สเปกที่จัดไว้จะย้ายเข้าบัญชีให้อัตโนมัติ'}
          </DialogDescription>
        </DialogHeader>
        {open && (loggedIn ? <ShareBody ensureSaved={ensureSaved} /> : <GuestBody />)}
      </DialogContent>
    </Dialog>
  );
}

function GuestBody() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button asChild className="flex-1">
        <Link href="/register">สมัครสมาชิก</Link>
      </Button>
      <Button asChild variant="secondary" className="flex-1">
        <Link href="/login?next=/builder">เข้าสู่ระบบ</Link>
      </Button>
    </div>
  );
}

function ShareBody({ ensureSaved }: { ensureSaved: () => Promise<string | null> }) {
  const [buildId, setBuildId] = useState<string | null>(null);
  const [share, setShare] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void (async () => {
      const id = await ensureSaved();
      if (!active) return;
      if (!id) {
        setShare({ ok: false, error: 'บันทึกสเปกไม่สำเร็จ กรุณาลองใหม่' });
        return;
      }
      setBuildId(id);
      const result = await shareBuild(id);
      if (active) setShare(result);
    })();
    return () => {
      active = false;
    };
    // เรียกครั้งเดียวตอนเปิดหน้าต่าง
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!share) return <p className="text-sm text-muted-foreground">กำลังสร้างลิงก์…</p>;
  if (!share.ok) {
    return (
      <p role="alert" className="text-sm text-err-fg">
        {share.error}
      </p>
    );
  }

  const changeVisibility = (visibility: Visibility) => {
    if (!buildId) return;
    startTransition(async () => setShare(await shareBuild(buildId, visibility)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div
          role="img"
          aria-label={`QR Code ของลิงก์ ${share.url}`}
          className="size-36 shrink-0 overflow-hidden rounded-lg border border-border bg-white p-1 [&_svg]:size-full"
          // SVG สร้างจากไลบรารี qrcode บนเซิร์ฟเวอร์จากลิงก์ของระบบเอง ไม่มีข้อความจากผู้ใช้
          dangerouslySetInnerHTML={{ __html: share.qr }}
        />
        <div className="flex w-full min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-url">ลิงก์สั้น</Label>
            <div className="flex gap-2">
              <Input id="share-url" readOnly value={share.url} className="font-mono text-xs" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="คัดลอกลิงก์"
                onClick={async () => {
                  await navigator.clipboard.writeText(share.url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              </Button>
            </div>
            <p aria-live="polite" className="text-xs text-ok-fg">
              {copied ? 'คัดลอกแล้ว' : ''}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-visibility">ใครเห็นได้</Label>
            <NativeSelect
              id="share-visibility"
              value={share.visibility}
              disabled={pending}
              onChange={(event) => changeVisibility(event.target.value as Visibility)}
            >
              {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((key) => (
                <option key={key} value={key}>
                  {VISIBILITY_LABELS[key]}
                </option>
              ))}
            </NativeSelect>
            {share.visibility === 'private' && (
              <p className="text-xs text-warn-fg">สเปกส่วนตัว คนอื่นเปิดลิงก์นี้ไม่ได้</p>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="secondary" className="flex-1">
          <a href={`/api/og/build/${buildId}?download=1`} download>
            <ImageDown aria-hidden />
            ดาวน์โหลดรูปสรุป
          </a>
        </Button>
        <Button asChild variant="secondary" className="flex-1">
          <Link href={`/builds/${buildId}`}>
            <ExternalLink aria-hidden />
            เปิดหน้าสเปก
          </Link>
        </Button>
      </div>
    </div>
  );
}
