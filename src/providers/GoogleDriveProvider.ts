/**
 * GoogleDriveProvider
 *
 * Authentication strategy:
 * - Chrome (MV3): uses chrome.identity.getAuthToken — seamless, no popup.
 * - Firefox (MV2) + all other browsers: uses browser.identity.launchWebAuthFlow
 *   with PKCE (Proof Key for Code Exchange), which is the cross-browser standard.
 *
 * For Firefox you must also register a "Web Application" OAuth2 client in
 * Google Cloud Console (NOT a "Chrome App" client) and add the redirect URI
 * printed by getFirefoxRedirectUrl() to the authorized redirect URIs list.
 *
 * Environment variables expected (set in .env):
 *   VITE_GOOGLE_CLIENT_ID_CHROME   — Chrome App client ID  (oauth2.client_id in manifest)
 *   VITE_GOOGLE_CLIENT_ID_WEB      — Web Application client ID used for Firefox / PKCE flow
 */

import type {
  AuthState,
  CloudFile,
  CloudProvider,
  CloudProviderType,
  UploadOptions,
  UploadResult,
} from '@/types/cloud';

// ─── Config ───────────────────────────────────────────────────────────────────

const WEB_CLIENT_ID    = import.meta.env.VITE_GOOGLE_CLIENT_ID_WEB    as string ?? 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const STORAGE_KEY = 'auth_google_drive';

// ─── SVG icon ─────────────────────────────────────────────────────────────────

export const GDRIVE_ICON = `<svg viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
</svg>`;

// ─── Browser detection ────────────────────────────────────────────────────────

/** True when running inside Chrome (or a Chromium browser that supports getAuthToken) */
function isChrome(): boolean {
  return typeof browser !== 'undefined'
    ? browser.runtime.getManifest().manifest_version === 3
    : false;
}

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function generateRandomString(length = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await sha256(verifier);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function saveAuth(state: AuthState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

async function loadAuth(): Promise<AuthState> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as AuthState | undefined) ?? {
    isAuthenticated: false,
    provider: null,
  };
}

// ─── User profile ─────────────────────────────────────────────────────────────

async function fetchUserProfile(token: string): Promise<{
  email: string;
  name: string;
  picture: string;
}> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Google user profile');
  return res.json() as Promise<{ email: string; name: string; picture: string }>;
}

// ─── Chrome-specific: getAuthToken ────────────────────────────────────────────

async function loginWithGetAuthToken(): Promise<AuthState> {
  const token = await new Promise<string>((resolve, reject) => {
    browser.identity.getAuthToken({ interactive: true }, (t) => {
      if (browser.runtime.lastError || !t) {
        reject(new Error(browser.runtime.lastError?.message ?? 'getAuthToken failed'));
      } else {
        resolve(t);
      }
    });
  });

  const profile = await fetchUserProfile(token);
  const state: AuthState = {
    isAuthenticated: true,
    provider: 'google_drive',
    accessToken: token,
    userEmail: profile.email,
    userName: profile.name,
    userAvatar: profile.picture,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
  await saveAuth(state);
  return state;
}

async function refreshWithGetAuthToken(oldToken: string): Promise<string> {
  // Remove the stale cached token so Chrome fetches a fresh one
  await new Promise<void>((resolve) => {
    chrome.identity.removeCachedAuthToken({ token: oldToken }, resolve);
  });
  return new Promise<string>((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (t) => {
      if (chrome.runtime.lastError || !t) {
        reject(new Error('Silent token refresh failed'));
      } else {
        resolve(t);
      }
    });
  });
}

// ─── Cross-browser: launchWebAuthFlow + PKCE ──────────────────────────────────

async function loginWithWebAuthFlow(): Promise<AuthState> {
  const codeVerifier  = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state         = generateRandomString(16);
  const redirectUrl   = browser.identity.getRedirectURL('oauth2');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id',             WEB_CLIENT_ID);
  authUrl.searchParams.set('response_type',         'code');
  authUrl.searchParams.set('redirect_uri',          redirectUrl);
  authUrl.searchParams.set('scope',                 SCOPES.join(' '));
  authUrl.searchParams.set('state',                 state);
  authUrl.searchParams.set('code_challenge',        codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('access_type',           'offline');
  authUrl.searchParams.set('prompt',                'consent');

  const responseUrl: string = await browser.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });

  const url    = new URL(responseUrl);
  const code   = url.searchParams.get('code');
  const retState = url.searchParams.get('state');

  if (!code)             throw new Error('No authorization code returned');
  if (retState !== state) throw new Error('OAuth state mismatch — possible CSRF');

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     WEB_CLIENT_ID,
      redirect_uri:  redirectUrl,
      grant_type:    'authorization_code',
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({})) as Record<string, string>;
    throw new Error(`Token exchange failed: ${err['error_description'] ?? tokenRes.statusText}`);
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const profile = await fetchUserProfile(tokens.access_token);

  const authState: AuthState = {
    isAuthenticated: true,
    provider: 'google_drive',
    accessToken:  tokens.access_token,
    refreshToken: tokens.refresh_token,
    userEmail:    profile.email,
    userName:     profile.name,
    userAvatar:   profile.picture,
    expiresAt:    Date.now() + tokens.expires_in * 1000,
  };
  await saveAuth(authState);
  return authState;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     WEB_CLIENT_ID,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) throw new Error('Token refresh failed — please login again');

  const data = await res.json() as { access_token: string; expires_in: number };
  return data.access_token;
}

// ─── GoogleDriveProvider ─────────────────────────────────────────────────────

export class GoogleDriveProvider implements CloudProvider {
  readonly type: CloudProviderType = 'google_drive';
  readonly displayName = 'Google Drive';
  readonly icon = GDRIVE_ICON;

  async login(): Promise<AuthState> {
    console.info('Starting Google Drive login flow',isChrome());
    return isChrome() ? loginWithGetAuthToken() : loginWithWebAuthFlow();
  }

  async logout(): Promise<void> {
    const state = await loadAuth();
    if (isChrome() && state.accessToken) {
      await new Promise<void>((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: state.accessToken! }, resolve);
      });
    }
    if (!isChrome() && state.accessToken) {
      // Revoke token on Google's side
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${state.accessToken}`,
        { method: 'POST' }
      ).catch(() => { /* best-effort */ });
    }
    await saveAuth({ isAuthenticated: false, provider: null });
  }

  async isAuthenticated(): Promise<boolean> {
    const state = await loadAuth();
    if (!state.isAuthenticated || !state.accessToken) return false;
    try {
      const res = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${state.accessToken}`
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async getAuthState(): Promise<AuthState> {
    return loadAuth();
  }

  /** Returns a valid access token, refreshing silently if expired */
  private async getToken(): Promise<string> {
    const state = await loadAuth();

    // Token still fresh (> 60 s remaining)
    if (
      state.accessToken &&
      state.expiresAt &&
      state.expiresAt - Date.now() > 60_000
    ) {
      return state.accessToken;
    }

    if (isChrome() && state.accessToken) {
      const newToken = await refreshWithGetAuthToken(state.accessToken);
      const updated: AuthState = {
        ...state,
        accessToken: newToken,
        expiresAt: Date.now() + 55 * 60 * 1000,
      };
      await saveAuth(updated);
      return newToken;
    }

    if (state.refreshToken) {
      const newToken = await refreshAccessToken(state.refreshToken);
      const updated: AuthState = {
        ...state,
        accessToken: newToken,
        expiresAt: Date.now() + 55 * 60 * 1000,
      };
      await saveAuth(updated);
      return newToken;
    }

    throw new Error('Session expired — please login again');
  }

  // ── Drive API calls ─────────────────────────────────────────────────────────

  async uploadFile(options: UploadOptions): Promise<UploadResult> {
    const token = await this.getToken();
    const { fileName, content, mimeType = 'application/json', existingFileId } = options;

    const metadata = { name: fileName, mimeType };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: mimeType }));

    const url = existingFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,webViewLink`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';

    const res = await fetch(url, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(`Upload failed: ${err?.error?.message ?? res.statusText}`);
    }

    const data = await res.json() as { id: string; name: string; webViewLink?: string };
    return { fileId: data.id, fileName: data.name, webViewLink: data.webViewLink };
  }

  async downloadFile(fileId: string): Promise<string> {
    const token = await this.getToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
    return res.text();
  }

  async listFiles(query?: string): Promise<CloudFile[]> {
    const token = await this.getToken();

    let q = "mimeType='application/json' and trashed=false";
    if (query) q += ` and name contains '${query.replace(/'/g, "\\'")}'`;

    const params = new URLSearchParams({
      q,
      fields: 'files(id,name,mimeType,modifiedTime,size)',
      orderBy: 'modifiedTime desc',
      pageSize: '50',
    });

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) throw new Error(`List failed: ${res.statusText}`);
    const data = await res.json() as {
      files: Array<{ id: string; name: string; mimeType: string; modifiedTime: string; size?: string }>;
    };

    return (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedAt: f.modifiedTime,
      size: f.size ? parseInt(f.size, 10) : undefined,
    }));
  }
}
