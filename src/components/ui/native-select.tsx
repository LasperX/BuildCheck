import { ChevronDown } from 'lucide-react';
import { cn } from 'cn';
import * as React from 'react';

/** ตัวเลือกของเบราว์เซอร์ที่แต่งให้ตรง Design System ใช้กับฟอร์ม ทำงานบนมือถือได้ดีและใช้คีย์บอร์ดได้ */
export function NativeSelect({
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<'select'>) {
  return (
    <span className="relative block w-full">
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-md border border-input bg-surface pr-9 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:opacity-50 aria-invalid:border-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}
