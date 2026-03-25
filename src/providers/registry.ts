import type { CloudProvider, CloudProviderType } from '@/types/cloud';
import { GoogleDriveProvider } from './GoogleDriveProvider';
import { DropboxProvider } from './DropboxProvider';
import { OneDriveProvider } from './OneDriveProvider';

const providers = new Map<CloudProviderType, CloudProvider>([
  ['google_drive', new GoogleDriveProvider()],
  ['dropbox', new DropboxProvider()],
  ['onedrive', new OneDriveProvider()],
]);

export function getProvider(type: CloudProviderType): CloudProvider {
  const provider = providers.get(type);
  if (!provider) throw new Error(`Provider "${type}" is not registered.`);
  return provider;
}

export function getAllProviders(): CloudProvider[] {
  return Array.from(providers.values());
}

export function getProviderMeta(): {
  type: CloudProviderType;
  displayName: string;
  icon: string;
}[] {
  return getAllProviders().map((p) => ({
    type: p.type,
    displayName: p.displayName,
    icon: p.icon,
  }));
}
