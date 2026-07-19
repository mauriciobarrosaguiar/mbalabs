/**
 * Mantém compatibilidade com os nomes de variáveis usados pelas
 * integrações mais antigas do MBA Labs sem enviar nenhum segredo ao cliente.
 */
export function ensurePortalStorageEnvAliases() {
  process.env.DROPBOX_CLIENT_ID ||= process.env.DROPBOX_APP_KEY;
  process.env.DROPBOX_CLIENT_SECRET ||= process.env.DROPBOX_APP_SECRET;
  process.env.GOOGLE_DRIVE_CLIENT_ID ||= process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_DRIVE_CLIENT_SECRET ||= process.env.GOOGLE_CLIENT_SECRET;
}
