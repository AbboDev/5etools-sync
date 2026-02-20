import { storage } from '#imports';
import { getAuthToken } from '@/utils/drive';

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
      alert("Logged out successfully!");
      return;
    }

    try {
      const newToken = await getAuthToken();

      await storage.setItem('local:token', newToken);

      token = newToken;

      setButtonText();

      alert("Authenticated successfully!");
    } catch (error) {
      alert(`Authentication failed! Please try again. Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error("Authentication error:", error);
    }
  };

  element.addEventListener('click', () => authenticate());
}
