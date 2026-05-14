import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const noop = vi.fn();

function appShellProps(sidebar: ReactNode = null) {
  return {
    sidebar,
    children: <div>Editor</div>,
    fileTreeWidth: 240,
    sidebarCollapsed: false,
    onCreateFile: noop,
    onCreateFolder: noop,
    onGoHome: noop,
    onToggleSidebar: noop,
    onOpenProjectInstructions: noop,
    onOpenSettings: noop,
  };
}

function queryFileNavigation(container: HTMLElement) {
  return container.querySelector<HTMLElement>(
    '[aria-label="File navigation"]',
  );
}

function fileNavigation(container: HTMLElement) {
  const navigation = queryFileNavigation(container);
  if (!navigation) throw new Error('File navigation not found');
  return navigation;
}

describe('AppShell', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('adds a draggable top bar on the home screen', () => {
    const { container } = render(<AppShell {...appShellProps()} />);

    const dragRegion = container.querySelector('[data-tauri-drag-region]');

    expect(dragRegion).toBeInTheDocument();
    expect(dragRegion).toHaveClass('top-0', 'h-13', 'z-20');
  });

  it('mounts the sidebar at full width when opening a project from home', () => {
    const { container, rerender } = render(<AppShell {...appShellProps()} />);

    expect(queryFileNavigation(container)).not.toBeInTheDocument();

    rerender(<AppShell {...appShellProps(<div>Files</div>)} />);

    const navigation = fileNavigation(container);
    expect(navigation).toHaveStyle({ width: '240px' });
  });

  it('keeps the sidebar width transition for regular in-project toggles', () => {
    const { container, rerender } = render(
      <AppShell {...appShellProps(<div>Files</div>)} />,
    );

    expect(fileNavigation(container)).toHaveClass('transition-[width]');

    rerender(
      <AppShell
        {...appShellProps(<div>Files</div>)}
        sidebarCollapsed
      />,
    );

    expect(fileNavigation(container)).toHaveClass('transition-[width]');
  });
});
