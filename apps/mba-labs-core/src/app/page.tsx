import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, MessageCircle } from "lucide-react";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const config = await getSiteConfig();
  const whatsappHref = config.whatsappUrl || process.env.NEXT_PUBLIC_MBA_WHATSAPP_URL || "#";
  const systems = config.systems.filter((system) => system.visible);

  return (
    <main>
      <section className="page-shell grid min-h-[100svh] gap-8 py-6 sm:gap-10 sm:py-8 lg:gap-12 lg:py-10">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link className="flex min-h-10 items-center gap-3 text-xl font-black" href="/">
            {config.logoUrl ? (
              <img className="max-h-10 max-w-[180px] object-contain" src={config.logoUrl} alt={config.brandName} />
            ) : (
              config.brandName
            )}
          </Link>
          <div className="flex flex-wrap gap-2">
            <a className="button-secondary" href={whatsappHref} target="_blank" rel="noreferrer">
              {config.whatsappButtonText}
            </a>
            <Link className="button-primary" href="/login">
              Entrar
            </Link>
          </div>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div className="grid gap-7">
            <p className="eyebrow">{config.heroEyebrow}</p>
            <div className="grid gap-5">
              <h1 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
                {config.heroTitle}
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-slate-200 sm:text-xl">{config.heroSubtitle}</p>
              <p className="max-w-2xl text-base leading-7 text-slate-300">{config.heroSupportText}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="button-primary" href="#sistemas" style={{ background: config.primaryColor }}>
                {config.primaryButtonText} <ArrowRight size={18} />
              </Link>
              <a className="button-secondary" href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle size={18} />
                {config.whatsappButtonText}
              </a>
            </div>
          </div>

          <div className="panel grid gap-4 p-5">
            <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-5">
              <p className="eyebrow">{config.sideEyebrow}</p>
              <h2 className="mt-3 text-2xl font-black">{config.sideTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{config.sideText}</p>
            </div>
          </div>
        </div>

        <section className="grid gap-4" id="sistemas">
          <h2 className="text-2xl font-black">{config.systemsTitle}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {systems.map((system) => (
              <article className="panel p-5" key={system.key}>
                <Building2 className="mb-5" color={config.primaryColor} size={24} />
                <h3 className="text-lg font-black">{system.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{system.description}</p>
                <Link className="button-secondary mt-5 w-fit" href={system.href}>
                  {system.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-2xl font-black">{config.benefitsTitle}</h2>
          <div className="grid gap-3 md:grid-cols-5">
            {config.benefits.map((benefit) => (
              <div className="panel flex items-start gap-3 p-4 text-sm font-bold leading-6 text-slate-100" key={benefit}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" color={config.primaryColor} aria-hidden />
                {benefit}
              </div>
            ))}
          </div>
        </section>

        {config.footerText ? <p className="text-sm leading-6 text-slate-400">{config.footerText}</p> : null}
      </section>
    </main>
  );
}
