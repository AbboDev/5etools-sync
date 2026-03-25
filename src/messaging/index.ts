/**
 * Central messaging contract for the extension.
 *
 * @webext-core/messaging replaces all manual chrome.runtime.sendMessage /
 * browser.runtime.sendMessage boilerplate with a fully type-safe, async API.
 *
 * Usage:
 *   background  → onMessage('authLogin', handler)
 *   popup/content → sendMessage('authLogin', payload)
 *
 * Every key in ExtensionProtocolMap is one message type.
 * The function signature is: (data: TData) => TReturn
 */

import { defineExtensionMessaging } from '@webext-core/messaging';
import type { AuthState, CloudFile, CloudProviderType, UploadResult } from '@/types/cloud';

// ─── Protocol map ─────────────────────────────────────────────────────────────
// Each entry: messageName(inputPayload): ReturnType
// Use `void` as input when no payload is needed.

export interface ExtensionProtocolMap {
  // Auth
  authGetState(provider: CloudProviderType): AuthState;
  authLogin(provider: CloudProviderType): AuthState;
  authLogout(provider: CloudProviderType): void;

  // Provider metadata
  getProviders(): ProviderMeta[];

  // Storage actions
  exportJson(payload: ExportPayload): UploadResult;
  importJson(payload: ImportPayload): Record<string, unknown>;
  listFiles(provider: CloudProviderType): CloudFile[];

  // Content-script notification (popup → content)
  importResult(data: Record<string, unknown>): void;

  // Auth state change broadcast (background → content)
  authStateChanged(provider: CloudProviderType): void;
}

// ─── Shared payload types ─────────────────────────────────────────────────────

export interface ProviderMeta {
  type: CloudProviderType;
  displayName: string;
  icon: string;
}

export interface ExportPayload {
  provider: CloudProviderType;
  fileName: string;
  data: Record<string, unknown>;
  existingFileId?: string;
}

export interface ImportPayload {
  provider: CloudProviderType;
  fileId: string;
}

// ─── Singleton messenger ──────────────────────────────────────────────────────
// Import { sendMessage, onMessage } from '@/messaging' in every entrypoint.

const defineExtensionMessagingSingleton = defineExtensionMessaging<ExtensionProtocolMap>();

export const sendMessage = defineExtensionMessagingSingleton.sendMessage.bind(
  defineExtensionMessagingSingleton,
);
export const onMessage = defineExtensionMessagingSingleton.onMessage.bind(
  defineExtensionMessagingSingleton,
);
