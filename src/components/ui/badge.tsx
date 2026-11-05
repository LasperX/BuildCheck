import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Slot } from 'radix-ui';

const badgeVariants = cva(
  'inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-sm border border-transparent px-2 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-surface-2 text-muted-foreground',
        brand: 'bg-brand-soft text-brand-soft-fg',
        err: 'border-err-border bg-err-soft text-err-fg',
        warn: 'border-warn-border bg-warn-soft text-warn-fg',
        ok: 'border-ok-border bg-ok-soft text-ok-fg',
        info: 'border-info-border bg-info-soft text-info-fg',
        used: 'border-used-border bg-used-soft text-used-fg',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

function Badge({
  className,
  variant = 'neutral',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
