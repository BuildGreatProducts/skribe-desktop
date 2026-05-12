import type { ReactNode } from 'react';
import { useState } from 'react';
import clsx from 'clsx';

type TooltipProps = {
  label: string;
  children: ReactNode;
  placement?: 'top' | 'bottom';
};

export function Tooltip({ label, children, placement = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => {
        window.setTimeout(() => setVisible(true), 500);
      }}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible ? (
        <span
          className={clsx(
            'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-sm bg-accent px-3 py-2 text-xs text-paper shadow-modal',
            placement === 'top'
              ? 'bottom-[calc(100%+8px)]'
              : 'top-[calc(100%+8px)]',
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
