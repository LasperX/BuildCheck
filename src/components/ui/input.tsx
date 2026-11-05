import * as React from 'react';
import { cn } from 'cn';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-subtle focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
