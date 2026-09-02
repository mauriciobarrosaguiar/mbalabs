import Link from "next/link";
import { CalendarDays, ChevronRight, Church, HandCoins, HeartHandshake, MapPin, UserRoundPlus } from "lucide-react";
import { dateTimeBR, getPublicElshadayContext } from "@/lib/elshaday";
import { ElshadayMediaCarousel } from "./ElshadayMediaCarousel";

export async function PublicElshadayHome() {
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
      <section className="min-w-0 overflow-hidden rounded-[28px] bg-[#123d2d] p-5 text-white shadow-[0_18px_45px_rgba(18,61,45,.18)] sm:rounded-[32px] sm:p-9">
        <div className="max-w-3xl">
          <div className="grid size-14 place-items-center rounded-[18px] bg-[#d4aa54] text-[#123d2d]">
            <Church size={28} />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-[#f1d79d]">Seja bem-vindo</p>
          <h1 className="mt-2 text-[clamp(1.85rem,8vw,3rem)] font-black leading-[1.04] tracking-tight">{igreja.nome}</h1>
          <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
            <a className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl sm:w-auto bg-[#d4aa54] px-5 font-black text-[#123d2d]" href="#agenda">
              <CalendarDays size={19} /> Ver agenda
            </a>
            <Link className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl sm:w-auto border border-white/15 bg-white/10 px-5 font-black text-white" href="/elshaday/contribuir">
              <HandCoins size={19} /> Contribuir via PIX
            </Link>
            <Link className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl sm:w-auto border border-white/15 bg-white/5 px-5 font-black text-white" href="/cadastro-membro">
              <UserRoundPlus size={19} /> Seja membro
            </Link>
          </div>
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
                  <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start">
                    <h3 className="font-black text-slate-950">{event.titulo}</h3>
                    <span className="shrink-0 text-xs font-black text-[#176445]">{dateTimeBR(event.inicio)}</span>
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

      <section className="grid gap-4 sm:grid-cols-2">
        <Link className="group rounded-[28px] bg-[#123d2d] p-6 text-white shadow-sm" href="/elshaday/contribuir">
          <div className="grid size-12 place-items-center rounded-2xl bg-white/10 text-[#f4d992]">
            <HeartHandshake size={23} />
          </div>
          <h2 className="mt-5 text-2xl font-black">Deseja contribuir?</h2>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#f4d992]">
            Abrir contribuição <ChevronRight size={17} />
          </span>
        </Link>

        <Link className="group rounded-[28px] border border-emerald-950/10 bg-white p-6 shadow-sm" href="/cadastro-membro">
          <div className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-[#176445]">
            <UserRoundPlus size={23} />
          </div>
          <h2 className="mt-5 text-2xl font-black text-slate-950">Seja membro</h2>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#176445]">
            Fazer meu cadastro <ChevronRight size={17} />
          </span>
        </Link>
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
