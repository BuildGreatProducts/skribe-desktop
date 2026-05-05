import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import Typography from '@tiptap/extension-typography';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';

const lowlight = createLowlight(common);

export const extensions = [
  StarterKit.configure({
    codeBlock: false,
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
  }),
  Placeholder.configure({
    placeholder: 'Start writing...',
  }),
  Typography,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  CodeBlockLowlight.configure({ lowlight }),
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  Image,
  Markdown.configure({
    html: true,
    tightLists: true,
    tightListClass: 'tight',
    bulletListMarker: '-',
    linkify: false,
    breaks: false,
    transformPastedText: true,
    transformCopiedText: true,
  }),
];
