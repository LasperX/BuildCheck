import { Label } from '@/components/ui/label';

type FormFieldProps = {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  children: React.ReactNode;
};

/** ป้ายกำกับ + ช่องกรอก + ข้อความผิดพลาด ใช้ซ้ำทุกฟอร์ม */
export function FormField({ id, label, error, hint, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-err-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** กล่องแจ้งผลของทั้งฟอร์ม มีไอคอนกำกับเสมอ เพราะสถานะต้องไม่สื่อด้วยสีอย่างเดียว */
export function FormAlert({
  variant,
  icon,
  children,
}: {
  variant: 'err' | 'ok' | 'info' | 'warn';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = {
    err: 'border-err-border bg-err-soft text-err-fg',
    ok: 'border-ok-border bg-ok-soft text-ok-fg',
    info: 'border-info-border bg-info-soft text-info-fg',
    warn: 'border-warn-border bg-warn-soft text-warn-fg',
  }[variant];
  return (
    <div
      role={variant === 'err' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-md border p-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 ${styles}`}
    >
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
