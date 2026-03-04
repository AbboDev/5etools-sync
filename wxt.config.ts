import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  // publicDir and modulesDir are now relative to rootDir (project root) in v0.20
  publicDir: 'src/public',
  modulesDir: 'src/wxt-modules',

  manifest: {
    name: '5eTools Sync',
    description: 'Import/Export State files to Google Drive and other cloud providers',
    version: '1.0.0',
    permissions: [
      'storage',
      'identity',
      'activeTab',
      'scripting',
      'tabs',
    ],
    host_permissions: [
      'https://2014.5e.tools/*',
      'https://5e.tools/*',
      'https://www.googleapis.com/*',
      'https://accounts.google.com/*',
      '<all_urls>',
    ],
    // oauth2 is Chrome-only — used only when building for Chrome (MV3).
    // For Firefox we use launchWebAuthFlow (see GoogleDriveProvider).
    oauth2: {
      // Replace with your actual Google OAuth2 Client ID
      // Create one at https://console.cloud.google.com/
      // Application type: "Chrome App"
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID_CHROME as string,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    },
  },
});
