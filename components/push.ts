import { storage } from '#imports';
import { findFile, uploadFile } from '@/utils/drive';

export function setupPush(element: HTMLButtonElement) {
  const setPush = async () => {
    const token: string | null = await storage.getItem('local:token');

    if (!token) {
      alert("Please authenticate first!");
      return;
    }

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      alert("No active tab found!");
      return;
    }

    const [{ result }] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => JSON.stringify(localStorage)
    });

    if (!result) {
      alert("Failed to retrieve data from the active tab!");
      return;
    }

    const file = await findFile(token);
    const response = await uploadFile(token, result, file?.id);
    console.info("Upload response:", JSON.stringify(response));

    alert("Saved successfully!");
  };

  element.addEventListener('click', () => setPush());
}
