import { describe, expect, it, vi } from 'vitest';
import {
  handleActiveFileChange,
  type ActiveEditorFileState,
} from './activeFileChange';

const filePath = '/tmp/project/README.md';

function editorState(
  state: Partial<ActiveEditorFileState> = {},
): ActiveEditorFileState {
  return {
    filePath,
    content: 'Draft',
    originalContent: 'Draft',
    pendingSaveContent: null,
    isDirty: false,
    ...state,
  };
}

describe('handleActiveFileChange', () => {
  it('closes the active file when it is deleted', async () => {
    const readFile = vi.fn(async () => 'Draft');
    const applyExternalContent = vi.fn();
    const closeFile = vi.fn();
    const setReloadPrompt = vi.fn();

    await handleActiveFileChange({
      payload: { event: 'deleted', path: filePath },
      readFile,
      getEditorState: () => editorState(),
      applyExternalContent,
      closeFile,
      setReloadPrompt,
    });

    expect(closeFile).toHaveBeenCalledOnce();
    expect(setReloadPrompt).toHaveBeenCalledWith(null);
    expect(readFile).not.toHaveBeenCalled();
    expect(applyExternalContent).not.toHaveBeenCalled();
  });

  it('ignores watcher events for unrelated paths', async () => {
    const readFile = vi.fn(async () => 'External edit');
    const applyExternalContent = vi.fn();
    const closeFile = vi.fn();
    const setReloadPrompt = vi.fn();

    await handleActiveFileChange({
      payload: { event: 'modified', path: '/tmp/project/other.txt' },
      readFile,
      getEditorState: () => editorState(),
      applyExternalContent,
      closeFile,
      setReloadPrompt,
    });

    expect(readFile).not.toHaveBeenCalled();
    expect(applyExternalContent).not.toHaveBeenCalled();
    expect(setReloadPrompt).not.toHaveBeenCalled();
    expect(closeFile).not.toHaveBeenCalled();
  });

  it('ignores watcher events for the last content Skribe saved while the user keeps typing', async () => {
    const applyExternalContent = vi.fn();
    const setReloadPrompt = vi.fn();

    await handleActiveFileChange({
      payload: { event: 'modified', path: filePath },
      readFile: vi.fn(async () => 'Draft'),
      getEditorState: () =>
        editorState({
          content: 'Draft with newer local edits',
          originalContent: 'Draft',
          isDirty: true,
        }),
      applyExternalContent,
      closeFile: vi.fn(),
      setReloadPrompt,
    });

    expect(applyExternalContent).not.toHaveBeenCalled();
    expect(setReloadPrompt).not.toHaveBeenCalled();
  });

  it('ignores watcher events for a save that is still in flight', async () => {
    const applyExternalContent = vi.fn();
    const setReloadPrompt = vi.fn();

    await handleActiveFileChange({
      payload: { event: 'modified', path: filePath },
      readFile: vi.fn(async () => 'Draft'),
      getEditorState: () =>
        editorState({
          content: 'Draft with newer local edits',
          originalContent: 'Older draft',
          pendingSaveContent: 'Draft',
          isDirty: true,
        }),
      applyExternalContent,
      closeFile: vi.fn(),
      setReloadPrompt,
    });

    expect(applyExternalContent).not.toHaveBeenCalled();
    expect(setReloadPrompt).not.toHaveBeenCalled();
  });

  it('prompts when a dirty active file changed to different disk content', async () => {
    const setReloadPrompt = vi.fn();

    await handleActiveFileChange({
      payload: { event: 'modified', path: filePath },
      readFile: vi.fn(async () => 'External edit'),
      getEditorState: () =>
        editorState({
          content: 'Local edit',
          originalContent: 'Draft',
          isDirty: true,
        }),
      applyExternalContent: vi.fn(),
      closeFile: vi.fn(),
      setReloadPrompt,
    });

    expect(setReloadPrompt).toHaveBeenCalledWith(filePath);
  });

  it('applies disk content when the active file is clean', async () => {
    const applyExternalContent = vi.fn();

    await handleActiveFileChange({
      payload: { event: 'modified', path: filePath },
      readFile: vi.fn(async () => 'External edit'),
      getEditorState: () => editorState(),
      applyExternalContent,
      closeFile: vi.fn(),
      setReloadPrompt: vi.fn(),
    });

    expect(applyExternalContent).toHaveBeenCalledWith('External edit');
  });

  it('skips watcher processing when reading disk content fails', async () => {
    const applyExternalContent = vi.fn();
    const setReloadPrompt = vi.fn();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    await handleActiveFileChange({
      payload: { event: 'modified', path: filePath },
      readFile: vi.fn(async () => {
        throw new Error('file disappeared');
      }),
      getEditorState: () => editorState(),
      applyExternalContent,
      closeFile: vi.fn(),
      setReloadPrompt,
    });

    expect(applyExternalContent).not.toHaveBeenCalled();
    expect(setReloadPrompt).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      'readFile failed for activeFilePath.',
      expect.objectContaining({ activeFilePath: filePath }),
    );

    debugSpy.mockRestore();
  });
});
