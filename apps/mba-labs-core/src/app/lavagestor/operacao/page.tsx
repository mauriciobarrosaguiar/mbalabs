import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function LavaOperacaoPage() {
  const [{ config }, access] = await Promise.all([
    getLavaConfiguracoesEmpresa(),
    requireLavaGestorAccess("/lavagestor/operacao")
  ]);

  const isGestao = ["admin_master", "admin_empresa", "dono", "gerente"].includes(access.perfil);

  return (
    <LavaGestorShell activePath="/lavagestor/operacao" companyName={config.nome_exibicao}>
      <section className="mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-xl gap-4 py-4">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">LavaGestor</p>
          <h1 className="mt-1 text-3xl font-black">Operação</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            Tela simples para entrada e saída de veículos.
          </p>
        </div>

        <div className="grid flex-1 gap-3">
          <BigButton href="/lavagestor/operacao/entrada" label="ENTRADA" tone="green" />
          <BigButton href="/lavagestor/operacao/saida" label="SAÍDA" tone="red" />
          <BigButton href="/lavagestor/operacao/fila" label="VEÍCULOS EM SERVIÇO" tone="blue" />
        </div>

        {isGestao ? (
          <Link className="button-secondary justify-center rounded-xl py-4 text-base font-black" href="/lavagestor">
            Visão do dono / gestão
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
      className={`flex min-h-[26vh] items-center justify-center rounded-3xl border border-white/40 p-6 text-center text-4xl font-black tracking-tight shadow-lg transition active:scale-[0.98] ${classes[tone]}`}
      href={href}
    >
      {label}
    </Link>
  );
}
