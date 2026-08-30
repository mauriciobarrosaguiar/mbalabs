import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  HandCoins,
  Mic2,
  UsersRound
} from "lucide-react";
import {
  dateTimeBR,
  hasElshadayRole,
  moneyBR,
  requireElshadayContext
} from "@/lib/elshaday";

export const dynamic = "force-dynamic";

export default async function ElshadayDashboardPage() {
  const context = await requireElshadayContext("/elshaday");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  const canSeeMembers = hasElshadayRole(context.papel, ["admin", "pastor", "secretaria", "lider"]);
  const canSeeFinance = hasElshadayRole(context.papel, ["admin", "tesouraria"]);

  const [membersResult, eventsResult, sermonsResult, financeResult] = await Promise.all([
    canSeeMembers
      ? context.admin
          .from("igreja_membros")
          .select("id", { count: "exact", head: true })
          .eq("igreja_id", context.igreja.id)
          .eq("situacao", "ativo")
      : Promise.resolve({ count: null, data: null, error: null }),
    context.admin
      .from("igreja_eventos")
      .select("id,titulo,tipo,inicio,local,pregador,tema")
      .eq("igreja_id", context.igreja.id)
      .gte("inicio", now.toISOString())
      .neq("status", "cancelado")
      .order("inicio", { ascending: true })
      .limit(5),
    context.admin
      .from("igreja_pregacoes")
      .select("id,titulo,tema,pregador,data_pregacao,texto_base")
      .eq("igreja_id", context.igreja.id)
      .order("data_pregacao", { ascending: false })
      .limit(4),
    canSeeFinance
      ? context.admin
          .from("igreja_financeiro_entradas")
          .select("valor,tipo")
          .eq("igreja_id", context.igreja.id)
          .gte("data_entrada", monthStart)
          .lt("data_entrada", nextMonthStart)
      : Promise.resolve({ data: [], error: null })
  ]);

  const entries = financeResult.data ?? [];
  const monthTotal = entries.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
  const titheTotal = entries
    .filter((row: any) => row.tipo === "dizimo")
    .reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
  const offeringTotal = entries
    .filter((row: any) => row.tipo !== "dizimo")
    .reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);

  const cards = [
    {
      label: "Próximos cultos",
      value: String(eventsResult.data?.length ?? 0),
      detail: "Agenda e programação",
      href: "/elshaday/eventos",
      icon: CalendarDays
    },
    {
      label: "Pregações salvas",
      value: String(sermonsResult.data?.length ?? 0),
      detail: "Últimos registros",
      href: "/elshaday/pregacoes",
      icon: Mic2
    }
  ];

  if (canSeeMembers) {
    cards.unshift({
      label: "Membros ativos",
      value: String(membersResult.count ?? 0),
      detail: "Cadastro e acompanhamento",
      href: "/elshaday/membros",
      icon: UsersRound
    });
  }

  if (canSeeFinance) {
    cards.splice(canSeeMembers ? 1 : 0, 0, {
      label: "Entradas do mês",
      value: moneyBR(monthTotal),
      detail: `Dízimos ${moneyBR(titheTotal)} · Ofertas ${moneyBR(offeringTotal)}`,
      href: "/elshaday/financeiro",
      icon: HandCoins
    });
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-7">
      <section className="overflow-hidden rounded-[32px] bg-[#123d2d] p-6 text-white shadow-xl shadow-emerald-950/10 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#f1d79d]">Painel da igreja</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            {context.igreja.nome_curto}
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-emerald-50/75">
            Um único lugar para organizar pessoas, finanças, cultos, mensagens e leitura bíblica.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-2xl bg-[#d4aa54] px-5 py-3 font-black text-[#123d2d]" href="/elshaday/eventos">
            Novo culto ou evento
          </Link>
          <Link className="rounded-2xl border border-white/20 bg-white/5 px-5 py-3 font-black" href="/elshaday/biblia">
            <BookOpen className="mr-2 inline" size={18} />
            Abrir Bíblia
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, href, icon: Icon }) => (
          <Link
            className="group rounded-[26px] border border-emerald-950/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            href={href}
            key={label}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-[#176445]">
                <Icon size={22} />
              </div>
              <ArrowRight className="text-slate-300 transition group-hover:text-[#176445]" size={18} />
            </div>
            <p className="mt-5 text-sm font-bold text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-black tracking-tight">{value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-[28px] border border-emerald-950/10 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">Agenda</p>
              <h2 className="mt-1 text-xl font-black">Próximos cultos e eventos</h2>
            </div>
            <Link className="text-sm font-black text-[#176445]" href="/elshaday/eventos">Ver agenda</Link>
          </div>
          <div className="mt-5 grid gap-3">
            {(eventsResult.data ?? []).length === 0 ? (
              <Empty text="Nenhum culto futuro cadastrado." />
            ) : (
              (eventsResult.data ?? []).map((event: any) => (
                <div className="rounded-2xl bg-slate-50 p-4" key={event.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black">{event.titulo}</p>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                      {dateTimeBR(event.inicio)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {[event.tema, event.pregador, event.local].filter(Boolean).join(" · ") || "Programação em definição"}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-[28px] border border-emerald-950/10 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">Conteúdo</p>
              <h2 className="mt-1 text-xl font-black">Últimas pregações</h2>
            </div>
            <Link className="text-sm font-black text-[#176445]" href="/elshaday/pregacoes">Ver acervo</Link>
          </div>
          <div className="mt-5 grid gap-3">
            {(sermonsResult.data ?? []).length === 0 ? (
              <Empty text="Nenhuma pregação cadastrada." />
            ) : (
              (sermonsResult.data ?? []).map((sermon: any) => (
                <div className="rounded-2xl bg-slate-50 p-4" key={sermon.id}>
                  <p className="font-black">{sermon.titulo}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {[sermon.pregador, sermon.texto_base].filter(Boolean).join(" · ")}
                  </p>
                  {sermon.tema ? <p className="mt-2 text-sm font-semibold text-[#176445]">{sermon.tema}</p> : null}
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{text}</div>;
}
