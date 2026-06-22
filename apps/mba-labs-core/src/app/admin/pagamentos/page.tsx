import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { DataTable, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { generateAsaasPaymentAction } from "@/lib/actions/billing-actions";
import { getCurrentUserProfile } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPagamentosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await getCurrentUserProfile("/admin/pagamentos");
  if (!current.isAdminMaster) return null;

  const query = await searchParams;
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("core_pagamentos")
    .select("id,empresa_id,assinatura_id,valor,vencimento,pagamento_em,status,metodo,referencia_externa,provider,billing_type,payment_url,invoice_url,asaas_payment_id,asaas_status,created_at,core_empresas(nome,nome_fantasia),core_assinaturas(core_apps(nome),core_planos(nome))")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const assinatura = relationObject(row.core_assinaturas);
    return {
      ...row,
      empresa: relationName(row.core_empresas),
      app: relationName(assinatura.core_apps),
      plano: relationName(assinatura.core_planos),
      valor: formatMoney(row.valor),
      vencimento: formatDate(row.vencimento),
      pagamento_em: formatDate(row.pagamento_em),
      provider: row.provider ?? "manual",
      link_status: row.payment_url || row.invoice_url ? "link gerado" : "sem link",
    };
  });

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="Admin Master"
          title="Pagamentos"
          description="Cobranças centralizadas do MBA Labs. Gere links Asaas e acompanhe baixa automática via webhook."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link className="button-primary" href="/admin/pagamentos?novo=1">Novo pagamento</Link>
              <Link className="button-secondary" href="/admin/configuracoes">Configurações</Link>
            </div>
          }
        />
        <MessageBanner ok={firstParam(query.ok)} error={firstParam(query.error) ?? error?.message} />
        <DataTable
          columns={[
            { key: "empresa", label: "Empresa" },
            { key: "app", label: "App" },
            { key: "plano", label: "Plano" },
            { key: "valor", label: "Valor" },
            { key: "vencimento", label: "Vencimento" },
            { key: "status", label: "Status" },
            { key: "provider", label: "Provider" },
            { key: "link_status", label: "Link" },
          ]}
          rows={rows}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              {row.payment_url || row.invoice_url ? (
                <a className="button-secondary" href={String(row.payment_url ?? row.invoice_url)} rel="noreferrer" target="_blank">Abrir link</a>
              ) : null}
              {String(row.status ?? "") !== "pago" ? (
                <form action={generateAsaasPaymentAction}>
                  <input name="payment_id" type="hidden" value={String(row.id)} />
                  <input name="billing_type" type="hidden" value="UNDEFINED" />
                  <button className="button-primary" type="submit">Gerar Asaas</button>
                </form>
              ) : null}
              <Link className="button-secondary" href={`/admin/pagamentos?edit=${row.id}`}>Editar</Link>
            </div>
          )}
        />
        <div className="panel p-4 text-sm leading-6 text-slate-300">
          <strong className="text-slate-100">Importante:</strong> o link Asaas com forma de pagamento indefinida permite o cliente escolher os meios habilitados na sua conta Asaas, como Pix, cartão de crédito e boleto.
        </div>
      </section>
    </main>
  );
}

function relationObject(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Record<string, unknown>) : {};
}

function relationName(value: unknown) {
  const relation = relationObject(value);
  return String(relation.nome_fantasia ?? relation.nome ?? "");
}
