import type { Editor as TiptapEditor } from '@tiptap/react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

type EditorToolbarProps = {
  editor: TiptapEditor | null;
  disabled?: boolean;
};

type ToolbarControl = {
  label: string;
  active: () => boolean;
  run: () => void;
};

export function EditorToolbar({ editor, disabled = false }: EditorToolbarProps) {
  const [, setRenderVersion] = useState(0);

  useEffect(() => {
    if (!editor) return undefined;
    const rerender = () => setRenderVersion((version) => version + 1);
    editor.on('selectionUpdate', rerender);
    editor.on('transaction', rerender);
    return () => {
      editor.off('selectionUpdate', rerender);
      editor.off('transaction', rerender);
    };
  }, [editor]);

  if (!editor) return null;

  const controls: ToolbarControl[] = [
    {
      label: 'Bold',
      active: () => editor.isActive('bold'),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      active: () => editor.isActive('italic'),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: 'H1',
      active: () => editor.isActive('heading', { level: 1 }),
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: 'H2',
      active: () => editor.isActive('heading', { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'H3',
      active: () => editor.isActive('heading', { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: 'Quote',
      active: () => editor.isActive('blockquote'),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'Code',
      active: () => editor.isActive('codeBlock'),
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: 'Bullets',
      active: () => editor.isActive('bulletList'),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbers',
      active: () => editor.isActive('orderedList'),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Link',
      active: () => editor.isActive('link'),
      run: () => setLink(editor),
    },
  ];

  return (
    <div className="sticky top-0 z-10 border-b border-hairline bg-paper">
      <div className="absolute inset-0" aria-hidden="true" data-tauri-drag-region />
      <div
        className="skribe-scrollbar pointer-events-none relative z-10 mx-auto flex w-full max-w-[44rem] items-center justify-center gap-5 overflow-x-auto px-8 py-3"
        role="toolbar"
        aria-label="Text formatting"
      >
        {controls.map((control) => (
          <button
            key={control.label}
            type="button"
            aria-label={control.label}
            aria-pressed={control.active()}
            disabled={disabled}
            className={clsx(
              'pointer-events-auto h-8 shrink-0 rounded-sm px-1 text-base text-chrome-text-soft transition hover:text-ink focus-visible:outline-offset-4 disabled:pointer-events-none disabled:opacity-40',
              control.active() && 'font-semibold text-ink',
            )}
            onMouseDown={(event) => event.preventDefault()}
            onClick={control.run}
          >
            {control.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function setLink(editor: TiptapEditor) {
  const previousHref = editor.getAttributes('link').href;
  const nextHref = window.prompt('Link URL', typeof previousHref === 'string' ? previousHref : '');
  if (nextHref === null) return;

  const href = nextHref.trim();
  if (!href) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }

  editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
}
