/**
 * Contrato de armazenamento do AgroDoc. As implementacoes externas
 * precisam validar contexto de empresa/usuario e permissao de OS no servidor.
 * Upload sessionUrl e credencial de capacidade; nunca logar ou compartilhar.
 */
export type AgroCloudProvider = "google_drive" | "dropbox";
export type CloudObject = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  checksum?: string;
};
export type CloudUploadSession = {
  sessionUrl: string;
  fileId: string;
  size: number;
  mimeType: string;
};
export interface AgroDocStorageAdapter {
  readonly provider: AgroCloudProvider;
  readonly available: boolean;
  connect(args: { state: string; returnUrl: string }): Promise<string>;
  testConnection(): Promise<boolean>;
  ensureFolder(args: { parentId?: string; stableId: string; name: string }): Promise<string>;
  startUpload(args: { parentId: string; fileName: string; mimeType: string; size: number }): Promise<CloudUploadSession>;
  resumeUpload(args: { sessionUrl: string; start: number; chunk: Blob; total: number }): Promise<number>;
  confirmFile(args: { fileId: string; expectedSize: number; folderId: string }): Promise<CloudObject>;
  listFiles(args: { folderId: string }): Promise<CloudObject[]>;
  getFileMetadata(args: { fileId: string }): Promise<CloudObject>;
  download(args: { fileId: string }): Promise<ReadableStream<Uint8Array>>;
  revoke(): Promise<void>;
}
export const AGRODOC_STORAGE_CAPABILITIES = {
  google_drive: { available: true, oauth: true, resumable: true, scoped: true },
  dropbox: { available: false, oauth: false, resumable: false, scoped: false }
} as const;
export function requireProviderAvailable(provider: AgroCloudProvider) {
  if (!AGRODOC_STORAGE_CAPABILITIES[provider].available)
    throw new Error("Integração indisponível: " + provider);
}
