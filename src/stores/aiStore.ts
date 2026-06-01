import { create } from 'zustand';
import { acpEvents } from '../lib/acp';
import { AGENTS, DEFAULT_AGENT_ID, type AgentId } from '../lib/agents';
import { documentPromptTarget, selectedTextForPromptTarget } from '../lib/aiPromptTarget';
import { buildMarkedDocument } from '../lib/insertionMarker';
import { errorMessage, tauriClient } from '../lib/tauri';
import { buildWritingInstructionsSystemPrompt } from '../lib/writingInstructions';
import { useEditorStore } from './editorStore';
import { useFolderStore } from './folderStore';
import { usePreflightStore } from './preflightStore';
import { dangerouslySkipPermissionsForFolder } from './sessionSettingsStore';
import { useSettingsStore } from './settingsStore';
import type {
  AiError,
  AiPromptTarget,
  AiStatus,
  AppErrorCode,
  DocumentReference,
  InsertionContext,
  PendingClarification,
  PromptAttachment,
} from '../types';

export type StreamPreview = {
  text: string;
  visible: boolean;
  complete: boolean;
  hasContent: boolean;
};

const hiddenStreamPreview: StreamPreview = {
  text: '',
  visible: false,
  complete: false,
  hasContent: false,
};

const pendingStreamPreview: StreamPreview = {
  text: '',
  visible: true,
  complete: false,
  hasContent: false,
};

let listenerSetupPromise: Promise<void> | null = null;
let startSessionPromise: Promise<void> | null = null;

export function streamPreviewFromDelta(
  current: StreamPreview,
  delta: string,
  replace = false,
): StreamPreview {
  return {
    text: replace || !current.hasContent ? delta : `${current.text}${delta}`,
    visible: true,
    complete: false,
    hasContent: true,
  };
}

type AiState = {
  sessionId: string | null;
  sessionAgentId: AgentId | null;
  status: AiStatus;
  prompt: string;
  promptFilePath: string | null;
  promptTarget: AiPromptTarget;
  promptDocumentReferences: DocumentReference[];
  promptAttachments: PromptAttachment[];
  partialResponse: string;
  streamPreview: StreamPreview;
  pendingClarification: PendingClarification | null;
  error: AiError | null;
  listenersReady: boolean;
  acceptingStream: boolean;
  startSession: (folderPath: string, agentId?: AgentId) => Promise<void>;
  stopSession: () => Promise<void>;
  submitPrompt: (
    prompt: string,
    activeFilePath: string,
    target?: AiPromptTarget,
    documentReferences?: DocumentReference[],
    attachments?: PromptAttachment[],
  ) => Promise<void>;
  respondClarification: (optionId: string | null, response: string | null) => Promise<void>;
  cancel: () => Promise<void>;
  dismissStreamPreview: () => void;
  markError: (error: AiError) => void;
  ensureListeners: () => Promise<void>;
};

export const useAiStore = create<AiState>((set, get) => ({
  sessionId: null,
  sessionAgentId: null,
  status: 'idle',
  prompt: '',
  promptFilePath: null,
  promptTarget: documentPromptTarget,
  promptDocumentReferences: [],
  promptAttachments: [],
  partialResponse: '',
  streamPreview: hiddenStreamPreview,
  pendingClarification: null,
  error: null,
  listenersReady: false,
  acceptingStream: false,
  ensureListeners: async () => {
    if (get().listenersReady) return;
    listenerSetupPromise ??= Promise.all([
      acpEvents.onTextDelta((event) => {
        if (event.sessionId !== get().sessionId) return;
        if (!get().acceptingStream) return;
        set((state) => ({
          status: 'streaming',
          partialResponse: event.replace
            ? event.delta
            : `${state.partialResponse}${event.delta}`,
          streamPreview: streamPreviewFromDelta(
            state.streamPreview,
            event.delta,
            event.replace,
          ),
        }));
      }),
      acpEvents.onComplete(async (event) => {
        if (event.sessionId !== get().sessionId) return;
        if (event.status === 'ok' && !get().acceptingStream) return;
        if (event.status === 'error') {
          const agentId = get().sessionAgentId ?? selectedAgentId();
          const error = classifyAiError(event.error, event.code, agentId);
          const shouldTerminateSession = event.terminateSession === true;
          if (error.code === 'CLAUDE_NOT_LOGGED_IN' || error.code === 'CODEX_NOT_LOGGED_IN') {
            usePreflightStore.getState().markLoginRequired(agentId, error.message);
          }
          if (error.code === 'CLAUDE_NOT_INSTALLED' || error.code === 'CODEX_NOT_INSTALLED') {
            usePreflightStore.getState().markMissing(agentId, error.message);
          }
          if (shouldTerminateSession) {
            await tauriClient.acp.stop(event.sessionId).catch(() => undefined);
          }
          set({
            ...(shouldTerminateSession
              ? { sessionId: null, sessionAgentId: null, pendingClarification: null }
              : {}),
            status: 'error',
            error,
            streamPreview: hiddenStreamPreview,
            acceptingStream: false,
          });
          return;
        }
        const state = get();
        if (
          state.promptFilePath &&
          state.promptTarget.type === 'document' &&
          state.partialResponse &&
          useEditorStore.getState().filePath !== state.promptFilePath
        ) {
          void tauriClient.fs.writeFile(state.promptFilePath, state.partialResponse).catch((error) => {
            set({
              status: 'error',
              error: classifyAiError(
                errorMessage(error),
                undefined,
                state.sessionAgentId ?? selectedAgentId(),
              ),
            });
          });
        }

        set((state) => ({
          status: 'idle',
          pendingClarification: null,
          acceptingStream: false,
          streamPreview: state.streamPreview.visible
            ? { ...state.streamPreview, complete: true }
            : state.streamPreview,
        }));
      }),
      acpEvents.onUserInputRequired((event) => {
        if (event.sessionId !== get().sessionId) return;
        set({
          status: 'awaiting_clarification',
          pendingClarification: {
            question: event.question,
            options: event.options,
            freeForm: event.freeForm,
          },
        });
      }),
      acpEvents.onStatus((event) => {
        if (event.sessionId !== get().sessionId) return;
        if (event.status === 'crashed') {
          set({
            sessionId: null,
            status: 'error',
            error: {
              code: 'ACP_SIDECAR_FAILED',
              message: 'The AI sidecar crashed. Retry when ready.',
            },
            streamPreview: hiddenStreamPreview,
            acceptingStream: false,
          });
        }
      }),
    ])
      .then(() => {
        set({ listenersReady: true });
      })
      .catch((error) => {
        listenerSetupPromise = null;
        throw error;
      });
    await listenerSetupPromise;
  },
  startSession: async (folderPath, agentId = selectedAgentId()) => {
    startSessionPromise ??= (async () => {
      await get().ensureListeners();
      const setupStatus =
        usePreflightStore.getState().availabilityByAgent[agentId].status;
      if (setupStatus !== 'ready') return;
      if (get().sessionId && get().sessionAgentId === agentId) return;
      if (get().sessionId) await get().stopSession();
      set({ error: null, streamPreview: hiddenStreamPreview });
      try {
        const { sessionId } = await tauriClient.acp.start(folderPath, agentId);
        set({ sessionId, sessionAgentId: agentId, status: 'idle', partialResponse: '' });
      } catch (error) {
        set({
          status: 'error',
          error: classifyAiError(errorMessage(error), undefined, agentId),
          streamPreview: hiddenStreamPreview,
          acceptingStream: false,
        });
      }
    })().finally(() => {
      startSessionPromise = null;
    });
    await startSessionPromise;
  },
  stopSession: async () => {
    const sessionId = get().sessionId;
    if (sessionId) {
      await tauriClient.acp.stop(sessionId).catch(() => undefined);
    }
    set({
      sessionId: null,
      sessionAgentId: null,
      status: 'idle',
      partialResponse: '',
      promptFilePath: null,
      promptTarget: documentPromptTarget,
      promptDocumentReferences: [],
      promptAttachments: [],
      streamPreview: hiddenStreamPreview,
      pendingClarification: null,
      error: null,
      acceptingStream: false,
    });
  },
  submitPrompt: async (
    prompt,
    activeFilePath,
    target = documentPromptTarget,
    documentReferences = [],
    attachments = [],
  ) => {
    if (!prompt.trim()) return;
    let sessionId = get().sessionId;
    const agentId = selectedAgentId();
    if (!sessionId || get().sessionAgentId !== agentId) {
      const folderPath = useFolderStore.getState().path;
      if (!folderPath) return;
      await get().startSession(folderPath, agentId);
      sessionId = get().sessionId;
    }
    if (!sessionId || !prompt.trim()) return;
    const promptTarget = target;
    // Resolve the insertion context up front so we can fail fast for
    // insertion-type targets when the marked document cannot be built (no
    // editor, missing serializer, sentinel collision, file changed). Without
    // this, the sendPrompt call below would silently omit `insertion` and the
    // sidecar would downgrade the request to a full-document rewrite.
    const insertion = insertionContextForPromptTarget(
      activeFilePath,
      promptTarget,
    );
    if (promptTarget.type === 'insertion' && !insertion) {
      set({
        status: 'error',
        error: classifyAiError(undefined, 'AI_INSERTION_STALE', agentId),
        streamPreview: hiddenStreamPreview,
        acceptingStream: false,
      });
      return;
    }
    set({
      status: 'submitting',
      prompt,
      promptFilePath: activeFilePath,
      promptTarget,
      promptDocumentReferences: documentReferences,
      promptAttachments: attachments,
      partialResponse: '',
      streamPreview: pendingStreamPreview,
      pendingClarification: null,
      error: null,
      acceptingStream: true,
    });
    const sendWithSession = async (targetSessionId: string) => {
      const settings = useSettingsStore.getState().settings;
      const folderPath = useFolderStore.getState().path;
      const systemPrompt = buildWritingInstructionsSystemPrompt(
        settings,
        folderPath,
      );
      await tauriClient.acp.sendPrompt(
        targetSessionId,
        prompt,
        activeFilePath,
        systemPrompt,
        selectedTextForPromptTarget(activeFilePath, promptTarget),
        documentReferences,
        attachments,
        dangerouslySkipPermissionsForFolder(folderPath),
        insertion,
      );
    };

    try {
      await sendWithSession(sessionId);
      set({ status: 'streaming' });
    } catch (error) {
      let promptError = error;
      if (isBrokenSidecarPipeError(error)) {
        await tauriClient.acp.stop(sessionId).catch(() => undefined);
        set({ sessionId: null, sessionAgentId: null });
        const folderPath = useFolderStore.getState().path;
        if (folderPath) {
          await get().startSession(folderPath, agentId);
          const restartedSessionId = get().sessionId;
          if (restartedSessionId) {
            try {
              await sendWithSession(restartedSessionId);
              set({ status: 'streaming' });
              return;
            } catch (retryError) {
              promptError = retryError;
            }
          }
        }
      }

      const aiError = classifyAiError(errorMessage(promptError), undefined, agentId);
      set({
        status: 'error',
        error: aiError,
        streamPreview: hiddenStreamPreview,
        acceptingStream: false,
      });
    }
  },
  respondClarification: async (optionId, response) => {
    const sessionId = get().sessionId;
    if (!sessionId) return;
    await tauriClient.acp.respondClarification(sessionId, optionId, response);
    set({ status: 'streaming', pendingClarification: null });
  },
  cancel: async () => {
    const sessionId = get().sessionId;
    if (!sessionId) return;
    set({
      status: 'idle',
      partialResponse: '',
      pendingClarification: null,
      promptFilePath: null,
      promptDocumentReferences: [],
      promptAttachments: [],
      streamPreview: hiddenStreamPreview,
      acceptingStream: false,
    });
    await tauriClient.acp.cancel(sessionId).catch(() => undefined);
  },
  dismissStreamPreview: () => {
    set((state) => ({
      streamPreview: state.streamPreview.complete
        ? hiddenStreamPreview
        : state.streamPreview,
      promptFilePath: state.streamPreview.complete ? null : state.promptFilePath,
    }));
  },
  markError: (error) => {
    set({
      status: 'error',
      error,
      streamPreview: hiddenStreamPreview,
      pendingClarification: null,
      promptFilePath: null,
      promptDocumentReferences: [],
      promptAttachments: [],
      acceptingStream: false,
    });
  },
}));

function selectedAgentId(): AgentId {
  return useSettingsStore.getState().settings.ai.selectedAgent ?? DEFAULT_AGENT_ID;
}

function classifyAiError(
  message = 'The selected agent reported an error.',
  code?: AppErrorCode,
  agentId: AgentId = selectedAgentId(),
): AiError {
  const normalized = message.toLowerCase();
  const errorPrefix = agentId === 'codex' ? 'CODEX' : 'CLAUDE';
  const inferredCode =
    code ??
    (/(claude login|codex auth|not logged|login required|auth|required|unauthorized|api key|credentials|openai_api_key|codex_api_key)/.test(
      normalized,
    )
      ? `${errorPrefix}_NOT_LOGGED_IN`
      : /(enoent|not found|no such file|install claude|install codex|command not found)/.test(normalized)
        ? `${errorPrefix}_NOT_INSTALLED`
        : /(rate limit|too many requests|quota|429)/.test(normalized)
          ? `${errorPrefix}_RATE_LIMITED`
          : /(broken pipe|os error 32|pipe closed|sidecar.*crash)/.test(normalized)
            ? 'ACP_SIDECAR_FAILED'
            : /(network|connection|econn|timed out|timeout|dns|fetch failed)/.test(normalized)
            ? `${errorPrefix}_NETWORK_ERROR`
            : `${errorPrefix}_UNKNOWN_ERROR`) as AppErrorCode;

  switch (inferredCode) {
    case 'CLAUDE_NOT_LOGGED_IN':
    case 'CODEX_NOT_LOGGED_IN':
      return {
        code: inferredCode,
        message:
          agentId === 'claude'
            ? 'Run claude login in your terminal to enable AI edits.'
            : 'Sign in to Codex or set OPENAI_API_KEY/CODEX_API_KEY to enable AI edits.',
      };
    case 'CLAUDE_NOT_INSTALLED':
    case 'CODEX_NOT_INSTALLED':
      return {
        code: inferredCode,
        message: `Install ${AGENTS[agentId].label} to enable AI edits.`,
      };
    case 'CLAUDE_RATE_LIMITED':
    case 'CODEX_RATE_LIMITED':
      return {
        code: inferredCode,
        message: `${AGENTS[agentId].label} is rate limited. Wait a moment, then retry.`,
      };
    case 'CLAUDE_NETWORK_ERROR':
    case 'CODEX_NETWORK_ERROR':
      return {
        code: inferredCode,
        message: `${AGENTS[agentId].label} could not reach the network. Check your connection, then retry.`,
      };
    case 'ACP_SIDECAR_FAILED':
      return {
        code: inferredCode,
        message: 'AI is unavailable right now. Retry when ready.',
      };
    case 'AI_SELECTION_STALE':
      return {
        code: inferredCode,
        message: `The selected text changed before ${AGENTS[agentId].label} finished. Select it again and retry.`,
      };
    case 'AI_INSERTION_STALE':
      return {
        code: inferredCode,
        message:
          `The document changed before ${AGENTS[agentId].label} finished. Pick the insertion point again and retry.`,
      };
    default:
      return {
        code: inferredCode,
        message,
      };
  }
}

function isBrokenSidecarPipeError(error: unknown): boolean {
  return /(broken pipe|os error 32|pipe closed)/i.test(errorMessage(error));
}

function insertionContextForPromptTarget(
  activeFilePath: string,
  target: AiPromptTarget,
): InsertionContext | undefined {
  if (target.type !== 'insertion') return undefined;
  if (target.insertion.filePath !== activeFilePath) return undefined;
  const markedDocument = buildMarkedDocument(target.insertion.pos);
  if (markedDocument === null) return undefined;
  return { markedDocument };
}
