import { create } from 'zustand';
import { errorMessage, tauriClient } from '../lib/tauri';
import type { ClaudeAvailability, ClaudeAvailabilityStatus, ClaudePreflight } from '../types';

const initialAvailability: ClaudeAvailability = {
  status: 'checking',
  installed: null,
  version: null,
  loggedIn: null,
  lastCheckedAt: null,
  error: null,
};

function availabilityFromResult(result: ClaudePreflight): ClaudeAvailability {
  if (!result.installed) {
    return {
      status: 'missing',
      installed: false,
      version: null,
      loggedIn: false,
      lastCheckedAt: Date.now(),
      error: null,
    };
  }

  if (!result.loggedIn) {
    return {
      status: 'login_required',
      installed: true,
      version: result.version,
      loggedIn: false,
      lastCheckedAt: Date.now(),
      error: 'Run claude login in your terminal to enable AI edits.',
    };
  }

  return {
    status: 'ready',
    installed: true,
    version: result.version,
    loggedIn: null,
    lastCheckedAt: Date.now(),
    error: null,
  };
}

type PreflightState = {
  result: ClaudePreflight | null;
  availability: ClaudeAvailability;
  dismissed: Partial<Record<ClaudeAvailabilityStatus, boolean>>;
  loading: boolean;
  error: string | null;
  run: (options?: { force?: boolean }) => Promise<void>;
  dismiss: () => void;
  markLoginRequired: (message?: string) => void;
  markMissing: (message?: string) => void;
};

export const usePreflightStore = create<PreflightState>((set, get) => ({
  result: null,
  availability: initialAvailability,
  dismissed: {},
  loading: false,
  error: null,
  run: async (options) => {
    set({
      availability: {
        ...get().availability,
        status: 'checking',
        error: null,
      },
      loading: true,
      error: null,
    });
    try {
      const result = await tauriClient.claude.preflight(options);
      set({ result, availability: availabilityFromResult(result), loading: false });
    } catch (error) {
      const message = errorMessage(error);
      set({
        loading: false,
        error: message,
        availability: {
          status: 'check_failed',
          installed: null,
          version: null,
          loggedIn: null,
          lastCheckedAt: Date.now(),
          error: message,
        },
      });
    }
  },
  dismiss: () =>
    set((state) => ({
      dismissed: { ...state.dismissed, [state.availability.status]: true },
    })),
  markLoginRequired: (message = 'Run claude login in your terminal to enable AI edits.') =>
    set((state) => ({
      result: state.result
        ? { ...state.result, installed: true, loggedIn: false }
        : { installed: true, version: state.availability.version, loggedIn: false },
      availability: {
        status: 'login_required',
        installed: true,
        version: state.availability.version,
        loggedIn: false,
        lastCheckedAt: Date.now(),
        error: message,
      },
      error: null,
      loading: false,
    })),
  markMissing: (message = 'Claude Code is needed for AI edits.') =>
    set({
      result: { installed: false, version: null, loggedIn: false },
      availability: {
        status: 'missing',
        installed: false,
        version: null,
        loggedIn: false,
        lastCheckedAt: Date.now(),
        error: message,
      },
      error: null,
      loading: false,
    }),
}));
