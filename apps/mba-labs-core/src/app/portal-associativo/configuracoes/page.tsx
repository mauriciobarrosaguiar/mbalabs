import Link from "next/link";
import Image from "next/image";
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
import { canPortalAccess, getPortalConfiguracoes, getPortalLookups, PORTAL_UNIDADE_OPTIONS } from "@/lib/portal-associativo-data";
import { portalStorageProviderLabel } from "@/lib/portal-associativo-storage";
import { BrazilLocationFields } from "../BrazilLocationFields";

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
  const lookups = await getPortalLookups("/portal-associativo/configuracoes");
  const personOptions = lookups.pessoas.map((person: Record<string, unknown>) => ({
    value: String(person.id),
    label: `${person.nome_completo}${person.whatsapp ? ` · ${person.whatsapp}` : ""}`
  }));
  const selectedResponsible = lookups.pessoas.find((person: Record<string, unknown>) => String(person.id) === String(data.configuracoes.responsavel_pessoa_id ?? "")) as Record<string, unknown> | undefined;
  const logoUrl = String(data.configuracoes.logo_url ?? "");

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
          title="Ajustes"
          description="Aqui você ajusta os dados da associação, mensalidade, PIX e onde guardar os documentos."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <form action={savePortalConfiguracoes} id="pix-manual">
          <ResourceForm title="Dados da entidade" actions={<SubmitButton>Salvar dados da entidade</SubmitButton>}>
            <FormInput label="Nome público da entidade" name="nome_publico_entidade" defaultValue={String(data.configuracoes.nome_publico_entidade ?? "")} required />
            <FormInput label="Subtítulo" name="subtitulo" defaultValue={String(data.configuracoes.subtitulo ?? "")} />
            <FormSelect label="Tipo de unidade padrão" name="tipo_unidade_padrao" defaultValue={String(data.configuracoes.tipo_unidade_padrao ?? "chacara")} options={PORTAL_UNIDADE_OPTIONS} />
            <BrazilLocationFields defaultCity={String(data.configuracoes.cidade ?? "")} defaultUf={String(data.configuracoes.uf ?? "")} />
            <FormSelect label="Responsável da entidade" name="responsavel_pessoa_id" defaultValue={String(data.configuracoes.responsavel_pessoa_id ?? "")} options={personOptions} required />
            {selectedResponsible && !selectedResponsible.core_usuario_id ? <p className="col-span-full rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Este responsável ainda não possui usuário de acesso vinculado.</p> : null}
            <FormMoneyInput label="Valor padrão da mensalidade" name="valor_mensalidade_padrao" defaultValue={String(Number(data.configuracoes.valor_mensalidade_padrao ?? 0) > 0 ? data.configuracoes.valor_mensalidade_padrao : 20)} />
            <FormInput label="Dia padrão de vencimento" name="vencimento_padrao" type="number" defaultValue={String(data.configuracoes.vencimento_padrao ?? 10)} />
            <FormSelect label="Descrição padrão da mensalidade" name="descricao_mensalidade_padrao" defaultValue={String(data.configuracoes.descricao_mensalidade_padrao ?? "Mensalidade")} options={["Mensalidade", "Taxa de manutenção", "Taxa de associação", "Fundo de reserva", "Água", "Energia", "Projeto", "Multa", "Acordo", "Outra"].map((value) => ({ value, label: value }))} />
            <FormInput label="Descrição personalizada (quando escolher Outra)" name="descricao_mensalidade_outra" />
            <FormInput label="Chave PIX manual" name="pix_chave" defaultValue={String(data.configuracoes.pix_chave ?? "")} />
            <FormSelect label="Tipo da chave PIX" name="pix_tipo_chave" defaultValue={String(data.configuracoes.pix_tipo_chave ?? "")} options={[{ value: "cpf", label: "CPF" }, { value: "cnpj", label: "CNPJ" }, { value: "email", label: "E-mail" }, { value: "telefone", label: "Telefone" }, { value: "aleatoria", label: "Chave aleatória" }]} />
            <FormInput label="Nome do recebedor" name="recebedor_nome" defaultValue={String(data.configuracoes.recebedor_nome ?? "")} />
            <BrazilLocationFields defaultCity={String(data.configuracoes.recebedor_cidade ?? "")} defaultUf={String(data.configuracoes.recebedor_uf ?? data.configuracoes.uf ?? "")} cityName="recebedor_cidade" cityLabel="Cidade do recebedor" ufName="recebedor_uf" ufLabel="UF do recebedor" />
            <FormTextarea label="Instruções de pagamento" name="instrucoes_pagamento" defaultValue={String(data.configuracoes.instrucoes_pagamento ?? "")} />
            <FormCheckbox label="Usar PIX manual quando não houver banco de pagamento conectado" name="usar_pix_manual" defaultChecked={data.configuracoes.usar_pix_manual !== false} />
            <FormSelect
              label="Onde guardar os arquivos"
              name="storage_provider_ativo"
              defaultValue={String(data.configuracoes.storage_provider_ativo ?? "nenhum")}
              options={[
                { value: "nenhum", label: "Nenhum" },
                { value: "dropbox", label: "Dropbox" },
                { value: "google_drive", label: "Google Drive" },
                { value: "manual", label: "Sem integração" }
              ]}
            />
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-bold">Configuração avançada</summary>
              <div className="mt-3"><FormInput label="Endereço de integração" name="webhook_url" defaultValue={String(data.configuracoes.webhook_url ?? "")} /></div>
            </details>
            <FormSelect label="Assinatura/identificação dos PDFs" name="assinatura_tipo" defaultValue={String(data.configuracoes.assinatura_tipo ?? "entidade")} options={[{ value: "entidade", label: "Nome da entidade" }, { value: "responsavel", label: "Responsável da entidade" }, { value: "presidente", label: "Presidente" }, { value: "tesoureiro", label: "Tesoureiro" }, { value: "secretario", label: "Secretário" }, { value: "pessoa", label: "Pessoa específica" }]} />
            <FormSelect label="Pessoa específica para assinatura" name="assinatura_pessoa_id" defaultValue={String(data.configuracoes.assinatura_pessoa_id ?? "")} options={personOptions} />
            <FormCheckbox label="Marcar implantação como concluída" name="implantacao_concluida" defaultChecked={data.configuracoes.implantacao_concluida === true} />
          </ResourceForm>
        </form>

        <section className="panel grid gap-4 p-5">
          <div><h2 className="text-lg font-black">Logo da entidade</h2><p className="text-sm text-muted-foreground">Escolha uma imagem da galeria ou do dispositivo. Ela será guardada na conta de arquivos da associação.</p></div>
          {logoUrl ? <Image alt="Logo atual da entidade" className="h-24 w-24 rounded-xl border object-contain" height={96} src={logoUrl} unoptimized width={96} /> : <p className="text-sm text-muted-foreground">Nenhuma logo cadastrada.</p>}
          <form action="/api/portal-associativo/logo/upload" className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" encType="multipart/form-data" method="post">
            <label className="grid gap-1 text-sm font-semibold">Selecionar imagem<input accept="image/*" className="input" name="arquivo" required type="file" /></label>
            <button className="button-primary" type="submit">Enviar logo</button>
          </form>
          {logoUrl ? <details className="w-fit rounded-lg border border-red-200 bg-red-50 p-2"><summary className="cursor-pointer text-sm font-bold text-red-700">Remover logo</summary><form action="/api/portal-associativo/logo/remove" className="mt-2" method="post"><button className="button-danger" type="submit">Confirmar remoção</button></form></details> : null}
        </section>

        <details className="panel p-5">
          <summary className="cursor-pointer text-lg font-black">Configuração avançada do banco de pagamento</summary>
          <p className="mt-2 text-sm text-muted-foreground">Abra somente quando conectar um banco para cobranças automáticas.</p>
          <form action={savePortalConfiguracoesPagamento} className="mt-4">
          <ResourceForm title="Banco de pagamento" actions={<SubmitButton>Salvar pagamento</SubmitButton>}>
            <FormSelect
              label="Provedor PIX ativo"
              name="provedor_pix_ativo"
              defaultValue={String(data.pagamento.provedor_pix_ativo ?? "manual")}
              options={[{ value: "manual", label: "PIX manual" }, { value: "efi", label: "Efi" }, { value: "banco_brasil", label: "Banco do Brasil" }]}
            />
            <FormSelect label="Ambiente" name="ambiente" defaultValue={String(data.pagamento.ambiente ?? "homologacao")} options={[{ value: "homologacao", label: "Homologação" }, { value: "producao", label: "Produção" }]} />
            <FormInput label="Chave PIX" name="chave_pix" defaultValue={String(data.pagamento.chave_pix ?? "")} />
            <FormInput label="Nome do recebedor" name="nome_recebedor" defaultValue={String(data.pagamento.nome_recebedor ?? "")} />
            <FormInput label="Cidade do recebedor" name="cidade_recebedor" defaultValue={String(data.pagamento.cidade_recebedor ?? "")} />
            <FormInput label="Descrição padrão da cobrança" name="descricao_padrao" defaultValue={String(data.pagamento.descricao_padrao ?? data.configuracoes.descricao_mensalidade_padrao ?? "Mensalidade")} />
            <FormInput label="Endereço de integração" name="webhook_url" defaultValue={String(data.pagamento.webhook_url ?? "")} />
            <FormInput label="Modo padrão de cobrança" name="modo_cobranca_padrao" defaultValue={String(data.pagamento.modo_cobranca_padrao ?? "manual")} />
            <FormCheckbox label="Preparar estrutura para PIX automático futuro" name="pix_preparado_automatico" defaultChecked={data.pagamento.pix_preparado_automatico === true || data.pagamento.gerar_pix_automatico === true} />
            <FormCheckbox label="Gerar PIX automaticamente quando provedor estiver configurado" name="gerar_pix_automatico" defaultChecked={data.pagamento.gerar_pix_automatico === true} />
          </ResourceForm>
          </form>
        </details>

        <section className="panel grid gap-4 p-5" id="arquivos">
          <div>
            <p className="eyebrow">Dropbox / Google Drive</p>
            <h2 className="text-xl font-black">Arquivos da associação</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Documentos sensíveis devem ficar na conta Dropbox ou Google Drive da associação. O MBA Labs guarda apenas metadados, vínculos e links seguros.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(["dropbox", "google_drive"] as const).map((provider) => {
              const connection = (data.storage as Array<Record<string, unknown>>).find((row) => row.provedor === provider);
              return (
                <article className="rounded-lg border border-border bg-muted/40 p-4" key={provider}>
                  <h3 className="font-black">{portalStorageProviderLabel(provider)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Status: {String(connection?.status ?? "não conectado")}</p>
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
              <button className="button-secondary" type="submit">Testar conexão</button>
            </form>
            <details className="rounded-lg border border-red-200 bg-red-50 p-2">
              <summary className="cursor-pointer text-sm font-bold text-red-700">Desconectar integração</summary>
              <form action="/api/portal-associativo/storage/disconnect" className="mt-2" method="post">
                <button className="button-danger" type="submit">Confirmar desconexão</button>
              </form>
            </details>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Segurança</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">As senhas das integrações ficam protegidas e nunca aparecem nesta tela.</p>
        </section>
      </section>
    </PortalAssociativoShell>
  );
}
