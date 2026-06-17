import { aplicarMarcaDagua, type MarcaDaguaEscritorio } from "./watermark";

export async function gerarPdfComMarcaDagua(params: {
  arquivoOriginal: File | Blob | string;
  marcaDagua: MarcaDaguaEscritorio;
}) {
  const resultado = await aplicarMarcaDagua(params);

  return {
    tipo: "pdf_marca_dagua",
    status: "pdf_gerado",
    resultado,
  };
}

export async function gerarPdfRelatoCliente(conteudo: string) {
  return {
    tipo: "pdf_relato_cliente",
    status: "pdf_gerado",
    conteudo,
  };
}

export async function gerarPdfChecklistCaso(checklistId: string) {
  return {
    tipo: "pdf_checklist_caso",
    status: "pdf_gerado",
    checklistId,
  };
}

export async function gerarDossieFinal(casoId: string) {
  return {
    tipo: "dossie_final",
    status: "pdf_gerado",
    casoId,
  };
}
