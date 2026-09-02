import Link from "next/link";
import type { ReactNode } from "react";
import {
  CheckCircle2,
  CircleAlert,
  FileBarChart,
  HandCoins,
  LockKeyhole,
  QrCode,
  RefreshCw,
  Webhook
} from "lucide-react";
import {
  createElshadayFinanceEntry,
  generateElshadayStaticPix,
  saveElshadayPixSettings,
  syncElshadayPixReceipts
} from "../actions";
import { ElshadaySubmitButton } from "../ElshadaySubmitButton";
import {
  dateBR,
  moneyBR,
  requireElshadayContext,
  requireElshadayRole
} from "@/lib/elshaday";
import { getElshadayPixStatus } from "@/lib/elshaday-payments";

export const dynamic = "force-dynamic";

export default async function ElshadayFinancePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/financeiro");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  const now = new Date();
  const today = palmasDate(now);
  const { monthStart, nextMonthStart } = monthBounds(today);

  const [entriesResult, membersResult, configResult, pixStatus] = await Promise.all([
    context.admin
      .from("igreja_financeiro_entradas")
      .select("id,membro_id,tipo,descricao,valor,forma_pagamento,data_entrada,anonimo,observacoes,created_at,origem,provider,provider_payment_id,pix_cobranca_id,recebido_em,status")
      .eq("igreja_id", context.igreja.id)
      .order("data_entrada", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(150),
    context.admin
      .from("igreja_membros")
      .select("id,nome")
      .eq("igreja_id", context.igreja.id)
      .eq("situacao", "ativo")
      .order("nome"),
    context.admin
      .from("igreja_pix_configuracoes")
      .select("ambiente,ativo,pix_address_key")
      .eq("igreja_id", context.igreja.id)
      .eq("provider", "asaas")
      .maybeSingle(),
    getElshadayPixStatus(context.igreja.id)
  ]);

  if (entriesResult.error) throw new Error(`Falha ao carregar entradas: ${entriesResult.error.message}`);
  if (membersResult.error) throw new Error(`Falha ao carregar membros: ${membersResult.error.message}`);
  if (configResult.error) throw new Error(`Falha ao carregar configuração PIX: ${configResult.error.message}`);

  const entries = entriesResult.data ?? [];
  const members = membersResult.data ?? [];
  const config = configResult.data ?? null;
  const memberMap = new Map<string, string>(
    members.map((member: any) => [String(member.id), String(member.nome)])
  );

  const monthEntries = entries.filter((entry: any) => {
    const date = String(entry.data_entrada);
    return entry.status !== "estornado" && date >= monthStart && date < nextMonthStart;
  });
  const total = sum(monthEntries);
  const dizimos = sum(monthEntries.filter((entry: any) => entry.tipo === "dizimo"));
  const ofertas = total - dizimos;
  const pixAutomatico = sum(
    monthEntries.filter((entry: any) => entry.forma_pagamento === "pix" && entry.origem !== "manual")
  );

  const ok = readParam(query.ok);
  const errorMessage = readParam(query.erro);

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Tesouraria</p>
          <h1 className="mt-1 text-3xl font-black">Dízimos, ofertas e PIX</h1>
          <p className="mt-2 text-slate-600">
            Entradas manuais e recebimentos PIX automáticos no mesmo financeiro.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-950/10 bg-white px-4 text-sm font-black text-[#123d2d] shadow-sm"
            href="/elshaday/financeiro/relatorios"
          >
            <FileBarChart size={17} /> Relatórios e fechamento
          </Link>
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-950/10 bg-white px-4 text-sm font-black text-[#123d2d] shadow-sm"
            href="/elshaday/financeiro/provedores"
          >
            <Webhook size={17} /> Provedores PIX
          </Link>
          <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
            <HandCoins size={25} />
          </div>
        </div>
      </header>

      {ok ? <Message kind="success">{successMessage(ok)}</Message> : null}
      {errorMessage ? <Message kind="error">{errorMessage}</Message> : null}

      <section className="flex gap-3 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <LockKeyhole className="mt-0.5 shrink-0" size={19} />
        <p>
          Os valores individuais ficam disponíveis somente para <strong>Administrador</strong> e <strong>Tesouraria</strong>.
          O restante dos membros não enxerga quem contribuiu nem quanto contribuiu.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Entradas no mês" value={moneyBR(total)} />
        <Kpi label="Dízimos" value={moneyBR(dizimos)} />
        <Kpi label="Ofertas e outros" value={moneyBR(ofertas)} />
        <Kpi label="PIX automático" value={moneyBR(pixAutomatico)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <article className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">Integração</p>
              <h2 className="mt-1 text-xl font-black">PIX automático · Asaas</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                O webhook confirma o pagamento e cria a entrada financeira automaticamente.
              </p>
            </div>
            <IntegrationStatus ready={pixStatus.ready} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Check label="API Key da igreja" ok={pixStatus.apiKeyConfigured} />
            <Check label="Token do webhook" ok={pixStatus.webhookTokenConfigured} />
            <Check label="Chave PIX" ok={pixStatus.addressKeyConfigured} />
            <Check label="QR compartilhável" ok={Boolean(pixStatus.staticQrId)} />
          </div>

          <form action={saveElshadayPixSettings} className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Ambiente
              <select className="input" name="ambiente" defaultValue={config?.ambiente ?? pixStatus.environment}>
                <option value="sandbox">Sandbox / testes</option>
                <option value="production">Produção</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Chave PIX da igreja
              <input
                className="input"
                name="pix_address_key"
                defaultValue={config?.pix_address_key ?? ""}
                placeholder="E-mail, telefone, CPF/CNPJ ou chave aleatória"
              />
            </label>

            <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-50 px-4 text-sm font-bold sm:col-span-2">
              <input
                className="size-5 accent-emerald-700"
                defaultChecked={Boolean(config?.ativo)}
                name="ativo"
                type="checkbox"
              />
              Ativar integração PIX do Elshaday
            </label>

            <div className="sm:col-span-2">
              <ElshadaySubmitButton className="min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-black text-white" pendingLabel="Salvando configuração...">
                Salvar configuração
              </ElshadaySubmitButton>
            </div>
          </form>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-slate-700">
              <Webhook size={17} /> Webhook do Elshaday
            </div>
            <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs text-slate-600">
              {pixStatus.webhookUrl}
            </code>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Eventos principais: PAYMENT_RECEIVED, PAYMENT_CONFIRMED e PAYMENT_REFUNDED.
            </p>
          </div>
        </article>

        <article className="rounded-[28px] border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-sky-900 text-white">
              <QrCode size={22} />
            </div>
            <div>
              <h2 className="font-black text-sky-950">QR Code da igreja</h2>
              <p className="text-sm text-sky-900/70">Um QR reutilizável para receber qualquer valor.</p>
            </div>
          </div>

          {pixStatus.staticQrPayload ? (
            <div className="mt-5">
              {pixStatus.staticQrImage ? (
                <div className="mx-auto max-w-[260px] rounded-3xl bg-white p-4 shadow-sm">
                  <img
                    alt="QR Code PIX da Igreja Elshaday"
                    className="h-auto w-full"
                    src={imageSource(pixStatus.staticQrImage)}
                  />
                </div>
              ) : null}
              <p className="mt-4 text-xs font-black uppercase tracking-wide text-sky-900/60">PIX Copia e Cola</p>
              <textarea
                className="mt-2 min-h-28 w-full rounded-2xl border border-sky-200 bg-white p-3 text-xs"
                readOnly
                value={pixStatus.staticQrPayload}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="rounded-xl bg-sky-900 px-4 py-3 text-sm font-black text-white" href="/elshaday/contribuir">
                  Abrir tela para contribuição
                </Link>
                <form action={syncElshadayPixReceipts}>
                  <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 text-sm font-black text-sky-900" type="submit">
                    <RefreshCw size={16} /> Sincronizar recebidos
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-white p-4">
              <p className="text-sm leading-6 text-slate-600">
                Depois de configurar a conta Asaas da igreja e a chave PIX, gere aqui o QR Code oficial.
              </p>
              <form action={generateElshadayStaticPix} className="mt-4">
                <button className="rounded-xl bg-sky-900 px-4 py-3 text-sm font-black text-white" type="submit">
                  Gerar QR Code PIX
                </button>
              </form>
            </div>
          )}
        </article>
      </section>

      <details className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer list-none font-black">Registrar entrada manual</summary>
        <form action={createElshadayFinanceEntry} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Tipo
            <select className="input" name="tipo" defaultValue="dizimo">
              <option value="dizimo">Dízimo</option>
              <option value="oferta">Oferta</option>
              <option value="oferta_especial">Oferta especial</option>
              <option value="campanha">Campanha</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Valor
            <input className="input" name="valor" inputMode="decimal" placeholder="0,00" required />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Data
            <input className="input" name="data_entrada" type="date" defaultValue={today} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Membro
            <select className="input" name="membro_id" defaultValue="">
              <option value="">Sem vínculo individual</option>
              {members.map((member: any) => (
                <option key={member.id} value={member.id}>{member.nome}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Forma de pagamento
            <select className="input" name="forma_pagamento" defaultValue="pix">
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao">Cartão</option>
              <option value="transferencia">Transferência</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Descrição
            <input className="input" name="descricao" placeholder="Ex.: Culto de domingo" />
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-50 px-4 text-sm font-bold sm:col-span-2 lg:col-span-3">
            <input className="size-5 accent-emerald-700" name="anonimo" type="checkbox" />
            Registrar como contribuição anônima
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2 lg:col-span-3">
            Observações
            <textarea className="min-h-24 rounded-2xl border border-slate-200 p-4 outline-none focus:border-emerald-600" name="observacoes" />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <ElshadaySubmitButton className="min-h-12 rounded-2xl bg-[#123d2d] px-6 font-black text-white" pendingLabel="Registrando entrada...">
              Registrar entrada
            </ElshadaySubmitButton>
          </div>
        </form>
      </details>

      <section className="overflow-hidden rounded-[28px] border border-emerald-950/10 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-black">Últimas entradas</h2>
          <p className="mt-1 text-sm text-slate-500">Manual e automático, com origem identificada.</p>
        </div>
        {entries.length === 0 ? (
          <p className="p-8 text-center text-slate-500">Nenhuma entrada registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Data</th>
                  <th className="px-5 py-4">Tipo</th>
                  <th className="px-5 py-4">Membro</th>
                  <th className="px-5 py-4">Forma</th>
                  <th className="px-5 py-4">Origem</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Valor</th>
                  <th className="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: any) => (
                  <tr className={`border-t border-slate-100 ${entry.status === "estornado" ? "opacity-60" : ""}`} key={entry.id}>
                    <td className="px-5 py-4">{dateBR(entry.data_entrada)}</td>
                    <td className="px-5 py-4 font-bold">{labelType(entry.tipo)}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {entry.anonimo ? "Anônimo" : (memberMap.get(String(entry.membro_id ?? "")) ?? "Sem vínculo")}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{labelPayment(entry.forma_pagamento)}</td>
                    <td className="px-5 py-4"><OriginBadge identified={Boolean(entry.pix_cobranca_id)} origin={entry.origem} /></td>
                    <td className="px-5 py-4"><EntryStatus value={entry.status} /></td>
                    <td className="px-5 py-4 text-right font-black">{moneyBR(entry.valor)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black"
                        href={"/elshaday/financeiro/lancamentos/" + entry.id}
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style>{`
        .input {
          min-height: 3rem;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0 1rem;
          outline: none;
        }
        .input:focus { border-color: rgb(5 150 105); }
      `}</style>
    </div>
  );
}

function palmasDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Araguaina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function monthBounds(today: string) {
  const [yearText, monthText] = today.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    monthStart: `${yearText}-${monthText}-01`,
    nextMonthStart: `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`
  };
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function successMessage(code: string) {
  if (code === "pix_config") return "Configuração PIX salva.";
  if (code === "pix_qr") return "QR Code PIX da igreja gerado com sucesso.";
  if (code.startsWith("pix_sync:")) {
    const [, imported = "0", seen = "0"] = code.split(":");
    return `Sincronização concluída: ${imported} novo(s) recebimento(s) importado(s), ${seen} pagamento(s) consultado(s).`;
  }
  return "Operação concluída.";
}

function imageSource(value: string) {
  if (value.startsWith("data:image/")) return value;
  return `data:image/png;base64,${value}`;
}

function sum(entries: any[]) {
  return entries.reduce((total, entry) => total + Number(entry.valor ?? 0), 0);
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[24px] border border-emerald-950/10 bg-white p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </article>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-2xl p-3 text-sm font-bold ${
      ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
    }`}>
      {ok ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}
      {label}
    </div>
  );
}

function IntegrationStatus({ ready }: { ready: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${
      ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
    }`}>
      {ready ? "Pronto para receber" : "Configuração pendente"}
    </span>
  );
}

function OriginBadge({
  origin,
  identified
}: {
  origin: string;
  identified: boolean;
}) {
  if (identified) {
    return (
      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-black text-violet-800">
        PIX identificado
      </span>
    );
  }

  const automatic = origin !== "manual";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
      automatic ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"
    }`}>
      {automatic ? "PIX automático" : "Manual"}
    </span>
  );
}

function EntryStatus({ value }: { value: string }) {
  const styles: Record<string, string> = {
    confirmado: "bg-emerald-100 text-emerald-800",
    pendente: "bg-amber-100 text-amber-800",
    estornado: "bg-red-100 text-red-700"
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${styles[value] ?? styles.pendente}`}>
      {value}
    </span>
  );
}

function Message({ kind, children }: { kind: "success" | "error"; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 text-sm font-bold ${
      kind === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-red-200 bg-red-50 text-red-800"
    }`}>
      {children}
    </div>
  );
}

function labelType(value: string) {
  const labels: Record<string, string> = {
    dizimo: "Dízimo",
    oferta: "Oferta",
    oferta_especial: "Oferta especial",
    campanha: "Campanha",
    outro: "Outro"
  };
  return labels[value] ?? value;
}

function labelPayment(value: string) {
  const labels: Record<string, string> = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    cartao: "Cartão",
    transferencia: "Transferência",
    outro: "Outro"
  };
  return labels[value] ?? value;
}
