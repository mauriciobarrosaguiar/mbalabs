import { CotacoesShell, LoginRequired } from "@/components/CotacoesShell";
import { getCotacoesContext } from "@/lib/cotacoes-data";

export const dynamic = "force-dynamic";

export default async function NovaCotacaoPage() {
  const context = await getCotacoesContext();

  return (
    <CotacoesShell>
      {!context.signedIn ? (
        <LoginRequired error={context.error} />
      ) : (
        <section className="page-shell grid gap-5 py-8">
          <p className="eyebrow">Nova cotacao</p>
          <h1 className="text-4xl font-black">Estrutura pronta</h1>
          <p className="max-w-2xl text-slate-300">
            Esta rota ja esta protegida por login. O proximo passo e ligar o formulario de criacao na tabela
            <code className="mx-1 rounded bg-white/10 px-1">cot_cotacoes</code>.
          </p>
        </section>
      )}
    </CotacoesShell>
  );
}
