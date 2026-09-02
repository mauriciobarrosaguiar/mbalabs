import Link from "next/link";
import { CalendarDays, ChevronRight, Church, HandCoins, HeartHandshake, MapPin, UserRoundPlus } from "lucide-react";
import { dateTimeBR, getPublicElshadayContext } from "@/lib/elshaday";
import { ElshadayMediaCarousel } from "./ElshadayMediaCarousel";

export async function PublicElshadayHome({ showMembership = true }: { showMembership?: boolean }) {
  const { admin, igreja } = await getPublicElshadayContext();
  const now = new Date().toISOString();

  const [eventsResult, carouselResult, sermonsResult] = await Promise.all([
    admin
      .from("igreja_eventos")
      .select("id,titulo,tipo,inicio,fim,local,pregador,tema,publico,status,banner_url,destacar_home,ordem_home")
      .eq("igreja_id", igreja.id)
      .eq("status", "agendado")
      .gte("inicio", now)
      .order("inicio", { ascending: true })
      .limit(30),
    admin
      .from("igreja_carrossel")
      .select("id,titulo,subtitulo,imagem_url,link_url,ordem,ativo")
      .eq("igreja_id", igreja.id)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .limit(10),
    admin
      .from("igreja_pregacoes")
      .select("id,titulo,pregador,banner_url,data_pregacao")
      .eq("igreja_id", igreja.id)
      .eq("status", "ativo")
      .order("data_pregacao", { ascending: false })
      .limit(3)
  ]);

  if (eventsResult.error) throw new Error("Falha ao carregar a agenda pública.");
  if (carouselResult.error) throw new Error("Falha ao carregar os destaques públicos.");
  if (sermonsResult.error) throw new Error("Falha ao carregar as palavras públicas.");

  const events = (eventsResult.data ?? []).filter(
    (event: any) => !["membros", "lideranca"].includes(String(event.publico ?? "todos"))
  );
  const carousel = carouselResult.data ?? [];
  const sermons = sermonsResult.data ?? [];

  const mediaItems = [
    ...events
      .filter((event: any) => Boolean(event.banner_url))
      .slice(0, 6)
      .map((event: any) => ({
        id: "agenda-" + event.id,
        title: event.titulo,
        subtitle: dateTimeBR(event.inicio),
        imageUrl: event.banner_url,
        href: null
      })),
    ...carousel
      .filter((item: any) => Boolean(item.imagem_url))
      .map((item: any) => ({
        id: "carrossel-" + item.id,
        title: item.titulo,
        subtitle: item.subtitulo,
        imageUrl: item.imagem_url,
        href:
          item.link_url === "/elshaday/contribuir" || item.link_url === "/cadastro-membro"
            ? item.link_url
            : null
      }))
  ].slice(0, 10);

  return (
    <div className="grid min-w-0 gap-5 overflow-x-hidden pb-20 md:gap-6 md:pb-0">
      <section className="min-w-0 overflow-hidden rounded-[24px] bg-[#123d2d] px-5 py-5 text-white shadow-[0_14px_34px_rgba(18,61,45,.16)] sm:rounded-[28px] sm:px-7 sm:py-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[#d4aa54] text-[#123d2d] sm:size-12">
            <Church size={23} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#f4dc9c]">Seja bem-vindo</p>
            <h1 className="mt-1 text-[clamp(1.45rem,6vw,2.25rem)] font-black leading-tight tracking-tight text-white">
              Elshaday Palmas
            </h1>
          </div>
        </div>

        <div className={"mt-5 grid gap-2 " + (showMembership ? "sm:grid-cols-2" : "")}>
          <a
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#d4aa54] px-5 text-sm font-black text-[#123d2d]"
            href="#agenda"
          >
            <CalendarDays size={18} /> Ver agenda
          </a>
          {showMembership ? (
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 text-sm font-black text-white"
              href="/cadastro-membro"
            >
              <UserRoundPlus size={18} /> Seja membro
            </Link>
          ) : null}
        </div>
      </section>

      {mediaItems.length ? <ElshadayMediaCarousel items={mediaItems} /> : null}

      <section id="agenda" className="scroll-mt-24 rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">Programação</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Agenda da igreja</h2>
          </div>
          <CalendarDays className="text-[#176445]" size={26} />
        </div>

        <div className="mt-5 grid gap-3">
          {events.slice(0, 10).map((event: any) => (
            <article className="rounded-[20px] bg-[#f7f8f4] p-4" key={event.id}>
              <div className="flex items-start gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-[#123d2d] text-[#f4d992]">
                  <CalendarDays size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="grid gap-1">
                    <h3 className="text-base font-black leading-tight text-slate-950 sm:text-lg">{event.titulo}</h3>
                    <span className="text-sm font-black text-[#176445]">{dateTimeBR(event.inicio)}</span>
                  </div>
                  {event.tema ? <p className="mt-2 text-sm font-bold text-slate-700">{event.tema}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
                    {event.local ? <span className="inline-flex items-center gap-1"><MapPin size={13} /> {event.local}</span> : null}
                    {event.pregador ? <span>Pregador: {event.pregador}</span> : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
          {!events.length ? (
            <div className="rounded-[20px] border border-dashed border-slate-200 p-7 text-center text-sm text-slate-600">
              Nenhuma programação pública futura cadastrada.
            </div>
          ) : null}
        </div>
      </section>

      <section className={"grid gap-4 " + (showMembership ? "sm:grid-cols-2" : "")}>
        <Link className="group min-w-0 rounded-[24px] bg-[#123d2d] p-5 text-white shadow-sm sm:p-6" href="/elshaday/contribuir">
          <div className="grid size-11 place-items-center rounded-2xl bg-white/10 text-[#f4d992]">
            <HeartHandshake size={22} />
          </div>
          <h2 className="mt-4 text-xl font-black text-white sm:text-2xl">Contribua</h2>
          <span className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[#f4d992]">
            Abrir PIX <ChevronRight size={17} />
          </span>
        </Link>

        {showMembership ? (
          <Link className="group min-w-0 rounded-[24px] border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-6" href="/cadastro-membro">
            <div className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-[#176445]">
              <UserRoundPlus size={22} />
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-950 sm:text-2xl">Seja membro</h2>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[#176445]">
              Fazer cadastro <ChevronRight size={17} />
            </span>
          </Link>
        ) : null}
      </section>

      {sermons.length ? (
        <section className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">Palavras recentes</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {sermons.map((sermon: any) => (
              <article className="overflow-hidden rounded-[20px] bg-[#f7f8f4]" key={sermon.id}>
                {sermon.banner_url ? (
                  <img alt="" className="aspect-video w-full object-cover" src={sermon.banner_url} />
                ) : null}
                <div className="p-4">
                  <h3 className="line-clamp-3 font-black text-slate-950">{sermon.titulo}</h3>
                  <p className="mt-2 text-xs font-semibold text-slate-600">{sermon.pregador}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
