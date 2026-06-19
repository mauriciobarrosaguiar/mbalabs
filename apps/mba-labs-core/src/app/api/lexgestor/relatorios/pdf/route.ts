import { NextResponse } from "next/server";
import { registrarAuditoriaLexGestor } from "@/lib/lexgestor/audit";
import { obterUsuarioLexGestorAtual } from "@/lib/lexgestor/auth";
import { getLexWorkspaceData, type LexCaso, type LexDocumento, type LexWorkspaceData } from "@/lib/lexgestor/data";
import { createCaseDossiePdf } from "@/lib/lexgestor/dossie-pdf";
import { slugSeguro } from "@/lib/lexgestor/formatters";
import { possuiPermissao } from "@/lib/lexgestor/permissions";
import { resolvePdfBranding } from "@/lib/lexgestor/pdf-branding";
import { createSimplePdf, type SimplePdfLine } from "@/lib/lexgestor/simple-pdf";
import { montarPastaRaizEscritorio, uploadToConnectedStorage } from "@/lib/lexgestor/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = await getLexWorkspaceData("/lexgestor/relatorios");
  const tipo = url.searchParams.get("tipo") || "geral";
  const casoId = url.searchParams.get("caso") || "";
  const usuarioLex = await obterUsuarioLexGestorAtual("/lexgestor/relatorios");
  const canGenerate = casoId || tipo === "dossie"
    ? possuiPermissao(usuarioLex, "lex:dossie:gerar")
    : possuiPermissao(usuarioLex, "lex:relatorios:ler");
  if (!canGenerate) {
    return friendlyPdfError("Seu perfil não permite gerar este arquivo.", 403);
  }
  const caso = casoId ? data.casos.find((item) => item.id === casoId) : null;
  const branding = await resolvePdfBranding(data.escritorio, request.url, data.current);

  if (caso) {
    const selectedDocumentIds = selectedDocumentIdsFromUrl(url);
    const documentos = data.documentos.filter((documento) => documento.casoId === caso.id);
    const pdf = await createCaseDossiePdf({
      current: data.current,
      caso,
      documentos,
      branding,
      selectedDocumentIds,
    });

    await salvarDossieNoArmazenamento(data, caso, pdf).catch(() => null);
    await registrarAuditoriaLexGestor({
      current: data.current,
      acao: "dossie.gerado",
      entidade: "lex_casos",
      entidadeId: caso.id,
      detalhes: { documentos: selectedDocumentIds.length || documentos.length },
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${safeFileName(`dossie-${caso.titulo}.pdf`)}"`,
        ...noStoreHeaders(),
        "x-lexgestor-pdf-version": "dossie-header-logo-only-v2",
      },
    });
  }

  const filtered = filterReportData(data, url);
  const pdf = createSimplePdf(montarLinhasRelatorio(data, filtered, tipo), branding);

  await registrarAuditoriaLexGestor({
    current: data.current,
    acao: "relatorio.pdf_gerado",
    entidade: "lex_relatorios",
    detalhes: { tipo },
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${safeFileName(`lexgestor-relatorio-${tipo}.pdf`)}"`,
      ...noStoreHeaders(),
    },
  });
}

function selectedDocumentIdsFromUrl(url: URL) {
  const ids = [
    ...url.searchParams.getAll("documento"),
    ...(url.searchParams.get("documentos") || "").split(","),
  ];
  return ids.map((id) => id.trim()).filter(Boolean);
}

function filterReportData(data: LexWorkspaceData, url: URL) {
  const clienteId = url.searchParams.get("cliente") || "";
  const casoId = url.searchParams.get("caso") || "";
  const advogadoId = url.searchParams.get("advogado") || "";
  const status = url.searchParams.get("status") || "";
  const inicio = url.searchParams.get("inicio") || "";
  const fim = url.searchParams.get("fim") || "";

  const casos = data.casos.filter((caso) => {
    if (clienteId && caso.clienteId !== clienteId) return false;
    if (casoId && caso.id !== casoId) return false;
    if (advogadoId && caso.advogadoResponsavelId !== advogadoId) return false;
    if (status && caso.status !== status) return false;
    if (!isWithinPeriod(caso.criadoEm, inicio, fim) && !isWithinPeriod(caso.proximoPrazo, inicio, fim)) return false;
    return true;
  });
  const casoIds = new Set(casos.map((caso) => caso.id));
  const clientes = data.clientes.filter((cliente) => !clienteId ? casos.some((caso) => caso.clienteId === cliente.id) : cliente.id === clienteId);
  const documentos = data.documentos.filter((documento) => casoIds.has(documento.casoId));

  return { clientes, casos, documentos };
}

function montarLinhasRelatorio(
  data: LexWorkspaceData,
  filtered: { clientes: LexWorkspaceData["clientes"]; casos: LexCaso[]; documentos: LexDocumento[] },
  tipo: string,
): SimplePdfLine[] {
  const escritorio = data.escritorio ?? {};
  const officeName = text(escritorio.nome) || "LexGestor";
  const ativos = filtered.casos.filter((item) => !["Finalizado", "Arquivado"].includes(item.status)).length;

  return [
    { text: officeName, size: 16 },
    { text: text(escritorio.cnpj) ? `CNPJ: ${text(escritorio.cnpj)}` : "Relatório LexGestor", size: 10 },
    { text: tipo === "geral" ? "Relatório geral do escritório" : `Relatório ${tipo}`, size: 14 },
    { text: `Clientes no filtro: ${filtered.clientes.length}` },
    { text: `Casos ativos no filtro: ${ativos}` },
    { text: `Documentos no filtro: ${filtered.documentos.length}` },
    { text: `Prazos próximos: ${filtered.casos.filter((caso) => caso.proximoPrazo).length}` },
    { text: "Casos:" },
    ...filtered.casos.slice(0, 40).map((caso) => ({
      text: `- ${caso.cliente} | ${caso.titulo} | ${caso.status} | ${caso.advogadoResponsavel || "Sem responsável"}`,
    })),
    { text: "Documentos:" },
    ...filtered.documentos.slice(0, 40).map((documento) => ({
      text: `- ${documento.cliente} | ${documento.tipo} | ${documento.status}`,
    })),
  ];
}

async function salvarDossieNoArmazenamento(data: LexWorkspaceData, caso: LexCaso, pdf: Buffer) {
  const connection = data.storageConnections.find((item) => item.connected);
  if (!connection) return;

  const root = montarPastaRaizEscritorio(String(data.escritorio?.nome ?? "Escritorio"));
  const folderPath = [
    root,
    "Clientes",
    `${slugSeguro(caso.cliente)} - ${slugSeguro(caso.clienteDocumento || "sem-documento")}`,
    "Casos",
    slugSeguro(caso.titulo),
    "03 - Dossies",
  ].join("/");

  await uploadToConnectedStorage({
    current: data.current,
    provider: connection.provider,
    fileName: safeFileName(`Dossie - ${caso.titulo} - ${timestampForFileName()}.pdf`),
    mimeType: "application/pdf",
    bytes: pdf,
    folderPath,
  });
}

function isWithinPeriod(value: string, inicio: string, fim: string) {
  if (!inicio && !fim) return true;
  if (!value) return false;
  const date = value.slice(0, 10);
  if (inicio && date < inicio) return false;
  if (fim && date > fim) return false;
  return true;
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "lexgestor.pdf";
}

function timestampForFileName() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function friendlyPdfError(message: string, status: number) {
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Arquivo indisponível</title><body style="font-family:Arial,sans-serif;margin:32px;color:#172033"><h1 style="font-size:20px">Arquivo indisponível</h1><p>${escapeHtml(message)}</p></body></html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...noStoreHeaders(),
    },
  });
}

function noStoreHeaders() {
  return {
    "cache-control": "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate",
    pragma: "no-cache",
    expires: "0",
  };
}

function escapeHtml(value: string) {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (char) => map[char] ?? char);
}
