import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { MessageActions } from "@/components/lavagestor/MessageActions";
import { BackButton, MessageBanner, PageHeader, formatDateTime, formatMoney } from "@/components/ui-kit";
import { registrarIAmobLog } from "@/lib/actions/lavagestor-iamob-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaAiMode } from "@/lib/lavagestor-ai";
import { getLavaIAmobData } from "@/lib/lavagestor-iamob-data";

export const dynamic = "force-dynamic";

export default async function IAmobPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await getLavaIAmobData();
  const aiMode = await getLavaAiMode(data.current);

  return (
    <LavaGestorShell activePath="/lavagestor/iamob" companyName={data.config.nome_exibicao}>
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="IAMob"
          description={aiMode.active ? "Inteligencia operacional com Gemini ativo e fallback por regras." : "Inteligencia operacional em modo regras, sem depender de API externa."}
          actions={<><BackButton href="/lavagestor" /><Link className="button-secondary" href="/lavagestor/automacoes">Automacoes</Link></>}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        {!aiMode.active ? (
          <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">IA real</p>
              <h2 className="text-xl font-black">Ative a IA real em poucos passos</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-emerald-950">Configure Gemini no modo guiado e teste a resposta do IAMob.</p>
            </div>
            <Link className="button-primary justify-center" href="/lavagestor/setup-facil?step=ia">Configurar agora</Link>
          </div>
        ) : null}

        <div className={`rounded-xl border p-4 text-sm font-bold leading-6 ${aiMode.active ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          {aiMode.active
            ? "IAMob usando Gemini. Se a IA falhar, o LavaGestor usa regras internas e registra o erro."
            : "IAMob em modo regras: cruza fila, pagamentos, agenda, estoque e historico para sugerir proximas acoes."}
          {aiMode.connection.ultimoErro ? <span className="mt-2 block break-words">Ultimo erro Gemini: {aiMode.connection.ultimoErro}</span> : null}
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric label="Lavagens hoje" value={data.summary.lavagensHoje} />
          <Metric label="Recebido hoje" value={formatMoney(data.summary.faturamentoRecebido)} green />
          <Metric label="Pendencias" value={data.summary.pendencias} warning />
          <Metric label="Clientes no mes" value={data.summary.clientesAtendidos} />
          <Metric label="Agendamentos hoje" value={data.summary.agendamentosHoje} />
          <Metric label="Estoque baixo" value={data.summary.estoqueBaixo} warning />
          <Metric label="Cobrancas pendentes" value={data.summary.cobrancasPendentes} warning />
          <Metric label="Automacao pendente" value={data.summary.automacoesPendentes} warning />
        </div>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">IAMob recomenda</h2>
          {data.recomendacoes.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Sem recomendacoes criticas agora.</p> : null}
          <div className="grid gap-2 md:grid-cols-2">
            {data.recomendacoes.map((item) => (
              <Link className="rounded-lg border border-border bg-muted/30 p-3 shadow-sm transition hover:border-emerald-300" href={item.href} key={`${item.href}-${item.title}`}>
                <strong className="block text-sm font-black">{item.title}</strong>
                <span className="mt-1 block text-xs font-semibold leading-5 text-muted-foreground">{item.detail}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Gerador de mensagem</h2>
          <div className="grid gap-2 lg:grid-cols-3">
            {data.mensagens.map((item) => (
              <article className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3" key={item.tipo}>
                <strong>{item.label}</strong>
                <p className="text-sm font-semibold leading-6 text-muted-foreground">{item.message}</p>
                <MessageActions message={item.message} />
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Assistente de atendimento</h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {data.atendimento.map((row) => (
              <article className="rounded-lg border border-border p-3" key={row.cliente_id}>
                <strong className="block truncate">{row.cliente}</strong>
                <span className="mt-1 block truncate text-xs font-semibold text-muted-foreground">{row.veiculo}</span>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Info label="Lavagens" value={String(row.count)} />
                  <Info label="Ticket medio" value={formatMoney(row.ticket_medio)} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <form action={registrarIAmobLog} className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Analise manual de foto</h2>
          <p className="text-sm font-semibold leading-6 text-muted-foreground">Possivel avaria observada. Confirme manualmente.</p>
          <input name="tipo" type="hidden" value="analise_foto_manual" />
          <label className="grid gap-2">
            <span className="text-sm font-black">Observacao do operador</span>
            <textarea className="input min-h-24" name="entrada" placeholder="Ex.: pequeno risco no para-choque dianteiro" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-black">Texto profissional para checklist/ticket</span>
            <textarea className="input min-h-24" name="saida" defaultValue="Possivel avaria observada. Confirme manualmente." />
          </label>
          <button className="button-primary w-fit" type="submit">Registrar analise</button>
        </form>

        {data.logs.length ? (
          <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black">Historico IAMob</h2>
            <div className="grid gap-2 md:grid-cols-2">
              {data.logs.map((row) => (
                <article className="rounded-lg border border-border p-3 text-sm" key={String(row.id)}>
                  <strong>{String(row.tipo)}</strong>
                  <p className="mt-1 font-semibold text-muted-foreground">{String(row.saida ?? row.erro ?? "Sem saida")}</p>
                  <span className="mt-2 block text-xs font-bold text-muted-foreground">{formatDateTime(row.created_at)}</span>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </LavaGestorShell>
  );
}

function Metric({ label, value, green = false, warning = false }: { label: string; value: string | number; green?: boolean; warning?: boolean }) {
  const tone = green ? "border-emerald-200 bg-emerald-50" : warning ? "border-amber-200 bg-amber-50" : "border-border bg-white";
  return <div className={`rounded-xl border p-3 shadow-sm ${tone}`}><p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><strong className="mt-2 block break-words text-xl font-black">{value}</strong></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <span className="rounded-lg bg-muted px-2 py-2"><span className="block text-[10px] font-black uppercase text-muted-foreground">{label}</span><strong className="block truncate text-sm">{value}</strong></span>;
}
