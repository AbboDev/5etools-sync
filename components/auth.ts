import { storage } from '#imports';
import { getAuthToken } from '@/utils/drive';

export function setupAuth(element: HTMLButtonElement) {
  const setAuth = async () => {
    try {
      const token = await getAuthToken();

      await storage.setItem('local:token', token);

      alert("Authenticated successfully!");
    } catch (error) {
      alert(`Authentication failed! Please try again. Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error("Authentication error:", error);
    }
  };

  element.addEventListener('click', () => setAuth());
}
