import type { PdfBrandingOptions, PdfBrandImage } from "./simple-pdf";
import type { CurrentUserProfile } from "@/lib/core-data";
import { downloadFromConnectedStorage } from "./storage-read";
import { isStorageProvider, type StorageProvider } from "./storage";

const maxLogoBytes = 4 * 1024 * 1024;
export const logoStorageScheme = "lex-storage";

export async function resolvePdfBranding(
  escritorio: Record<string, unknown> | null | undefined,
  baseUrl?: string,
  current?: CurrentUserProfile,
): Promise<PdfBrandingOptions> {
  const officeName = text(escritorio?.nome) || "LexGestor";
  const logoUrl = text(escritorio?.logo_url) || text(escritorio?.watermark_image_url);
  const logo = await loadBrandImage(logoUrl, baseUrl, current).catch(() => null);

  return {
    headerText: officeName,
    watermarkText: text(escritorio?.watermark_text) || officeName,
    logo,
    watermarkOpacity: 0.09,
  };
}

export function createLogoStorageUrl(provider: StorageProvider, params: { fileId?: string; path?: string }) {
  const value = provider === "google_drive" ? params.fileId : params.path;
  if (!value) return "";
  return `${logoStorageScheme}://${provider}/${encodeURIComponent(value)}`;
}

async function loadBrandImage(rawUrl: string, baseUrl?: string, current?: CurrentUserProfile): Promise<PdfBrandImage | null> {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("data:image/")) return parseDataImage(rawUrl);

  const storageRef = parseLogoStorageUrl(rawUrl);
  if (storageRef && current) {
    const file = await downloadFromConnectedStorage({
      current,
      provider: storageRef.provider,
      fileId: storageRef.provider === "google_drive" ? storageRef.value : undefined,
      path: storageRef.provider === "dropbox" ? storageRef.value : undefined,
    });
    if (!file.mimeType.toLowerCase().startsWith("image/")) return null;
    if (file.bytes.length === 0 || file.bytes.length > maxLogoBytes) return null;
    return {
      bytes: file.bytes,
      mimeType: file.mimeType,
      name: file.fileName,
    };
  }

  const url = toAbsoluteUrl(rawUrl, baseUrl);
  if (!url) return null;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;

  const mimeType = response.headers.get("content-type") || "";
  if (!mimeType.toLowerCase().startsWith("image/")) return null;

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxLogoBytes) return null;

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maxLogoBytes) return null;

  return {
    bytes,
    mimeType,
    name: fileNameFromUrl(url),
  };
}

function parseLogoStorageUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== `${logoStorageScheme}:`) return null;
    const provider = url.hostname;
    if (!isStorageProvider(provider)) return null;
    const value = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (!value) return null;
    return { provider, value };
  } catch {
    return null;
  }
}

function parseDataImage(value: string): PdfBrandImage | null {
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > maxLogoBytes) return null;

  return {
    bytes,
    mimeType: match[1],
    name: `logo.${match[1].split("/")[1] || "png"}`,
  };
}

function toAbsoluteUrl(rawUrl: string, baseUrl?: string) {
  try {
    return new URL(rawUrl).toString();
  } catch {
    if (!baseUrl) return "";
    try {
      return new URL(rawUrl, baseUrl).toString();
    } catch {
      return "";
    }
  }
}

function fileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").filter(Boolean).pop() || "logo";
  } catch {
    return "logo";
  }
}

function text(value: unknown) {
  return String(value ?? "").trim();
}
