import { HandCoins, LockKeyhole } from "lucide-react";
import { createElshadayFinanceEntry } from "../actions";
import {
  dateBR,
  moneyBR,
  requireElshadayContext,
  requireElshadayRole
} from "@/lib/elshaday";

export const dynamic = "force-dynamic";

export default async function ElshadayFinancePage() {
  const context = await requireElshadayContext("/elshaday/financeiro");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);

  const [entriesResult, membersResult] = await Promise.all([
    context.admin
      .from("igreja_financeiro_entradas")
      .select("id,membro_id,tipo,descricao,valor,forma_pagamento,data_entrada,anonimo,observacoes,created_at")
      .eq("igreja_id", context.igreja.id)
      .order("data_entrada", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    context.admin
      .from("igreja_membros")
      .select("id,nome")
      .eq("igreja_id", context.igreja.id)
      .eq("situacao", "ativo")
      .order("nome")
  ]);

  if (entriesResult.error) throw new Error(`Falha ao carregar entradas: ${entriesResult.error.message}`);
  if (membersResult.error) throw new Error(`Falha ao carregar membros: ${membersResult.error.message}`);

  const entries = entriesResult.data ?? [];
  const members = membersResult.data ?? [];
  const memberMap = new Map(members.map((member: any) => [member.id, member.nome]));

  const monthEntries = entries.filter((entry: any) => {
    const date = String(entry.data_entrada);
    return date >= monthStart && date < nextMonthStart;
  });
  const total = sum(monthEntries);
  const dizimos = sum(monthEntries.filter((entry: any) => entry.tipo === "dizimo"));
  const ofertas = total - dizimos;

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Tesouraria</p>
          <h1 className="mt-1 text-3xl font-black">Dízimos e ofertas</h1>
          <p className="mt-2 text-slate-600">Registro de entradas com acesso restrito.</p>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <HandCoins size={25} />
        </div>
      </header>

      <section className="flex gap-3 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <LockKeyhole className="mt-0.5 shrink-0" size={19} />
        <p>
          Os valores individuais ficam disponíveis somente para <strong>Administrador</strong> e <strong>Tesouraria</strong>.
          O restante dos membros não enxerga quem contribuiu nem quanto contribuiu.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Entradas no mês" value={moneyBR(total)} />
        <Kpi label="Dízimos" value={moneyBR(dizimos)} />
        <Kpi label="Ofertas e outros" value={moneyBR(ofertas)} />
      </section>

      <details className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm" open={entries.length === 0}>
        <summary className="cursor-pointer list-none font-black">Registrar nova entrada</summary>
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
            <input className="input" name="data_entrada" type="date" defaultValue={now.toISOString().slice(0, 10)} />
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
            <button className="min-h-12 rounded-2xl bg-[#123d2d] px-6 font-black text-white" type="submit">
              Registrar entrada
            </button>
          </div>
        </form>
      </details>

      <section className="overflow-hidden rounded-[28px] border border-emerald-950/10 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-black">Últimas entradas</h2>
        </div>
        {entries.length === 0 ? (
          <p className="p-8 text-center text-slate-500">Nenhuma entrada registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Data</th>
                  <th className="px-5 py-4">Tipo</th>
                  <th className="px-5 py-4">Membro</th>
                  <th className="px-5 py-4">Forma</th>
                  <th className="px-5 py-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: any) => (
                  <tr className="border-t border-slate-100" key={entry.id}>
                    <td className="px-5 py-4">{dateBR(entry.data_entrada)}</td>
                    <td className="px-5 py-4 font-bold">{labelType(entry.tipo)}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {entry.anonimo ? "Anônimo" : (memberMap.get(entry.membro_id) ?? "Sem vínculo")}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{labelPayment(entry.forma_pagamento)}</td>
                    <td className="px-5 py-4 text-right font-black">{moneyBR(entry.valor)}</td>
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
