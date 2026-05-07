import { invoke } from '@tauri-apps/api/core';
import type {
  AppErrorCode,
  AppSettings,
  ClaudePreflight,
  DocumentReference,
  MarkdownFile,
  PromptAttachment,
} from '../types';

export const tauriClient = {
  fs: {
    pickFolder: () => invoke<string | null>('fs_pick_folder'),
    listMarkdownFiles: (folderPath: string) =>
      invoke<MarkdownFile[]>('fs_list_markdown_files', { folderPath }),
    readFile: (filePath: string) => invoke<string>('fs_read_file', { filePath }),
    writeFile: (filePath: string, content: string) =>
      invoke<void>('fs_write_file', { filePath, content }),
    createFile: (folderPath: string, fileName: string) =>
      invoke<MarkdownFile>('fs_create_file', { folderPath, fileName }),
    renameFile: (oldPath: string, newName: string) =>
      invoke<MarkdownFile>('fs_rename_file', { oldPath, newName }),
    deleteFile: (filePath: string) => invoke<void>('fs_delete_file', { filePath }),
    describeAttachments: (paths: string[]) =>
      invoke<PromptAttachment[]>('fs_describe_attachments', { paths }),
    watchFolder: (folderPath: string) => invoke<void>('fs_watch_folder', { folderPath }),
    unwatchFolder: () => invoke<void>('fs_unwatch_folder'),
  },
  settings: {
    load: () => invoke<AppSettings>('settings_load'),
    save: (settings: AppSettings) => invoke<void>('settings_save', { settings }),
    addRecentFolder: (folderPath: string) =>
      invoke<AppSettings>('settings_add_recent_folder', { folderPath }),
  },
  claude: {
    preflight: (options?: { force?: boolean }) =>
      invoke<ClaudePreflight>('claude_preflight', { force: options?.force ?? false }),
  },
  acp: {
    start: (folderPath: string) => invoke<{ sessionId: string }>('acp_start', { folderPath }),
    sendPrompt: (
      sessionId: string,
      prompt: string,
      activeFilePath: string,
      systemPrompt: string,
      selectedText?: string,
      documentReferences?: DocumentReference[],
      attachments?: PromptAttachment[],
      dangerouslySkipPermissions = false,
    ) =>
      invoke<void>('acp_send_prompt', {
        sessionId,
        prompt,
        activeFilePath,
        systemPrompt,
        selectedText,
        documentReferences,
        attachments: attachments?.map(attachmentPayload),
        dangerouslySkipPermissions,
      }),
    respondClarification: (
      sessionId: string,
      optionId: string | null,
      response: string | null,
    ) =>
      invoke<void>('acp_respond_clarification', {
        sessionId,
        optionId,
        response,
      }),
    cancel: (sessionId: string) => invoke<void>('acp_cancel', { sessionId }),
    stop: (sessionId: string) => invoke<void>('acp_stop', { sessionId }),
  },
};

function attachmentPayload(attachment: PromptAttachment) {
  return {
    path: attachment.path,
    name: attachment.name,
    size: attachment.size,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
  };
}

export function appError(error: unknown): { code: AppErrorCode | null; message: string } {
  if (typeof error === 'object' && error) {
    const value = error as { code?: unknown; message?: unknown };
    return {
      code: typeof value.code === 'string' ? (value.code as AppErrorCode) : null,
      message: typeof value.message === 'string' ? value.message : String(error),
    };
  }
  return { code: null, message: String(error) };
}

export function errorMessage(error: unknown): string {
  return appError(error).message;
}
