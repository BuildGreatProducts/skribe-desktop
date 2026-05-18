import { FolderOpen } from '@phosphor-icons/react';
import { Button } from '../ui';
import { useSettingsStore } from '../../stores/settingsStore';

type EmptyStateProps = {
  onOpenFolder: () => void;
  onOpenRecent: (path: string) => void;
};

export function EmptyState({ onOpenFolder, onOpenRecent }: EmptyStateProps) {
  const recentFolders = useSettingsStore((state) => state.settings.recentFolders);
  return (
    <div className="flex h-full items-center justify-center bg-paper px-8">
      <div className="w-full max-w-[480px] text-center">
        <img
          src="/logo.png"
          alt=""
          className="mx-auto mb-6 h-36 w-auto object-contain"
        />
        <h1 className="mb-3 font-editor text-display font-medium leading-tight tracking-[-0.04em] text-ink">Skribe</h1>
        <p className="mb-5 text-base font-normal text-chrome-text-soft">
          Writing finally lives where you build.
        </p>
        <Button
          className="!rounded-full bg-black text-white hover:bg-[#1f1f1f]"
          icon={<FolderOpen size={18} />}
          onClick={onOpenFolder}
        >
          Open folder
        </Button>
        {recentFolders.length > 0 ? (
          <div className="mt-10 text-left">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-chrome-text-soft">
              Recent
            </p>
            <div className="space-y-1">
              {recentFolders.slice(0, 5).map((folder) => (
                <button
                  type="button"
                  key={folder}
                  className="block w-full rounded-sm px-2 py-2 text-left text-sm text-chrome-text transition hover:bg-chrome-bg"
                  onClick={() => onOpenRecent(folder)}
                >
                  {folder.split('/').filter(Boolean).at(-1) ?? folder}
                  <span className="block truncate text-xs text-chrome-text-soft">{folder}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
