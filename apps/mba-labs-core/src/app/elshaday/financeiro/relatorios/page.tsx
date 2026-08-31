import Link from "next/link";
import {
  ArrowLeft,
  FileDown,
  Filter,
  LockKeyhole,
  RotateCcw,
  Sheet,
  WalletCards
} from "lucide-react";
import {
  dateBR,
  moneyBR,
  requireElshadayContext,
  requireElshadayRole
} from "@/lib/elshaday";
import {
  closeElshadayFinanceMonth,
  reopenElshadayFinanceMonth
} from "../../completion-actions";

export const dynamic = "force-dynamic";

export default async function FinanceReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/financeiro/relatorios");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  const today = localDate(new Date());
  const defaultStart = today.slice(0, 8) + "01";
  const start = read(query.inicio) || defaultStart;
  const end = read(query.fim) || today;
  const type = read(query.tipo);
  const payment = read(query.forma);
  const status = read(query.status);
  const memberId = read(query.membro_id);
  const competence = read(query.competencia) || today.slice(0, 7);

  const membersResult = await context.admin
    .from("igreja_membros")
    .select("id,nome")
    .eq("igreja_id", context.igreja.id)
    .order("nome");

  if (membersResult.error) throw new Error("Falha ao carregar membros: " + membersResult.error.message);
  const members = membersResult.data ?? [];

  let request = context.admin
    .from("igreja_financeiro_entradas")
    .select("id,membro_id,tipo,descricao,valor,forma_pagamento,data_entrada,anonimo,origem,status,created_at")
    .eq("igreja_id", context.igreja.id)
    .gte("data_entrada", start)
    .lte("data_entrada", end)
    .order("data_entrada", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);

  if (type) request = request.eq("tipo", type);
  if (payment) request = request.eq("forma_pagamento", payment);
  if (status) request = request.eq("status", status);
  if (memberId) request = request.eq("membro_id", memberId);

  const [{ data: entries, error: entriesError }, closingResult] = await Promise.all([
    request,
    context.admin
      .from("igreja_financeiro_fechamentos")
      .select("id,competencia,total_calculado,resumo,observacoes,fechado_em,reaberto_em,reabertura_motivo,status")
      .eq("igreja_id", context.igreja.id)
      .eq("competencia", competence)
      .maybeSingle()
  ]);

  if (entriesError) throw new Error("Falha ao carregar relatório: " + entriesError.message);
  if (closingResult.error) throw new Error("Falha ao carregar fechamento: " + closingResult.error.message);

  const rows = entries ?? [];
  const validRows = rows.filter((item: any) => item.status !== "estornado");
  const total = sum(validRows);
  const tithes = sum(validRows.filter((item: any) => item.tipo === "dizimo"));
  const offers = total - tithes;
  const cash = sum(validRows.filter((item: any) => item.forma_pagamento === "dinheiro"));
  const pix = sum(validRows.filter((item: any) => item.forma_pagamento === "pix"));
  const memberMap = new Map<string, string>(
    members.map((item: any): [string, string] => [String(item.id), String(item.nome)])
  );
  const exportQuery = buildExportQuery({ start, end, type, payment, status, memberId });
  const closing = closingResult.data ?? null;
  const ok = read(query.ok);
  const error = read(query.erro);

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link
            href="/elshaday/financeiro"
            className="inline-flex items-center gap-2 text-sm font-black text-[#176445]"
          >
            <ArrowLeft size={16} /> Voltar ao financeiro
          </Link>
          <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-[#176445]">
            Tesouraria
          </p>
          <h1 className="mt-1 text-3xl font-black">Relatórios e fechamento</h1>
          <p className="mt-2 text-slate-600">
            Consulta detalhada, exportação, fechamento mensal e auditoria dos lançamentos.
          </p>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <WalletCards size={25} />
        </div>
      </header>

      {ok ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          Operação concluída.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total do período" value={moneyBR(total)} />
        <Kpi label="Dízimos" value={moneyBR(tithes)} />
        <Kpi label="Ofertas e outros" value={moneyBR(offers)} />
        <Kpi label="Dinheiro / PIX" value={moneyBR(cash) + " / " + moneyBR(pix)} />
      </section>

      <section className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-7" method="get">
          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            Início
            <input className="input" name="inicio" type="date" defaultValue={start} />
          </label>
          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            Fim
            <input className="input" name="fim" type="date" defaultValue={end} />
          </label>
          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            Tipo
            <select className="input" name="tipo" defaultValue={type}>
              <option value="">Todos</option>
              <option value="dizimo">Dízimo</option>
              <option value="oferta">Oferta</option>
              <option value="oferta_especial">Oferta especial</option>
              <option value="campanha">Campanha</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            Forma
            <select className="input" name="forma" defaultValue={payment}>
              <option value="">Todas</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="cartao">Cartão</option>
              <option value="transferencia">Transferência</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            Status
            <select className="input" name="status" defaultValue={status}>
              <option value="">Todos</option>
              <option value="confirmado">Confirmado</option>
              <option value="pendente">Pendente</option>
              <option value="estornado">Estornado</option>
            </select>
          </label>
          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            Membro
            <select className="input" name="membro_id" defaultValue={memberId}>
              <option value="">Todos</option>
              {members.map((member: any) => (
                <option key={member.id} value={member.id}>{member.nome}</option>
              ))}
            </select>
          </label>
          <button className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 font-black text-white">
            <Filter size={17} /> Filtrar
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-800"
            href={"/api/elshaday/financeiro/export?format=xlsx&" + exportQuery}
          >
            <Sheet size={16} /> Exportar Excel
          </a>
          <a
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700"
            href={"/api/elshaday/financeiro/export?format=pdf&" + exportQuery}
          >
            <FileDown size={16} /> Exportar PDF
          </a>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_.8fr]">
        <article className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
          <div className="flex items-center gap-2">
            <LockKeyhole size={19} className="text-[#176445]" />
            <h2 className="font-black">Fechamento mensal</h2>
          </div>
          <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
            <input type="hidden" name="inicio" value={start} />
            <input type="hidden" name="fim" value={end} />
            <label className="grid gap-2 text-sm font-bold">
              Competência
              <input className="input" name="competencia" type="month" defaultValue={competence} />
            </label>
            <button className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black">
              Consultar
            </button>
          </form>

          {closing?.status === "fechado" ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-black text-emerald-900">Competência fechada</p>
              <p className="mt-1 text-sm text-emerald-800">
                Total registrado no fechamento: {moneyBR(closing.total_calculado)}
              </p>
              <form action={reopenElshadayFinanceMonth} className="mt-4 grid gap-3">
                <input type="hidden" name="competencia" value={competence} />
                <input className="input" name="motivo" placeholder="Motivo da reabertura" required />
                <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-black text-emerald-900">
                  <RotateCcw size={16} /> Reabrir competência
                </button>
              </form>
            </div>
          ) : (
            <form action={closeElshadayFinanceMonth} className="mt-5 grid gap-3">
              <input type="hidden" name="competencia" value={competence} />
              <textarea
                className="min-h-24 rounded-2xl border border-slate-200 p-4"
                name="observacoes"
                placeholder="Observação opcional do fechamento"
              />
              <button className="min-h-11 w-fit rounded-xl bg-[#123d2d] px-5 font-black text-white">
                Fechar competência {competence}
              </button>
            </form>
          )}
        </article>

        <article className="rounded-[28px] border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-black text-amber-950">Regra de segurança</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900/80">
            Competências fechadas bloqueiam edição e estorno de lançamentos. Para corrigir o período,
            a Tesouraria precisa reabri-lo informando um motivo, que fica registrado na auditoria.
          </p>
        </article>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-emerald-950/10 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-black">Lançamentos do período</h2>
          <p className="mt-1 text-sm text-slate-500">{rows.length} registro(s) encontrados.</p>
        </div>

        {!rows.length ? (
          <p className="p-8 text-center text-slate-500">Nenhum lançamento encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
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
                {rows.map((entry: any) => (
                  <tr className={"border-t border-slate-100 " + (entry.status === "estornado" ? "opacity-60" : "")} key={entry.id}>
                    <td className="px-5 py-4">{dateBR(entry.data_entrada)}</td>
                    <td className="px-5 py-4 font-bold">{typeLabel(entry.tipo)}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {entry.anonimo ? "Anônimo" : memberMap.get(String(entry.membro_id ?? "")) || "Sem vínculo"}
                    </td>
                    <td className="px-5 py-4">{paymentLabel(entry.forma_pagamento)}</td>
                    <td className="px-5 py-4">{entry.origem === "manual" ? "Manual" : "Automático"}</td>
                    <td className="px-5 py-4">{entry.status}</td>
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

      <style>
        {".input{min-height:3rem;border-radius:1rem;border:1px solid rgb(226 232 240);background:white;padding:0 1rem;outline:none}.input:focus{border-color:rgb(5 150 105)}"}
      </style>
    </div>
  );
}

function localDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Araguaina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function sum(rows: any[]) {
  return rows.reduce((total, row) => total + Number(row.valor ?? 0), 0);
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[24px] border border-emerald-950/10 bg-white p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
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

function buildExportQuery(input: {
  start: string;
  end: string;
  type: string;
  payment: string;
  status: string;
  memberId: string;
}) {
  const params = new URLSearchParams();
  params.set("inicio", input.start);
  params.set("fim", input.end);
  if (input.type) params.set("tipo", input.type);
  if (input.payment) params.set("forma", input.payment);
  if (input.status) params.set("status", input.status);
  if (input.memberId) params.set("membro_id", input.memberId);
  return params.toString();
}
