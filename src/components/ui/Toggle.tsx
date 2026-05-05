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
          'relative h-5 w-9 rounded-[999px] border border-hairline transition',
          checked ? 'bg-accent' : 'bg-chrome-bg',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-[999px] bg-paper transition',
            checked ? 'left-4' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}
