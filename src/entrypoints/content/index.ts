import '#imports';
import './style.css';
import { onMessage, sendMessage } from '@/messaging';
import type { CloudProviderType } from '@/types/cloud';

export default defineContentScript({
  matches: ['*://*.5e.tools/*'],

  main() {
    const activeProvider: CloudProviderType = 'google_drive';

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

    // ── Widget helpers ────────────────────────────────────────────────────

    const ICON_SMALL = `<svg class="cse-icon" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#fff"/>
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#fff"/>
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#fff"/>
    </svg>`;

    function setLoading(btn: HTMLButtonElement, loading: boolean, restoreHTML?: string): void {
      btn.disabled = loading;
      if (loading) {
        btn.innerHTML = `<div class="cse-spinner"></div><span>Loading…</span>`;
      } else if (restoreHTML !== undefined) {
        btn.innerHTML = restoreHTML;
      }
    }

    // ── Widget build ──────────────────────────────────────────────────────

    async function createWidget(): Promise<void> {
      if (document.getElementById('cse-widget')) return;
      let isAuthenticated = false;
      try {
        const state = await sendMessage('authGetState', activeProvider);
        isAuthenticated = state.isAuthenticated;
      } catch {
        // background not ready yet — show login button
      }

      const widget = document.createElement('div');
      widget.id = 'cse-widget';

      // Login button (unauthenticated only)
      if (!isAuthenticated) {
        const loginHTML = `${ICON_SMALL}<span>Login to Drive</span>`;
        const loginBtn = document.createElement('button');
        loginBtn.className = 'cse-btn cse-btn--auth';
        loginBtn.innerHTML = loginHTML;
        loginBtn.addEventListener('click', async () => {
          setLoading(loginBtn, true);
          try {
            await sendMessage('authLogin', activeProvider);
            showToast('✓ Logged in!', 'success');
            widget.remove();
            await createWidget();
          } catch (err) {
            showToast(`Login failed: ${(err as Error).message}`, 'error');
            setLoading(loginBtn, false, loginHTML);
          }
        });
        widget.appendChild(loginBtn);
      }

      // Export button
      const exportHTML = `${ICON_SMALL}<span>Export JSON</span>`;
      const exportBtn = document.createElement('button');
      exportBtn.className = 'cse-btn cse-btn--export';
      exportBtn.innerHTML = exportHTML;
      exportBtn.disabled = !isAuthenticated;
      exportBtn.addEventListener('click', async () => {
        setLoading(exportBtn, true);
        try {
          const result = await sendMessage('exportJson', {
            provider: activeProvider,
            fileName: `export_${Date.now().toString()}.json`,
            // TODO: replace payload with real page data
            data: {
              url: location.href,
              title: document.title,
              exportedAt: new Date().toISOString(),
            },
          });
          showToast(`✓ Exported: ${result.fileName}`, 'success');
        } catch (err) {
          showToast(`Export failed: ${(err as Error).message}`, 'error');
        } finally {
          setLoading(exportBtn, false, exportHTML);
        }
      });

      // Import button
      const importHTML = `${ICON_SMALL}<span>Import JSON</span>`;
      const importBtn = document.createElement('button');
      importBtn.className = 'cse-btn cse-btn--import';
      importBtn.innerHTML = importHTML;
      importBtn.disabled = !isAuthenticated;
      importBtn.addEventListener('click', async () => {
        setLoading(importBtn, true);
        let files: { id: string; name: string; modifiedAt: string }[] = [];
        try {
          files = await sendMessage('listFiles', activeProvider);
        } catch (err) {
          showToast(`Could not list files: ${(err as Error).message}`, 'error');
          setLoading(importBtn, false, importHTML);
          return;
        }
        setLoading(importBtn, false, importHTML);

        const fileId = await showFilePicker(files);
        if (!fileId) return;

        setLoading(importBtn, true);
        try {
          const data = await sendMessage('importJson', {
            provider: activeProvider,
            fileId,
          });
          // Dispatch a DOM event so the host page can consume the data
          document.dispatchEvent(new CustomEvent('cse:import', { detail: data, bubbles: true }));
          showToast('✓ Import complete — cse:import event dispatched', 'success', 4000);
        } catch (err) {
          showToast(`Import failed: ${(err as Error).message}`, 'error');
        } finally {
          setLoading(importBtn, false, importHTML);
        }
      });

      widget.appendChild(exportBtn);
      widget.appendChild(importBtn);
      document.body.appendChild(widget);
    }

    // ── Listen for auth state changes broadcast from popup ────────────────

    onMessage('authStateChanged', () => {
      document.getElementById('cse-widget')?.remove();
      void createWidget();
    });

    // ── Init ─────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => void createWidget());
    } else {
      void createWidget();
    }
  },
});
