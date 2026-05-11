import {
  BookOpenTextIcon,
  FolderPlusIcon,
  GearIcon,
  HouseLineIcon,
  PlusIcon,
  SidebarSimpleIcon,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Button } from '../ui';

type AppShellProps = {
  banner?: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  fileTreeWidth: number;
  sidebarCollapsed: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onGoHome: () => void;
  onToggleSidebar: () => void;
  onOpenProjectInstructions: () => void;
  onOpenSettings: () => void;
  projectInstructionsDisabled?: boolean;
};

export function AppShell({
  banner,
  sidebar,
  children,
  fileTreeWidth,
  sidebarCollapsed,
  onCreateFile,
  onCreateFolder,
  onGoHome,
  onToggleSidebar,
  onOpenProjectInstructions,
  onOpenSettings,
  projectInstructionsDisabled = false,
}: AppShellProps) {
  const hasSidebar = Boolean(sidebar);
  const expandedSidebarWidth = Math.min(360, Math.max(200, fileTreeWidth || 240));
  const sidebarWidth = !hasSidebar || sidebarCollapsed ? 0 : expandedSidebarWidth;
  const collapseButtonLeft = sidebarCollapsed ? 84 : expandedSidebarWidth + 12;
  const iconButtonClass =
    'h-8 w-8 border-0 bg-transparent px-0 text-chrome-text-soft shadow-none hover:!bg-transparent hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      {banner}
      <div className="relative min-h-0 flex-1">
        {hasSidebar ? (
          <div
            className="absolute top-2.5 z-30 flex items-center gap-2 transition-[left]"
            style={{ left: collapseButtonLeft }}
          >
            <Button
              aria-label={sidebarCollapsed ? 'Expand file navigation' : 'Collapse file navigation'}
              variant="secondary"
              className={iconButtonClass}
              onClick={onToggleSidebar}
              icon={
                <SidebarSimpleIcon
                  size={18}
                  weight="bold"
                  className={sidebarCollapsed ? '' : 'scale-x-[-1]'}
                />
              }
            />
            <Button
              aria-label="Back to home"
              variant="secondary"
              className={iconButtonClass}
              onClick={onGoHome}
              icon={<HouseLineIcon size={17} weight="bold" />}
            />
          </div>
        ) : null}
        <div className="absolute right-3 top-2.5 z-30 flex items-center gap-2">
          <Button
            aria-label="Project writing instructions"
            variant="secondary"
            className={iconButtonClass}
            disabled={projectInstructionsDisabled}
            onClick={onOpenProjectInstructions}
            icon={<BookOpenTextIcon size={17} weight="bold" />}
          />
          <Button
            aria-label="Settings"
            variant="secondary"
            className={iconButtonClass}
            onClick={onOpenSettings}
            icon={<GearIcon size={16} weight="bold" />}
          />
        </div>
        <div className="flex h-full">
          <aside
            className="min-h-0 shrink-0 overflow-hidden border-r border-hairline bg-chrome-bg transition-[width] duration-200 ease-in-out"
            style={{ width: sidebarWidth }}
            aria-label="File navigation"
            aria-hidden={!hasSidebar}
          >
            {hasSidebar ? (
              <div
                className="flex h-full flex-col transition-opacity duration-200 ease-in-out"
                style={{ width: expandedSidebarWidth, opacity: sidebarCollapsed ? 0 : 1 }}
                aria-hidden={sidebarCollapsed}
              >
                <div className="flex h-12 shrink-0 items-start justify-end gap-2 px-2 pt-2.5">
                  <div className="min-w-0 flex-1 self-stretch" aria-hidden="true" data-tauri-drag-region />
                  <Button
                    aria-label="New file"
                    variant="secondary"
                    className={iconButtonClass}
                    onClick={onCreateFile}
                    icon={<PlusIcon size={16} weight="bold" />}
                  />
                  <Button
                    aria-label="New folder"
                    variant="secondary"
                    className={iconButtonClass}
                    onClick={onCreateFolder}
                    icon={<FolderPlusIcon size={17} weight="bold" />}
                  />
                </div>
                <div className="min-h-0 flex-1">{sidebar}</div>
              </div>
            ) : (
              null
            )}
          </aside>
          <main className="min-w-0 flex-1 bg-paper">{children}</main>
        </div>
      </div>
    </div>
  );
}
