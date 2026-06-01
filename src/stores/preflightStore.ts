import { create } from 'zustand';
import { AGENT_IDS, DEFAULT_AGENT_ID, type AgentId } from '../lib/agents';
import { errorMessage, tauriClient } from '../lib/tauri';
import { useSettingsStore } from './settingsStore';
import type {
  AgentAvailability,
  AgentAvailabilityStatus,
  AgentPreflight,
} from '../types';

const initialAvailabilityByAgent = agentRecord((agentId) => initialAvailability(agentId));
const initialResultByAgent = agentRecord<AgentPreflight | null>(() => null);
const initialLoadingByAgent = agentRecord(() => false);
const initialErrorByAgent = agentRecord<string | null>(() => null);

function initialAvailability(agentId: AgentId): AgentAvailability {
  return {
    agentId,
    status: 'checking',
    installed: null,
    version: null,
    loggedIn: null,
    lastCheckedAt: null,
    error: null,
  };
}

function availabilityFromResult(result: AgentPreflight): AgentAvailability {
  if (!result.installed) {
    return {
      agentId: result.agentId,
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
      agentId: result.agentId,
      status: 'login_required',
      installed: true,
      version: result.version,
      loggedIn: false,
      lastCheckedAt: Date.now(),
      error: 'Sign in to your selected agent to enable AI edits.',
    };
  }

  return {
    agentId: result.agentId,
    status: 'ready',
    installed: true,
    version: result.version,
    loggedIn: null,
    lastCheckedAt: Date.now(),
    error: null,
  };
}

type PreflightState = {
  resultByAgent: Record<AgentId, AgentPreflight | null>;
  availabilityByAgent: Record<AgentId, AgentAvailability>;
  dismissed: Partial<Record<AgentId, Partial<Record<AgentAvailabilityStatus, boolean>>>>;
  loadingByAgent: Record<AgentId, boolean>;
  errorByAgent: Record<AgentId, string | null>;
  loading: boolean;
  error: string | null;
  run: (options?: { force?: boolean; agentId?: AgentId }) => Promise<void>;
  dismiss: (agentId?: AgentId) => void;
  markLoginRequired: (agentId: AgentId, message?: string) => void;
  markMissing: (agentId: AgentId, message?: string) => void;
};

export const usePreflightStore = create<PreflightState>((set, get) => ({
  resultByAgent: initialResultByAgent,
  availabilityByAgent: initialAvailabilityByAgent,
  dismissed: {},
  loadingByAgent: initialLoadingByAgent,
  errorByAgent: initialErrorByAgent,
  loading: true,
  error: null,
  run: async (options) => {
    const agentIds = options?.agentId ? [options.agentId] : [...AGENT_IDS];
    await Promise.all(agentIds.map((agentId) => runAgentPreflight(agentId, options)));
  },
  dismiss: (agentId = selectedAgentId()) =>
    set((state) => ({
      dismissed: {
        ...state.dismissed,
        [agentId]: {
          ...state.dismissed[agentId],
          [state.availabilityByAgent[agentId].status]: true,
        },
      },
    })),
  markLoginRequired: (agentId, message = 'Sign in to your selected agent to enable AI edits.') =>
    set({
      resultByAgent: {
        ...get().resultByAgent,
        [agentId]: {
          agentId,
          installed: true,
          version: get().availabilityByAgent[agentId].version,
          loggedIn: false,
        },
      },
      availabilityByAgent: {
        ...get().availabilityByAgent,
        [agentId]: {
          agentId,
          status: 'login_required',
          installed: true,
          version: get().availabilityByAgent[agentId].version,
          loggedIn: false,
          lastCheckedAt: Date.now(),
          error: message,
        },
      },
      error: null,
      loading: false,
    }),
  markMissing: (agentId, message = 'The selected agent is needed for AI edits.') =>
    set({
      resultByAgent: {
        ...get().resultByAgent,
        [agentId]: { agentId, installed: false, version: null, loggedIn: false },
      },
      availabilityByAgent: {
        ...get().availabilityByAgent,
        [agentId]: {
          agentId,
          status: 'missing',
          installed: false,
          version: null,
          loggedIn: false,
          lastCheckedAt: Date.now(),
          error: message,
        },
      },
      error: null,
      loading: false,
    }),
}));

async function runAgentPreflight(
  agentId: AgentId,
  options?: { force?: boolean; agentId?: AgentId },
) {
  usePreflightStore.setState((state) => ({
    availabilityByAgent: {
      ...state.availabilityByAgent,
      [agentId]: {
        ...state.availabilityByAgent[agentId],
        status: 'checking',
        error: null,
      },
    },
    loadingByAgent: { ...state.loadingByAgent, [agentId]: true },
    loading: true,
    error: null,
  }));

  try {
    const result = await tauriClient.agents.preflight(agentId, options);
    usePreflightStore.setState((state) => ({
      resultByAgent: { ...state.resultByAgent, [agentId]: result },
      availabilityByAgent: {
        ...state.availabilityByAgent,
        [agentId]: availabilityFromResult(result),
      },
      loadingByAgent: { ...state.loadingByAgent, [agentId]: false },
      loading: Object.values({ ...state.loadingByAgent, [agentId]: false }).some(Boolean),
      error: null,
    }));
  } catch (error) {
    const message = errorMessage(error);
    usePreflightStore.setState((state) => ({
      loadingByAgent: { ...state.loadingByAgent, [agentId]: false },
      loading: Object.values({ ...state.loadingByAgent, [agentId]: false }).some(Boolean),
      errorByAgent: { ...state.errorByAgent, [agentId]: message },
      error: message,
      availabilityByAgent: {
        ...state.availabilityByAgent,
        [agentId]: {
          agentId,
          status: 'check_failed',
          installed: null,
          version: null,
          loggedIn: null,
          lastCheckedAt: Date.now(),
          error: message,
        },
      },
    }));
  }
}

function selectedAgentId(): AgentId {
  return useSettingsStore.getState().settings.ai.selectedAgent ?? DEFAULT_AGENT_ID;
}

function agentRecord<T>(build: (agentId: AgentId) => T): Record<AgentId, T> {
  return AGENT_IDS.reduce(
    (record, agentId) => {
      record[agentId] = build(agentId);
      return record;
    },
    {} as Record<AgentId, T>,
  );
}
