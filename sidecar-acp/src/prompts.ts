export type DocumentReference = {
  path: string;
  relativePath: string;
  name: string;
};

export type PromptAttachment = {
  path: string;
  name: string;
  size: number;
  kind: 'image' | 'pdf' | 'text' | 'file';
  mimeType?: string | null;
};

export type InsertionContext = {
  markedDocument: string;
};

export const INSERT_SENTINEL = '<<<SKRIBE_INSERT_HERE>>>';

export type SkribePromptOptions = {
  prompt: string;
  activeFilePath: string;
  workingFolder: string;
  agentLabel?: string;
  selectedText?: string | null;
  documentReferences?: DocumentReference[] | null;
  attachments?: PromptAttachment[] | null;
  insertion?: InsertionContext | null;
};

export function buildSkribePrompt({
  prompt,
  activeFilePath,
  workingFolder,
  agentLabel = 'Claude Code',
  selectedText,
  documentReferences,
  attachments,
  insertion,
}: SkribePromptOptions) {
  const selection = selectedText?.trim() ? selectedText : null;
  const documentReferenceContext = documentReferenceContextBlock(documentReferences);
  const attachmentContext = attachmentContextBlock(attachments);
  const insertionDoc = insertion?.markedDocument?.trim()
    ? insertion.markedDocument
    : null;

  if (insertionDoc) {
    return `${prompt}

You are Skribe's editing agent.
Active markdown file: ${activeFilePath}
Working folder: ${workingFolder}
${documentReferenceContext}
${attachmentContext}

Full Markdown document with the user's chosen insertion point marked as ${INSERT_SENTINEL}:
<<<SKRIBE_DOCUMENT
${insertionDoc}
SKRIBE_DOCUMENT

Use ${agentLabel}'s file tools when useful:
- You may inspect sibling markdown files for tone and context.
- You may use WebFetch to read URLs explicitly provided by the user.
- Do not use file modification tools. Skribe will splice your final Markdown into the document at the marker.
- Use the surrounding text in the document above as context so the inserted content flows naturally with what comes before and after the marker.
- Do not output the rest of the document, do not repeat the marker, and do not rewrite unrelated text.
- If the user asks to create another file, describe the requested file content in your final response instead of writing it.

Output only the Markdown to insert at the ${INSERT_SENTINEL} marker. Do not output the surrounding document. Do not add an outer code fence around your response. Still use normal Markdown code fences inside the content for literal code, terminal output, and file trees; use a text fence for directory/file trees. Do not include commentary.`;
  }

  if (selection) {
    return `${prompt}

You are Skribe's editing agent.
Active markdown file: ${activeFilePath}
Working folder: ${workingFolder}
${documentReferenceContext}
${attachmentContext}

Highlighted text selected by the user:
<<<SKRIBE_SELECTED_TEXT
${selectedText}
SKRIBE_SELECTED_TEXT

Use ${agentLabel}'s file tools when useful:
- Read the active markdown file before editing it.
- You may inspect sibling markdown files for tone and context.
- You may use WebFetch to read URLs explicitly provided by the user.
- Do not use file modification tools. Skribe will apply your final Markdown to the selected text only.
- Preserve surrounding document context. Do not rewrite unrelated text.
- If the user asks to create another file, describe the requested file content in your final response instead of writing it.

Output only the replacement Markdown for the highlighted text. Do not output the complete document. Do not add an outer code fence around your response. Still use normal Markdown code fences inside the content for literal code, terminal output, and file trees; use a text fence for directory/file trees. Do not include commentary.`;
  }

  return `${prompt}

You are Skribe's editing agent.
Active markdown file: ${activeFilePath}
Working folder: ${workingFolder}
${documentReferenceContext}
${attachmentContext}

Use ${agentLabel}'s file tools when useful:
- Read the active markdown file before editing it.
- You may inspect sibling markdown files for tone and context.
- You may use WebFetch to read URLs explicitly provided by the user.
- Do not use file modification tools. Skribe will apply your final Markdown to the active file.
- If the user asks to create another file, describe the requested file content in your final response instead of writing it.

Output only the complete final Markdown contents of the active document. Do not add an outer code fence around your response. Still use normal Markdown code fences inside the document for literal code, terminal output, and file trees; use a text fence for directory/file trees. Do not include commentary.`;
}

function documentReferenceContextBlock(documentReferences?: DocumentReference[] | null): string {
  const references = documentReferences?.filter(
    (reference) => reference.path.trim() && reference.relativePath.trim(),
  );
  if (!references?.length) return '';

  const list = references
    .map(
      (reference, index) =>
        `${index + 1}. ${reference.name}\n   Relative path: ${reference.relativePath}\n   Absolute path: ${reference.path}`,
    )
    .join('\n');

  return `

User-selected context documents:
${list}

These documents were intentionally referenced by the user. Read them when useful for the request, but only edit the active markdown file unless the user explicitly asks otherwise.`;
}

function attachmentContextBlock(attachments?: PromptAttachment[] | null): string {
  const selectedAttachments = attachments?.filter(
    (attachment) => attachment.path.trim() && attachment.name.trim(),
  );
  if (!selectedAttachments?.length) return '';

  const list = selectedAttachments
    .map((attachment, index) => {
      const name = sanitizeAttachmentField(attachment.name);
      const path = sanitizeAttachmentField(attachment.path);
      const mimeType = attachment.mimeType ? `\n   MIME type: ${attachment.mimeType}` : '';
      return `${index + 1}. ${name}\n   Absolute path: ${path}\n   Kind: ${attachment.kind}\n   Size: ${attachment.size} bytes${mimeType}`;
    })
    .join('\n');

  return `

User-attached files:
${list}

These files were intentionally attached by the user. Read them when useful for the request, but do not modify attached files unless the user explicitly asks you to.`;
}

function sanitizeAttachmentField(value: string): string {
  return value
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
}
