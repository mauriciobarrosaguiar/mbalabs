import { NextResponse } from "next/server";
import { registrarAuditoriaLexGestor } from "@/lib/lexgestor/audit";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";
import { slugSeguro } from "@/lib/lexgestor/formatters";
import { createSimplePdf } from "@/lib/lexgestor/simple-pdf";
import { montarPastaRaizEscritorio, uploadToConnectedStorage } from "@/lib/lexgestor/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = await getLexWorkspaceData("/lexgestor/relatorios");
  const tipo = url.searchParams.get("tipo") || "geral";
  const casoId = url.searchParams.get("caso") || "";
  const caso = casoId ? data.casos.find((item) => item.id === casoId) : null;
  const escritorio = data.escritorio;
  const watermark = String(escritorio?.watermark_text ?? escritorio?.nome ?? "LexGestor");

  const lines = caso
    ? montarLinhasDossie(caso, data.documentos.filter((documento) => documento.casoId === caso.id))
    : [
        { text: tipo === "geral" ? "Relatório geral do escritório" : `Relatório ${tipo}`, size: 16 },
        { text: `Clientes cadastrados: ${data.clientes.length}` },
        { text: `Casos ativos: ${data.casos.filter((item) => !["Finalizado", "Arquivado"].includes(item.status)).length}` },
        { text: `Documentos cadastrados: ${data.documentos.length}` },
        { text: `Prazos próximos: ${data.proximosPrazos.length}` },
        { text: "Casos por status:" },
        ...data.casosPorStatus.slice(0, 10).map((row) => ({ text: `- ${row.label}: ${row.value}` })),
        { text: "Produtividade por advogado:" },
        ...data.produtividadePorAdvogado.slice(0, 10).map((row) => ({ text: `- ${row.label}: ${row.value}` })),
      ];

  const pdf = createSimplePdf(lines, watermark);

  if (caso) {
    await salvarDossieNoArmazenamento(data, caso, pdf).catch(() => null);
    await registrarAuditoriaLexGestor({
      current: data.current,
      acao: "dossie.gerado",
      entidade: "lex_casos",
      entidadeId: caso.id,
      detalhes: { documentos: data.documentos.filter((documento) => documento.casoId === caso.id).length },
    });
  } else {
    await registrarAuditoriaLexGestor({
      current: data.current,
      acao: "relatorio.pdf_gerado",
      entidade: "lex_relatorios",
      detalhes: { tipo },
    });
  }

  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${caso ? "lexgestor-dossie.pdf" : "lexgestor-relatorio.pdf"}"`,
    },
  });
}

function montarLinhasDossie(
  caso: Awaited<ReturnType<typeof getLexWorkspaceData>>["casos"][number],
  documentos: Awaited<ReturnType<typeof getLexWorkspaceData>>["documentos"],
) {
  const documentosOrdenados = [...documentos].sort((a, b) => ordemDocumento(a).localeCompare(ordemDocumento(b)));

  return [
    { text: "Dossiê do caso", size: 16 },
    { text: `Cliente: ${caso.cliente}` },
    { text: `Caso: ${caso.titulo}` },
    { text: `Categoria: ${caso.categoria} / ${caso.subcategoria}` },
    { text: `Processo: ${caso.numeroProcesso || "Não informado"}` },
    { text: `Chave/eproc: ${caso.chaveProcesso || "Não informada"}` },
    { text: `Status: ${caso.status}` },
    { text: `Próximo prazo: ${caso.proximoPrazo || "Sem prazo"}` },
    { text: `Advogado responsável: ${caso.advogadoResponsavel || "Sem responsável"}` },
    { text: "Índice:" },
    { text: "1. Dados do cliente e processo" },
    { text: "2. Relato inicial" },
    { text: "3. Checklist e documentos" },
    { text: `Relato: ${caso.relatoInicial || "Não informado"}` },
    { text: `Documentos anexados: ${documentosOrdenados.length}` },
    ...documentosOrdenados.slice(0, 28).flatMap((documento, index) => [
      { text: `${index + 1}. ${documento.tipo}: ${documento.nome}` },
      { text: `   ${documento.categoria} / ${documento.subcategoria} - ${documento.status}` },
    ]),
  ];
}

function ordemDocumento(documento: Awaited<ReturnType<typeof getLexWorkspaceData>>["documentos"][number]) {
  return [grupoDocumento(documento), documento.categoria, documento.subcategoria, documento.tipo, documento.criadoEm, documento.nome]
    .map((item) => item || "")
    .join("|");
}

function grupoDocumento(documento: Awaited<ReturnType<typeof getLexWorkspaceData>>["documentos"][number]) {
  const value = `${documento.categoria} ${documento.subcategoria} ${documento.tipo}`.toLowerCase();
  const groups = [
    ["01", ["rg", "cpf", "cnh", "pessoal", "residência", "residencia", "cnis"]],
    ["02", ["caso", "contrato", "procuração", "procuracao", "declaração", "declaracao"]],
    ["03", ["relato", "atendimento"]],
    ["04", ["print", "whatsapp", "conversa", "foto"]],
    ["05", ["checklist"]],
    ["06", ["processo", "petição", "peticao", "sentença", "sentenca"]],
    ["07", ["relatório", "relatorio", "laudo"]],
  ] as const;

  return groups.find(([, terms]) => terms.some((term) => value.includes(term)))?.[0] ?? "08";
}

async function salvarDossieNoArmazenamento(
  data: Awaited<ReturnType<typeof getLexWorkspaceData>>,
  caso: Awaited<ReturnType<typeof getLexWorkspaceData>>["casos"][number],
  pdf: Buffer,
) {
  const connection = data.storageConnections.find((item) => item.connected);
  if (!connection) return;

  const root = montarPastaRaizEscritorio(String(data.escritorio?.nome ?? "Escritorio"));
  const folderPath = [
    root,
    "Clientes",
    slugSeguro(caso.cliente),
    "Casos",
    slugSeguro(caso.titulo),
    "07 - Dossies e relatorios",
  ].join("/");

  await uploadToConnectedStorage({
    current: data.current,
    provider: connection.provider,
    fileName: `dossie-${slugSeguro(caso.titulo)}.pdf`,
    mimeType: "application/pdf",
    bytes: pdf,
    folderPath,
  });
}
