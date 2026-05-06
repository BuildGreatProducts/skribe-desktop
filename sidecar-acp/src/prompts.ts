export type DocumentReference = {
  path: string;
  relativePath: string;
  name: string;
};

export type SkribePromptOptions = {
  prompt: string;
  activeFilePath: string;
  workingFolder: string;
  selectedText?: string | null;
  documentReferences?: DocumentReference[] | null;
};

export function buildSkribePrompt({
  prompt,
  activeFilePath,
  workingFolder,
  selectedText,
  documentReferences,
}: SkribePromptOptions) {
  const selection = selectedText?.trim() ? selectedText : null;
  const documentReferenceContext = documentReferenceContextBlock(documentReferences);

  if (selection) {
    return `${prompt}

You are Skribe's editing agent.
Active markdown file: ${activeFilePath}
Working folder: ${workingFolder}
${documentReferenceContext}

Highlighted text selected by the user:
<<<SKRIBE_SELECTED_TEXT
${selectedText}
SKRIBE_SELECTED_TEXT

Use Claude Code's file tools when useful:
- Read the active markdown file before editing it.
- You may inspect sibling markdown files for tone and context.
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

Use Claude Code's file tools when useful:
- Read the active markdown file before editing it.
- You may inspect sibling markdown files for tone and context.
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
