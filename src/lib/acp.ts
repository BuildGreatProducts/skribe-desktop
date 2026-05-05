import { listen } from '@tauri-apps/api/event';
import type {
  AcpCompleteEvent,
  AcpStatusEvent,
  AcpTextDeltaEvent,
  AcpUserInputRequiredEvent,
} from '../types';

export const acpEvents = {
  onTextDelta: (handler: (event: AcpTextDeltaEvent) => void) =>
    listen<AcpTextDeltaEvent>('acp:text_delta', ({ payload }) => handler(payload)),
  onComplete: (handler: (event: AcpCompleteEvent) => void) =>
    listen<AcpCompleteEvent>('acp:complete', ({ payload }) => handler(payload)),
  onStatus: (handler: (event: AcpStatusEvent) => void) =>
    listen<AcpStatusEvent>('acp:status', ({ payload }) => handler(payload)),
  onUserInputRequired: (handler: (event: AcpUserInputRequiredEvent) => void) =>
    listen<AcpUserInputRequiredEvent>('acp:user_input_required', ({ payload }) =>
      handler(payload),
    ),
};

export function scaffoldPrompt(prompt: string, activeFilePath: string): string {
  return `You are editing ${activeFilePath}. The user wants you to edit the active markdown document in place. Request: ${prompt}`;
}
