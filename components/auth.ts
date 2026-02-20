import { storage } from '#imports';
import { getAuthToken } from '@/utils/drive';
import { showMessage } from './notify';

export async function setupAuth(element: HTMLButtonElement) {
  let token: string | null = await storage.getItem('local:token');

  const setButtonText = () => {
    if (token) {
      element.textContent = "Logout Google";
    } else {
      element.textContent = "Login Google";
    }
  }

  setButtonText();

  const authenticate = async () => {
    if (token) {
      await storage.removeItem('local:token');
      token = null;
      setButtonText();
      showMessage("Logged out successfully!", 'success');
      return;
    }

    try {
      const newToken = await getAuthToken();

      await storage.setItem('local:token', newToken);

      token = newToken;

      setButtonText();

      showMessage("Authenticated successfully!", 'success');
    } catch (error) {
      showMessage(`Authentication failed! Please try again. Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      console.error("Authentication error:", error);
    }
  };

  element.addEventListener('click', () => authenticate());
}
