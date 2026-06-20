import Link from "next/link";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { DataTable, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { canPortalAccess, getPortalAssociadoPanel } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalAssociadoPage() {
  const data = await getPortalAssociadoPanel();

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/painel-associado"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Painel do associado"
          description="Acesse suas unidades, cobrancas, avisos, reunioes e documentos liberados."
        />
        <MessageBanner error={data.error ?? undefined} />

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Suas unidades">
            <DataTable
              columns={[{ key: "codigo_unidade", label: "Codigo" }, { key: "numero_unidade", label: "Numero" }, { key: "tipo_unidade", label: "Tipo" }, { key: "status_unidade", label: "Status" }]}
              rows={data.unidades as Array<Record<string, unknown>>}
            />
          </Panel>
          <Panel title="Avisos ativos">
            <SimpleList rows={data.avisos as Array<Record<string, unknown>>} primary="titulo" secondary="prioridade" />
          </Panel>
          <Panel title="Reunioes">
            <SimpleList rows={(data.reunioes as Array<Record<string, unknown>>).map((row) => ({ ...row, data: formatDate(row.data_reuniao) }))} primary="titulo" secondary="data" />
          </Panel>
        </div>

        <Panel title="Cobrancas abertas">
          <DataTable
            columns={[{ key: "descricao", label: "Descricao" }, { key: "unidade", label: "Unidade" }, { key: "data_vencimento", label: "Vencimento" }, { key: "valor_total", label: "Valor" }, { key: "status", label: "Status" }]}
            rows={data.cobrancasAbertas.map((row) => ({ ...row, data_vencimento: formatDate(row.data_vencimento), valor_total: formatMoney(row.valor_total) }))}
            actions={(row) => (
              <div className="flex flex-wrap justify-end gap-2">
                {row.pix_copia_cola ? <span className="button-secondary select-all">{String(row.pix_copia_cola)}</span> : null}
                {row.mensagem_whatsapp ? (
                  <Link className="button-primary" href={`https://wa.me/?text=${encodeURIComponent(String(row.mensagem_whatsapp))}`} target="_blank">
                    WhatsApp
                  </Link>
                ) : null}
              </div>
            )}
          />
        </Panel>

        <Panel title="Cobrancas pagas">
          <DataTable
            columns={[{ key: "descricao", label: "Descricao" }, { key: "unidade", label: "Unidade" }, { key: "data_pagamento", label: "Pagamento" }, { key: "valor_total", label: "Valor" }]}
            rows={data.cobrancasPagas.map((row) => ({ ...row, data_pagamento: formatDate(row.data_pagamento), valor_total: formatMoney(row.valor_total) }))}
          />
        </Panel>

        <Panel title="Documentos liberados">
          <DataTable
            columns={[{ key: "titulo", label: "Titulo" }, { key: "categoria", label: "Categoria" }, { key: "unidade", label: "Unidade" }, { key: "criado_em", label: "Criado em" }]}
            rows={(data.documentos as Array<Record<string, unknown>>).map((row) => ({ ...row, criado_em: formatDate(row.criado_em) }))}
          />
        </Panel>
      </section>
    </PortalAssociativoShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel min-w-0 p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SimpleList({ rows, primary, secondary }: { rows: Array<Record<string, unknown>>; primary: string; secondary: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum registro liberado.</p>;
  }
  return (
    <div className="grid gap-2">
      {rows.slice(0, 6).map((row, index) => (
        <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm" key={String(row.id ?? index)}>
          <strong className="block">{String(row[primary] ?? "-")}</strong>
          <span className="text-muted-foreground">{String(row[secondary] ?? "")}</span>
        </div>
      ))}
    </div>
  );
}
