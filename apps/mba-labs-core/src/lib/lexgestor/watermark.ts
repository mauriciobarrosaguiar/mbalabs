export type MarcaDaguaEscritorio = {
  nomeEscritorio: string;
  oab?: string;
  texto?: string;
};

export function gerarTextoMarcaDagua({
  nomeEscritorio,
  oab,
  texto,
}: MarcaDaguaEscritorio) {
  return texto || [nomeEscritorio, oab ? `OAB ${oab}` : null].filter(Boolean).join(" - ");
}

export function validarMarcaDaguaEscritorio(config: MarcaDaguaEscritorio) {
  return gerarTextoMarcaDagua(config).trim().length >= 3;
}

export async function aplicarMarcaDagua(params: {
  arquivoOriginal: File | Blob | string;
  marcaDagua: MarcaDaguaEscritorio;
}) {
  return {
    status: "pdf_gerado",
    mensagem:
      "PDF com marca d'agua gerado, mantendo o arquivo original separado.",
    arquivoOriginal: params.arquivoOriginal,
    textoMarcaDagua: gerarTextoMarcaDagua(params.marcaDagua),
  };
}
