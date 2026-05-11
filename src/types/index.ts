export type AppErrorCode =
  | 'FS_PERMISSION_DENIED'
  | 'FS_NOT_FOUND'
  | 'FS_INVALID_PATH'
  | 'CLAUDE_NOT_INSTALLED'
  | 'CLAUDE_NOT_LOGGED_IN'
  | 'CLAUDE_RATE_LIMITED'
  | 'CLAUDE_NETWORK_ERROR'
  | 'CLAUDE_UNKNOWN_ERROR'
  | 'ACP_SIDECAR_FAILED'
  | 'ACP_PROTOCOL_ERROR'
  | 'AI_SELECTION_STALE'
  | 'SETTINGS_INVALID'
  | 'INTERNAL';

export type AppError = {
  code: AppErrorCode;
  message: string;
};

export type MarkdownFile = {
  path: string;
  relativePath: string;
  name: string;
  size: number;
  modifiedAt: number;
};

export type MarkdownFolder = {
  path: string;
  relativePath: string;
  name: string;
};

export type DocumentReference = {
  path: string;
  relativePath: string;
  name: string;
};

export type PromptAttachmentKind = 'image' | 'pdf' | 'text' | 'file';

export type PromptAttachment = {
  path: string;
  name: string;
  size: number;
  kind: PromptAttachmentKind;
  mimeType?: string | null;
  previewDataUrl?: string | null;
};

export type AppSettings = {
  schemaVersion: 1;
  recentFolders: string[];
  lastOpenedFolder: string | null;
  editor: {
    fontSize: 14 | 16 | 18 | 20;
    accentColor: 'deep-ink' | 'deep-green';
    lineHeight: 1.5 | 1.7 | 1.9;
  };
  ui: {
    fileTreeWidth: number;
    showStatusLine: boolean;
  };
  widgets: {
    wordCount: boolean;
    characterCount: boolean;
    readingLevel: boolean;
  };
  ai: {
    autoFocusInputOnFolderOpen: boolean;
    dangerouslySkipPermissions: boolean;
    systemPrompt: string;
    projectWritingInstructions: Record<string, string>;
  };
  preflight: {
    claudeCodeDetected: boolean;
    claudeCodeVersion: string | null;
    lastDetectedAt: number;
  };
};

export type ClaudePreflight = {
  installed: boolean;
  version: string | null;
  loggedIn: boolean;
};

export type ClaudeAvailabilityStatus =
  | 'checking'
  | 'ready'
  | 'missing'
  | 'login_required'
  | 'check_failed';

export type ClaudeAvailability = {
  status: ClaudeAvailabilityStatus;
  installed: boolean | null;
  version: string | null;
  loggedIn: boolean | null;
  lastCheckedAt: number | null;
  error: string | null;
};

export type SaveStatus = 'idle' | 'editing' | 'saving' | 'saved' | 'error';

export type ClarificationOption = {
  id: string;
  label: string;
  description?: string;
};

export type PendingClarification = {
  question: string;
  options: ClarificationOption[];
  freeForm: boolean;
};

export type AiStatus =
  | 'idle'
  | 'submitting'
  | 'streaming'
  | 'awaiting_clarification'
  | 'error';

export type AiError = {
  code: AppErrorCode;
  message: string;
};

export type HighlightedTextSelection = {
  filePath: string;
  from: number;
  to: number;
  text: string;
};

export type AiPromptTarget =
  | { type: 'document' }
  | { type: 'selection'; selection: HighlightedTextSelection };

export type FsChangeEvent = {
  event: 'created' | 'modified' | 'deleted';
  path: string;
};

export type AcpTextDeltaEvent = {
  sessionId: string;
  delta: string;
  replace?: boolean;
};

export type AcpCompleteEvent = {
  sessionId: string;
  status: 'ok' | 'error';
  code?: AppErrorCode;
  error?: string;
};

export type AcpStatusEvent = {
  sessionId: string;
  status: 'starting' | 'ready' | 'crashed' | 'stopped' | 'streaming';
};

export type AcpUserInputRequiredEvent = {
  sessionId: string;
  question: string;
  options: ClarificationOption[];
  freeForm: boolean;
};
