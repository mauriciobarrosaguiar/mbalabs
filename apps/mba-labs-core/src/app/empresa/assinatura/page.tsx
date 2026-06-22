import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { DataTable, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { getEmpresaDashboardData } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function EmpresaAssinaturaPage() {
  const data = await getEmpresaDashboardData("/empresa/assinatura");
  const supabase = await getSupabaseServer();
  const paymentsResult = data.current.empresaId
    ? await (supabase as any)
        .from("core_pagamentos")
        .select("id,assinatura_id,valor,vencimento,pagamento_em,status,metodo,payment_url,invoice_url,provider,core_assinaturas(core_apps(nome),core_planos(nome))")
        .eq("empresa_id", data.current.empresaId)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [], error: null };

  const rows = (data.apps as Array<Record<string, unknown>>).map((app) => ({
    ...app,
    data_inicio: formatDate(app.data_inicio),
    data_vencimento: formatDate(app.data_vencimento)
  }));
  const paymentRows = ((paymentsResult.data ?? []) as Array<Record<string, unknown>>).map((payment) => {
    const assinatura = relationObject(payment.core_assinaturas);
    return {
      ...payment,
      app: relationName(assinatura.core_apps),
      plano: relationName(assinatura.core_planos),
      valor: formatMoney(payment.valor),
      vencimento: formatDate(payment.vencimento),
      pagamento_em: formatDate(payment.pagamento_em),
      link: payment.payment_url || payment.invoice_url ? "Disponível" : "Aguardando"
    };
  });

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="Painel da empresa"
          title="Assinatura"
          description="Resumo dos contratos, vencimentos e pagamentos da empresa."
          actions={
            <Link className="button-secondary" href="/empresa/dashboard">
              Voltar
            </Link>
          }
        />
        <MessageBanner error={data.error ?? paymentsResult.error?.message ?? undefined} />
        <DataTable
          columns={[
            { key: "app", label: "App" },
            { key: "plano", label: "Plano" },
            { key: "status", label: "Status" },
            { key: "data_inicio", label: "Início" },
            { key: "data_vencimento", label: "Vencimento" }
          ]}
          rows={rows}
        />
        <div className="grid gap-3">
          <h2 className="text-xl font-black">Pagamentos</h2>
          <DataTable
            columns={[
              { key: "app", label: "App" },
              { key: "plano", label: "Plano" },
              { key: "valor", label: "Valor" },
              { key: "vencimento", label: "Vencimento" },
              { key: "pagamento_em", label: "Pago em" },
              { key: "status", label: "Status" },
              { key: "link", label: "Link" }
            ]}
            rows={paymentRows}
            actions={(row) => (
              row.payment_url || row.invoice_url ? (
                <a className="button-primary" href={String(row.payment_url ?? row.invoice_url)} rel="noreferrer" target="_blank">
                  Pagar
                </a>
              ) : null
            )}
          />
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
