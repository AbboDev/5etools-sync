import { storage } from '#imports';
import { findFile, downloadFile } from '@/utils/drive';

export async function setupPull(element: HTMLButtonElement) {
  let token: string | null = await storage.getItem('local:token');

  const setButtonState = (token: string | null) => {
    element.disabled = !token;
  }

  const pullData = async () => {
    token = await storage.getItem('local:token');

    if (!token) {
      alert("Please authenticate first!");
      return;
    }

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      alert("No active tab found!");
      return;
    }

    const file = await findFile(token);
    if (!file) {
      alert("No file found in the Cloud!");
      return;
    }

    const state = await downloadFile(token, file?.id);

    if (!state) {
      alert("Failed to retrieve state from the Cloud!");
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

    alert("Loaded successfully!");
  };

  setButtonState(token);
  storage.watch<string | null>('local:token', (token) => {
    setButtonState(token);
  });

  element.addEventListener('click', () => pullData());
}
