import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-brand-hover',
        secondary: 'border-input bg-surface text-foreground hover:bg-surface-2',
        outline: 'border-input bg-surface text-foreground hover:bg-surface-2',
        ghost: 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        destructive: 'border-err-border bg-surface text-err-fg hover:bg-err-soft',
        link: 'text-link underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4',
        xs: "h-6 gap-1 rounded-xs px-2 text-2xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-sm px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
        'icon-xs': "size-6 rounded-xs [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8 rounded-sm',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
