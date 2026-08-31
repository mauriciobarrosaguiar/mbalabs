import Link from "next/link";
import { ArrowLeft, Ban, CircleAlert, PencilLine, ReceiptText } from "lucide-react";
import {
  dateBR,
  moneyBR,
  requireElshadayContext,
  requireElshadayRole
} from "@/lib/elshaday";
import {
  updateElshadayFinanceEntry,
  voidElshadayFinanceEntry
} from "../../../completion-actions";

export const dynamic = "force-dynamic";

export default async function FinanceEntryPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/financeiro/lancamentos/" + id);
  requireElshadayRole(context, ["admin", "tesouraria"]);

  const [entryResult, membersResult] = await Promise.all([
    context.admin
      .from("igreja_financeiro_entradas")
      .select("*")
      .eq("igreja_id", context.igreja.id)
      .eq("id", id)
      .maybeSingle(),
    context.admin
      .from("igreja_membros")
      .select("id,nome")
      .eq("igreja_id", context.igreja.id)
      .order("nome")
  ]);

  if (entryResult.error || !entryResult.data) throw new Error("Lançamento não localizado.");
  if (membersResult.error) throw new Error(membersResult.error.message);

  const entry = entryResult.data;
  const members = membersResult.data ?? [];
  const memberName = members.find((item: any) => String(item.id) === String(entry.membro_id))?.nome ?? null;
  const competence = String(entry.data_entrada).slice(0, 7);
  const { data: closing } = await context.admin
    .from("igreja_financeiro_fechamentos")
    .select("status")
    .eq("igreja_id", context.igreja.id)
    .eq("competencia", competence)
    .maybeSingle();

  const closed = closing?.status === "fechado";
  const manual = entry.origem === "manual";
  const canChange = manual && !closed && entry.status !== "estornado";
  const ok = read(query.ok);
  const error = read(query.erro);

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <Link
          href="/elshaday/financeiro/relatorios"
          className="inline-flex items-center gap-2 text-sm font-black text-[#176445]"
        >
          <ArrowLeft size={16} /> Voltar aos relatórios
        </Link>
        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">Lançamento financeiro</p>
            <h1 className="mt-1 text-3xl font-black">{moneyBR(entry.valor)}</h1>
            <p className="mt-2 text-slate-600">{dateBR(entry.data_entrada)} · {typeLabel(entry.tipo)}</p>
          </div>
          <span className={"rounded-full px-3 py-1 text-xs font-black " + statusClass(entry.status)}>
            {entry.status}
          </span>
        </div>
      </header>

      {ok ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          Operação concluída.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>
      ) : null}

      {closed ? (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <CircleAlert className="mt-0.5 shrink-0" size={18} />
          <p>Competência {competence} fechada. Reabra o mês em Relatórios antes de alterar este lançamento.</p>
        </div>
      ) : null}

      {!manual ? (
        <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <ReceiptText className="mt-0.5 shrink-0" size={18} />
          <p>Este recebimento é automático e não pode ser corrigido manualmente. A origem precisa controlar eventual estorno.</p>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Data label="Membro" value={entry.anonimo ? "Anônimo" : memberName || "Sem vínculo"} />
        <Data label="Forma" value={paymentLabel(entry.forma_pagamento)} />
        <Data label="Origem" value={entry.origem === "manual" ? "Manual" : "Automático"} />
        <Data label="Descrição" value={entry.descricao || "—"} />
        <Data label="Criado em" value={String(entry.created_at ?? "—")} />
        <Data label="Alterado em" value={String(entry.alterado_em ?? "—")} />
      </section>

      {entry.estorno_motivo ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-5">
          <h2 className="font-black text-red-900">Estorno</h2>
          <p className="mt-2 text-sm text-red-800">{entry.estorno_motivo}</p>
        </section>
      ) : null}

      {canChange ? (
        <details className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
          <summary className="cursor-pointer list-none font-black">
            <span className="inline-flex items-center gap-2"><PencilLine size={18} /> Corrigir lançamento</span>
          </summary>
          <form action={updateElshadayFinanceEntry} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="entrada_id" value={id} />
            <input type="hidden" name="return_to" value={"/elshaday/financeiro/lancamentos/" + id} />
            <label className="grid gap-2 text-sm font-bold">
              Tipo
              <select className="input" name="tipo" defaultValue={entry.tipo}>
                <option value="dizimo">Dízimo</option>
                <option value="oferta">Oferta</option>
                <option value="oferta_especial">Oferta especial</option>
                <option value="campanha">Campanha</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Valor
              <input className="input" name="valor" defaultValue={String(entry.valor).replace(".", ",")} required />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Data
              <input className="input" name="data_entrada" type="date" defaultValue={entry.data_entrada} required />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Membro
              <select className="input" name="membro_id" defaultValue={entry.membro_id ?? ""}>
                <option value="">Sem vínculo</option>
                {members.map((member: any) => <option key={member.id} value={member.id}>{member.nome}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Forma
              <select className="input" name="forma_pagamento" defaultValue={entry.forma_pagamento}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
                <option value="transferencia">Transferência</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Descrição
              <input className="input" name="descricao" defaultValue={entry.descricao ?? ""} />
            </label>
            <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-50 px-4 text-sm font-bold sm:col-span-2 lg:col-span-3">
              <input className="size-5" name="anonimo" type="checkbox" defaultChecked={Boolean(entry.anonimo)} />
              Contribuição anônima
            </label>
            <label className="grid gap-2 text-sm font-bold sm:col-span-2 lg:col-span-3">
              Observações
              <textarea className="min-h-24 rounded-2xl border border-slate-200 p-4" name="observacoes" defaultValue={entry.observacoes ?? ""} />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <button className="min-h-12 rounded-2xl bg-slate-900 px-6 font-black text-white">Salvar correção</button>
            </div>
          </form>
        </details>
      ) : null}

      {canChange ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2 text-red-900">
            <Ban size={19} />
            <h2 className="font-black">Estornar lançamento</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-red-800">
            O registro não será apagado. Ele ficará marcado como estornado com motivo, data e responsável.
          </p>
          <form action={voidElshadayFinanceEntry} className="mt-4 grid gap-3">
            <input type="hidden" name="entrada_id" value={id} />
            <input type="hidden" name="return_to" value={"/elshaday/financeiro/lancamentos/" + id} />
            <input className="input" name="motivo" placeholder="Motivo do estorno" required />
            <button className="min-h-11 w-fit rounded-xl bg-red-700 px-5 font-black text-white">Confirmar estorno</button>
          </form>
        </section>
      ) : null}

      <style>
        {".input{min-height:3rem;border-radius:1rem;border:1px solid rgb(226 232 240);background:white;padding:0 1rem;outline:none}.input:focus{border-color:rgb(5 150 105)}"}
      </style>
    </div>
  );
}

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-slate-800">{value}</p>
    </article>
  );
}

function typeLabel(value: string) {
  const labels: Record<string, string> = {
    dizimo: "Dízimo",
    oferta: "Oferta",
    oferta_especial: "Oferta especial",
    campanha: "Campanha",
    outro: "Outro"
  };
  return labels[value] ?? value;
}

function paymentLabel(value: string) {
  const labels: Record<string, string> = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    cartao: "Cartão",
    transferencia: "Transferência",
    outro: "Outro"
  };
  return labels[value] ?? value;
}

function statusClass(value: string) {
  if (value === "confirmado") return "bg-emerald-100 text-emerald-800";
  if (value === "estornado") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-800";
}
