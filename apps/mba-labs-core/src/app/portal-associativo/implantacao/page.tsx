import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, MessageBanner, PageHeader, StatCard } from "@/components/ui-kit";
import { fixPortalVinculoInconsistente, fixPortalVinculosDuplicados } from "@/lib/actions/portal-associativo-actions";
import { canPortalAccess, getPortalConfiguracoes, getPortalDashboard, getPortalOnboarding, getPortalVinculoDiagnostics } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalImplantacaoPage() {
  const [onboarding, dashboard, settings, diagnostics] = await Promise.all([
    getPortalOnboarding(),
    getPortalDashboard(),
    getPortalConfiguracoes(),
    getPortalVinculoDiagnostics()
  ]);
  if (!canPortalAccess(onboarding.perfil, "implantacao")) {
    redirect("/portal-associativo");
  }

  return (
    <PortalAssociativoShell activePath="/portal-associativo/implantacao" can={(section) => canPortalAccess(onboarding.perfil, section)} companyName={onboarding.companyName} roleLabel={onboarding.perfilLabel} userName={onboarding.current.usuario.nome}>
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Começar aqui"
          description="Complete os passos principais para deixar o portal pronto."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner error={onboarding.error ?? dashboard.error ?? settings.error ?? undefined} />

        <section className="panel grid gap-4 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Progresso</p>
              <h2 className="text-2xl font-black">{onboarding.completed}/{onboarding.total} etapas concluídas</h2>
            </div>
            <Link className="button-primary w-fit" href="/portal-associativo">Voltar ao início</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {onboarding.steps.map((step) => (
              <Link className="rounded-lg border border-border bg-muted/40 p-4 transition hover:border-primary/60" href={step.href} key={step.id}>
                <span className={step.done ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700"}>
                  {step.done ? "Concluído" : "Pendente"}
                </span>
                <strong className="mt-3 block">{step.title}</strong>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">{step.description}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black">1. Dados da entidade, responsável, logo e PIX</h2><p className="text-sm text-muted-foreground">Faça estes ajustes em uma única tela, usando seleções simples e envio de imagem.</p></div><Link className="button-primary" href="/portal-associativo/configuracoes">Abrir ajustes</Link></section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pessoas cadastradas" value={onboarding.counts.pessoas} />
          <StatCard label="Unidades cadastradas" value={onboarding.counts.unidades} />
          <StatCard label="Cobranças abertas" value={dashboard.metrics.cobrancasAbertas} />
          <StatCard label="Cobranças vencidas" value={dashboard.metrics.cobrancasVencidas} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <StepPanel title="3. Cadastro de pessoas" description={`${onboarding.counts.pessoas} pessoa(s) já cadastrada(s).`}>
            <Link className="button-primary" href="/portal-associativo/pessoas#cadastro">Cadastrar associado</Link>
            <Link className="button-secondary" href="/portal-associativo/importacao?tipo=pessoas">Importar CSV/Excel</Link>
          </StepPanel>
          <StepPanel title="4. Cadastro de unidades" description={`${onboarding.counts.unidades} unidade(s) já cadastrada(s).`}>
            <Link className="button-primary" href="/portal-associativo/unidades#cadastro">Cadastrar unidade</Link>
            <Link className="button-secondary" href="/portal-associativo/importacao?tipo=unidades">Importar CSV/Excel</Link>
          </StepPanel>
          <StepPanel title="5. Vínculos" description={`${dashboard.metrics.unidadesSemResponsavelFinanceiro} unidade(s) sem responsável financeiro. Revise proprietário, financeiro e contato.`}>
            <Link className="button-primary" href="/portal-associativo/unidades">Corrigir vínculos</Link>
          </StepPanel>
          <StepPanel title="6. Cobranças" description={`${dashboard.metrics.cobrancasAbertas} abertas, ${dashboard.metrics.cobrancasVencidas} vencidas, ${dashboard.metrics.cobrancasAguardandoPagamento} aguardando pagamento.`}>
            <Link className="button-primary" href="/portal-associativo/financeiro#mensalidades-lote">Gerar mensalidades em lote</Link>
            <Link className="button-secondary" href="/portal-associativo/financeiro#cobranca-avulsa">Criar cobrança individual</Link>
          </StepPanel>
          <StepPanel title="7. Painel do associado" description={`${onboarding.counts.perfis} pessoa(s) vinculada(s) a usuários do MBA Labs. Quem não estiver vinculado deve procurar a administração.`}>
            <Link className="button-primary" href="/portal-associativo/pessoas">Vincular usuários</Link>
            <Link className="button-secondary" href="/portal-associativo/painel-associado">Testar painel</Link>
          </StepPanel>
        </div>

        <section className="panel grid gap-4 p-5">
          <div>
            <p className="eyebrow">Revisão segura</p>
            <h2 className="text-xl font-black">Vínculos de pessoas e unidades</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">O sistema apenas aponta problemas. Ao corrigir, o vínculo repetido é encerrado e continua no histórico.</p>
          </div>
          {diagnostics.issues.length ? (
            <div className="grid gap-3">
              {diagnostics.issues.map((issue) => {
                const candidates = issue.candidatos as Array<Record<string, unknown>>;
                const canChoose = issue.tipo === "duplicado" || issue.tipo === "multiplos_principais";
                return (
                  <article className="grid gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4" key={String(issue.key)}>
                    <div><strong>{String(issue.mensagem)}</strong><p className="mt-1 text-sm">{String(issue.unidade)} · {String(issue.papel)}</p></div>
                    {canChoose ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {candidates.map((candidate) => (
                          <form action={fixPortalVinculosDuplicados} className="rounded-xl bg-white p-3" key={String(candidate.id)}>
                            <input name="keep_id" type="hidden" value={String(candidate.id)} />
                            <input name="vinculo_ids" type="hidden" value={candidates.map((item) => String(item.id)).join(",")} />
                            <p className="text-sm font-bold">{String(candidate.pessoa)}</p>
                            <p className="text-xs text-muted-foreground">Início: {String(candidate.data_inicio ?? "não informado")}</p>
                            <button className="button-secondary mt-2" type="submit">Manter este vínculo</button>
                          </form>
                        ))}
                      </div>
                    ) : issue.tipo !== "referencia_invalida" ? (
                      <form action={fixPortalVinculoInconsistente}>
                        <input name="id" type="hidden" value={String(candidates[0]?.id ?? "")} />
                        <button className="button-secondary" type="submit">Corrigir situação</button>
                      </form>
                    ) : <p className="text-sm">Procure o suporte antes de alterar este registro.</p>}
                  </article>
                );
              })}
            </div>
          ) : <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Nenhum vínculo duplicado ou inconsistente encontrado.</p>}
        </section>
      </section>
    </PortalAssociativoShell>
  );
}

function StepPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="panel grid gap-4 p-5">
      <div>
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}
