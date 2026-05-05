import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'link' | 'danger';
  icon?: ReactNode;
};

export function Button({
  variant = 'primary',
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-paper hover:bg-[#162132]',
        variant === 'secondary' && 'bg-transparent px-3 text-chrome-text hover:bg-paper/50',
        variant === 'link' && 'h-auto rounded-none px-0 text-accent underline-offset-4 hover:underline',
        variant === 'danger' && 'bg-error text-paper hover:brightness-95',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="inline-flex shrink-0 items-center justify-center leading-none [&>svg]:block" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
