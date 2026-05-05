import clsx from 'clsx';
import type { SelectHTMLAttributes } from 'react';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'h-9 rounded-md border border-hairline bg-paper px-3 text-sm text-ink focus:border-accent focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
