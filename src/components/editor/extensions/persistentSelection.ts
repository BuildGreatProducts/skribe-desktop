import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const PERSISTENT_SELECTION_META = 'persistentSelection';
export const PERSISTENT_SELECTION_CLASS = 'skribe-ai-selection';

const persistentSelectionPluginKey = new PluginKey<DecorationSet>(
  'persistentSelection',
);

export type PersistentSelectionRange = { from: number; to: number } | null;

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
    ];
  },
});
