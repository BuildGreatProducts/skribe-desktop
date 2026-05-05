import { X } from '@phosphor-icons/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Button } from './Button';

type ModalProps = {
  open: boolean;
  title?: string;
  children: ReactNode;
  className?: string;
  onClose: () => void;
};

export function Modal({ open, title, children, className, onClose }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2A2A2A66] p-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={clsx('w-full max-w-[480px] rounded-lg bg-paper p-6 text-ink shadow-modal', className)}>
        <div className="mb-5 flex items-start justify-between gap-4">
          {title ? <h2 className="m-0 text-doc-h3 font-semibold leading-tight">{title}</h2> : <span />}
          <Button
            aria-label="Close"
            type="button"
            variant="secondary"
            className="h-8 w-8 px-0"
            onClick={onClose}
            icon={<X size={16} />}
          />
        </div>
        {children}
      </div>
    </div>
  );
}
