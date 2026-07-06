import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton } from "@/components/ui-kit";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function LavaOperacaoSaidaPage() {
  const [{ config }] = await Promise.all([
    getLavaConfiguracoesEmpresa(),
    requireLavaGestorAccess("/lavagestor/operacao/saida")
  ]);

  return (
    <LavaGestorShell activePath="/lavagestor/operacao/saida" companyName={config.nome_exibicao}>
      <section className="mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-xl gap-4 py-4">
        <BackButton href="/lavagestor/operacao" label="Voltar" />

        <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black">Saída</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            Busque por ticket, placa, nome ou contato para localizar o veículo.
          </p>

          <form className="mt-5 grid gap-3" action="/lavagestor/busca">
            <input className="input min-h-14 text-center text-xl font-black uppercase" name="q" placeholder="Ticket ou placa" autoFocus />
            <button className="button-primary min-h-14 justify-center text-lg font-black" type="submit">
              Buscar veículo
            </button>
          </form>
        </div>

        <Link className="button-secondary min-h-14 justify-center rounded-xl text-lg font-black" href="/lavagestor/fila">
          Ver veículos em serviço
        </Link>
      </section>
    </LavaGestorShell>
  );
}
