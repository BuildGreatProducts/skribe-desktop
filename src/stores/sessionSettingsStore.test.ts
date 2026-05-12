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

  it('stores false values with the same normalized folder key', () => {
    useSessionSettingsStore
      .getState()
      .setDangerouslySkipPermissions('C:\\Project\\Drafts\\', true);
    useSessionSettingsStore
      .getState()
      .setDangerouslySkipPermissions('C:/Project/Drafts', false);

    expect(dangerouslySkipPermissionsForFolder('C:\\Project\\Drafts\\')).toBe(
      false,
    );
    expect(
      useSessionSettingsStore.getState().dangerouslySkipPermissionsByFolder,
    ).toEqual({
      'C:/Project/Drafts': false,
    });
  });

  it('normalizes Unix folder path variants consistently', () => {
    useSessionSettingsStore
      .getState()
      .setDangerouslySkipPermissions('/home/user/project/', true);

    expect(normalizeFolderPath('/home/user/project/')).toBe(
      '/home/user/project',
    );
    expect(dangerouslySkipPermissionsForFolder('/home/user/project')).toBe(true);
    expect(
      dangerouslySkipPermissionsForFolder('/home/user/project/'),
    ).toBe(true);
  });

  it('keeps multiple folder settings independent', () => {
    useSessionSettingsStore
      .getState()
      .setDangerouslySkipPermissions('/home/user/project-a', true);
    useSessionSettingsStore
      .getState()
      .setDangerouslySkipPermissions('/home/user/project-b', false);

    expect(dangerouslySkipPermissionsForFolder('/home/user/project-a')).toBe(
      true,
    );
    expect(dangerouslySkipPermissionsForFolder('/home/user/project-b')).toBe(
      false,
    );
    expect(
      useSessionSettingsStore.getState().dangerouslySkipPermissionsByFolder,
    ).toEqual({
      '/home/user/project-a': true,
      '/home/user/project-b': false,
    });
  });

  it('returns false for unset and empty folder paths', () => {
    expect(dangerouslySkipPermissionsForFolder('/home/user/unset')).toBe(false);
    expect(dangerouslySkipPermissionsForFolder('')).toBe(false);
    expect(dangerouslySkipPermissionsForFolder(null)).toBe(false);
  });
});
