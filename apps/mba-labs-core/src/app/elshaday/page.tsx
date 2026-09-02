import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarHeart,
  ChevronRight,
  Church,
  HandCoins,
  MapPin,
  Mic2,
  Play,
  Sparkles,
  UsersRound
} from "lucide-react";
import {
  dateTimeBR,
  hasElshadayRole,
  moneyBR,
  requireElshadayContext
} from "@/lib/elshaday";
import { ElshadayMediaCarousel } from "./ElshadayMediaCarousel";

export const dynamic = "force-dynamic";

export default async function ElshadayDashboardPage() {
  const context = await requireElshadayContext("/elshaday");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  const isMember = context.papel === "membro";
  const canSeeMembers = hasElshadayRole(context.papel, ["admin", "pastor", "secretaria", "lider"]);
  const canSeeFinance = hasElshadayRole(context.papel, ["admin", "tesouraria"]);

  const [membersResult, eventsResult, sermonsResult, homeEventsResult, carouselResult, financeResult] = await Promise.all([
    !isMember && canSeeMembers
      ? context.admin
          .from("igreja_membros")
          .select("id", { count: "exact", head: true })
          .eq("igreja_id", context.igreja.id)
          .eq("situacao", "ativo")
      : Promise.resolve({ count: null, data: null, error: null }),
    context.admin
      .from("igreja_eventos")
      .select("id,titulo,tipo,inicio,fim,local,pregador,dirigente,tema,texto_biblico,publico,status,banner_url,serie_id,recorrencia_tipo,destacar_home,ordem_home")
      .eq("igreja_id", context.igreja.id)
      .gte("inicio", now.toISOString())
      .neq("status", "cancelado")
      .order("inicio", { ascending: true })
      .limit(12),
    context.admin
      .from("igreja_pregacoes")
      .select("id,titulo,tema,pregador,data_pregacao,texto_base,esboco,video_url,arquivo_url,banner_url")
      .eq("igreja_id", context.igreja.id)
      .eq("status", "ativo")
      .order("data_pregacao", { ascending: false })
      .limit(6),
    context.admin
      .from("igreja_eventos")
      .select("id,titulo,tipo,inicio,local,status,banner_url,serie_id,recorrencia_tipo,destacar_home,ordem_home")
      .eq("igreja_id", context.igreja.id)
      .eq("destacar_home", true)
      .eq("status", "agendado")
      .gte("inicio", now.toISOString())
      .order("inicio", { ascending: true })
      .order("ordem_home", { ascending: true })
      .limit(40),
    context.admin
      .from("igreja_carrossel")
      .select("id,titulo,subtitulo,imagem_url,link_url,ordem,ativo,evento_id")
      .eq("igreja_id", context.igreja.id)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(10),
    !isMember && canSeeFinance
      ? context.admin
          .from("igreja_financeiro_entradas")
          .select("valor,tipo,status")
          .eq("igreja_id", context.igreja.id)
          .neq("status", "estornado")
          .gte("data_entrada", monthStart)
          .lt("data_entrada", nextMonthStart)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (eventsResult.error) throw new Error("Falha ao carregar a programação: " + eventsResult.error.message);
  if (sermonsResult.error) throw new Error("Falha ao carregar as pregações: " + sermonsResult.error.message);
  if (homeEventsResult.error) throw new Error("Falha ao carregar os destaques da Agenda: " + homeEventsResult.error.message);
  if (carouselResult.error) throw new Error("Falha ao carregar o carrossel: " + carouselResult.error.message);

  const events = eventsResult.data ?? [];
  const sermons = sermonsResult.data ?? [];
  const homeEvents = homeEventsResult.data ?? [];
  const configuredCarousel = carouselResult.data ?? [];
  const entries = financeResult.data ?? [];
  const monthTotal = entries.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
  const titheTotal = entries
    .filter((row: any) => row.tipo === "dizimo")
    .reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
  const offeringTotal = entries
    .filter((row: any) => row.tipo !== "dizimo")
    .reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);

  const mobileHome = (
    <MobileAppHome
      events={events}
      sermons={sermons}
      homeEvents={homeEvents}
      carouselItems={configuredCarousel}
      usuarioNome={context.current.usuario.nome}
      papel={context.papel}
      membersCount={membersResult.count ?? 0}
      monthTotal={monthTotal}
    />
  );

  if (isMember) return mobileHome;

  const cards = [
    {
      label: "Próximos cultos",
      value: String(events.length),
      detail: "Agenda e programação",
      href: "/elshaday/eventos",
      icon: CalendarDays
    },
    {
      label: "Pregações salvas",
      value: String(sermons.length),
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
      detail: "Dízimos " + moneyBR(titheTotal) + " · Ofertas " + moneyBR(offeringTotal),
      href: "/elshaday/financeiro",
      icon: HandCoins
    });
  }

  return (
    <>
      <div className="lg:hidden">{mobileHome}</div>

      <div className="mx-auto hidden max-w-7xl gap-7 lg:grid">
        <section className="overflow-hidden rounded-[32px] bg-[#123d2d] p-8 text-white shadow-xl shadow-emerald-950/10">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#f1d79d]">Painel da igreja</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">{context.igreja.nome_curto}</h1>
            <p className="mt-3 max-w-2xl leading-7 text-emerald-50/75">
              Gestão de pessoas, finanças, cultos, mensagens e leitura bíblica.
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
          <DashboardList
            eyebrow="Agenda"
            title="Próximos cultos e eventos"
            href="/elshaday/eventos"
            empty="Nenhum culto futuro cadastrado."
          >
            {events.slice(0, 5).map((event: any) => (
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
            ))}
          </DashboardList>

          <DashboardList
            eyebrow="Conteúdo"
            title="Últimas pregações"
            href="/elshaday/pregacoes"
            empty="Nenhuma pregação cadastrada."
          >
            {sermons.slice(0, 4).map((sermon: any) => (
              <div className="rounded-2xl bg-slate-50 p-4" key={sermon.id}>
                <p className="font-black">{sermon.titulo}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {[sermon.pregador, sermon.texto_base].filter(Boolean).join(" · ")}
                </p>
                {sermon.tema ? <p className="mt-2 text-sm font-semibold text-[#176445]">{sermon.tema}</p> : null}
              </div>
            ))}
          </DashboardList>
        </section>
      </div>
    </>
  );
}

function MobileAppHome({
  events,
  sermons,
  homeEvents,
  carouselItems,
  usuarioNome,
  papel,
  membersCount,
  monthTotal
}: {
  events: any[];
  sermons: any[];
  homeEvents: any[];
  carouselItems: any[];
  usuarioNome: string;
  papel: string;
  membersCount: number;
  monthTotal: number;
}) {
  const firstName = usuarioNome.trim().split(/\s+/)[0] || usuarioNome;
  const nextEvent = events[0];
  const manualByEventId = new Map<string, any>(
    carouselItems
      .filter((item: any) => Boolean(item.evento_id && item.imagem_url))
      .map((item: any) => [String(item.evento_id), item] as [string, any])
  );
  const manualByTitle = new Map<string, any>(
    carouselItems
      .filter((item: any) => Boolean(item.imagem_url))
      .map((item: any) => [
        String(item.titulo ?? "").trim().toLocaleLowerCase("pt-BR"),
        item
      ] as [string, any])
      .filter((entry: [string, any]) => Boolean(entry[0]))
  );

  const seenSeries = new Set<string>();
  const syncedAgendaItems = homeEvents
    .filter((event: any) => {
      const key = event.serie_id ? "serie-" + event.serie_id : "evento-" + event.id;
      if (seenSeries.has(key)) return false;
      seenSeries.add(key);
      return true;
    })
    .map((event: any) => {
      const titleKey = String(event.titulo ?? "").trim().toLocaleLowerCase("pt-BR");
      const manualFallback: any = manualByEventId.get(String(event.id)) ?? manualByTitle.get(titleKey);
      return {
        id: "agenda-" + event.id,
        href: "/elshaday/eventos/" + event.id,
        title: event.titulo,
        subtitle: dateTimeBR(event.inicio),
        imageUrl: event.banner_url || manualFallback?.imagem_url || null,
        order: Number(event.ordem_home ?? manualFallback?.ordem ?? 10)
      };
    })
    .filter((item: any) => Boolean(item.imageUrl));

  const syncedTitleKeys = new Set(
    syncedAgendaItems
      .map((item: any) => String(item.title ?? "").trim().toLocaleLowerCase("pt-BR"))
      .filter(Boolean)
  );

  const configuredMediaItems = carouselItems
    .filter((item: any) => {
      if (item.evento_id) return false;
      const key = String(item.titulo ?? "").trim().toLocaleLowerCase("pt-BR");
      return !key || !syncedTitleKeys.has(key);
    })
    .map((item: any) => ({
      id: "carrossel-" + item.id,
      href: item.link_url || null,
      title: item.titulo || null,
      subtitle: item.subtitulo || null,
      imageUrl: item.imagem_url,
      order: Number(item.ordem ?? 10)
    }));

  const synchronizedMediaItems = [...syncedAgendaItems, ...configuredMediaItems]
    .sort((a, b) => a.order - b.order)
    .slice(0, 10);

  const fallbackMediaItems = [
    ...events
      .filter((event: any) => Boolean(event.banner_url))
      .map((event: any) => ({
        id: "evento-" + event.id,
        href: "/elshaday/eventos/" + event.id,
        title: event.titulo,
        subtitle: typeLabel(event.tipo),
        imageUrl: event.banner_url
      })),
    ...sermons
      .filter((sermon: any) => Boolean(sermon.banner_url))
      .map((sermon: any) => ({
        id: "pregacao-" + sermon.id,
        href: "/elshaday/pregacoes/" + sermon.id,
        title: sermon.titulo,
        subtitle: sermon.pregador,
        imageUrl: sermon.banner_url
      }))
  ].slice(0, 8);

  const mediaItems = synchronizedMediaItems.length ? synchronizedMediaItems : fallbackMediaItems;

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <section className="flex items-center justify-between gap-3 px-1 pt-1">
        <div>
          <p className="text-sm font-semibold text-slate-500">{greeting()},</p>
          <h1 className="mt-0.5 text-[28px] font-black tracking-tight text-slate-950">{firstName}</h1>
        </div>
        <div className="grid size-12 place-items-center rounded-full bg-emerald-50 text-[#123d2d]">
          <Church size={23} />
        </div>
      </section>

      {mediaItems.length ? (
        <ElshadayMediaCarousel items={mediaItems} />
      ) : nextEvent ? (
        <Link
          className="group relative min-h-[250px] overflow-hidden rounded-[30px] bg-[#0f3b2b] p-6 text-white shadow-[0_18px_45px_rgba(18,61,45,.22)]"
          href={"/elshaday/eventos/" + nextEvent.id}
        >
          <div className="absolute -right-12 -top-10 size-48 rounded-full bg-[#d4aa54]/20 blur-2xl" />
          <div className="absolute -bottom-16 -left-12 size-52 rounded-full bg-emerald-300/10 blur-2xl" />
          <div className="relative flex h-full min-h-[202px] flex-col">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-black uppercase tracking-[.14em] text-[#f4d992]">
                Próxima programação
              </span>
              <CalendarHeart size={22} className="text-[#f4d992]" />
            </div>
            <div className="mt-auto">
              <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-100/70">
                {typeLabel(nextEvent.tipo)}
              </p>
              <h2 className="mt-2 max-w-[90%] text-[30px] font-black leading-[1.05] tracking-tight">
                {nextEvent.titulo}
              </h2>
              <p className="mt-4 font-bold text-emerald-50">{dateTimeBR(nextEvent.inicio)}</p>
              <p className="mt-1 text-sm text-emerald-50/70">
                {[nextEvent.local, nextEvent.pregador].filter(Boolean).join(" · ") || "Detalhes da programação"}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#f4d992]">
                Ver detalhes <ChevronRight size={17} />
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <Link
          className="rounded-[30px] border border-dashed border-emerald-950/15 bg-white p-7 text-center shadow-sm"
          href="/elshaday/eventos"
        >
          <CalendarHeart className="mx-auto text-[#176445]" size={34} />
          <h2 className="mt-3 text-xl font-black">Agenda da igreja</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Nenhuma programação futura cadastrada.</p>
        </Link>
      )}

      <section className="rounded-[26px] border border-emerald-950/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-950">Minha agenda</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">Próximos encontros</p>
          </div>
          <Link className="text-sm font-black text-[#176445]" href="/elshaday/eventos">
            Ver todos
          </Link>
        </div>

        <div className="mt-4 grid gap-2">
          {events.slice(0, 3).map((event: any) => (
            <Link
              className="flex items-center gap-3 rounded-[18px] bg-[#f7f8f4] p-3"
              href={"/elshaday/eventos/" + event.id}
              key={event.id}
            >
              <div className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-[#123d2d] text-[#f4d992]">
                <CalendarDays size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-slate-900">{event.titulo}</p>
                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{dateTimeBR(event.inicio)}</p>
              </div>
              <ChevronRight className="shrink-0 text-slate-400" size={19} />
            </Link>
          ))}
          {!events.length ? <p className="py-3 text-center text-sm text-slate-500">Sem programações futuras.</p> : null}
        </div>
      </section>

      <section className="rounded-[26px] border border-emerald-950/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">Para sua edificação</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Palavras recentes</h2>
          </div>
          <Link className="text-sm font-black text-[#176445]" href="/elshaday/pregacoes">
            Ver todos
          </Link>
        </div>

        {!sermons.length ? (
          <div className="mt-4 rounded-[20px] bg-[#f7f8f4] p-5 text-center text-sm text-slate-500">
            Nenhuma pregação publicada ainda.
          </div>
        ) : (
          <>
            <Link
              className="mt-4 block overflow-hidden rounded-[22px] bg-[#321f18] text-white"
              href={"/elshaday/pregacoes/" + sermons[0].id}
            >
              <div className="relative min-h-[165px] overflow-hidden p-5">
                <div className="absolute -right-7 -top-7 size-36 rounded-full bg-[#d4aa54]/30 blur-2xl" />
                <div className="relative flex h-full min-h-[125px] flex-col justify-between">
                  <div className="grid size-10 place-items-center rounded-full bg-white/12">
                    <Play size={18} fill="currentColor" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[.15em] text-[#f4d992]">
                      Palavra em destaque
                    </p>
                    <h3 className="mt-2 text-2xl font-black leading-tight">{sermons[0].titulo}</h3>
                    <p className="mt-2 text-sm text-white/70">{sermons[0].pregador}</p>
                  </div>
                </div>
              </div>
            </Link>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {sermons.slice(1, 3).map((sermon: any) => (
                <Link
                  className="min-w-0 rounded-[20px] bg-[#f7f8f4] p-4"
                  href={"/elshaday/pregacoes/" + sermon.id}
                  key={sermon.id}
                >
                  <Mic2 className="text-[#176445]" size={20} />
                  <p className="mt-3 line-clamp-2 font-black leading-snug text-slate-900">{sermon.titulo}</p>
                  <p className="mt-2 truncate text-xs font-semibold text-slate-500">{sermon.pregador}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <QuickLink
          href="/elshaday/biblia"
          icon={<BookOpen size={22} />}
          label="Bíblia"
          detail="Leia e faça anotações"
        />
        <QuickLink
          href="/elshaday/contribuir"
          icon={<HandCoins size={22} />}
          label="Contribua"
          detail="Dízimos e ofertas"
        />
        {papel !== "membro" ? (
          <>
            <QuickLink
              href="/elshaday/membros"
              icon={<UsersRound size={22} />}
              label="Membros"
              detail={membersCount + " ativos"}
            />
            <QuickLink
              href="/elshaday/financeiro"
              icon={<Sparkles size={22} />}
              label="Financeiro"
              detail={moneyBR(monthTotal) + " no mês"}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
  detail
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <Link
      className="rounded-[22px] border border-emerald-950/10 bg-white p-4 shadow-sm transition active:scale-[.99]"
      href={href}
    >
      <div className="grid size-11 place-items-center rounded-[14px] bg-emerald-50 text-[#123d2d]">{icon}</div>
      <p className="mt-4 font-black text-slate-950">{label}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{detail}</p>
    </Link>
  );
}

function DashboardList({
  eyebrow,
  title,
  href,
  empty,
  children
}: {
  eyebrow: string;
  title: string;
  href: string;
  empty: string;
  children: React.ReactNode;
}) {
  const childArray = Array.isArray(children) ? children : [children];
  return (
    <article className="rounded-[28px] border border-emerald-950/10 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-black">{title}</h2>
        </div>
        <Link className="text-sm font-black text-[#176445]" href={href}>Ver todos</Link>
      </div>
      <div className="mt-5 grid gap-3">
        {childArray.length ? children : <Empty text={empty} />}
      </div>
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Araguaina",
      hour: "2-digit",
      hour12: false
    }).format(new Date()).replace(/\D/g, "")
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function typeLabel(value: string) {
  const labels: Record<string, string> = {
    culto: "Culto",
    ceia: "Santa Ceia",
    ebd: "Escola Bíblica",
    vigilia: "Vigília",
    congresso: "Congresso",
    reuniao: "Reunião",
    seminario: "Seminário",
    evento: "Evento"
  };
  return labels[value] ?? "Programação";
}
