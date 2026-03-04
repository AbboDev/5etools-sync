// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthState {
  isAuthenticated: boolean;
  provider: CloudProviderType | null;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

// ─── Cloud Provider abstraction ──────────────────────────────────────────────

export type CloudProviderType = 'google_drive' | 'dropbox' | 'onedrive';

export interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedAt: string;
  size?: number;
}

export interface UploadOptions {
  fileName: string;
  content: string;
  mimeType?: string;
  folderId?: string;
  /** If provided, the file with this ID will be updated instead of creating a new one */
  existingFileId?: string;
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  webViewLink?: string;
}

export interface CloudProvider {
  readonly type: CloudProviderType;
  readonly displayName: string;
  readonly icon: string; // SVG string

  /** Trigger the OAuth login flow */
  login(): Promise<AuthState>;

  /** Revoke token and clear local state */
  logout(): Promise<void>;

  /** Check if the current token is still valid */
  isAuthenticated(): Promise<boolean>;

  /** Return current AuthState from local storage */
  getAuthState(): Promise<AuthState>;

  /** Upload (create or update) a JSON file */
  uploadFile(options: UploadOptions): Promise<UploadResult>;

  /** Download a file by ID and return its text content */
  downloadFile(fileId: string): Promise<string>;

  /** List JSON files previously created by this extension */
  listFiles(query?: string): Promise<CloudFile[]>;
}

// ─── Messages (content ↔ background ↔ popup) ─────────────────────────────────

export type MessageType =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_GET_STATE'
  | 'EXPORT_JSON'
  | 'IMPORT_JSON'
  | 'LIST_FILES'
  | 'GET_PROVIDERS'
  | 'IMPORT_RESULT';

export interface BaseMessage {
  type: MessageType;
  provider?: CloudProviderType;
}

export interface ExportMessage extends BaseMessage {
  type: 'EXPORT_JSON';
  payload: {
    fileName: string;
    data: Record<string, unknown>;
    existingFileId?: string;
  };
}

export interface ImportMessage extends BaseMessage {
  type: 'IMPORT_JSON';
  payload: { fileId: string };
}

export interface AuthMessage extends BaseMessage {
  type: 'AUTH_LOGIN' | 'AUTH_LOGOUT' | 'AUTH_GET_STATE';
}

export interface ListFilesMessage extends BaseMessage {
  type: 'LIST_FILES';
}

export type ExtensionMessage =
  | ExportMessage
  | ImportMessage
  | AuthMessage
  | ListFilesMessage
  | { type: 'GET_PROVIDERS' }
  | { type: 'IMPORT_RESULT'; data: Record<string, unknown> };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
