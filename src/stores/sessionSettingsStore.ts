import { create } from 'zustand';

type SessionSettingsState = {
  dangerouslySkipPermissionsByFolder: Record<string, boolean>;
  setDangerouslySkipPermissions: (folderPath: string, enabled: boolean) => void;
};

export const useSessionSettingsStore = create<SessionSettingsState>((set) => ({
  dangerouslySkipPermissionsByFolder: {},
  setDangerouslySkipPermissions: (folderPath, enabled) =>
    set((state) => ({
      dangerouslySkipPermissionsByFolder: {
        ...state.dangerouslySkipPermissionsByFolder,
        [folderPath]: enabled,
      },
    })),
}));

export function dangerouslySkipPermissionsForFolder(folderPath: string | null): boolean {
  if (!folderPath) return false;
  return (
    useSessionSettingsStore.getState().dangerouslySkipPermissionsByFolder[folderPath] === true
  );
}
