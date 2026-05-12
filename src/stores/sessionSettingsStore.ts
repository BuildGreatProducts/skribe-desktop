import { create } from 'zustand';

type SessionSettingsState = {
  dangerouslySkipPermissionsByFolder: Record<string, boolean>;
  setDangerouslySkipPermissions: (folderPath: string, enabled: boolean) => void;
};

export const useSessionSettingsStore = create<SessionSettingsState>((set) => ({
  dangerouslySkipPermissionsByFolder: {},
  setDangerouslySkipPermissions: (folderPath, enabled) =>
    set((state) => {
      const normalizedFolderPath = normalizeFolderPath(folderPath);
      return {
        dangerouslySkipPermissionsByFolder: {
          ...state.dangerouslySkipPermissionsByFolder,
          [normalizedFolderPath]: enabled,
        },
      };
    }),
}));

export function dangerouslySkipPermissionsForFolder(folderPath: string | null): boolean {
  if (!folderPath) return false;
  const normalizedFolderPath = normalizeFolderPath(folderPath);
  return (
    useSessionSettingsStore.getState().dangerouslySkipPermissionsByFolder[
      normalizedFolderPath
    ] === true
  );
}

export function normalizeFolderPath(folderPath: string): string {
  return folderPath.replace(/\\/g, '/').replace(/\/+$/g, '');
}
