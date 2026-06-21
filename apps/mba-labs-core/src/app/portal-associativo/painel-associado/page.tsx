import Link from "next/link";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
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
          description="Veja suas unidades, cobrancas, recibos, documentos liberados, avisos, reunioes e projetos."
        />
        <MessageBanner error={data.error ?? undefined} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Minhas unidades" value={data.unidades.length} />
          <SummaryCard label="Cobrancas abertas" value={data.cobrancasAbertas.length} />
          <SummaryCard label="Cobrancas pagas" value={data.cobrancasPagas.length} />
          <SummaryCard label="Documentos liberados" value={(data.documentos as Array<Record<string, unknown>>).length} />
        </div>

        <Panel title="Minhas unidades">
          <CardGrid rows={data.unidades as Array<Record<string, unknown>>} empty="Nenhuma unidade vinculada ao seu cadastro.">
            {(row) => (
              <article className="rounded-lg border border-border bg-muted/40 p-4">
                <strong className="block text-lg">{[row.codigo_unidade, row.numero_unidade].filter(Boolean).join(" - ") || "Unidade"}</strong>
                <p className="mt-1 text-sm text-muted-foreground">{String(row.tipo_unidade ?? "-")} - {String(row.status_unidade ?? "-")}</p>
                <p className="mt-2 text-sm">{String(row.endereco_localizacao ?? "")}</p>
              </article>
            )}
          </CardGrid>
        </Panel>

        <Panel title="Cobrancas abertas">
          <CardGrid rows={data.cobrancasAbertas as Array<Record<string, unknown>>} empty="Nao ha cobrancas abertas para seu cadastro.">
            {(row) => {
              const overdue = isOverdue(row);
              return (
                <article className={`grid gap-3 rounded-lg border p-4 ${overdue ? "border-red-200 bg-red-50" : "border-border bg-muted/40"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong className="block text-lg">{String(row.descricao ?? "Cobranca")}</strong>
                      <p className="text-sm text-muted-foreground">Unidade {String(row.unidade ?? "-")}</p>
                    </div>
                    <span className={overdue ? "rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700" : "rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700"}>
                      {overdue ? "Vencida" : String(row.status ?? "aberta")}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Info label="Valor" value={formatMoney(row.valor_total)} />
                    <Info label="Vencimento" value={formatDate(row.data_vencimento)} />
                  </div>
                  {row.pix_copia_cola ? (
                    <div className="rounded-lg border border-border bg-white p-3">
                      <span className="block text-xs font-bold uppercase text-muted-foreground">PIX copia e cola</span>
                      <code className="mt-1 block select-all break-words text-xs">{String(row.pix_copia_cola)}</code>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {row.mensagem_whatsapp ? (
                      <Link className="button-primary" href={`https://wa.me/?text=${encodeURIComponent(String(row.mensagem_whatsapp))}`} target="_blank">
                        WhatsApp
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            }}
          </CardGrid>
        </Panel>

        <Panel title="Cobrancas pagas">
          <CardGrid rows={data.cobrancasPagas as Array<Record<string, unknown>>} empty="Nenhuma cobranca paga encontrada.">
            {(row) => (
              <article className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong className="block text-lg">{String(row.descricao ?? "Cobranca")}</strong>
                    <p className="text-sm text-muted-foreground">Unidade {String(row.unidade ?? "-")}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Paga</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Info label="Valor" value={formatMoney(row.valor_pago ?? row.valor_total)} />
                  <Info label="Pagamento" value={formatDate(row.data_pagamento)} />
                  <Info label="Forma" value={String(row.forma_pagamento ?? "-")} />
                </div>
                <Link className="button-secondary w-fit" href={`/api/portal-associativo/recibos/${row.id}`} target="_blank">
                  Recibo PDF
                </Link>
              </article>
            )}
          </CardGrid>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Documentos liberados">
            <CardGrid rows={data.documentos as Array<Record<string, unknown>>} empty="Nenhum documento liberado.">
              {(row) => (
                <article className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4">
                  <strong>{String(row.titulo ?? row.file_name ?? "Documento")}</strong>
                  <p className="text-sm text-muted-foreground">{String(row.categoria ?? "-")} - {formatDate(row.criado_em)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link className="button-secondary" href={`/api/portal-associativo/documentos/${row.id}/open`} target="_blank">Abrir documento</Link>
                    <Link className="button-secondary" href={`/api/portal-associativo/documentos/${row.id}/open?download=1`} target="_blank">Baixar</Link>
                  </div>
                </article>
              )}
            </CardGrid>
          </Panel>

          <Panel title="Avisos">
            <CardGrid rows={data.avisos as Array<Record<string, unknown>>} empty="Nenhum aviso ativo.">
              {(row) => (
                <article className="rounded-lg border border-border bg-muted/40 p-4">
                  <strong>{String(row.titulo ?? "Aviso")}</strong>
                  <p className="mt-2 text-sm leading-6">{String(row.mensagem ?? "")}</p>
                  <p className="mt-2 text-xs font-bold uppercase text-muted-foreground">{String(row.prioridade ?? "media")}</p>
                </article>
              )}
            </CardGrid>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Reunioes e atas">
            <CardGrid rows={data.reunioes as Array<Record<string, unknown>>} empty="Nenhuma reuniao liberada.">
              {(row) => (
                <article className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4">
                  <strong>{String(row.titulo ?? "Reuniao")}</strong>
                  <p className="text-sm text-muted-foreground">{formatDate(row.data_reuniao)} - {String(row.local ?? "")}</p>
                  <Link className="button-secondary w-fit" href={`/api/portal-associativo/reunioes/${row.id}/ata`} target="_blank">Ata PDF</Link>
                </article>
              )}
            </CardGrid>
          </Panel>

          <Panel title="Projetos">
            <CardGrid rows={(data.projetos ?? []) as Array<Record<string, unknown>>} empty="Nenhum projeto liberado.">
              {(row) => {
                const previsto = Number(row.valor_previsto ?? 0);
                const arrecadado = Number(row.valor_arrecadado ?? 0);
                const percent = Math.round((arrecadado / Math.max(previsto, 1)) * 100);
                return (
                  <article className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4">
                    <strong>{String(row.nome ?? "Projeto")}</strong>
                    <p className="text-sm leading-6 text-muted-foreground">{String(row.descricao ?? "")}</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Info label="Status" value={String(row.status ?? "-")} />
                      <Info label="Previsto" value={formatMoney(previsto)} />
                      <Info label="Arrecadado" value={`${formatMoney(arrecadado)} (${percent}%)`} />
                    </div>
                  </article>
                );
              }}
            </CardGrid>
          </Panel>
        </div>
      </section>
    </PortalAssociativoShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-4">
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase text-muted-foreground">{label}</div>
    </div>
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

function CardGrid({
  rows,
  empty,
  children
}: {
  rows: Array<Record<string, unknown>>;
  empty: string;
  children: (row: Record<string, unknown>) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return <div className="grid gap-3">{rows.map((row, index) => <div key={String(row.id ?? index)}>{children(row)}</div>)}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs font-bold uppercase text-muted-foreground">{label}</span>
      <strong className="break-words text-sm">{value}</strong>
    </div>
  );
}

function isOverdue(row: Record<string, unknown>) {
  if (!row.data_vencimento || row.status === "paga" || row.status === "cancelada") return false;
  const due = new Date(String(row.data_vencimento));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Number.isFinite(due.getTime()) && due < today;
}
