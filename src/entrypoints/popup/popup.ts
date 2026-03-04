import '#imports';
import type {
  AuthState,
  CloudFile,
  CloudProviderType,
  ExtensionMessage,
  MessageResponse,
} from '@/types/cloud';

// ─── Messaging ────────────────────────────────────────────────────────────────

function sendMsg<T = unknown>(message: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    browser.runtime.sendMessage(message, (response: MessageResponse<T>) => {
      if (browser.runtime.lastError) {
        reject(new Error(browser.runtime.lastError.message));
        return;
      }
      if (!response?.success) {
        reject(new Error(response?.error ?? 'Unknown error'));
        return;
      }
      resolve(response.data as T);
    });
  });
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;

const providerTabs    = $('#provider-tabs');
const userInfo        = $('#user-info');
const loginInfo       = $('#login-info');
const userAvatar      = $<HTMLImageElement>('#user-avatar');
const userName        = $('#user-name');
const userEmail       = $('#user-email');
const btnLogin        = $<HTMLButtonElement>('#btn-login');
const btnLogout       = $<HTMLButtonElement>('#btn-logout');
const loginBtnIcon    = $('#login-btn-icon');
const loginProvName   = $('#login-provider-name');
const providerIcon    = $('#provider-icon');
const btnExport       = $<HTMLButtonElement>('#btn-export');
const btnImport       = $<HTMLButtonElement>('#btn-import');
const statusBar       = $('#status-bar');
const statusSpinner   = $<HTMLElement>('#status-spinner');
const statusText      = $('#status-text');
const filePicker      = $('#file-picker');
const filePickerClose = $<HTMLButtonElement>('#file-picker-close');
const fileList        = $('#file-list');

// ─── State ────────────────────────────────────────────────────────────────────

interface ProviderMeta { type: CloudProviderType; displayName: string; icon: string }

let providers: ProviderMeta[]   = [];
let activeProvider: CloudProviderType = 'google_drive';
let authState: AuthState        = { isAuthenticated: false, provider: null };

// ─── Status bar ───────────────────────────────────────────────────────────────

function setStatus(
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
  loading = false,
  duration?: number
): void {
  statusBar.hidden = false;
  statusBar.className = `status-bar ${type}`;
  statusText.textContent = message;
  statusSpinner.hidden = !loading;
  if (duration) setTimeout(() => { statusBar.hidden = true; }, duration);
}

function clearStatus(): void { statusBar.hidden = true; }

// ─── Provider tabs ────────────────────────────────────────────────────────────

function renderProviderTabs(): void {
  providerTabs.innerHTML = '';
  providers.forEach((p) => {
    const isActive = p.type === activeProvider;
    const isReady  = p.type === 'google_drive';
    const btn = document.createElement('button');
    btn.className = `provider-tab${isActive ? ' active' : ''}${!isReady ? ' disabled' : ''}`;
    btn.innerHTML = `
      <span class="tab-icon">${p.icon}</span>
      ${p.displayName}
      ${!isReady ? '<span class="badge">soon</span>' : ''}`;
    btn.title = isReady ? p.displayName : `${p.displayName} — coming soon`;
    if (isReady) btn.addEventListener('click', () => switchProvider(p.type));
    providerTabs.appendChild(btn);
  });
}

// ─── Auth card ────────────────────────────────────────────────────────────────

function renderAuthCard(): void {
  const meta = providers.find((p) => p.type === activeProvider);
  if (!meta) return;

  if (authState.isAuthenticated) {
    userInfo.hidden  = false;
    loginInfo.hidden = true;
    userAvatar.src   = authState.userAvatar ?? '';
    userAvatar.hidden = !authState.userAvatar;
    userName.textContent  = authState.userName  ?? '';
    userEmail.textContent = authState.userEmail ?? '';
  } else {
    userInfo.hidden  = true;
    loginInfo.hidden = false;
    providerIcon.innerHTML  = meta.icon;
    loginBtnIcon.innerHTML  = meta.icon;
    loginProvName.textContent = meta.displayName;
  }

  btnExport.disabled = !authState.isAuthenticated;
  btnImport.disabled = !authState.isAuthenticated;
}

// ─── Provider switch ──────────────────────────────────────────────────────────

async function switchProvider(type: CloudProviderType): Promise<void> {
  activeProvider = type;
  renderProviderTabs();
  clearStatus();
  try {
    authState = await sendMsg<AuthState>({ type: 'AUTH_GET_STATE', provider: activeProvider });
  } catch {
    authState = { isAuthenticated: false, provider: null };
  }
  renderAuthCard();
}

// ─── Login / Logout ───────────────────────────────────────────────────────────

btnLogin.addEventListener('click', async () => {
  btnLogin.disabled = true;
  setStatus('Connecting…', 'info', true);
  try {
    authState = await sendMsg<AuthState>({ type: 'AUTH_LOGIN', provider: activeProvider });
    renderAuthCard();
    setStatus(`Signed in as ${authState.userEmail}`, 'success', false, 3000);
  } catch (err) {
    setStatus(`Login failed: ${(err as Error).message}`, 'error', false, 5000);
  } finally {
    btnLogin.disabled = false;
  }
});

btnLogout.addEventListener('click', async () => {
  btnLogout.disabled = true;
  setStatus('Signing out…', 'info', true);
  try {
    await sendMsg({ type: 'AUTH_LOGOUT', provider: activeProvider });
    authState = { isAuthenticated: false, provider: null };
    renderAuthCard();
    clearStatus();
  } catch (err) {
    setStatus(`Logout failed: ${(err as Error).message}`, 'error', false, 5000);
  } finally {
    btnLogout.disabled = false;
  }
});

// ─── Export ───────────────────────────────────────────────────────────────────

btnExport.addEventListener('click', async () => {
  btnExport.disabled = true;
  setStatus('Exporting…', 'info', true);
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const data = {
      url:        tab?.url   ?? '',
      title:      tab?.title ?? '',
      exportedAt: new Date().toISOString(),
      payload:    {} as Record<string, unknown>, // TODO: replace with real data
    };
    const result = await sendMsg<{ fileName: string }>({
      type: 'EXPORT_JSON',
      provider: activeProvider,
      payload: { fileName: `export_${Date.now()}.json`, data },
    });
    setStatus(`✓ Exported: ${result.fileName}`, 'success', false, 4000);
  } catch (err) {
    setStatus(`Export failed: ${(err as Error).message}`, 'error', false, 5000);
  } finally {
    btnExport.disabled = false;
  }
});

// ─── Import ───────────────────────────────────────────────────────────────────

btnImport.addEventListener('click', async () => {
  btnImport.disabled = true;
  setStatus('Loading files…', 'info', true);
  try {
    const files = await sendMsg<CloudFile[]>({ type: 'LIST_FILES', provider: activeProvider });
    clearStatus();
    showFilePicker(files);
  } catch (err) {
    setStatus(`Could not load files: ${(err as Error).message}`, 'error', false, 5000);
    btnImport.disabled = false;
  }
});

function showFilePicker(files: CloudFile[]): void {
  filePicker.hidden = false;
  fileList.innerHTML = '';
  if (files.length === 0) {
    fileList.innerHTML = `<div class="file-picker__loading">No JSON files found.</div>`;
    return;
  }
  files.forEach((f) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <svg class="file-item__icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
      </svg>
      <div class="file-item__info">
        <div class="file-item__name">${f.name}</div>
        <div class="file-item__meta">${new Date(f.modifiedAt).toLocaleString()}</div>
      </div>`;
    item.addEventListener('click', () => importFile(f.id, f.name));
    fileList.appendChild(item);
  });
}

filePickerClose.addEventListener('click', () => {
  filePicker.hidden = true;
  btnImport.disabled = false;
});

async function importFile(fileId: string, fileName: string): Promise<void> {
  filePicker.hidden = true;
  setStatus(`Importing ${fileName}…`, 'info', true);
  try {
    const data = await sendMsg<Record<string, unknown>>({
      type: 'IMPORT_JSON',
      provider: activeProvider,
      payload: { fileId },
    });
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: 'IMPORT_RESULT', data });
    }
    setStatus(`✓ Imported: ${fileName}`, 'success', false, 4000);
  } catch (err) {
    setStatus(`Import failed: ${(err as Error).message}`, 'error', false, 5000);
  } finally {
    btnImport.disabled = false;
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  try {
    providers = await sendMsg<ProviderMeta[]>({ type: 'GET_PROVIDERS' });
  } catch {
    providers = [{ type: 'google_drive', displayName: 'Google Drive', icon: '' }];
  }
  renderProviderTabs();
  await switchProvider(activeProvider);
}

init();
