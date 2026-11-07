'use client';

import { useState, useTransition } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { MUTABLE_TYPES, NOTIFICATION_LABELS } from '@/lib/notifications';
import { updateNotificationPrefs } from '@/server/actions/notifications';

type Mutable = (typeof MUTABLE_TYPES)[number];

/** เปิด/ปิดการแจ้งเตือนแต่ละประเภท (หัวข้อ 3.8) บันทึกทันทีที่กดสวิตช์ */
export function NotificationPrefs({ muted }: { muted: string[] }) {
  const [off, setOff] = useState<Set<Mutable>>(
    () => new Set(MUTABLE_TYPES.filter((type) => muted.includes(type))),
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (type: Mutable, enabled: boolean) => {
    const next = new Set(off);
    if (enabled) next.delete(type);
    else next.add(type);
    setOff(next);
    startTransition(async () => {
      const result = await updateNotificationPrefs([...next]);
      setMessage(result.ok ? { ok: true, text: 'บันทึกแล้ว' } : { ok: false, text: result.error });
      if (!result.ok) setOff(off);
    });
  };

  return (
    <Card id="notifications">
      <CardHeader>
        <CardTitle>การแจ้งเตือน</CardTitle>
        <CardDescription>เลือกเรื่องที่อยากให้แจ้ง ประกาศจากระบบแจ้งเสมอ</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {MUTABLE_TYPES.map((type) => (
            <li key={type} className="flex items-center justify-between gap-3 py-2.5">
              <label htmlFor={`pref-${type}`} className="text-sm">
                {NOTIFICATION_LABELS[type]}
              </label>
              <Switch
                id={`pref-${type}`}
                checked={!off.has(type)}
                disabled={pending}
                onCheckedChange={(checked) => toggle(type, checked)}
              />
            </li>
          ))}
        </ul>
        {message && (
          <p
            role="status"
            className={message.ok ? 'mt-2 text-xs text-ok-fg' : 'mt-2 text-xs text-err-fg'}
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
