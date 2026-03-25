/**
 * DropboxProvider — stub implementation
 *
 * To activate:
 * 1. Create an app at https://www.dropbox.com/developers/apps
 *    - Choose "Scoped access" → "Full Dropbox" (or "App folder")
 *    - Add the redirect URI: browser.identity.getRedirectURL('oauth2')
 * 2. Set VITE_DROPBOX_CLIENT_ID in your .env file
 * 3. Implement loginWithWebAuthFlow() following the PKCE pattern in GoogleDriveProvider
 *
 * Dropbox supports PKCE OAuth2 out of the box via launchWebAuthFlow,
 * which works on both Chrome and Firefox without any browser-specific logic.
 */

import type {
  AuthState,
  CloudFile,
  CloudProvider,
  CloudProviderType,
  UploadOptions,
  UploadResult,
} from '@/types/cloud';

const STORAGE_KEY = 'auth_dropbox';

const DROPBOX_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path fill="#0061FF" d="M12 14.56l-6-3.73L0 14.56l6 3.73 6-3.73zm0 0l6 3.73 6-3.73-6-3.73-6 3.73zM6 2.71L0 6.44l6 3.73 6-3.73L6 2.71zm12 0l-6 3.73 6 3.73 6-3.73-6-3.73zM6 18.85L12 22.58l6-3.73-6-3.73-6 3.73z"/>
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

export class DropboxProvider implements CloudProvider {
  readonly type: CloudProviderType = 'dropbox';
  readonly displayName = 'Dropbox';
  readonly icon = DROPBOX_ICON;

  // eslint-disable-next-line @typescript-eslint/require-await
  async login(): Promise<AuthState> {
    /**
     * Use browser.identity.launchWebAuthFlow with PKCE.
     * Endpoint: https://www.dropbox.com/oauth2/authorize
     * token_endpoint: https://api.dropboxapi.com/oauth2/token
     * Scopes: files.content.read files.content.write account_info.read
     *
     * See GoogleDriveProvider for a complete PKCE implementation to follow.
     */
    throw new Error(
      'Dropbox not yet implemented. Set VITE_DROPBOX_CLIENT_ID and implement PKCE flow.',
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
    throw new Error('Dropbox not yet implemented');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async downloadFile(_fileId: string): Promise<string> {
    throw new Error('Dropbox not yet implemented');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listFiles(_query?: string): Promise<CloudFile[]> {
    throw new Error('Dropbox not yet implemented');
  }
}
