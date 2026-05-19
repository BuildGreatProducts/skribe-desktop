import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditorHistoryStore } from '../../stores/editorHistoryStore';
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
    useEditorHistoryStore.getState().clear();
  });

  it('renders undo and redo controls before project writing instructions', () => {
    useEditorHistoryStore.setState({
      canUndo: true,
      canRedo: false,
      disabled: false,
    });

    render(<AppShell {...appShellProps()} />);

    const buttons = screen.getAllByRole('button');
    const undoIndex = buttons.findIndex((button) => button.getAttribute('aria-label') === 'Undo');
    const redoIndex = buttons.findIndex((button) => button.getAttribute('aria-label') === 'Redo');
    const instructionsIndex = buttons.findIndex(
      (button) => button.getAttribute('aria-label') === 'Project writing instructions',
    );

    expect(undoIndex).toBeGreaterThanOrEqual(0);
    expect(redoIndex).toBeGreaterThan(undoIndex);
    expect(instructionsIndex).toBeGreaterThan(redoIndex);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('calls editor history actions from the chrome buttons', () => {
    const undo = vi.fn();
    const redo = vi.fn();

    useEditorHistoryStore.getState().register({
      undo,
      redo,
      refresh: vi.fn(),
    });
    useEditorHistoryStore.setState({
      canUndo: true,
      canRedo: true,
      disabled: false,
    });

    render(<AppShell {...appShellProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));

    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).toHaveBeenCalledTimes(1);
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
