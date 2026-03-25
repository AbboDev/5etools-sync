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

// ─── Cloud provider contract ──────────────────────────────────────────────────

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
  /** If set, the existing file is updated instead of creating a new one */
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
  readonly icon: string;

  login(): Promise<AuthState>;
  logout(): Promise<void>;
  isAuthenticated(): Promise<boolean>;
  getAuthState(): Promise<AuthState>;
  uploadFile(options: UploadOptions): Promise<UploadResult>;
  downloadFile(fileId: string): Promise<string>;
  listFiles(query?: string): Promise<CloudFile[]>;
}
