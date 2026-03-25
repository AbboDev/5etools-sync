import { defineWindowMessaging } from '@webext-core/messaging/page';

export interface ContentInjectedProtocolMap {
  exportData(payload: { dump: Record<string, unknown>; source: string }): void;
  importData(source: string): Record<string, unknown> | null;
}

export const contentInjectedMessaging = defineWindowMessaging<ContentInjectedProtocolMap>({
  namespace: '5etools-sync',
});
