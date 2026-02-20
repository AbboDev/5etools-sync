import { storage } from '#imports';
import { findFile, uploadFile } from '@/utils/drive';
import { showMessage } from './notify';

export async function setupPush(element: HTMLButtonElement) {
  let token: string | null = await storage.getItem('local:token');

  const setButtonState = (token: string | null) => {
    element.disabled = !token;
  }

  const pushData = async () => {
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

    const [{ result }] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => JSON.stringify(localStorage)
    });

    if (!result) {
      showMessage("Failed to retrieve data from the active tab!", 'error');
      return;
    }

    const file = await findFile(token);
    const response = await uploadFile(token, result, file?.id);
    console.info("Upload response:", JSON.stringify(response));

    showMessage("Saved successfully!", 'success');
  };

  setButtonState(token);
  storage.watch<string | null>('local:token', (token) => {
    setButtonState(token);
  });

  element.addEventListener('click', () => pushData());
}
