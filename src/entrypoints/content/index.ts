import '#imports';
import './style.css';
import { onMessage, sendMessage } from '@/messaging';
import type { CloudProviderType } from '@/types/cloud';
import { contentInjectedMessaging } from '@/messaging/contentInjectedMessaging';

export default defineContentScript({
  matches: ['*://*.5e.tools/*'],

  async main() {
    // ── Init ─────────────────────────────────────────────────────────────

    // Inject the script into the MAIN world so it can access window.NavBar
    await injectScript('/inject.js', {
      keepInDom: true,
    });

    // ── Toast ─────────────────────────────────────────────────────────────

    function showToast(
      msg: string,
      type: 'success' | 'error' | 'info' = 'info',
      duration = 3000,
    ): void {
      const toast = document.createElement('div');
      toast.className = `cse-toast cse-toast--${type}`;
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, duration);
    }

    // ── File picker modal ─────────────────────────────────────────────────

    interface FileItem {
      id: string;
      name: string;
      modifiedAt: string;
    }

    function showFilePicker(files: FileItem[]): Promise<string | null> {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'cse-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'cse-modal';
        modal.innerHTML = '<h3>Select a file to import</h3>';

        if (files.length === 0) {
          modal.innerHTML += '<p class="cse-file-empty">No JSON files found.</p>';
        } else {
          files.forEach((f) => {
            const item = document.createElement('div');
            item.className = 'cse-file-item';
            item.innerHTML = `
              <div>
                <div class="cse-file-name">${f.name}</div>
                <div class="cse-file-date">${new Date(f.modifiedAt).toLocaleDateString()}</div>
              </div>`;
            item.addEventListener('click', () => {
              overlay.remove();
              resolve(f.id);
            });
            modal.appendChild(item);
          });
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'cse-modal-close';
        closeBtn.textContent = 'Cancel';
        closeBtn.addEventListener('click', () => {
          overlay.remove();
          resolve(null);
        });
        modal.appendChild(closeBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            overlay.remove();
            resolve(null);
          }
        });
      });
    }

    // ── Content Messaging Handlers ────────────────────────────────────────

    async function ensureAuth(provider: CloudProviderType): Promise<boolean> {
      try {
        const state = await sendMessage('authGetState', provider);
        if (state.isAuthenticated) return true;
      } catch {
        // failed to get state
      }

      try {
        const state = await sendMessage('authLogin', provider);
        if (state.isAuthenticated) {
          showToast('✓ Logged in!', 'success');
          return true;
        }
      } catch (err) {
        showToast(`Login failed: ${(err as Error).message}`, 'error');
      }
      return false;
    }

    contentInjectedMessaging.onMessage('exportData', async ({ data }) => {
      const { dump, source } = data;
      const activeProvider = (source === 'drive' ? 'google_drive' : source) as CloudProviderType;

      const isAuthenticated = await ensureAuth(activeProvider);
      if (!isAuthenticated) return;

      showToast(`Exporting to ${source}...`, 'info', 2000);
      try {
        const result = await sendMessage('exportJson', {
          provider: activeProvider,
          fileName: `export_${Date.now().toString()}.json`,
          data: dump,
        });
        showToast(`✓ Exported: ${result.fileName}`, 'success');
      } catch (err) {
        showToast(`Export failed: ${(err as Error).message}`, 'error');
      }
    });

    contentInjectedMessaging.onMessage('importData', async ({ data: source }) => {
      const activeProvider = (source === 'drive' ? 'google_drive' : source) as CloudProviderType;

      const isAuthenticated = await ensureAuth(activeProvider);
      if (!isAuthenticated) return null;

      let files: { id: string; name: string; modifiedAt: string }[] = [];
      try {
        files = await sendMessage('listFiles', activeProvider);
      } catch (err) {
        showToast(`Could not list files: ${(err as Error).message}`, 'error');
        return null;
      }

      const fileId = await showFilePicker(files);
      if (!fileId) return null;

      showToast('Importing...', 'info', 2000);
      try {
        const data = await sendMessage('importJson', {
          provider: activeProvider,
          fileId,
        });
        showToast('✓ Import complete', 'success', 4000);
        return data;
      } catch (err) {
        showToast(`Import failed: ${(err as Error).message}`, 'error');
        throw err;
      }
    });

    // ── Listen for auth state changes broadcast from popup ────────────────

    onMessage('authStateChanged', () => {
      // Background auth state changed, log context if needed.
    });
  },
});
