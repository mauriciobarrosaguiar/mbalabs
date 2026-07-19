import { NextResponse } from "next/server";
import { canPortalAccess, getPortalContext } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

const templates: Record<string, string> = {
  pessoas: "nome_completo;cpf_cnpj;telefone;whatsapp;email;endereco;cidade;uf;perfil;status;observacoes\nMaria Silva;00000000000;16999990000;16999990000;maria@email.com;Rua 1;Ribeirao Preto;SP;associado;ativa;\n",
  unidades: "codigo_unidade;numero_unidade;quadra_setor;tipo;area_m2;localizacao;status;observacoes\nA;001;Setor 1;chacara;1000;Entrada principal;ativa;\n",
  cobrancas: "codigo_unidade;numero_unidade;responsavel;descricao;mes;ano;data_vencimento;valor;status;tipo\nA;001;Maria Silva;Mensalidade;7;2026;2026-07-10;150.00;aberta;mensalidade\n"
};

export async function GET(request: Request) {
  const context = await getPortalContext("/portal-associativo/importacao");
  if (!canPortalAccess(context.perfil, "importacao")) {
    return NextResponse.json({ error: "Seu perfil não permite baixar modelos." }, { status: 403 });
  }
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") ?? "pessoas";
  const csv = templates[tipo] ?? templates.pessoas;

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="modelo-${tipo}.csv"`
    }
  });
}
