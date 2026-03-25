import '#imports';
import { onMessage } from '@/messaging';
import { getProvider, getProviderMeta } from '@/providers/registry';

export default defineBackground({
  // MV2 (Firefox): background page — persistent: false = event page.
  // MV3 (Chrome):  service worker (persistent is ignored).
  persistent: false,

  main() {
    // ── Provider metadata ────────────────────────────────────────────────────
    onMessage('getProviders', () => getProviderMeta());

    // ── Auth ─────────────────────────────────────────────────────────────────
    onMessage('authGetState', ({ data: provider }) => getProvider(provider).getAuthState());

    onMessage('authLogin', ({ data: provider }) => getProvider(provider).login());

    onMessage('authLogout', async ({ data: provider }) => {
      await getProvider(provider).logout();
    });

    // ── Export ───────────────────────────────────────────────────────────────
    onMessage('exportJson', ({ data: { provider, fileName, data, existingFileId } }) =>
      getProvider(provider).uploadFile({
        fileName,
        content: JSON.stringify(data, null, 2),
        existingFileId,
      }),
    );

    // ── Import ───────────────────────────────────────────────────────────────
    onMessage('importJson', async ({ data: { provider, fileId } }) => {
      const raw = await getProvider(provider).downloadFile(fileId);
      return JSON.parse(raw) as Record<string, unknown>;
    });

    // ── List files ───────────────────────────────────────────────────────────
    onMessage('listFiles', ({ data: provider }) => getProvider(provider).listFiles());
  },
});
