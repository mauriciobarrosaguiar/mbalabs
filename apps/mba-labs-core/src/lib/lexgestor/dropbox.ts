import { formatarDataIso, slugSeguro } from "./formatters";

export type DropboxStatusLexGestor = {
  conectado: boolean;
  conta?: string;
  pastaRaiz: string;
  mensagem: string;
};

export type PastaCasoDropboxParams = {
  nomeEscritorio: string;
  nomeCliente: string;
  cpfCnpj: string;
  area: string;
  subarea: string;
  pessoaJuridica?: boolean;
  data?: Date;
};

export const pastasPadraoCaso = [
  "01 - Originais",
  "02 - PDF com Marca d'agua",
  "03 - Relatos",
  "04 - Checklist",
  "05 - Processo",
  "06 - Relatorios",
] as const;

export function montarCaminhoCasoDropbox({
  nomeEscritorio,
  nomeCliente,
  cpfCnpj,
  area,
  subarea,
  pessoaJuridica,
  data = new Date(),
}: PastaCasoDropboxParams) {
  const documentoLabel = pessoaJuridica ? "CNPJ" : "CPF";

  return [
    "/LexGestor",
    `Escritorio - ${slugSeguro(nomeEscritorio)}`,
    "Clientes",
    `${slugSeguro(nomeCliente)} - ${documentoLabel} ${slugSeguro(cpfCnpj)}`,
    `${formatarDataIso(data)} - ${slugSeguro(area)} - ${slugSeguro(subarea)}`,
  ].join("/");
}

export async function conectarDropboxAdvogado() {
  return {
    status: "em_preparacao",
    mensagem: "OAuth do Dropbox sera conectado sem token fixo em codigo.",
  };
}

export async function verificarDropboxConectado(): Promise<DropboxStatusLexGestor> {
  return {
    conectado: false,
    pastaRaiz: "/LexGestor",
    mensagem: "Dropbox em preparacao para conexao OAuth.",
  };
}

export async function criarPastaRaizLexGestor() {
  return "/LexGestor";
}

export async function criarPastaEscritorio(nomeEscritorio: string) {
  return `/LexGestor/Escritorio - ${slugSeguro(nomeEscritorio)}`;
}

export async function criarPastaCliente(params: {
  nomeEscritorio: string;
  nomeCliente: string;
  cpfCnpj: string;
  pessoaJuridica?: boolean;
}) {
  const documentoLabel = params.pessoaJuridica ? "CNPJ" : "CPF";

  return [
    await criarPastaEscritorio(params.nomeEscritorio),
    "Clientes",
    `${slugSeguro(params.nomeCliente)} - ${documentoLabel} ${slugSeguro(params.cpfCnpj)}`,
  ].join("/");
}

export async function criarPastaCaso(params: PastaCasoDropboxParams) {
  return montarCaminhoCasoDropbox(params);
}

export async function criarPastasPadraoCaso(params: PastaCasoDropboxParams) {
  const base = montarCaminhoCasoDropbox(params);
  return pastasPadraoCaso.map((pasta) => `${base}/${pasta}`);
}

export async function enviarArquivoOriginalParaDropbox(caminhoCaso: string) {
  return `${caminhoCaso}/01 - Originais`;
}

export async function enviarPdfMarcaDaguaParaDropbox(caminhoCaso: string) {
  return `${caminhoCaso}/02 - PDF com Marca d'agua`;
}

export async function enviarRelatoParaDropbox(caminhoCaso: string) {
  return `${caminhoCaso}/03 - Relatos`;
}

export async function enviarChecklistParaDropbox(caminhoCaso: string) {
  return `${caminhoCaso}/04 - Checklist`;
}

export async function enviarDossieFinalParaDropbox(caminhoCaso: string) {
  return `${caminhoCaso}/06 - Relatorios`;
}

export async function buscarCaminhoDocumento(documentoId: string) {
  return {
    documentoId,
    status: "metadados_apenas",
    mensagem: "O Supabase deve guardar apenas metadados e caminhos do Dropbox.",
  };
}

export async function desconectarDropbox() {
  return {
    status: "em_preparacao",
    mensagem: "Desconexao preparada para revogar tokens criptografados no futuro.",
  };
}
