import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import {
  canViewOwnerDashboard,
  getLavaGestorPermissionExtras,
  requireLavaGestorOperationAccess
} from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function LavaOperacaoPage() {
  const [{ config }, access] = await Promise.all([
    getLavaConfiguracoesEmpresa("/lavagestor/operacao"),
    requireLavaGestorOperationAccess("/lavagestor/operacao")
  ]);
  const canSeeDashboard = canViewOwnerDashboard(access.perfil, getLavaGestorPermissionExtras(access.current));

  return (
    <LavaGestorShell activePath="/lavagestor/operacao" companyName={config.nome_exibicao}>
      <section className="mx-auto grid h-[calc(100svh-8.25rem)] max-h-[calc(100svh-8.25rem)] min-h-0 w-full max-w-xl grid-rows-[1fr_1fr_1fr_auto] gap-2 overflow-hidden p-0">
        <BigButton href="/lavagestor/operacao/entrada" label="ENTRADA" tone="green" />
        <BigButton href="/lavagestor/operacao/saida" label="SAÍDA" tone="red" />
        <BigButton href="/lavagestor/operacao/fila" label="VEÍCULOS EM SERVIÇO" tone="blue" />
        {canSeeDashboard ? (
          <Link className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-white px-3 text-center text-sm font-black shadow-sm" href="/lavagestor/dashboard">
            VISÃO DO DONO / GESTÃO
          </Link>
        ) : null}
      </section>
    </LavaGestorShell>
  );
}

function BigButton({ href, label, tone }: { href: string; label: string; tone: "green" | "red" | "blue" }) {
  const classes = {
    green: "bg-emerald-500 text-white hover:bg-emerald-600",
    red: "bg-red-500 text-white hover:bg-red-600",
    blue: "bg-sky-500 text-white hover:bg-sky-600"
  };

  return (
    <Link
      className={`flex min-h-0 items-center justify-center rounded-2xl border border-white/40 px-3 py-2 text-center text-[clamp(1.9rem,9vw,3rem)] font-black tracking-tight shadow-md transition active:scale-[0.98] ${classes[tone]}`}
      href={href}
    >
      <span className="leading-none">{label}</span>
    </Link>
  );
}
