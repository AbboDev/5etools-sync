import { storage } from '#imports';
import { findFile, downloadFile } from '@/utils/drive';
import { showMessage } from './notify';

export async function setupPull(element: HTMLButtonElement) {
  let token: string | null = await storage.getItem('local:token');

  const setButtonState = (token: string | null) => {
    element.disabled = !token;
  }

  const pullData = async () => {
    token = await storage.getItem('local:token');

    if (!token) {
      showMessage("Please authenticate first!", 'error');
      return;
    }

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      showMessage("No active tab found!", 'error');
      return;
    }

    const file = await findFile(token);
    if (!file) {
      showMessage("No file found in the Cloud!", 'warn');
      return;
    }

    const state = await downloadFile(token, file?.id);

    if (!state) {
      showMessage("Failed to retrieve state from the Cloud!", 'error');
      return;
    }

    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: (remoteState) => {
        localStorage.clear();
        const parsed = JSON.parse(remoteState);
        console.info(parsed)

        for (const key in parsed) {
          localStorage.setItem(key, parsed[key]);
        }

        location.reload();
      },
      args: [state]
    });

    showMessage("Loaded successfully!", 'success');
  };

  setButtonState(token);
  storage.watch<string | null>('local:token', (token) => {
    setButtonState(token);
  });

  element.addEventListener('click', () => pullData());
}
