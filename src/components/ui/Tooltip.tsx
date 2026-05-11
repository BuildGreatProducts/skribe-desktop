import type { ReactNode } from 'react';
import { useState } from 'react';

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
          className={
            placement === 'top'
              ? 'pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-sm bg-accent px-3 py-2 text-xs text-paper shadow-modal'
              : 'pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-50 -translate-x-1/2 whitespace-nowrap rounded-sm bg-accent px-3 py-2 text-xs text-paper shadow-modal'
          }
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
