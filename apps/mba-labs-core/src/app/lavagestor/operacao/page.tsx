import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function LavaOperacaoPage() {
  const [{ config }] = await Promise.all([
    getLavaConfiguracoesEmpresa(),
    requireLavaGestorAccess("/lavagestor/operacao")
  ]);

  return (
    <LavaGestorShell activePath="/lavagestor/operacao" companyName={config.nome_exibicao}>
      <section className="mx-auto grid h-[calc(100svh-8.25rem)] max-h-[calc(100svh-8.25rem)] min-h-0 w-full max-w-xl grid-rows-3 gap-2 overflow-hidden p-0">
        <BigButton href="/lavagestor/operacao/entrada" label="ENTRADA" tone="green" />
        <BigButton href="/lavagestor/operacao/saida" label="SAIDA" tone="red" />
        <BigButton href="/lavagestor/operacao/fila" label="VEICULOS EM SERVICO" tone="blue" />
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
