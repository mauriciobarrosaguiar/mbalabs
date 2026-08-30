import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bike,
  Boxes,
  Building2,
  Droplets,
  FileText,
  GraduationCap,
  Scale,
  Sparkles,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { PageHeader } from "@/components/ui-kit";
import { getLoginDestination, normalizeAppSlug, requireSessionProfile } from "@/lib/core-data";

export const dynamic = "force-dynamic";

const appIcons: Record<string, LucideIcon> = {
  "mba-cotacoes": FileText,
  lavagestor: Droplets,
  bikecomanda: Bike,
  "portal-associativo": Users,
  lexgestor: Scale,
  "conteudo-ia": Sparkles,
  "mba-escola": GraduationCap,
  dronegestor: Boxes,
  "google-empresas": Building2
};

export default async function SelecionarAppPage() {
  // A própria página se autocorrige caso o acesso do usuário mude:
  // 1 app -> entra direto; 0 apps -> bloqueio/empresa; 2+ -> permanece no seletor.
  const destination = await getLoginDestination("/dashboard");

  if (destination !== "/selecionar-app") {
    redirect(destination);
  }

  const { profile, appsLiberados } = await requireSessionProfile("/selecionar-app");
  const apps = appsLiberados.filter((app) => app.canAccess);

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-8 py-8">
        <PageHeader
          eyebrow="Seus sistemas"
          title="Onde você quer entrar?"
          description={`Olá, ${profile.nome}. Escolha um dos sistemas liberados para sua conta.`}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => {
            const Icon = appIcons[normalizeAppSlug(app.slug)] ?? Boxes;

            return (
              <Link
                className="group panel grid min-h-48 gap-5 p-5 transition hover:-translate-y-1 hover:border-cyan-300/40"
                href={app.urlPath}
                key={app.slug}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                    <Icon size={27} strokeWidth={1.8} />
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-emerald-200">
                    Ativo
                  </span>
                </div>

                <div className="grid gap-2">
                  <h2 className="text-xl font-black">{app.nome}</h2>
                  <p className="text-sm leading-6 text-slate-300">
                    {app.descricao ?? "Sistema liberado para sua conta."}
                  </p>
                </div>

                <span className="mt-auto inline-flex items-center gap-2 text-sm font-black text-cyan-200">
                  Acessar sistema
                  <ArrowRight className="transition group-hover:translate-x-1" size={17} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
