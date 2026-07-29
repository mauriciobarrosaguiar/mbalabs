import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export function LegalPage({
  eyebrow,
  title,
  description,
  updatedAt,
  sections
}: {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-white/10 bg-black/20">
        <div className="page-shell flex min-h-16 items-center justify-between gap-4 py-3">
          <Link href="/" aria-label="MBA Labs - início">
            <BrandLogo size="md" />
          </Link>
          <Link className="button-secondary" href="/">
            Voltar ao site
          </Link>
        </div>
      </header>

      <section className="page-shell grid gap-7 py-10 md:py-14">
        <div className="mx-auto grid w-full max-w-4xl gap-3">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">{title}</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-300">{description}</p>
          <p className="text-sm font-bold text-slate-400">Última atualização: {updatedAt}</p>
        </div>

        <article className="panel mx-auto grid w-full max-w-4xl gap-8 p-5 md:p-8">
          {sections.map((section) => (
            <section className="grid gap-3" key={section.title}>
              <h2 className="text-2xl font-black">{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p className="text-sm leading-7 text-slate-300 md:text-base" key={paragraph}>
                  {paragraph}
                </p>
              ))}
              {section.items?.length ? (
                <ul className="grid gap-2 pl-5 text-sm leading-7 text-slate-300 md:text-base">
                  {section.items.map((item) => (
                    <li className="list-disc" key={item}>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <section className="grid gap-3 border-t border-white/10 pt-6">
            <h2 className="text-2xl font-black">Contato</h2>
            <p className="text-sm leading-7 text-slate-300 md:text-base">
              Dúvidas, solicitações de privacidade ou pedidos de revogação podem ser enviados para{" "}
              <a className="font-bold text-emerald-300 underline" href="mailto:contato@mbalabs.com.br">
                contato@mbalabs.com.br
              </a>
              .
            </p>
          </section>
        </article>
      </section>
    </main>
  );
}
