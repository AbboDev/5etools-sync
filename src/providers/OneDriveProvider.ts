/**
 * OneDriveProvider — stub implementation
 *
 * To activate:
 * 1. Register an app at https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps
 *    - Platform: "Mobile and desktop applications"
 *    - Redirect URI: browser.identity.getRedirectURL('oauth2')
 * 2. Set VITE_ONEDRIVE_CLIENT_ID in your .env file
 * 3. Implement loginWithWebAuthFlow() following the PKCE pattern in GoogleDriveProvider
 *
 * Microsoft supports PKCE OAuth2 via launchWebAuthFlow on both Chrome and Firefox.
 * Authorization endpoint: https://login.microsoftonline.com/common/oauth2/v2.0/authorize
 * Token endpoint:         https://login.microsoftonline.com/common/oauth2/v2.0/token
 * Scopes: Files.ReadWrite User.Read offline_access
 */

import type {
  AuthState,
  CloudFile,
  CloudProvider,
  CloudProviderType,
  UploadOptions,
  UploadResult,
} from '@/types/cloud';

const STORAGE_KEY = 'auth_onedrive';

const ONEDRIVE_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path fill="#0078D4" d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
</svg>`;

async function loadAuth(): Promise<AuthState> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (
    (result[STORAGE_KEY] as AuthState | undefined) ?? {
      isAuthenticated: false,
      provider: null,
    }
  );
}

async function saveAuth(state: AuthState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export class OneDriveProvider implements CloudProvider {
  readonly type: CloudProviderType = 'onedrive';
  readonly displayName = 'OneDrive';
  readonly icon = ONEDRIVE_ICON;

  // eslint-disable-next-line @typescript-eslint/require-await
  async login(): Promise<AuthState> {
    throw new Error(
      'OneDrive not yet implemented. Set VITE_ONEDRIVE_CLIENT_ID and implement PKCE flow.',
    );
  }

  async logout(): Promise<void> {
    await saveAuth({ isAuthenticated: false, provider: null });
  }

  async isAuthenticated(): Promise<boolean> {
    const state = await loadAuth();
    return state.isAuthenticated;
  }

  async getAuthState(): Promise<AuthState> {
    return loadAuth();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async uploadFile(_options: UploadOptions): Promise<UploadResult> {
    throw new Error('OneDrive not yet implemented');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async downloadFile(_fileId: string): Promise<string> {
    throw new Error('OneDrive not yet implemented');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listFiles(_query?: string): Promise<CloudFile[]> {
    throw new Error('OneDrive not yet implemented');
  }
}
