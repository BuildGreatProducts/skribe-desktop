export type ClaudeTextEvent = {
  text: string;
  mode: 'append' | 'replace';
};

function textParts(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textParts).join('');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.type && obj.type !== 'text') return '';
    if (typeof obj.text === 'string') return obj.text;
    if (obj.content) return textParts(obj.content);
  }
  return '';
}

function streamEventPayload(event: Record<string, unknown>): Record<string, unknown> {
  if (event.type !== 'stream_event') return event;
  const inner = event.event;
  return typeof inner === 'object' && inner !== null
    ? (inner as Record<string, unknown>)
    : event;
}

export function assistantTextFromEvent(event: Record<string, unknown>): ClaudeTextEvent | null {
  const streamEvent = streamEventPayload(event);
  if (streamEvent.type === 'content_block_delta') {
    const delta = streamEvent.delta as Record<string, unknown> | undefined;
    if (typeof delta?.text === 'string') return { text: delta.text, mode: 'append' };
  }

  if (event.type === 'assistant') {
    const message = event.message as Record<string, unknown> | undefined;
    const text = textParts(message?.content);
    return text ? { text, mode: 'replace' } : null;
  }

  if (event.type === 'result' && typeof event.result === 'string') {
    return { text: event.result, mode: 'replace' };
  }

  return null;
}

export function toolCallsFromEvent(event: Record<string, unknown>): Array<Record<string, unknown>> {
  const streamEvent = streamEventPayload(event);
  if (streamEvent.type === 'content_block_start') {
    const block = streamEvent.content_block as Record<string, unknown> | undefined;
    if (block?.type === 'tool_use') return [block];
  }

  const message = event.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (!Array.isArray(content)) return [];
  return content.filter(
    (part): part is Record<string, unknown> =>
      typeof part === 'object' && part !== null && part.type === 'tool_use',
  );
}

export class ClaudeStreamTextAccumulator {
  private text = '';
  private hasText = false;

  consume(event: Record<string, unknown>): ClaudeTextEvent | null {
    const textEvent = assistantTextFromEvent(event);
    if (!textEvent) return null;

    const nextText =
      textEvent.mode === 'replace' ? textEvent.text : `${this.text}${textEvent.text}`;
    if (textEvent.mode === 'replace' && this.hasText && nextText === this.text) {
      return null;
    }

    this.text = nextText;
    this.hasText = true;
    return textEvent;
  }
}
