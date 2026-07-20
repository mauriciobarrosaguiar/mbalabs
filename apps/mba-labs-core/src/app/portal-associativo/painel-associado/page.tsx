import Link from "next/link";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { canPortalAccess, getPortalAssociadoPanel } from "@/lib/portal-associativo-data";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function PortalAssociadoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await getPortalAssociadoPanel();
  const cobrancasVencidas = (data.cobrancasAbertas as Array<Record<string, unknown>>).filter(isOverdue);

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
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" aria-label="Atalhos do painel">
          <Link className="button-primary min-h-10 justify-center px-3 py-2 text-sm" href="#minhas-cobrancas">Minhas cobranças</Link>
          <Link className="button-secondary min-h-10 justify-center px-3 py-2 text-sm" href="#minhas-unidades">Minhas unidades</Link>
          <Link className="button-secondary min-h-10 justify-center px-3 py-2 text-sm" href="#meus-recibos">Meus recibos</Link>
          <Link className="button-secondary min-h-10 justify-center px-3 py-2 text-sm" href="#documentos">Documentos</Link>
          <Link className="button-secondary min-h-10 justify-center px-3 py-2 text-sm" href="#avisos">Avisos</Link>
        </nav>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Minhas unidades" value={data.unidades.length} />
          <SummaryCard label="Cobrancas abertas" value={data.cobrancasAbertas.length} />
          <SummaryCard label="Cobranças vencidas" value={cobrancasVencidas.length} />
          <SummaryCard label="Aguardando aprovação" value={data.cobrancasAguardandoAprovacao.length} />
          <SummaryCard label="Comprovantes recusados" value={data.cobrancasRecusadas.length} />
          <SummaryCard label="Cobrancas pagas" value={data.cobrancasPagas.length} />
          <SummaryCard label="Documentos liberados" value={(data.documentos as Array<Record<string, unknown>>).length} />
        </div>

        <div id="minhas-unidades"><Panel title="Minhas unidades">
          <CardGrid rows={data.unidades as Array<Record<string, unknown>>} empty="Nenhuma unidade vinculada ao seu cadastro.">
            {(row) => (
              <article className="rounded-lg border border-border bg-muted/40 p-4">
                <strong className="block text-lg">{unitPanelLabel(row)}</strong>
                <p className="mt-1 text-sm text-muted-foreground">{String(row.tipo_unidade ?? "-")} - {String(row.status_unidade ?? "-")}</p>
                <p className="mt-2 text-sm">{String(row.endereco_localizacao ?? "")}</p>
                {Array.isArray(row.papeis) && row.papeis.length ? <p className="mt-2 text-sm"><b>Papéis:</b> {row.papeis.map(String).join(", ")}</p> : null}
              </article>
            )}
          </CardGrid>
        </Panel></div>

        <div id="minhas-cobrancas"><Panel title="Cobranças abertas">
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
                      <button className="button-secondary mt-3" data-copy-pix={String(row.pix_copia_cola)} type="button">Copiar PIX</button>
                    </div>
                  ) : null}
                  {data.pixManual.ativo ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                      <strong className="block">PIX manual da associação</strong>
                      <p className="mt-1">Chave: <span className="select-all font-mono">{String(data.pixManual.chave)}</span> ({String(data.pixManual.tipo || "não informado")})</p>
                      <p>Recebedor: {String(data.pixManual.recebedor || "-")} · {String(data.pixManual.cidade || "-")}</p>
                      {data.pixManual.instrucoes ? <p className="mt-2">{String(data.pixManual.instrucoes)}</p> : null}
                      <button className="button-secondary mt-3" data-copy-pix={String(data.pixManual.chave)} type="button">Copiar chave PIX</button>
                      {data.pixManual.qrCodeUrl ? <Link className="button-secondary ml-2" href={String(data.pixManual.qrCodeUrl)} target="_blank">Ver QR Code</Link> : null}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">A forma de pagamento ainda não foi configurada pela administração.</p>
                  )}
                  <details className="rounded-lg border border-border bg-white p-3">
                    <summary className="cursor-pointer font-bold">Enviar comprovante</summary>
                    <form action="/api/portal-associativo/comprovantes/upload" className="mt-3 grid gap-3" method="post" encType="multipart/form-data">
                      <input name="cobranca_id" type="hidden" value={String(row.id)} />
                      <label className="grid gap-1 text-sm font-semibold">Arquivo (PDF, JPG, PNG ou WEBP; até 10 MB)<input className="input" name="arquivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required /></label>
                      <label className="grid gap-1 text-sm font-semibold">Data do pagamento<input className="input" name="data_pagamento_informada" type="date" /></label>
                      <label className="grid gap-1 text-sm font-semibold">Valor informado<input className="input" name="valor_informado" type="number" min="0.01" step="0.01" /></label>
                      <label className="grid gap-1 text-sm font-semibold">Observação<textarea className="input min-h-20" name="observacao_associado" /></label>
                      <button className="button-primary" type="submit">Enviar comprovante</button>
                    </form>
                  </details>
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
        </Panel></div>

        <Panel title="Comprovantes aguardando aprovação">
          <CardGrid rows={data.cobrancasAguardandoAprovacao as Array<Record<string, unknown>>} empty="Nenhum comprovante aguardando análise.">
            {(row) => <article className="rounded-lg border border-amber-200 bg-amber-50 p-4"><strong>{String(row.descricao ?? "Cobrança")}</strong><p className="mt-1 text-sm">Unidade {String(row.unidade ?? "-")} · {formatMoney(row.valor_total)}</p><p className="mt-2 text-sm font-semibold">Comprovante enviado. A administração irá conferir e aprovar o pagamento.</p></article>}
          </CardGrid>
        </Panel>

        <Panel title="Comprovantes recusados">
          <CardGrid rows={data.cobrancasRecusadas as Array<Record<string, unknown>>} empty="Nenhum comprovante recusado.">
            {(row) => <article className="rounded-lg border border-red-200 bg-red-50 p-4"><strong>{String(row.descricao ?? "Cobrança")}</strong><p className="mt-2 text-sm"><b>Motivo:</b> {String(row.motivo_recusa ?? "Procure a administração.")}</p></article>}
          </CardGrid>
        </Panel>

        <div id="meus-recibos"><Panel title="Cobranças pagas e recibos">
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
        </Panel></div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div id="documentos"><Panel title="Documentos liberados">
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
          </Panel></div>

          <div id="avisos"><Panel title="Avisos">
            <CardGrid rows={data.avisos as Array<Record<string, unknown>>} empty="Nenhum aviso ativo.">
              {(row) => (
                <article className="rounded-lg border border-border bg-muted/40 p-4">
                  <strong>{String(row.titulo ?? "Aviso")}</strong>
                  <p className="mt-2 text-sm leading-6">{String(row.mensagem ?? "")}</p>
                  <p className="mt-2 text-xs font-bold uppercase text-muted-foreground">{String(row.prioridade ?? "media")}</p>
                </article>
              )}
            </CardGrid>
          </Panel></div>
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
        <script dangerouslySetInnerHTML={{ __html: copyPixScript }} />
      </section>
    </PortalAssociativoShell>
  );
}

const copyPixScript = `
document.addEventListener("click", function (event) {
  var target = event.target;
  if (!target || !target.getAttribute) return;
  var pix = target.getAttribute("data-copy-pix");
  if (!pix) return;
  navigator.clipboard && navigator.clipboard.writeText(pix).then(function () {
    target.textContent = "PIX copiado";
  }).catch(function () {
    window.prompt("Copie o PIX:", pix);
  });
});
`;

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

function unitPanelLabel(row: Record<string, unknown>) {
  const codigo = String(row.codigo_unidade ?? "").trim();
  const numero = String(row.numero_unidade ?? "").trim();
  if (codigo && numero && codigo === numero) return `Unidade ${numero}`;
  return [codigo, numero].filter(Boolean).join(" - ") || "Unidade";
}
