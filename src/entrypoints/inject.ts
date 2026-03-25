import { contentInjectedMessaging } from '../messaging/contentInjectedMessaging';

declare global {
  interface Window {
    StorageUtil?: {
      syncGetDump: () => Record<string, unknown>;
      pGetDump: () => Promise<Record<string, unknown>>;
      syncSetFromDump: (dump: unknown) => void;
      pSetFromDump: (dump: unknown) => Promise<void>;
    };
    NavBar?: {
      InteractionManager: unknown;
      _CAT_SETTINGS: string;
      _addElement_button: (args: {
        keyPath?: string[];
        html: string;
        click: (evt: MouseEvent) => void | Promise<void>;
        context?: unknown;
        title?: string;
        className?: string;
      }) => void;
      _addElement_divider: (args: { keyPath?: string[] }) => void;
    };
  }

  var NavBar: Window['NavBar'];

  var styleSwitcher: {
    constructor: {
      syncGetStorageDump: () => Record<string, unknown>;
      syncSetFromStorageDump: (dump: unknown) => void;
    };
  };
}

export default defineUnlistedScript(() => {
  if (!window.StorageUtil) {
    console.warn('StorageUtil not found');
    return;
  }

  if (!NavBar) {
    console.warn('NavBar not found');
    return;
  }

  if (!NavBar.InteractionManager) {
    console.warn('InteractionManager not found');
    return;
  }

  const saveState = async function (evt: MouseEvent): Promise<void> {
    evt.preventDefault();

    const sync = window.StorageUtil!.syncGetDump();
    const async = await window.StorageUtil!.pGetDump();
    const syncStyle = globalThis.styleSwitcher.constructor.syncGetStorageDump();
    const dump = { sync, async, syncStyle };

    await contentInjectedMessaging.sendMessage('exportData', { dump, source: 'drive' });
  };

  const loadState = async function (evt: MouseEvent): Promise<void> {
    evt.preventDefault();

    const dump = (await contentInjectedMessaging.sendMessage('importData', 'drive')) as {
      sync?: unknown;
      async?: unknown;
      syncStyle?: unknown;
    } | null;
    if (!dump) return;

    try {
      if (dump.sync) window.StorageUtil!.syncSetFromDump(dump.sync);
      if (dump.async) await window.StorageUtil!.pSetFromDump(dump.async);
      if (dump.syncStyle) {
        globalThis.styleSwitcher.constructor.syncSetFromStorageDump(dump.syncStyle);
      }
      location.reload();
    } catch (e) {
      console.error('Failed to load state', e);
      // Depending on UI libs we could show a toast, but index.ts will already handle basic UI.
      throw e;
    }
  };

  NavBar._addElement_divider({ keyPath: [NavBar._CAT_SETTINGS] });
  NavBar._addElement_button({
    keyPath: [NavBar._CAT_SETTINGS],
    html: 'Save State to Google Drive',
    click: saveState,
    title:
      'Save any locally-stored data (loaded homebrew, active blocklists, DM Screen configuration,...) to Google Drive.',
  });
  NavBar._addElement_button({
    keyPath: [NavBar._CAT_SETTINGS],
    html: 'Load State from Google Drive',
    // click: async (evt) => NavBar.InteractionManager._pOnClick_button_loadStateFile(evt),
    click: loadState,
    title:
      'Load previously-saved data (loaded homebrew, active blocklists, DM Screen configuration,...) from Google Drive.',
  });

  // eslint-disable-next-line no-console
  console.debug('5eTools sync hooks installed');
});
