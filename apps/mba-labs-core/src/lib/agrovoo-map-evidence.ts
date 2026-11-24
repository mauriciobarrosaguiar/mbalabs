import JSZip from "jszip";

/** Arquivo de evidência recebido: nunca equivale a autorização de voo ou a mapa georreferenciado validado. */
export type MapEvidenceFormat = "kml" | "kmz";

function isKml(xml: string): boolean {
  if (xml.length < 30 || xml.length > 2 * 1024 * 1024) return false;
  if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) return false;
  return /<kml(?:\s|>)/i.test(xml)
    && /<\/kml\s*>/i.test(xml)
    && /<(?:Placemark|Polygon|LineString|Point|coordinates)(?:\s|>)/i.test(xml);
}

/** Valida estrutura básica, tamanho e formato; NÃO certifica geometria, área nem conformidade de voo. */
export async function validateMapEvidenceFile(
  name: string,
  bytes: Uint8Array,
): Promise<{ ext: MapEvidenceFormat; mime: string } | null> {
  const lower = name.toLowerCase().trim();
  if (bytes.byteLength < 30 || bytes.byteLength > 10 * 1024 * 1024) return null;
  if (lower.endsWith(".kml")) {
    try {
      const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
      return isKml(xml) ? { ext: "kml", mime: "application/vnd.google-earth.kml+xml" } : null;
    } catch { return null; }
  }
  if (!lower.endsWith(".kmz")) return null;
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) return null;
  try {
    const zip = await JSZip.loadAsync(bytes);
    const entries = Object.values(zip.files).filter((file) => !file.dir);
    if (entries.length < 1 || entries.length > 100) return null;
    if (entries.some((file) => file.name.includes("..") || file.name.startsWith("/"))) return null;
    const kmlFiles = entries.filter((file) => file.name.toLowerCase().endsWith(".kml"));
    if (!kmlFiles.length) return null;
    const kml = kmlFiles.find((file) => file.name.toLowerCase() === "doc.kml") || kmlFiles[0];
    const uncompressedSize = (kml as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (typeof uncompressedSize !== "number" || uncompressedSize > 2 * 1024 * 1024 || uncompressedSize < 30) return null;
    const text = await kml.async("string");
    return isKml(text) ? { ext: "kmz", mime: "application/vnd.google-earth.kmz" } : null;
  } catch {
    return null;
  }
}
