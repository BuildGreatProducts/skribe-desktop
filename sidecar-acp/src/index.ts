import { createRequire } from 'node:module';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import { buildClaudeArgs } from './claudeArgs.js';
import { ClaudeStreamTextAccumulator, toolCallsFromEvent } from './claudeStream.js';
import {
  buildSkribePrompt,
  type DocumentReference,
  type InsertionContext,
  type PromptAttachment,
} from './prompts.js';

type PromptCommand = {
  type: 'prompt';
  sessionId: string;
  prompt: string;
  activeFilePath: string;
  systemPrompt?: string | null;
  selectedText?: string | null;
  documentReferences?: DocumentReference[] | null;
  attachments?: PromptAttachment[] | null;
  dangerouslySkipPermissions?: boolean | null;
  insertion?: InsertionContext | null;
};

type CancelCommand = {
  type: 'cancel';
  sessionId: string;
};

type VersionCommand = {
  type: 'version';
  sessionId: string;
  agentId?: AgentId | null;
};

type SidecarCommand = PromptCommand | CancelCommand | VersionCommand;
type AgentId = 'claude' | 'codex';
type AgentErrorCode =
  | 'CLAUDE_NOT_INSTALLED'
  | 'CLAUDE_NOT_LOGGED_IN'
  | 'CLAUDE_RATE_LIMITED'
  | 'CLAUDE_NETWORK_ERROR'
  | 'CLAUDE_UNKNOWN_ERROR'
  | 'CODEX_NOT_INSTALLED'
  | 'CODEX_NOT_LOGGED_IN'
  | 'CODEX_RATE_LIMITED'
  | 'CODEX_NETWORK_ERROR'
  | 'CODEX_UNKNOWN_ERROR'
  | 'ACP_SIDECAR_FAILED';

const require = createRequire(import.meta.url);
let current: ChildProcessWithoutNullStreams | null = null;
let currentCancelled = false;

function emit(payload: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function selectedAgent(command?: { agentId?: AgentId | null }): AgentId {
  return command?.agentId || normalizeAgentId(process.env.SKRIBE_AGENT_ID) || 'claude';
}

function normalizeAgentId(value: unknown): AgentId | null {
  return value === 'claude' || value === 'codex' ? value : null;
}

function classifyAgentError(agentId: AgentId, message: string): AgentErrorCode {
  const normalized = message.toLowerCase();
  const prefix = agentId === 'codex' ? 'CODEX' : 'CLAUDE';
  if (/\b(?:claude login|codex auth|not logged(?: in)?|login required|log in required|please log in|authentication required|unauthorized|api key|credentials|openai_api_key|codex_api_key)\b/.test(normalized)) {
    return `${prefix}_NOT_LOGGED_IN` as AgentErrorCode;
  }
  if (/(enoent|not found|no such file|install claude|install codex|command not found)/.test(normalized)) {
    return `${prefix}_NOT_INSTALLED` as AgentErrorCode;
  }
  if (/(rate limit|too many requests|quota|429)/.test(normalized)) {
    return `${prefix}_RATE_LIMITED` as AgentErrorCode;
  }
  if (/(network|connection|econn|timed out|timeout|dns|fetch failed)/.test(normalized)) {
    return `${prefix}_NETWORK_ERROR` as AgentErrorCode;
  }
  return `${prefix}_UNKNOWN_ERROR` as AgentErrorCode;
}

async function packageVersion(agentId: AgentId): Promise<string | null> {
  try {
    const pkgPath = require.resolve(
      agentId === 'codex'
        ? '@zed-industries/codex-acp/package.json'
        : '@agentclientprotocol/claude-agent-acp/package.json',
    );
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

async function handlePrompt(command: PromptCommand) {
  const agentId = selectedAgent();
  if (agentId === 'codex') return handleCodexPrompt(command);
  return handleClaudePrompt(command);
}

async function handleClaudePrompt(command: PromptCommand) {
  if (current) {
    emit({
      type: 'complete',
      sessionId: command.sessionId,
      status: 'error',
      error: 'Another AI request is already running.',
    });
    return;
  }

  const scaffolded = buildSkribePrompt({
    prompt: command.prompt,
    activeFilePath: command.activeFilePath,
    workingFolder: process.cwd(),
    selectedText: command.selectedText,
    documentReferences: command.documentReferences,
    attachments: command.attachments,
    insertion: command.insertion,
  });

  const attachmentDirectories = directoriesForAttachments(command.attachments);
  currentCancelled = false;
  current = spawn(
    process.env.CLAUDE_CODE_PATH?.trim() || 'claude',
    buildClaudeArgs(command.systemPrompt, attachmentDirectories, {
      dangerouslySkipPermissions: command.dangerouslySkipPermissions === true,
    }),
    {
      cwd: process.cwd(),
      env: process.env,
    },
  );

  current.stdin.on('error', () => undefined);
  current.stdin.end(scaffolded);

  emit({ type: 'status', sessionId: command.sessionId, status: 'streaming' });

  let buffer = '';
  const textAccumulator = new ClaudeStreamTextAccumulator();
  current.stdout.setEncoding('utf8');
  current.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as Record<string, unknown>;
        const textEvent = textAccumulator.consume(event);
        if (textEvent) {
          emit({
            type: 'text_delta',
            sessionId: command.sessionId,
            delta: textEvent.text,
            replace: textEvent.mode === 'replace',
          });
        }

        for (const toolCall of toolCallsFromEvent(event)) {
          emit({
            type: 'tool_call',
            sessionId: command.sessionId,
            tool: String(toolCall.name ?? 'tool'),
            args: toolCall.input ?? {},
          });
        }
      } catch {
        emit({
          type: 'text_delta',
          sessionId: command.sessionId,
          delta: line,
        });
      }
    }
  });

  let stderr = '';
  let spawnFailed = false;
  current.stderr.setEncoding('utf8');
  current.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  current.on('error', (error: NodeJS.ErrnoException) => {
    spawnFailed = true;
    const code = error.code === 'ENOENT' ? 'CLAUDE_NOT_INSTALLED' : 'ACP_SIDECAR_FAILED';
    emit({
      type: 'complete',
      sessionId: command.sessionId,
      status: 'error',
      code,
      error:
        code === 'CLAUDE_NOT_INSTALLED'
          ? 'Claude Code was not found on PATH.'
          : error.message,
    });
    emit({ type: 'status', sessionId: command.sessionId, status: 'ready' });
    current = null;
  });

  current.on('close', (code) => {
    if (spawnFailed || currentCancelled) return;
    const status = code === 0 ? 'ok' : 'error';
    const error = stderr.trim() || `Claude Code exited with ${code}`;
    emit({
      type: 'complete',
      sessionId: command.sessionId,
      status,
      code: status === 'error' ? classifyAgentError('claude', error) : undefined,
      error: status === 'error' ? error : undefined,
    });
    emit({ type: 'status', sessionId: command.sessionId, status: 'ready' });
    current = null;
  });
}

async function handleCodexPrompt(command: PromptCommand) {
  if (current) {
    emit({
      type: 'complete',
      sessionId: command.sessionId,
      status: 'error',
      error: 'Another AI request is already running.',
    });
    return;
  }

  const scaffolded = withSystemPrompt(
    command.systemPrompt,
    buildSkribePrompt({
      prompt: command.prompt,
      activeFilePath: command.activeFilePath,
      workingFolder: process.cwd(),
      selectedText: command.selectedText,
      documentReferences: command.documentReferences,
      attachments: command.attachments,
      insertion: command.insertion,
      agentLabel: 'Codex',
    }),
  );
  const attachmentDirectories = directoriesForAttachments(command.attachments);
  const codex = await resolveCodexCommand();

  currentCancelled = false;
  current = spawn(codex.command, codex.args, {
    cwd: process.cwd(),
    env: process.env,
  });

  let stderr = '';
  let spawnFailed = false;
  current.stderr.setEncoding('utf8');
  current.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  current.on('error', (error: NodeJS.ErrnoException) => {
    spawnFailed = true;
    if (currentCancelled) return;
    emit({
      type: 'complete',
      sessionId: command.sessionId,
      status: 'error',
      code: error.code === 'ENOENT' ? 'CODEX_NOT_INSTALLED' : 'ACP_SIDECAR_FAILED',
      error:
        error.code === 'ENOENT'
          ? 'Codex ACP was not found on PATH.'
          : error.message,
    });
    emit({ type: 'status', sessionId: command.sessionId, status: 'ready' });
    current = null;
  });

  emit({ type: 'status', sessionId: command.sessionId, status: 'streaming' });

  try {
    const child = current;
    if (!child) throw new Error('Codex ACP did not start.');
    const stream = acp.ndJsonStream(
      Writable.toWeb(child.stdin),
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
    );
    const client = new SkribeAcpClient(
      command.sessionId,
      command.dangerouslySkipPermissions === true,
      attachmentDirectories,
    );
    const connection = new acp.ClientSideConnection(() => client, stream);

    await connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: false,
        },
      },
    });
    const session = await connection.newSession({
      cwd: process.cwd(),
      mcpServers: [],
      additionalDirectories: attachmentDirectories,
    });
    await connection.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: 'text', text: scaffolded }],
    });

    if (!currentCancelled) {
      emit({ type: 'complete', sessionId: command.sessionId, status: 'ok' });
    }
  } catch (error) {
    if (!spawnFailed && !currentCancelled) {
      const message =
        error instanceof Error ? error.message : stderr.trim() || String(error);
      emit({
        type: 'complete',
        sessionId: command.sessionId,
        status: 'error',
        code: classifyAgentError('codex', message),
        error: message,
      });
    }
  } finally {
    current?.kill('SIGTERM');
    current = null;
    if (!spawnFailed && !currentCancelled) {
      emit({ type: 'status', sessionId: command.sessionId, status: 'ready' });
    }
  }
}

class SkribeAcpClient implements acp.Client {
  private readonly readRoots: string[];

  constructor(
    private readonly skribeSessionId: string,
    private readonly dangerouslySkipPermissions: boolean,
    additionalDirectories: string[],
  ) {
    this.readRoots = [process.cwd(), ...additionalDirectories];
  }

  async requestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    if (!this.dangerouslySkipPermissions) {
      return { outcome: { outcome: 'cancelled' as const } };
    }
    const option = params.options.find((candidate) => /allow|approve/i.test(candidate.name));
    if (!option) {
      return { outcome: { outcome: 'cancelled' as const } };
    }
    return {
      outcome: {
        outcome: 'selected' as const,
        optionId: option.optionId,
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification) {
    const update = params.update as Record<string, unknown>;
    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        this.emitMessageChunk(update);
        return;
      case 'tool_call':
        emit({
          type: 'tool_call',
          sessionId: this.skribeSessionId,
          tool: String(update.title ?? 'tool'),
          args: { status: update.status ?? null },
        });
        return;
      case 'tool_call_update':
        emit({
          type: 'tool_call',
          sessionId: this.skribeSessionId,
          tool: String(update.toolCallId ?? 'tool'),
          args: { status: update.status ?? null },
        });
        return;
      default:
        return;
    }
  }

  async readTextFile(params: acp.ReadTextFileRequest) {
    const filePath = await safeWorkspacePath(String(params.path ?? ''), this.readRoots);
    return {
      content: await readFile(filePath, 'utf8'),
    };
  }

  private emitMessageChunk(update: Record<string, unknown>) {
    const content = update.content as Record<string, unknown> | undefined;
    if (!content || content.type !== 'text') return;
    emit({
      type: 'text_delta',
      sessionId: this.skribeSessionId,
      delta: String(content.text ?? ''),
    });
  }
}

async function resolveCodexCommand(): Promise<{ command: string; args: string[] }> {
  const configured = process.env.CODEX_ACP_PATH?.trim();
  if (configured) return { command: configured, args: [] };

  const pkgPath = require.resolve('@zed-industries/codex-acp/package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as {
    bin?: string | Record<string, string>;
  };
  const binPath =
    typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['codex-acp'];
  if (!binPath) return { command: 'codex-acp', args: [] };
  return {
    command: process.execPath,
    args: [resolve(dirname(pkgPath), binPath)],
  };
}

async function safeWorkspacePath(
  requestedPath: string,
  allowedRoots: string[],
): Promise<string> {
  const lexicalWorkspace = resolve(process.cwd());
  const absolute = resolve(lexicalWorkspace, requestedPath);
  const [target, ...roots] = await Promise.all([
    realpath(absolute),
    ...allowedRoots.map((root) => realpath(resolve(root))),
  ]);
  const isAllowed = roots.some((root) => {
    const relativePath = relative(root, target);
    return !relativePath.startsWith('..') && !isAbsolute(relativePath);
  });
  if (!isAllowed) {
    throw new Error('Codex requested a file outside the open folder.');
  }
  return target;
}

function withSystemPrompt(systemPrompt: string | null | undefined, prompt: string): string {
  const instructions = systemPrompt?.trim();
  if (!instructions) return prompt;
  return `System writing instructions:
${instructions}

${prompt}`;
}

function directoriesForAttachments(attachments?: PromptAttachment[] | null): string[] {
  return Array.from(
    new Set(
      attachments
        ?.map((attachment) => attachment.path.trim())
        .filter(Boolean)
        .map((path) => dirname(path)) ?? [],
    ),
  );
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

emit({ type: 'status', sessionId: null, status: 'ready' });

rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const command = JSON.parse(line) as SidecarCommand;
    if (command.type === 'version') {
      const agentId = selectedAgent(command);
      emit({
        type: 'version',
        sessionId: command.sessionId,
        agentId,
        version: await packageVersion(agentId),
      });
      return;
    }
    if (command.type === 'cancel') {
      currentCancelled = true;
      current?.kill('SIGTERM');
      current = null;
      emit({ type: 'complete', sessionId: command.sessionId, status: 'ok' });
      emit({ type: 'status', sessionId: command.sessionId, status: 'ready' });
      return;
    }
    await handlePrompt(command);
  } catch (error) {
    emit({
      type: 'complete',
      sessionId: 'unknown',
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
