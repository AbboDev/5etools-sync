import '#imports';
import type { ExtensionMessage, MessageResponse, CloudProviderType } from '@/types/cloud';
import { getProvider, getProviderMeta } from '@/providers/registry';

export default defineBackground({
  // MV2 (Firefox): background page stays alive as long as needed.
  // MV3 (Chrome):  service worker — all state must be persisted to storage.
  persistent: false,

  main() {
    browser.runtime.onMessage.addListener(
      (
        message: ExtensionMessage,
        _sender: Browser.runtime.MessageSender,
        sendResponse: (response: MessageResponse) => void
      ): true => {
        handleMessage(message)
          .then((data) => sendResponse({ success: true, data }))
          .catch((err: unknown) =>
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            })
          );
        // Return true synchronously to keep the message channel open
        return true;
      }
    );
  },
});

// ─── Message router ───────────────────────────────────────────────────────────

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {

    case 'GET_PROVIDERS':
      return getProviderMeta();

    case 'AUTH_GET_STATE': {
      const providerType = (message as { provider?: CloudProviderType }).provider;
      if (!providerType) {
        return Promise.all(
          getProviderMeta().map(async (m) => ({
            provider: m.type,
            ...(await getProvider(m.type).getAuthState()),
          }))
        );
      }
      return getProvider(providerType).getAuthState();
    }

    case 'AUTH_LOGIN':
      if (!message.provider) throw new Error('provider required');
      return getProvider(message.provider).login();

    case 'AUTH_LOGOUT':
      if (!message.provider) throw new Error('provider required');
      return getProvider(message.provider).logout();

    case 'EXPORT_JSON': {
      if (!message.provider) throw new Error('provider required');
      const { fileName, data, existingFileId } = message.payload;
      return getProvider(message.provider).uploadFile({
        fileName,
        content: JSON.stringify(data, null, 2),
        existingFileId,
      });
    }

    case 'IMPORT_JSON': {
      if (!message.provider) throw new Error('provider required');
      const raw = await getProvider(message.provider).downloadFile(message.payload.fileId);
      return JSON.parse(raw);
    }

    case 'LIST_FILES':
      if (!message.provider) throw new Error('provider required');
      return getProvider(message.provider).listFiles();

    default:
      throw new Error(`Unknown message type: ${(message as { type: string }).type}`);
  }
}
