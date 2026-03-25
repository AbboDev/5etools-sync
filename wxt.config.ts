import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  publicDir: 'src/public',
  modulesDir: 'src/wxt-modules',

  // @webext-core/messaging uses webextension-polyfill internally.
  // vite-node (the default entrypoint loader in WXT v0.20) needs it marked
  // as noExternal so it gets bundled correctly.
  vite: () => ({
    ssr: {
      noExternal: ['@webext-core/messaging'],
    },
  }),

  manifest: () => ({
    name: '5eTools Sync',
    description: 'Import/Export State files to Google Drive and other cloud providers',
    version: '1.0.0',
    permissions: ['storage', 'identity', 'activeTab', 'scripting', 'tabs'],
    host_permissions: [
      'https://2014.5e.tools/*',
      'https://5e.tools/*',
      'https://www.googleapis.com/*',
      'https://accounts.google.com/*',
      '<all_urls>',
    ],
    oauth2: {
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID_CHROME as string,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    },
    web_accessible_resources: [
      {
        resources: ['inject.js'],
        matches: ['*://*.5e.tools/*'],
      },
    ],
  }),
});
