import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import {
  BackButton,
  FormCheckbox,
  FormInput,
  FormMoneyInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SubmitButton,
  formatDate
} from "@/components/ui-kit";
import { savePortalConfiguracoes, savePortalConfiguracoesPagamento } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, getPortalConfiguracoes, PORTAL_UNIDADE_OPTIONS } from "@/lib/portal-associativo-data";
import { portalStorageProviderLabel } from "@/lib/portal-associativo-storage";

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
    <PortalAssociativoShell
      activePath="/portal-associativo/configuracoes"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Configuracoes"
          description="Configure entidade, unidade padrao, mensalidade, PIX manual, armazenamento, aparencia e seguranca."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <form action={savePortalConfiguracoes}>
          <ResourceForm title="Dados da entidade" actions={<SubmitButton>Salvar dados da entidade</SubmitButton>}>
            <FormInput label="Nome publico da entidade" name="nome_publico_entidade" defaultValue={String(data.configuracoes.nome_publico_entidade ?? "")} required />
            <FormInput label="Subtitulo" name="subtitulo" defaultValue={String(data.configuracoes.subtitulo ?? "")} />
            <FormInput label="Logo URL" name="logo_url" defaultValue={String(data.configuracoes.logo_url ?? "")} />
            <FormInput label="Tema visual" name="tema_visual" defaultValue={String(data.configuracoes.tema_visual ?? "padrao")} />
            <FormSelect label="Tipo de unidade padrao" name="tipo_unidade_padrao" defaultValue={String(data.configuracoes.tipo_unidade_padrao ?? "chacara")} options={PORTAL_UNIDADE_OPTIONS} />
            <FormMoneyInput label="Valor padrao da mensalidade" name="valor_mensalidade_padrao" defaultValue={String(data.configuracoes.valor_mensalidade_padrao ?? 0)} />
            <FormInput label="Dia padrao de vencimento" name="vencimento_padrao" type="number" defaultValue={String(data.configuracoes.vencimento_padrao ?? 10)} />
            <FormInput label="Descricao padrao da mensalidade" name="descricao_mensalidade_padrao" defaultValue={String(data.configuracoes.descricao_mensalidade_padrao ?? "Mensalidade")} />
            <FormInput label="Chave PIX manual" name="pix_chave" defaultValue={String(data.configuracoes.pix_chave ?? "")} />
            <FormInput label="Tipo da chave PIX" name="pix_tipo_chave" defaultValue={String(data.configuracoes.pix_tipo_chave ?? "")} />
            <FormInput label="Nome do recebedor" name="recebedor_nome" defaultValue={String(data.configuracoes.recebedor_nome ?? "")} />
            <FormInput label="Cidade do recebedor" name="recebedor_cidade" defaultValue={String(data.configuracoes.recebedor_cidade ?? "")} />
            <FormSelect
              label="Provedor de armazenamento ativo"
              name="storage_provider_ativo"
              defaultValue={String(data.configuracoes.storage_provider_ativo ?? "nenhum")}
              options={[
                { value: "nenhum", label: "Nenhum" },
                { value: "dropbox", label: "Dropbox" },
                { value: "google_drive", label: "Google Drive" },
                { value: "manual", label: "Manual" }
              ]}
            />
            <FormInput label="Webhook URL" name="webhook_url" defaultValue={String(data.configuracoes.webhook_url ?? "")} />
            <FormTextarea label="Assinatura/identificacao da entidade para PDFs" name="assinatura_entidade" defaultValue={String(data.configuracoes.assinatura_entidade ?? "")} />
            <FormCheckbox label="Marcar implantacao como concluida" name="implantacao_concluida" defaultChecked={data.configuracoes.implantacao_concluida === true} />
          </ResourceForm>
        </form>

        <form action={savePortalConfiguracoesPagamento}>
          <ResourceForm title="Mensalidade, PIX e pagamento" actions={<SubmitButton>Salvar pagamento</SubmitButton>}>
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
            <FormInput label="Descricao padrao da cobranca" name="descricao_padrao" defaultValue={String(data.pagamento.descricao_padrao ?? data.configuracoes.descricao_mensalidade_padrao ?? "Mensalidade")} />
            <FormInput label="Webhook URL" name="webhook_url" defaultValue={String(data.pagamento.webhook_url ?? "")} />
            <FormInput label="Modo padrao de cobranca" name="modo_cobranca_padrao" defaultValue={String(data.pagamento.modo_cobranca_padrao ?? "manual")} />
            <FormCheckbox label="Preparar estrutura para PIX automatico futuro" name="pix_preparado_automatico" defaultChecked={data.pagamento.pix_preparado_automatico === true || data.pagamento.gerar_pix_automatico === true} />
            <FormCheckbox label="Gerar PIX automaticamente quando provedor estiver configurado" name="gerar_pix_automatico" defaultChecked={data.pagamento.gerar_pix_automatico === true} />
          </ResourceForm>
        </form>

        <section className="panel grid gap-4 p-5">
          <div>
            <p className="eyebrow">Dropbox / Google Drive</p>
            <h2 className="text-xl font-black">Armazenamento da propria entidade</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Documentos sensiveis devem ficar na conta Dropbox ou Google Drive da associacao. O MBA Labs guarda apenas metadados, vinculos e links seguros.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(["dropbox", "google_drive"] as const).map((provider) => {
              const connection = (data.storage as Array<Record<string, unknown>>).find((row) => row.provedor === provider);
              return (
                <article className="rounded-lg border border-border bg-muted/40 p-4" key={provider}>
                  <h3 className="font-black">{portalStorageProviderLabel(provider)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Status: {String(connection?.status ?? "nao conectado")}</p>
                  <p className="text-sm text-muted-foreground">Conta: {String(connection?.account_email ?? "-")}</p>
                  <p className="break-words text-sm text-muted-foreground">Pasta raiz: {String(connection?.root_folder_path ?? "/Portal Associativo")}</p>
                  <p className="text-sm text-muted-foreground">Atualizado em: {formatDate(connection?.atualizado_em)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link className="button-primary" href={`/api/portal-associativo/storage/connect/${provider}`}>Conectar</Link>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <form action="/api/portal-associativo/storage/test" method="post">
              <button className="button-secondary" type="submit">Testar conexao</button>
            </form>
            <form action="/api/portal-associativo/storage/disconnect" method="post">
              <button className="button-danger" type="submit">Desconectar integracao</button>
            </form>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Seguranca e segredos</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Client ID, client secret, refresh token, certificados e tokens nao aparecem no frontend. Configure-os na Vercel/Supabase e use tabela segura criptografada.
          </p>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <code>DROPBOX_CLIENT_ID</code>
            <code>DROPBOX_CLIENT_SECRET</code>
            <code>GOOGLE_DRIVE_CLIENT_ID</code>
            <code>GOOGLE_DRIVE_CLIENT_SECRET</code>
            <code>STORAGE_ENCRYPTION_KEY</code>
            <code>NEXT_PUBLIC_APP_URL</code>
          </div>
        </section>
      </section>
    </PortalAssociativoShell>
  );
}
