import { CircleCheck, Info, Lightbulb } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Issue, Suggestion } from '@/lib/compat';
import { cn } from '@/lib/utils';

import { LEVEL_UI } from './levels';

/** รายการปัญหาเรียงผิดพลาด → เตือน → ข้อมูล พร้อมสาเหตุ วิธีแก้ และปุ่มหาอะไหล่ทดแทน (หัวข้อ 3.4) */
export function IssueList({
  issues,
  empty,
  onSuggest,
}: {
  issues: Issue[];
  empty: boolean;
  /** ไม่ส่ง = แสดงอย่างเดียว (หน้ารายละเอียดสเปก) */
  onSuggest?: (suggest: Suggestion, issue: Issue) => void;
}) {
  if (issues.length === 0) {
    const Icon = empty ? Info : CircleCheck;
    return (
      <div
        className={cn(
          'flex items-start gap-3 rounded-lg border p-4',
          empty ? 'border-border bg-surface' : 'border-ok-border bg-ok-soft',
        )}
      >
        <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', !empty && 'text-ok-fg')} />
        <div>
          <p className="font-medium">{empty ? 'ยังไม่มีอะไหล่ในสเปก' : 'ไม่พบปัญหา'}</p>
          <p className="text-sm text-muted-foreground">
            {empty
              ? 'เริ่มจากเลือก CPU ระบบจะตรวจให้ทันทีทุกครั้งที่เปลี่ยนอะไหล่'
              : 'อะไหล่ที่เลือกไว้เข้ากันได้ทั้งหมด'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {issues.map((issue, index) => {
        const ui = LEVEL_UI[issue.level];
        const Icon = ui.icon;
        return (
          <li
            key={`${issue.code}-${index}`}
            className={cn('flex items-start gap-3 rounded-lg border p-4', ui.soft)}
          >
            <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', ui.text)} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 font-medium">
                {issue.code.startsWith('R') && (
                  <span className={cn('font-mono text-sm font-semibold', ui.text)}>
                    {issue.code}
                  </span>
                )}
                <span>{issue.title}</span>
                <span className="sr-only">ระดับ{ui.label}</span>
              </p>
              <p className="mt-1 text-sm">{issue.message}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">วิธีแก้:</span> {issue.fix}
              </p>
              {issue.suggest && onSuggest && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => issue.suggest && onSuggest(issue.suggest, issue)}
                >
                  <Lightbulb aria-hidden />
                  {issue.suggest.label}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
