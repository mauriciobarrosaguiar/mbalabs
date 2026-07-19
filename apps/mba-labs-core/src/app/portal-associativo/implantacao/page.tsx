import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, FormInput, FormMoneyInput, FormSelect, FormTextarea, MessageBanner, PageHeader, ResourceForm, StatCard, SubmitButton } from "@/components/ui-kit";
import { savePortalConfiguracoes } from "@/lib/actions/portal-associativo-actions";
import { canPortalAccess, getPortalConfiguracoes, getPortalDashboard, getPortalOnboarding, PORTAL_UNIDADE_OPTIONS } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalImplantacaoPage() {
  const [onboarding, dashboard, settings] = await Promise.all([
    getPortalOnboarding(),
    getPortalDashboard(),
    getPortalConfiguracoes()
  ]);
  if (!canPortalAccess(onboarding.perfil, "implantacao")) {
    redirect("/portal-associativo");
  }

  const config = settings.configuracoes as Record<string, unknown>;

  return (
    <PortalAssociativoShell activePath="/portal-associativo/implantacao" can={(section) => canPortalAccess(onboarding.perfil, section)} companyName={onboarding.companyName} roleLabel={onboarding.perfilLabel} userName={onboarding.current.usuario.nome}>
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Implantação guiada"
          description="Configure entidade, financeiro, cadastros, vínculos, cobranças e painel do associado em uma sequência segura."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner error={onboarding.error ?? dashboard.error ?? settings.error ?? undefined} />

        <section className="panel grid gap-4 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Progresso</p>
              <h2 className="text-2xl font-black">{onboarding.completed}/{onboarding.total} etapas concluídas</h2>
            </div>
            <Link className="button-primary w-fit" href="/portal-associativo">Ver dashboard</Link>
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

        <form action={savePortalConfiguracoes}>
          <ResourceForm title="1. Dados da entidade" actions={<SubmitButton>Salvar entidade e financeiro</SubmitButton>}>
            <FormInput label="Nome público da associação" name="nome_publico_entidade" defaultValue={String(config.nome_publico_entidade ?? "")} required />
            <FormInput label="Subtítulo" name="subtitulo" defaultValue={String(config.subtitulo ?? "")} />
            <FormInput label="Logo URL" name="logo_url" defaultValue={String(config.logo_url ?? "")} />
            <FormSelect label="Tipo padrão de unidade" name="tipo_unidade_padrao" defaultValue={String(config.tipo_unidade_padrao ?? "chacara")} options={PORTAL_UNIDADE_OPTIONS} />
            <FormInput label="Tema visual simples" name="tema_visual" defaultValue={String(config.tema_visual ?? "padrao")} />
            <FormInput label="Cidade" name="cidade" defaultValue={String(config.cidade ?? "")} />
            <FormInput label="UF" name="uf" defaultValue={String(config.uf ?? "")} />
            <FormInput label="Nome do responsável" name="responsavel_nome" defaultValue={String(config.responsavel_nome ?? "")} />
            <FormMoneyInput label="Valor padrão da mensalidade" name="valor_mensalidade_padrao" defaultValue={String(config.valor_mensalidade_padrao ?? 0)} />
            <FormInput label="Dia padrão de vencimento" name="vencimento_padrao" type="number" defaultValue={String(config.vencimento_padrao ?? 10)} />
            <FormInput label="Descrição padrão da cobrança" name="descricao_mensalidade_padrao" defaultValue={String(config.descricao_mensalidade_padrao ?? "Mensalidade")} />
            <FormInput label="Chave PIX manual" name="pix_chave" defaultValue={String(config.pix_chave ?? "")} />
            <FormInput label="Tipo da chave PIX" name="pix_tipo_chave" defaultValue={String(config.pix_tipo_chave ?? "")} />
            <FormInput label="Nome do recebedor" name="recebedor_nome" defaultValue={String(config.recebedor_nome ?? "")} />
            <FormInput label="Cidade do recebedor" name="recebedor_cidade" defaultValue={String(config.recebedor_cidade ?? "")} />
            <FormTextarea label="Instruções de pagamento" name="instrucoes_pagamento" defaultValue={String(config.instrucoes_pagamento ?? "")} />
          </ResourceForm>
        </form>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pessoas cadastradas" value={onboarding.counts.pessoas} />
          <StatCard label="Unidades cadastradas" value={onboarding.counts.unidades} />
          <StatCard label="Cobranças abertas" value={dashboard.metrics.cobrancasAbertas} />
          <StatCard label="Cobranças vencidas" value={dashboard.metrics.cobrancasVencidas} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <StepPanel title="3. Cadastro de pessoas" description={`${onboarding.counts.pessoas} pessoa(s) já cadastrada(s).`}>
            <Link className="button-primary" href="/portal-associativo/pessoas">Cadastrar pessoa manual</Link>
            <Link className="button-secondary" href="/portal-associativo/importacao?tipo=pessoas">Importar CSV/Excel</Link>
          </StepPanel>
          <StepPanel title="4. Cadastro de unidades" description={`${onboarding.counts.unidades} unidade(s) já cadastrada(s).`}>
            <Link className="button-primary" href="/portal-associativo/unidades">Cadastrar unidade manual</Link>
            <Link className="button-secondary" href="/portal-associativo/importacao?tipo=unidades">Importar CSV/Excel</Link>
          </StepPanel>
          <StepPanel title="5. Vínculos" description={`${dashboard.metrics.unidadesSemResponsavelFinanceiro} unidade(s) sem responsável financeiro. Revise proprietário, financeiro e contato.`}>
            <Link className="button-primary" href="/portal-associativo/unidades">Corrigir vínculos</Link>
          </StepPanel>
          <StepPanel title="6. Cobranças" description={`${dashboard.metrics.cobrancasAbertas} abertas, ${dashboard.metrics.cobrancasVencidas} vencidas, ${dashboard.metrics.cobrancasAguardandoPagamento} aguardando pagamento.`}>
            <Link className="button-primary" href="/portal-associativo/financeiro">Gerar mensalidades em lote</Link>
            <Link className="button-secondary" href="/portal-associativo/financeiro">Criar cobrança individual</Link>
          </StepPanel>
          <StepPanel title="7. Painel do associado" description={`${onboarding.counts.perfis} pessoa(s) vinculada(s) a usuários do MBA Labs. Quem não estiver vinculado deve procurar a administração.`}>
            <Link className="button-primary" href="/portal-associativo/pessoas">Vincular usuários</Link>
            <Link className="button-secondary" href="/portal-associativo/painel-associado">Testar painel</Link>
          </StepPanel>
        </div>
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
