import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: ({ browser }) => ({
    name: '5eTools Sync',
    permissions: ['storage', 'identity'],
    host_permissions: [
      'https://2014.5e.tools/*',
      'https://5e.tools/*',
      'https://www.googleapis.com/*'
    ],
    background: browser === 'firefox'
      ? { scripts: ['background.js'] }
      : { service_worker: 'background.js' },
    action: {
      default_popup: 'popup/index.html'
    }
  })
});
