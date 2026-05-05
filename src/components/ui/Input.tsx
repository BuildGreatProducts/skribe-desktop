import clsx from 'clsx';
import type { InputHTMLAttributes } from 'react';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'h-9 w-full rounded-md border border-hairline bg-paper px-3 text-base text-ink placeholder:text-chrome-text-soft focus:border-accent focus:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
