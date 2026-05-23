import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const PERSISTENT_SELECTION_META = 'persistentSelection';
export const PERSISTENT_SELECTION_CLASS = 'skribe-ai-selection';

export const INSERTION_MARKER_META = 'insertionMarker';
export const INSERTION_MARKER_CLASS = 'skribe-ai-insertion-marker';

const persistentSelectionPluginKey = new PluginKey<DecorationSet>(
  'persistentSelection',
);

const insertionMarkerPluginKey = new PluginKey<{
  pos: number | null;
  decorations: DecorationSet;
}>('insertionMarker');

export type PersistentSelectionRange = { from: number; to: number } | null;
export type InsertionMarkerPos = number | null;

function buildDecorationSet(
  doc: ProseMirrorNode,
  range: PersistentSelectionRange,
): DecorationSet {
  if (!range) return DecorationSet.empty;

  const docSize = doc.content.size;
  const from = Math.max(0, Math.min(range.from, docSize));
  const to = Math.max(0, Math.min(range.to, docSize));
  if (from >= to) return DecorationSet.empty;

  return DecorationSet.create(doc, [
    Decoration.inline(from, to, { class: PERSISTENT_SELECTION_CLASS }),
  ]);
}

// The insertion marker pos is tracked in plugin state and used to position
// the gutter button; no inline decoration is rendered so the document's
// layout (and therefore the gutter button's computed Y) stays stable
// before and after an insertion point is set.

export const PersistentSelection = Extension.create({
  name: 'persistentSelection',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: persistentSelectionPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, value) {
            const meta = tr.getMeta(PERSISTENT_SELECTION_META) as
              | PersistentSelectionRange
              | undefined;

            if (meta !== undefined) {
              return buildDecorationSet(tr.doc, meta);
            }

            if (tr.docChanged) {
              return value.map(tr.mapping, tr.doc);
            }

            return value;
          },
        },
        props: {
          decorations(state) {
            return persistentSelectionPluginKey.getState(state) ?? null;
          },
        },
      }),
      new Plugin<{ pos: number | null; decorations: DecorationSet }>({
        key: insertionMarkerPluginKey,
        state: {
          init() {
            return { pos: null, decorations: DecorationSet.empty };
          },
          apply(tr, value) {
            const meta = tr.getMeta(INSERTION_MARKER_META) as
              | InsertionMarkerPos
              | undefined;

            if (meta !== undefined) {
              return { pos: meta, decorations: DecorationSet.empty };
            }

            if (tr.docChanged && value.pos !== null) {
              return {
                pos: tr.mapping.map(value.pos),
                decorations: DecorationSet.empty,
              };
            }

            return value;
          },
        },
        props: {
          decorations(state) {
            return insertionMarkerPluginKey.getState(state)?.decorations ?? null;
          },
        },
      }),
    ];
  },
});

export function readInsertionMarkerPos(
  state: import('@tiptap/pm/state').EditorState,
): number | null {
  return insertionMarkerPluginKey.getState(state)?.pos ?? null;
}
