import { beforeEach, describe, expect, it } from 'vitest';
import {
  dangerouslySkipPermissionsForFolder,
  normalizeFolderPath,
  useSessionSettingsStore,
} from './sessionSettingsStore';

describe('session settings store', () => {
  beforeEach(() => {
    useSessionSettingsStore.setState({ dangerouslySkipPermissionsByFolder: {} });
  });

  it('normalizes folder paths for permission bypass reads and writes', () => {
    useSessionSettingsStore
      .getState()
      .setDangerouslySkipPermissions('C:\\Project\\Drafts\\', true);

    expect(normalizeFolderPath('C:\\Project\\Drafts\\')).toBe(
      'C:/Project/Drafts',
    );
    expect(dangerouslySkipPermissionsForFolder('C:/Project/Drafts')).toBe(true);
    expect(
      useSessionSettingsStore.getState().dangerouslySkipPermissionsByFolder,
    ).toEqual({
      'C:/Project/Drafts': true,
    });
  });
});
