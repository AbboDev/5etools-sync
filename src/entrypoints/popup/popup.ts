import '#imports';
import { sendMessage } from '@/messaging';
import type { ProviderMeta } from '@/messaging';
import type { AuthState, CloudFile, CloudProviderType } from '@/types/cloud';

// ─── DOM helpers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const providerTabs = $('#provider-tabs');
const userInfo = $<HTMLDivElement>('#user-info');
const loginInfo = $<HTMLDivElement>('#login-info');
const userAvatar = $<HTMLImageElement>('#user-avatar');
const userName = $<HTMLHeadingElement>('#user-name');
const userEmail = $<HTMLParagraphElement>('#user-email');
const btnLogin = $<HTMLButtonElement>('#btn-login');
const btnLogout = $<HTMLButtonElement>('#btn-logout');
const loginBtnIcon = $('#login-btn-icon');
const loginProvName = $('#login-provider-name');
const providerIcon = $('#provider-icon');
const btnExport = $<HTMLButtonElement>('#btn-export');
const btnImport = $<HTMLButtonElement>('#btn-import');
const statusBar = $<HTMLDivElement>('#status-bar');
const statusSpinner = $<HTMLElement>('#status-spinner');
const statusText = $('#status-text');
const filePicker = $<HTMLDivElement>('#file-picker');
const filePickerClose = $<HTMLButtonElement>('#file-picker-close');
const fileList = $('#file-list');

// ─── State ────────────────────────────────────────────────────────────────────

let providers: ProviderMeta[] = [];
let activeProvider: CloudProviderType = 'google_drive';
let authState: AuthState = { isAuthenticated: false, provider: null };

// ─── Status bar ───────────────────────────────────────────────────────────────

function setStatus(
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
  loading = false,
  duration?: number,
): void {
  statusBar.hidden = false;
  statusBar.className = `status-bar ${type}`;
  statusText.textContent = message;
  statusSpinner.hidden = !loading;
  if (duration !== undefined) {
    setTimeout(() => {
      statusBar.hidden = true;
    }, duration);
  }
}

function clearStatus(): void {
  statusBar.hidden = true;
}

// ─── Provider tabs ────────────────────────────────────────────────────────────

function renderProviderTabs(): void {
  providerTabs.innerHTML = '';
  providers.forEach((p) => {
    const isActive = p.type === activeProvider;
    const isReady = p.type === 'google_drive';
    const btn = document.createElement('button');
    btn.className = `provider-tab${isActive ? ' active' : ''}${!isReady ? ' disabled' : ''}`;
    btn.innerHTML = `
      <span class="tab-icon">${p.icon}</span>
      ${p.displayName}
      ${!isReady ? '<span class="badge">soon</span>' : ''}`;
    btn.title = isReady ? p.displayName : `${p.displayName} — coming soon`;
    if (isReady) {
      btn.addEventListener('click', () => void switchProvider(p.type));
    }
    providerTabs.appendChild(btn);
  });
}

// ─── Auth card ────────────────────────────────────────────────────────────────

function renderAuthCard(): void {
  const meta = providers.find((p) => p.type === activeProvider);
  if (!meta) return;

  if (authState.isAuthenticated) {
    userInfo.hidden = false;
    loginInfo.hidden = true;
    userAvatar.src = authState.userAvatar ?? '';
    userAvatar.hidden = !authState.userAvatar;
    userName.textContent = authState.userName ?? '';
    userEmail.textContent = authState.userEmail ?? '';
  } else {
    userInfo.hidden = true;
    loginInfo.hidden = false;
    providerIcon.innerHTML = meta.icon;
    loginBtnIcon.innerHTML = meta.icon;
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
    authState = await sendMessage('authGetState', activeProvider);
  } catch {
    authState = { isAuthenticated: false, provider: null };
  }
  renderAuthCard();
}

// ─── Login / Logout ───────────────────────────────────────────────────────────

btnLogin.addEventListener('click', () => {
  void (async () => {
    btnLogin.disabled = true;
    setStatus('Connecting…', 'info', true);
    try {
      authState = await sendMessage('authLogin', activeProvider);
      renderAuthCard();
      // Notify content scripts in all tabs that auth changed
      const tabs = await browser.tabs.query({});
      await Promise.allSettled(
        tabs
          .filter((t) => t.id !== undefined)
          .map((t) => sendMessage('authStateChanged', activeProvider, t.id)),
      );
      setStatus(`Signed in as ${authState.userEmail ?? ''}`, 'success', false, 3000);
    } catch (err) {
      setStatus(`Login failed: ${(err as Error).message}`, 'error', false, 5000);
    } finally {
      btnLogin.disabled = false;
    }
  })();
});

btnLogout.addEventListener('click', () => {
  void (async () => {
    btnLogout.disabled = true;
    setStatus('Signing out…', 'info', true);
    try {
      await sendMessage('authLogout', activeProvider);
      authState = { isAuthenticated: false, provider: null };
      renderAuthCard();
      clearStatus();
    } catch (err) {
      setStatus(`Logout failed: ${(err as Error).message}`, 'error', false, 5000);
    } finally {
      btnLogout.disabled = false;
    }
  })();
});

// ─── Export ───────────────────────────────────────────────────────────────────

btnExport.addEventListener('click', () => {
  void (async () => {
    btnExport.disabled = true;
    setStatus('Exporting…', 'info', true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const result = await sendMessage('exportJson', {
        provider: activeProvider,
        fileName: `export_${Date.now().toString()}.json`,
        // TODO: replace with real page data
        data: { url: tab.url ?? '', title: tab.title ?? '', exportedAt: new Date().toISOString() },
      });
      setStatus(`✓ Exported: ${result.fileName}`, 'success', false, 4000);
    } catch (err) {
      setStatus(`Export failed: ${(err as Error).message}`, 'error', false, 5000);
    } finally {
      btnExport.disabled = false;
    }
  })();
});

// ─── Import ───────────────────────────────────────────────────────────────────

btnImport.addEventListener('click', () => {
  void (async () => {
    btnImport.disabled = true;
    setStatus('Loading files…', 'info', true);
    try {
      const files = await sendMessage('listFiles', activeProvider);
      clearStatus();
      showFilePicker(files);
    } catch (err) {
      setStatus(`Could not load files: ${(err as Error).message}`, 'error', false, 5000);
      btnImport.disabled = false;
    }
  })();
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
    item.addEventListener('click', () => void importFile(f.id, f.name));
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
    const data = await sendMessage('importJson', { provider: activeProvider, fileId });
    // Forward imported data to the active tab's content script
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab.id !== undefined) {
      await sendMessage('importResult', data, tab.id);
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
    providers = await sendMessage('getProviders', undefined);
  } catch {
    providers = [{ type: 'google_drive', displayName: 'Google Drive', icon: '' }];
  }
  renderProviderTabs();
  await switchProvider(activeProvider);
}

void init();
