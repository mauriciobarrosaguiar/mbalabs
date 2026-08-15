import Link from "next/link";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { canPortalAccess, getPortalAssociadoPanel } from "@/lib/portal-associativo-data";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function PortalAssociadoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await getPortalAssociadoPanel();

  const openRaw = (data.cobrancasAbertas as Array<Record<string, unknown>>).filter((row) => !isPaidLike(row));
  const aguardandoRaw = (data.cobrancasAguardandoAprovacao as Array<Record<string, unknown>>).filter((row) => !isPaidLike(row));
  const recusadasRaw = (data.cobrancasRecusadas as Array<Record<string, unknown>>).filter((row) => !isPaidLike(row));
  const paidRaw = [
    ...(data.cobrancasPagas as Array<Record<string, unknown>>),
    ...(data.cobrancasAbertas as Array<Record<string, unknown>>).filter(isPaidLike),
    ...(data.cobrancasAguardandoAprovacao as Array<Record<string, unknown>>).filter(isPaidLike),
    ...(data.cobrancasRecusadas as Array<Record<string, unknown>>).filter(isPaidLike)
  ];

  const cobrancasAbertas = uniqueRows(openRaw);
  const cobrancasAguardandoAprovacao = uniqueRows(aguardandoRaw);
  const cobrancasRecusadas = uniqueRows(recusadasRaw);
  const cobrancasPagas = uniqueRows(paidRaw);
  const cobrancasVencidas = cobrancasAbertas.filter(isOverdue);

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/painel-associado"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-4 sm:gap-5">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Painel do associado"
          description="Cobranças, recibos, unidades e documentos."
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        {cobrancasVencidas.length ? (
          <a className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950 shadow-sm" href="#minhas-cobrancas">
            <strong className="block text-base">Você tem {cobrancasVencidas.length} cobrança(s) vencida(s)</strong>
            <span className="mt-1 block text-sm">Toque aqui para pagar ou enviar comprovante.</span>
          </a>
        ) : null}

        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Atalhos do painel">
          <Link className="button-primary min-h-10 justify-center px-3 py-2 text-sm" href="#minhas-cobrancas">Cobranças</Link>
          <Link className="button-secondary min-h-10 justify-center px-3 py-2 text-sm" href="#minhas-unidades">Unidades</Link>
          <Link className="button-secondary min-h-10 justify-center px-3 py-2 text-sm" href="#meus-recibos">Recibos</Link>
          <Link className="button-secondary min-h-10 justify-center px-3 py-2 text-sm" href="#documentos">Docs</Link>
          <Link className="button-secondary min-h-10 justify-center px-3 py-2 text-sm" href="#avisos">Avisos</Link>
        </nav>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <SummaryCard label="Unidades" value={data.unidades.length} />
          <SummaryCard label="Abertas" value={cobrancasAbertas.length} />
          <SummaryCard label="Vencidas" value={cobrancasVencidas.length} />
          <SummaryCard label="Em análise" value={cobrancasAguardandoAprovacao.length} />
          <SummaryCard label="Pagas" value={cobrancasPagas.length} />
        </div>

        <div id="minhas-cobrancas">
          <Panel title="Cobranças abertas">
            <CardGrid rows={cobrancasAbertas} empty="Não há cobranças abertas.">
              {(row) => <OpenChargeCard row={row} pixManual={data.pixManual as Record<string, unknown>} companyName={data.companyName} />}
            </CardGrid>
          </Panel>
        </div>

        <Panel title="Comprovantes em análise">
          <CardGrid rows={cobrancasAguardandoAprovacao} empty="Nenhum comprovante aguardando análise.">
            {(row) => (
              <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <strong>{String(row.descricao ?? "Cobrança")}</strong>
                <p className="mt-1 text-sm">{displayUnit(row.unidade)} · {formatMoney(row.valor_total)}</p>
                <p className="mt-2 text-sm font-semibold">Comprovante enviado. A administração irá conferir.</p>
              </article>
            )}
          </CardGrid>
        </Panel>

        <Panel title="Comprovantes recusados">
          <CardGrid rows={cobrancasRecusadas} empty="Nenhum comprovante recusado.">
            {(row) => (
              <article className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <strong>{String(row.descricao ?? "Cobrança")}</strong>
                <p className="mt-2 text-sm"><b>Motivo:</b> {String(row.motivo_recusa ?? "Procure a administração.")}</p>
              </article>
            )}
          </CardGrid>
        </Panel>

        <div id="meus-recibos">
          <Panel title="Pagas e recibos">
            <CardGrid rows={cobrancasPagas} empty="Nenhuma cobrança paga encontrada.">
              {(row) => (
                <article className="grid gap-3 rounded-2xl border border-border bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong className="block text-lg">{String(row.descricao ?? "Cobrança")}</strong>
                      <p className="text-sm text-muted-foreground">{displayUnit(row.unidade)}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Paga</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Info label="Valor" value={formatMoney(row.valor_pago ?? row.valor_total)} />
                    <Info label="Pagamento" value={formatDate(row.data_pagamento)} />
                    <Info label="Forma" value={String(row.forma_pagamento ?? "-")} />
                  </div>
                  <Link className="button-secondary w-fit" href={`/api/portal-associativo/recibos/${row.id}`} target="_blank">Recibo PDF</Link>
                </article>
              )}
            </CardGrid>
          </Panel>
        </div>

        <div id="minhas-unidades">
          <Panel title="Minhas unidades">
            <CardGrid rows={data.unidades as Array<Record<string, unknown>>} empty="Nenhuma unidade vinculada ao seu cadastro.">
              {(row) => (
                <article className="rounded-2xl border border-border bg-white p-4">
                  <strong className="block text-lg">{unitPanelLabel(row)}</strong>
                  <p className="mt-1 text-sm text-muted-foreground">{String(row.tipo_unidade ?? "-")} · {String(row.status_unidade ?? "-")}</p>
                  {Array.isArray(row.papeis) && row.papeis.length ? <p className="mt-2 text-sm"><b>Papéis:</b> {row.papeis.map(String).join(", ")}</p> : null}
                </article>
              )}
            </CardGrid>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div id="documentos">
            <Panel title="Documentos">
              <CardGrid rows={data.documentos as Array<Record<string, unknown>>} empty="Nenhum documento liberado.">
                {(row) => (
                  <article className="grid gap-3 rounded-2xl border border-border bg-white p-4">
                    <strong>{String(row.titulo ?? row.file_name ?? "Documento")}</strong>
                    <p className="text-sm text-muted-foreground">{String(row.categoria ?? "-")} · {formatDate(row.criado_em)}</p>
                    <div className="flex flex-wrap gap-2">
                      <Link className="button-secondary" href={`/api/portal-associativo/documentos/${row.id}/open`} target="_blank">Abrir</Link>
                      <Link className="button-secondary" href={`/api/portal-associativo/documentos/${row.id}/open?download=1`} target="_blank">Baixar</Link>
                    </div>
                  </article>
                )}
              </CardGrid>
            </Panel>
          </div>

          <div id="avisos">
            <Panel title="Avisos">
              <CardGrid rows={data.avisos as Array<Record<string, unknown>>} empty="Nenhum aviso ativo.">
                {(row) => <article className="rounded-2xl border border-border bg-white p-4"><strong>{String(row.titulo ?? "Aviso")}</strong><p className="mt-2 text-sm leading-6">{String(row.mensagem ?? "")}</p></article>}
              </CardGrid>
            </Panel>
          </div>
        </div>

        <details className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-black">Ver reuniões e projetos</summary>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Panel title="Reuniões e atas">
              <CardGrid rows={data.reunioes as Array<Record<string, unknown>>} empty="Nenhuma reunião liberada.">
                {(row) => <article className="rounded-2xl border border-border bg-white p-4"><strong>{String(row.titulo ?? "Reunião")}</strong><p className="text-sm text-muted-foreground">{formatDate(row.data_reuniao)} · {String(row.local ?? "")}</p></article>}
              </CardGrid>
            </Panel>
            <Panel title="Projetos">
              <CardGrid rows={(data.projetos ?? []) as Array<Record<string, unknown>>} empty="Nenhum projeto liberado.">
                {(row) => <article className="rounded-2xl border border-border bg-white p-4"><strong>{String(row.nome ?? "Projeto")}</strong><p className="mt-2 text-sm leading-6 text-muted-foreground">{String(row.descricao ?? "")}</p></article>}
              </CardGrid>
            </Panel>
          </div>
        </details>
        <script dangerouslySetInnerHTML={{ __html: copyPixScript }} />
      </section>
    </PortalAssociativoShell>
  );
}

function OpenChargeCard({ row, pixManual, companyName }: { row: Record<string, unknown>; pixManual: Record<string, unknown>; companyName: string }) {
  const overdue = isOverdue(row);
  const pixManualAtivo = Boolean(pixManual.ativo && pixManual.chave);
  const pixValue = String(row.pix_copia_cola || pixManual.chave || "");
  const mensagemWhatsApp = String(row.mensagem_whatsapp || buildFallbackWhatsappMessage(row, companyName, pixValue));

  return (
    <article className={`grid gap-3 rounded-2xl border p-4 ${overdue ? "border-red-200 bg-red-50" : "border-border bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong className="block text-lg">{String(row.descricao ?? "Cobrança")}</strong>
          <p className="text-sm text-muted-foreground">{displayUnit(row.unidade)}</p>
        </div>
        <span className={overdue ? "rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700" : "rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700"}>
          {overdue ? "Vencida" : "Aberta"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Info label="Valor" value={formatMoney(row.valor_total)} />
        <Info label="Vencimento" value={formatDate(row.data_vencimento)} />
      </div>
      {pixValue ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <strong className="block">PIX</strong>
          {pixManualAtivo ? <p className="mt-1">Recebedor: {String(pixManual.recebedor || "Associação")}</p> : null}
          <p className="mt-1">Chave: <span className="select-all font-mono">{pixValue}</span></p>
          <button className="button-secondary mt-3" data-copy-pix={pixValue} type="button">Copiar PIX</button>
        </div>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Pagamento ainda não configurado.</p>
      )}
      <details className="rounded-xl border border-border bg-white p-3">
        <summary className="cursor-pointer font-bold">Enviar comprovante</summary>
        <form action="/api/portal-associativo/comprovantes/upload" className="mt-3 grid gap-3" method="post" encType="multipart/form-data">
          <input name="cobranca_id" type="hidden" value={String(row.id)} />
          <label className="grid gap-1 text-sm font-semibold">Arquivo<input className="input" name="arquivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required /></label>
          <label className="grid gap-1 text-sm font-semibold">Data do pagamento<input className="input" name="data_pagamento_informada" type="date" /></label>
          <label className="grid gap-1 text-sm font-semibold">Valor informado<input className="input" name="valor_informado" type="number" min="0.01" step="0.01" /></label>
          <label className="grid gap-1 text-sm font-semibold">Observação<textarea className="input min-h-20" name="observacao_associado" /></label>
          <button className="button-primary" type="submit">Enviar comprovante</button>
        </form>
      </details>
      <Link className="button-primary w-fit" href={`https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp)}`} target="_blank">WhatsApp</Link>
    </article>
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
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-[11px] font-bold uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CardGrid({ rows, empty, children }: { rows: Array<Record<string, unknown>>; empty: string; children: (row: Record<string, unknown>) => React.ReactNode }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <div className="grid gap-3">{rows.map((row, index) => <div key={String(row.id ?? index)}>{children(row)}</div>)}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-[11px] font-bold uppercase text-muted-foreground">{label}</span><strong className="break-words text-base">{value}</strong></div>;
}

function isOverdue(row: Record<string, unknown>) {
  if (isPaidLike(row)) return false;
  if (String(row.status) === "cancelada") return false;
  if (!row.data_vencimento) return false;
  const due = new Date(String(row.data_vencimento));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Number.isFinite(due.getTime()) && due < today;
}

function isPaidLike(row: Record<string, unknown>) {
  if (String(row.status) === "paga") return true;
  if (row.data_pagamento) return true;
  const valorPago = Number(row.valor_pago ?? 0);
  return Number.isFinite(valorPago) && valorPago > 0;
}

function uniqueRows(rows: Array<Record<string, unknown>>) {
  const map = new Map<string, Record<string, unknown>>();
  rows.forEach((row, index) => map.set(String(row.id ?? index), row));
  return Array.from(map.values());
}

function unitPanelLabel(row: Record<string, unknown>) {
  const codigo = String(row.codigo_unidade ?? "").trim();
  const numero = String(row.numero_unidade ?? "").trim();
  if (codigo && numero && codigo === numero) return `Unidade ${numero}`;
  return [codigo, numero].filter(Boolean).join(" - ") || "Unidade";
}

function displayUnit(value: unknown) {
  const raw = String(value ?? "-").trim();
  if (!raw || raw === "-") return "Unidade";
  return raw.startsWith("Unidade ") || raw.startsWith("Chácara ") || raw.startsWith("Lote ") ? raw : `Unidade ${raw}`;
}

function buildFallbackWhatsappMessage(row: Record<string, unknown>, companyName: string, pix: string) {
  return [
    `Olá! Aqui é da ${companyName}.`,
    `Identificamos a cobrança ${String(row.descricao ?? "Mensalidade")} no valor de ${formatMoney(row.valor_total)}.`,
    `Vencimento: ${formatDate(row.data_vencimento)}.`,
    pix ? `PIX: ${pix}` : "",
    "Após pagar, envie o comprovante pelo Portal Associativo."
  ].filter(Boolean).join("\n\n");
}
