import '#imports';
import { onMessage, sendMessage } from '@/messaging';
import type { CloudProviderType } from '@/types/cloud';

export default defineContentScript({
  matches: ['*://*.5e.tools/*'],

  main() {
    const activeProvider: CloudProviderType = 'google_drive';

    // ── Styles ─────────────────────────────────────────────────────────────

    function injectStyles(): void {
      if (document.getElementById('cse-styles')) return;
      const style = document.createElement('style');
      style.id = 'cse-styles';
      style.textContent = `
        #cse-widget {
          position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
          display: flex; flex-direction: column; gap: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .cse-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px; border: none; border-radius: 24px; cursor: pointer;
          font-size: 13px; font-weight: 600; color: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,.25);
          transition: transform .15s, box-shadow .15s, opacity .15s;
          white-space: nowrap;
        }
        .cse-btn:hover  { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.3); }
        .cse-btn:active { transform: translateY(0); }
        .cse-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }
        .cse-btn--export { background: #1a73e8; }
        .cse-btn--import { background: #188038; }
        .cse-btn--auth   { background: #ea4335; }
        .cse-icon { width: 16px; height: 16px; flex-shrink: 0; }
        .cse-toast {
          position: fixed; bottom: 100px; right: 24px; z-index: 2147483647;
          padding: 10px 16px; border-radius: 8px; background: #202124; color: #fff;
          font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,.3); animation: cse-fadein .2s ease; max-width: 300px;
        }
        .cse-toast--error   { background: #c5221f; }
        .cse-toast--success { background: #188038; }
        @keyframes cse-fadein {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cse-modal-overlay {
          position: fixed; inset: 0; z-index: 2147483646;
          background: rgba(0,0,0,.5); display: flex;
          align-items: center; justify-content: center;
        }
        .cse-modal {
          background: #fff; border-radius: 12px; padding: 24px;
          width: 380px; max-height: 500px; overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,.3);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .cse-modal h3 { margin: 0 0 16px; font-size: 16px; color: #202124; }
        .cse-file-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px; border-radius: 8px; cursor: pointer; transition: background .15s;
        }
        .cse-file-item:hover { background: #f1f3f4; }
        .cse-file-name { font-size: 13px; color: #202124; flex: 1; }
        .cse-file-date { font-size: 11px; color: #5f6368; }
        .cse-modal-close {
          margin-top: 16px; width: 100%; padding: 10px;
          border: 1px solid #dadce0; border-radius: 8px;
          background: none; cursor: pointer; font-size: 13px; color: #5f6368;
        }
        .cse-modal-close:hover { background: #f1f3f4; }
        .cse-spinner {
          width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3);
          border-top-color: #fff; border-radius: 50%;
          animation: cse-spin .6s linear infinite; flex-shrink: 0;
        }
        @keyframes cse-spin { to { transform: rotate(360deg); } }
      `;
      document.head.appendChild(style);
    }

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
          modal.innerHTML += '<p style="color:#5f6368;font-size:13px;">No JSON files found.</p>';
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
      injectStyles();

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
