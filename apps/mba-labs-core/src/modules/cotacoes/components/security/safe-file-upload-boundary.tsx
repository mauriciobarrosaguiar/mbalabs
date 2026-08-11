"use client";

import { useRef, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_XLSX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_XLSX_ENTRIES = 2_000;
const MAX_XLSX_COMPRESSION_RATIO = 150;
const CSV_INSPECTION_BYTES = 64 * 1024;

const DANGEROUS_EXTENSIONS = new Set([
  "apk",
  "bat",
  "cmd",
  "com",
  "dll",
  "exe",
  "html",
  "htm",
  "jar",
  "js",
  "msi",
  "ps1",
  "scr",
  "sh",
  "svg",
  "vbs",
]);

const XLSX_MIME_TYPES = new Set([
  "application/octet-stream",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
]);

const CSV_MIME_TYPES = new Set([
  "application/csv",
  "application/octet-stream",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
]);

type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function SafeFileUploadBoundary({ children }: { children: ReactNode }) {
  const validatingInputs = useRef(new WeakSet<HTMLInputElement>());

  async function handleFileChangeCapture(event: FormEvent<HTMLDivElement>) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file") return;

    if (input.dataset.mbaSafeFileValidated === "true") {
      delete input.dataset.mbaSafeFileValidated;
      return;
    }

    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;

    // Interrompe o onChange original até a validação terminar.
    event.preventDefault();
    event.stopPropagation();

    if (validatingInputs.current.has(input)) return;
    validatingInputs.current.add(input);

    try {
      for (const file of files) {
        const result = await validateQuotationFile(file);
        if (!result.ok) {
          input.value = "";
          toast.error(result.message);
          return;
        }
      }

      // Reenvia o evento somente depois que todos os arquivos forem aprovados.
      input.dataset.mbaSafeFileValidated = "true";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch {
      input.value = "";
      toast.error("Não foi possível validar o arquivo. Envie uma planilha .xlsx ou .csv válida.");
    } finally {
      validatingInputs.current.delete(input);
    }
  }

  return (
    <div onChangeCapture={(event) => void handleFileChangeCapture(event)}>
      {children}
    </div>
  );
}

async function validateQuotationFile(file: File): Promise<ValidationResult> {
  if (!file.name || file.name.length > 180) {
    return block("Nome de arquivo inválido ou muito longo.");
  }

  if (file.size <= 0) {
    return block("O arquivo está vazio.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return block("Arquivo muito grande. O limite para cotação é 10 MB.");
  }

  const fileNameParts = file.name.toLowerCase().split(".").filter(Boolean);
  const extension = fileNameParts.at(-1) ?? "";

  if (fileNameParts.slice(0, -1).some((part) => DANGEROUS_EXTENSIONS.has(part))) {
    return block("Arquivo bloqueado por segurança: nome com extensão executável ou conteúdo disfarçado.");
  }

  if (extension !== "xlsx" && extension !== "csv") {
    return block("Por segurança, envie somente .xlsx ou .csv. Arquivos .xls antigos devem ser convertidos para .xlsx.");
  }

  if (extension === "xlsx") {
    if (file.type && !XLSX_MIME_TYPES.has(file.type.toLowerCase())) {
      return block("O tipo real do arquivo não corresponde a uma planilha .xlsx.");
    }
    return validateXlsx(file);
  }

  if (file.type && !CSV_MIME_TYPES.has(file.type.toLowerCase())) {
    return block("O tipo real do arquivo não corresponde a um arquivo .csv.");
  }
  return validateCsv(file);
}

async function validateXlsx(file: File): Promise<ValidationResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (!isZipSignature(bytes)) {
    return block("Arquivo .xlsx inválido ou disfarçado. Use o modelo exportado pelo MBA Cotações.");
  }

  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) {
    return block("Planilha .xlsx corrompida ou inválida.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  if (entries === 0 || entries > MAX_XLSX_ENTRIES) {
    return block("Planilha bloqueada por segurança: quantidade incomum de arquivos internos.");
  }

  if (
    centralDirectoryOffset + centralDirectorySize > bytes.length ||
    centralDirectoryOffset < 0
  ) {
    return block("Estrutura interna da planilha é inválida.");
  }

  let cursor = centralDirectoryOffset;
  let totalCompressed = 0;
  let totalUncompressed = 0;
  let hasWorkbook = false;
  let hasContentTypes = false;

  const decoder = new TextDecoder("utf-8");

  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
      return block("Estrutura interna da planilha é inválida.");
    }

    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;

    if (nameEnd > bytes.length) {
      return block("Estrutura interna da planilha é inválida.");
    }

    const entryName = decoder.decode(bytes.subarray(nameStart, nameEnd)).replaceAll("\\", "/").toLowerCase();

    if (entryName.includes("../") || entryName.startsWith("/")) {
      return block("Planilha bloqueada por segurança: caminho interno inválido.");
    }

    if (isDangerousSpreadsheetEntry(entryName)) {
      return block("Planilha bloqueada por segurança: contém macro, executável ou objeto incorporado.");
    }

    if (entryName === "xl/workbook.xml") hasWorkbook = true;
    if (entryName === "[content_types].xml") hasContentTypes = true;

    totalCompressed += compressedSize;
    totalUncompressed += uncompressedSize;

    if (totalUncompressed > MAX_XLSX_UNCOMPRESSED_BYTES) {
      return block("Planilha bloqueada por segurança: conteúdo interno excessivamente grande.");
    }

    cursor = nameEnd + extraLength + commentLength;
  }

  if (!hasWorkbook || !hasContentTypes) {
    return block("O arquivo não possui a estrutura esperada de uma planilha Excel .xlsx.");
  }

  if (
    totalCompressed > 0 &&
    totalUncompressed / totalCompressed > MAX_XLSX_COMPRESSION_RATIO
  ) {
    return block("Planilha bloqueada por segurança: compactação interna suspeita.");
  }

  return { ok: true };
}

async function validateCsv(file: File): Promise<ValidationResult> {
  const bytes = new Uint8Array(await file.slice(0, CSV_INSPECTION_BYTES).arrayBuffer());

  if (bytes.length === 0) {
    return block("O arquivo CSV está vazio.");
  }

  if (hasKnownBinarySignature(bytes)) {
    return block("Arquivo .csv inválido ou disfarçado. Envie um CSV de texto válido.");
  }

  let suspiciousControls = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      return block("Arquivo .csv bloqueado por segurança: conteúdo binário detectado.");
    }
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      suspiciousControls += 1;
    }
  }

  if (suspiciousControls / bytes.length > 0.01) {
    return block("Arquivo .csv bloqueado por segurança: conteúdo não textual detectado.");
  }

  return { ok: true };
}

function isZipSignature(bytes: Uint8Array) {
  if (bytes.length < 4) return false;
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const minimumEocdSize = 22;
  const maximumCommentSize = 65_535;
  const start = Math.max(0, bytes.length - minimumEocdSize - maximumCommentSize);

  for (let index = bytes.length - minimumEocdSize; index >= start; index -= 1) {
    if (
      bytes[index] === 0x50 &&
      bytes[index + 1] === 0x4b &&
      bytes[index + 2] === 0x05 &&
      bytes[index + 3] === 0x06
    ) {
      return index;
    }
  }

  return -1;
}

function isDangerousSpreadsheetEntry(entryName: string) {
  if (entryName.includes("vbaproject.bin")) return true;
  if (entryName.startsWith("xl/embeddings/")) return true;

  const extension = entryName.split(".").at(-1) ?? "";
  return DANGEROUS_EXTENSIONS.has(extension);
}

function hasKnownBinarySignature(bytes: Uint8Array) {
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) return true; // MZ/PE
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return true; // ELF
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return true; // PDF
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) return true; // ZIP/XLSX
  if (bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return true; // OLE/XLS
  return false;
}

function block(message: string): ValidationResult {
  return { ok: false, message };
}
