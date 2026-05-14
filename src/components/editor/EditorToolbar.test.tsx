import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorToolbar } from './EditorToolbar';

type MockChain = {
  focus: () => MockChain;
  toggleBold: () => MockChain;
  toggleItalic: () => MockChain;
  toggleHeading: (attributes: { level: number }) => MockChain;
  toggleBlockquote: () => MockChain;
  toggleCodeBlock: () => MockChain;
  toggleBulletList: () => MockChain;
  toggleOrderedList: () => MockChain;
  run: () => boolean;
};

function toolbarEditor({
  activeHeadingLevel,
  activeNodes = [],
}: {
  activeHeadingLevel?: number;
  activeNodes?: string[];
} = {}) {
  const run = vi.fn(() => true);
  const chain: MockChain = {
    focus: vi.fn(() => chain),
    toggleBold: vi.fn(() => chain),
    toggleItalic: vi.fn(() => chain),
    toggleHeading: vi.fn(() => chain),
    toggleBlockquote: vi.fn(() => chain),
    toggleCodeBlock: vi.fn(() => chain),
    toggleBulletList: vi.fn(() => chain),
    toggleOrderedList: vi.fn(() => chain),
    run,
  };
  const editor = {
    chain: vi.fn(() => chain),
    getAttributes: vi.fn(() => ({})),
    isActive: vi.fn((name: string, attributes?: { level?: number }) => {
      if (name === 'heading') return attributes?.level === activeHeadingLevel;
      return activeNodes.includes(name);
    }),
    on: vi.fn(),
    off: vi.fn(),
  };

  return { chain, editor: editor as unknown as TiptapEditor, run };
}

describe('EditorToolbar', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps the top bar tall enough for the fixed chrome icons', () => {
    const { editor } = toolbarEditor();

    const { container } = render(<EditorToolbar editor={editor} />);

    expect(container.firstElementChild).toHaveClass('h-[52px]');
  });

  it('centers the formatting controls within the top bar height', () => {
    const { editor } = toolbarEditor();

    render(<EditorToolbar editor={editor} />);

    expect(screen.getByRole('toolbar', { name: 'Text formatting' })).toHaveClass(
      'h-full',
      'items-center',
      'translate-y-[2px]',
    );
  });

  it('toggles code blocks from the toolbar', () => {
    const { chain, editor, run } = toolbarEditor();

    render(<EditorToolbar editor={editor} />);

    fireEvent.click(screen.getByRole('button', { name: 'Code' }));

    expect(chain.focus).toHaveBeenCalled();
    expect(chain.toggleCodeBlock).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
  });

  it('marks the code block control active when the selection is in code', () => {
    const { editor } = toolbarEditor({ activeNodes: ['codeBlock'] });

    render(<EditorToolbar editor={editor} />);

    expect(screen.getByRole('button', { name: 'Code' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('toggles lower-level headings from the toolbar', () => {
    const { chain, editor, run } = toolbarEditor();

    render(<EditorToolbar editor={editor} />);

    fireEvent.click(screen.getByRole('button', { name: 'H6' }));

    expect(chain.focus).toHaveBeenCalled();
    expect(chain.toggleHeading).toHaveBeenCalledWith({ level: 6 });
    expect(run).toHaveBeenCalled();
  });

  it('marks the matching heading control active', () => {
    const { editor } = toolbarEditor({ activeHeadingLevel: 5 });

    render(<EditorToolbar editor={editor} />);

    expect(screen.getByRole('button', { name: 'H5' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'H4' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
