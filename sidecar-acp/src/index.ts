import { createRequire } from 'node:module';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildClaudeArgs } from './claudeArgs.js';
import { ClaudeStreamTextAccumulator, toolCallsFromEvent } from './claudeStream.js';
import { buildSkribePrompt, type DocumentReference, type PromptAttachment } from './prompts.js';

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
};

type CancelCommand = {
  type: 'cancel';
  sessionId: string;
};

type VersionCommand = {
  type: 'version';
  sessionId: string;
};

type SidecarCommand = PromptCommand | CancelCommand | VersionCommand;
type ClaudeErrorCode =
  | 'CLAUDE_NOT_INSTALLED'
  | 'CLAUDE_NOT_LOGGED_IN'
  | 'CLAUDE_RATE_LIMITED'
  | 'CLAUDE_NETWORK_ERROR'
  | 'CLAUDE_UNKNOWN_ERROR'
  | 'ACP_SIDECAR_FAILED';

const require = createRequire(import.meta.url);
let current: ChildProcessWithoutNullStreams | null = null;

function emit(payload: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function classifyClaudeError(message: string): ClaudeErrorCode {
  const normalized = message.toLowerCase();
  if (/(claude login|not logged|login required|auth|unauthorized|api key|credentials)/.test(normalized)) {
    return 'CLAUDE_NOT_LOGGED_IN';
  }
  if (/(enoent|not found|no such file|install claude|command not found)/.test(normalized)) {
    return 'CLAUDE_NOT_INSTALLED';
  }
  if (/(rate limit|too many requests|quota|429)/.test(normalized)) {
    return 'CLAUDE_RATE_LIMITED';
  }
  if (/(network|connection|econn|timed out|timeout|dns|fetch failed)/.test(normalized)) {
    return 'CLAUDE_NETWORK_ERROR';
  }
  return 'CLAUDE_UNKNOWN_ERROR';
}

async function packageVersion(): Promise<string | null> {
  try {
    const pkgPath = require.resolve('@agentclientprotocol/claude-agent-acp/package.json');
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

async function handlePrompt(command: PromptCommand) {
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
  });

  const attachmentDirectories = directoriesForAttachments(command.attachments);
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
    if (spawnFailed) return;
    const status = code === 0 ? 'ok' : 'error';
    const error = stderr.trim() || `Claude Code exited with ${code}`;
    emit({
      type: 'complete',
      sessionId: command.sessionId,
      status,
      code: status === 'error' ? classifyClaudeError(error) : undefined,
      error: status === 'error' ? error : undefined,
    });
    emit({ type: 'status', sessionId: command.sessionId, status: 'ready' });
    current = null;
  });
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
      emit({
        type: 'version',
        sessionId: command.sessionId,
        version: await packageVersion(),
      });
      return;
    }
    if (command.type === 'cancel') {
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
