import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, FormCheckbox, FormInput, FormMoneyInput, FormSelect, FormTextarea, MessageBanner, PageHeader, ResourceForm, SubmitButton } from "@/components/ui-kit";
import { savePortalConfiguracoes, savePortalConfiguracoesPagamento } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, getPortalConfiguracoes, PORTAL_UNIDADE_OPTIONS } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalConfiguracoesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const data = await getPortalConfiguracoes();
  if (!canPortalAccess(data.perfil, "configuracoes")) {
    redirect("/portal-associativo");
  }

  return (
    <PortalAssociativoShell activePath="/portal-associativo/configuracoes" can={(section) => canPortalAccess(data.perfil, section)} companyName={data.companyName} roleLabel={data.perfilLabel} userName={data.current.usuario.nome}>
      <section className="grid gap-6">
        <PageHeader eyebrow="Portal Associativo" title="Configuracoes" description="Defina dados publicos, padroes de mensalidade, PIX e parametros de webhooks." actions={<BackButton href="/portal-associativo" />} />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <form action={savePortalConfiguracoes}>
          <ResourceForm title="Dados da entidade" actions={<SubmitButton>Salvar configuracoes</SubmitButton>}>
            <FormInput label="Nome publico da entidade" name="nome_publico_entidade" defaultValue={String(data.configuracoes.nome_publico_entidade ?? "")} required />
            <FormInput label="Logo URL" name="logo_url" defaultValue={String(data.configuracoes.logo_url ?? "")} />
            <FormInput label="Tema visual" name="tema_visual" defaultValue={String(data.configuracoes.tema_visual ?? "padrao")} />
            <FormSelect label="Tipo padrao de unidade" name="tipo_unidade_padrao" defaultValue={String(data.configuracoes.tipo_unidade_padrao ?? "propriedade")} options={PORTAL_UNIDADE_OPTIONS} />
            <FormMoneyInput label="Valor padrao da mensalidade" name="valor_mensalidade_padrao" defaultValue={String(data.configuracoes.valor_mensalidade_padrao ?? 0)} />
            <FormInput label="Dia padrao de vencimento" name="vencimento_padrao" type="number" defaultValue={String(data.configuracoes.vencimento_padrao ?? 10)} />
            <FormInput label="Descricao padrao da mensalidade" name="descricao_mensalidade_padrao" defaultValue={String(data.configuracoes.descricao_mensalidade_padrao ?? "Mensalidade")} />
            <FormInput label="Chave PIX" name="pix_chave" defaultValue={String(data.configuracoes.pix_chave ?? "")} />
            <FormInput label="Tipo da chave PIX" name="pix_tipo_chave" defaultValue={String(data.configuracoes.pix_tipo_chave ?? "")} />
            <FormInput label="Nome do recebedor" name="recebedor_nome" defaultValue={String(data.configuracoes.recebedor_nome ?? "")} />
            <FormInput label="Cidade do recebedor" name="recebedor_cidade" defaultValue={String(data.configuracoes.recebedor_cidade ?? "")} />
            <FormInput label="Webhook URL" name="webhook_url" defaultValue={String(data.configuracoes.webhook_url ?? "")} />
            <FormTextarea label="Subtitulo" name="subtitulo" defaultValue={String(data.configuracoes.subtitulo ?? "")} />
          </ResourceForm>
        </form>

        <form action={savePortalConfiguracoesPagamento}>
          <ResourceForm title="Configuracoes de pagamento" actions={<SubmitButton>Salvar pagamento</SubmitButton>}>
            <FormSelect
              label="Provedor PIX ativo"
              name="provedor_pix_ativo"
              defaultValue={String(data.pagamento.provedor_pix_ativo ?? "manual")}
              options={[{ value: "manual", label: "PIX manual" }, { value: "efi", label: "Efi" }, { value: "banco_brasil", label: "Banco do Brasil" }]}
            />
            <FormSelect label="Ambiente" name="ambiente" defaultValue={String(data.pagamento.ambiente ?? "homologacao")} options={[{ value: "homologacao", label: "Homologacao" }, { value: "producao", label: "Producao" }]} />
            <FormInput label="Chave PIX" name="chave_pix" defaultValue={String(data.pagamento.chave_pix ?? "")} />
            <FormInput label="Nome do recebedor" name="nome_recebedor" defaultValue={String(data.pagamento.nome_recebedor ?? "")} />
            <FormInput label="Cidade do recebedor" name="cidade_recebedor" defaultValue={String(data.pagamento.cidade_recebedor ?? "")} />
            <FormInput label="Webhook URL" name="webhook_url" defaultValue={String(data.pagamento.webhook_url ?? "")} />
            <FormInput label="Modo padrao de cobranca" name="modo_cobranca_padrao" defaultValue={String(data.pagamento.modo_cobranca_padrao ?? "manual")} />
            <FormCheckbox label="Gerar PIX automaticamente quando o provedor estiver configurado" name="gerar_pix_automatico" defaultChecked={data.pagamento.gerar_pix_automatico === true} />
          </ResourceForm>
        </form>

        <div className="panel p-5">
          <h2 className="text-lg font-semibold">Segredos de integracao</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Client ID, client secret, certificados, tokens e service role devem ficar em variaveis de ambiente da Vercel
            ou criptografados em `assoc_segredos_pagamento`. Eles nao sao exibidos no frontend.
          </p>
        </div>
      </section>
    </PortalAssociativoShell>
  );
}
