import clsx from 'clsx';

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="flex w-full items-center justify-between gap-4 py-2 text-left text-sm text-ink"
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span
        className={clsx(
          'relative h-6 w-11 rounded-[999px] border border-hairline transition',
          checked ? 'bg-accent' : 'bg-chrome-bg',
        )}
      >
        <span
          className={clsx(
            'absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-[999px] bg-paper transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  );
}
