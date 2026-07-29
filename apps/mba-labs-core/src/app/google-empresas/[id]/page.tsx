import Link from "next/link";
import { notFound } from "next/navigation";
import { GoogleEmpresasNav } from "@/components/google-empresas/GoogleEmpresasNav";
import { CopyAuthorizationLink } from "@/components/google-empresas/CopyAuthorizationLink";
import { GoogleEmpresaForm } from "@/components/google-empresas/GoogleEmpresaForm";
import { DataTable, MessageBanner, PageHeader, StatCard, SubmitButton, formatDate } from "@/components/ui-kit";
import {
  formatGoogleEmpresaStatus,
  getClientAuthorizationUrl,
  getGoogleEmpresa
} from "@/lib/google-empresas/data";
import {
  atualizarGoogleEmpresa,
  carregarOpcoesVerificacao,
  concluirVerificacao,
  criarPerfilNoGoogle,
  gerarLinkAutorizacao,
  iniciarVerificacao,
  revogarAutorizacao,
  selecionarContaGoogle,
  sincronizarComGoogle
} from "../actions";

export const dynamic = "force-dynamic";

export default async function GoogleEmpresaDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { empresa, autorizacoes, operacoes, error } = await getGoogleEmpresa(id);
  if (!empresa) notFound();

  const authorized = autorizacoes.find((item) => item.status === "autorizado") ?? null;
  const pending = autorizacoes.find((item) => item.status === "pendente") ?? null;
  const pendingUrl = pending ? getClientAuthorizationUrl(pending.public_token) : null;
  const googleAccounts = authorized?.google_accounts ?? [];
  const googleStatus = (empresa.google_status ?? {}) as Record<string, any>;
  const possibleMatches = Array.isArray(googleStatus.possibleMatches) ? googleStatus.possibleMatches : [];
  const requestAdminRightsUri = String(googleStatus.requestAdminRightsUri ?? "");
  const whatsappText = pendingUrl
    ? encodeURIComponent(
        `Olá! Para cadastrarmos e gerenciarmos a empresa ${empresa.nome} no Google, abra este link e autorize a conta Google responsável pelo perfil: ${pendingUrl}`
      )
    : "";

  const operationRows = operacoes.map((item) => ({
    id: item.id,
    data: formatDate(item.created_at),
    operacao: humanize(String(item.tipo ?? "")),
    status: humanize(String(item.status ?? "")),
    detalhes: summarizeDetails(item.detalhes)
  }));

  return (
    <main className="google-empresas-module">
      <GoogleEmpresasNav active="empresas" />
      <section className="google-empresas-content grid gap-6">
        <PageHeader
          eyebrow="Google Empresas"
          title={empresa.nome}
          description="Execute o fluxo na ordem abaixo. O cliente participa somente da autorização da conta e das provas solicitadas pelo próprio Google."
          actions={
            <Link className="button-secondary" href="/google-empresas">
              Voltar ao painel
            </Link>
          }
        />

        <MessageBanner ok={first(query.ok)} error={first(query.error) ?? error ?? empresa.ultimo_erro ?? undefined} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Situação" value={formatGoogleEmpresaStatus(empresa.status)} />
          <StatCard label="Autorização" value={authorized ? "Conectada" : pending ? "Link enviado" : "Pendente"} />
          <StatCard label="Perfil Google" value={empresa.google_location_name ? "Vinculado" : "Não criado"} />
          <StatCard label="Verificação" value={empresa.status === "verificado" ? "Concluída" : "Pendente"} />
        </div>

        <section className="panel grid gap-5 p-5 md:p-6">
          <StepHeader number="1" title="Autorização do cliente" description="Gere um link temporário. O cliente não recebe login do MBA Labs e não vê este painel." />

          {authorized ? (
            <div className="rounded-[14px] border border-emerald-300/30 bg-emerald-300/10 p-4">
              <strong className="text-emerald-100">Conta autorizada</strong>
              <p className="mt-1 text-sm text-emerald-50">{authorized.google_email || "Conta Google conectada"}</p>
            </div>
          ) : null}

          {pendingUrl ? (
            <div className="grid gap-3 rounded-[14px] border border-sky-300/30 bg-sky-300/10 p-4">
              <p className="text-sm font-bold text-sky-100">Link ativo até {formatDate(pending?.expires_at)}</p>
              <code className="overflow-x-auto rounded-[8px] bg-black/30 p-3 text-xs text-sky-50">{pendingUrl}</code>
              <div className="flex flex-wrap gap-2">
                <CopyAuthorizationLink value={pendingUrl} />
                <a className="button-primary" href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noreferrer">
                  Enviar pelo WhatsApp
                </a>
                <form action={revogarAutorizacao}>
                  <input type="hidden" name="empresa_id" value={empresa.id} />
                  <input type="hidden" name="autorizacao_id" value={pending?.id} />
                  <button className="button-danger" type="submit">Revogar link</button>
                </form>
              </div>
            </div>
          ) : null}

          <form action={gerarLinkAutorizacao} className="grid gap-4 rounded-[14px] border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_auto] md:items-end">
            <input type="hidden" name="empresa_id" value={empresa.id} />
            <label className="grid gap-2 text-sm font-bold">
              E-mail Google provável do cliente
              <input className="input" type="email" name="email_cliente" defaultValue={empresa.email_cliente ?? authorized?.google_email ?? ""} placeholder="cliente@gmail.com" />
            </label>
            <SubmitButton>{authorized ? "Gerar nova autorização" : pending ? "Substituir link" : "Gerar link"}</SubmitButton>
          </form>
        </section>

        <section className="panel grid gap-5 p-5 md:p-6">
          <StepHeader number="2" title="Conta e pesquisa de duplicidades" description="Sincronize as contas autorizadas e pesquise perfis que já existem no Google antes de criar outro." />

          {googleAccounts.length ? (
            <form action={selecionarContaGoogle} className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <label className="grid gap-2 text-sm font-bold">
                Conta ou grupo do Perfil da Empresa
                <select className="input" name="google_account_name" defaultValue={empresa.google_account_name ?? ""} required>
                  <option value="">Selecione</option>
                  {googleAccounts.map((account, index) => (
                    <option key={String(account.name ?? index)} value={String(account.name ?? "")}>
                      {String(account.accountName ?? account.name ?? `Conta ${index + 1}`)}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton>Selecionar conta</SubmitButton>
            </form>
          ) : (
            <p className="text-sm text-slate-300">As contas aparecerão depois que o cliente autorizar o Google.</p>
          )}

          <form action={sincronizarComGoogle}>
            <input type="hidden" name="empresa_id" value={empresa.id} />
            <SubmitButton>Sincronizar e pesquisar no Google</SubmitButton>
          </form>

          {possibleMatches.length ? (
            <div className="grid gap-3">
              <h3 className="text-lg font-black">Possíveis perfis encontrados</h3>
              {possibleMatches.slice(0, 5).map((match: Record<string, any>, index: number) => (
                <article className="rounded-[14px] border border-white/10 bg-white/[0.03] p-4" key={String(match.name ?? index)}>
                  <strong>{String(match.location?.title ?? `Resultado ${index + 1}`)}</strong>
                  <p className="mt-1 text-sm text-slate-300">{formatGoogleAddress(match.location?.storefrontAddress)}</p>
                  {match.requestAdminRightsUri ? (
                    <a className="button-primary mt-3 inline-flex" href={String(match.requestAdminRightsUri)} target="_blank" rel="noreferrer">
                      Solicitar acesso oficial
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-emerald-200">Perfil aparentemente não reivindicado; confira os dados antes de criar.</p>
                  )}
                </article>
              ))}
            </div>
          ) : null}

          {requestAdminRightsUri ? (
            <a className="button-primary w-fit" href={requestAdminRightsUri} target="_blank" rel="noreferrer">
              Abrir solicitação de acesso no Google
            </a>
          ) : null}
        </section>

        <section className="panel grid gap-5 p-5 md:p-6">
          <StepHeader number="3" title="Criar ou vincular o perfil" description="A criação usa os dados cadastrados e a categoria oficial localizada pela API do Google." />

          {empresa.google_location_name ? (
            <div className="rounded-[14px] border border-emerald-300/30 bg-emerald-300/10 p-4">
              <strong className="text-emerald-100">Perfil vinculado</strong>
              <p className="mt-1 break-all text-sm text-emerald-50">{empresa.google_location_name}</p>
              {empresa.google_maps_uri ? (
                <a className="button-secondary mt-3 inline-flex" href={empresa.google_maps_uri} target="_blank" rel="noreferrer">Abrir no Google Maps</a>
              ) : null}
            </div>
          ) : (
            <>
              <p className="rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
                Só crie depois de conferir os resultados acima. Criar ficha duplicada pode causar suspensão.
              </p>
              <form action={criarPerfilNoGoogle}>
                <input type="hidden" name="empresa_id" value={empresa.id} />
                <SubmitButton>Criar perfil no Google</SubmitButton>
              </form>
            </>
          )}
        </section>

        <section className="panel grid gap-5 p-5 md:p-6">
          <StepHeader number="4" title="Verificação" description="O painel consulta apenas os métodos liberados pelo Google para este perfil." />

          <form action={carregarOpcoesVerificacao}>
            <input type="hidden" name="empresa_id" value={empresa.id} />
            <SubmitButton>Consultar opções e status</SubmitButton>
          </form>

          {empresa.verification_options?.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {empresa.verification_options.map((option, index) => {
                const method = String(option.verificationMethod ?? option.method ?? "");
                return (
                  <form action={iniciarVerificacao} className="grid gap-3 rounded-[14px] border border-white/10 bg-white/[0.03] p-4" key={`${method}-${index}`}>
                    <input type="hidden" name="empresa_id" value={empresa.id} />
                    <input type="hidden" name="method" value={method} />
                    <strong>{verificationMethodLabel(method)}</strong>
                    <p className="text-sm leading-6 text-slate-300">{verificationOptionSummary(option)}</p>
                    {method.includes("EMAIL") ? <input className="input" name="email_user_name" placeholder="E-mail ou usuário solicitado pelo Google" /> : null}
                    {method.includes("PHONE") || method.includes("SMS") ? <input className="input" name="phone_number" placeholder="Telefone autorizado pelo Google" /> : null}
                    <SubmitButton>Iniciar este método</SubmitButton>
                  </form>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-300">Nenhuma opção carregada. Crie ou vincule o perfil e clique em consultar.</p>
          )}

          {empresa.google_verification_name ? (
            <form action={concluirVerificacao} className="grid gap-4 rounded-[14px] border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_auto] md:items-end">
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <label className="grid gap-2 text-sm font-bold">
                Código enviado pelo Google
                <input className="input" name="pin" inputMode="numeric" required />
              </label>
              <SubmitButton>Confirmar código</SubmitButton>
            </form>
          ) : null}
        </section>

        <details className="panel p-5 md:p-6">
          <summary className="cursor-pointer text-xl font-black">Editar dados da empresa</summary>
          <div className="mt-6">
            <GoogleEmpresaForm action={atualizarGoogleEmpresa} empresa={empresa} submitLabel="Atualizar dados" />
          </div>
        </details>

        <section className="grid gap-4">
          <h2 className="text-2xl font-black">Histórico</h2>
          <DataTable
            columns={[
              { key: "data", label: "Data" },
              { key: "operacao", label: "Operação" },
              { key: "status", label: "Status" },
              { key: "detalhes", label: "Detalhes" }
            ]}
            rows={operationRows}
            emptyMessage="Nenhuma operação registrada ainda."
          />
        </section>
      </section>
    </main>
  );
}

function StepHeader({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="google-step-number">{number}</span>
      <div>
        <h2 className="text-2xl font-black">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
      </div>
    </div>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summarizeDetails(value: unknown) {
  if (!value || typeof value !== "object") return "-";
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 3);
  return entries.map(([key, item]) => `${humanize(key)}: ${typeof item === "object" ? "registrado" : String(item)}`).join(" | ") || "-";
}

function formatGoogleAddress(address: Record<string, any> | undefined) {
  if (!address) return "Endereço não informado pelo Google.";
  return [address.addressLines?.join(", "), address.locality, address.administrativeArea, address.postalCode].filter(Boolean).join(" - ");
}

function verificationMethodLabel(method: string) {
  const labels: Record<string, string> = {
    ADDRESS: "Carta pelo correio",
    EMAIL: "E-mail",
    PHONE_CALL: "Ligação telefônica",
    SMS: "Mensagem SMS",
    AUTO: "Verificação automática",
    VETTED_PARTNER: "Parceiro aprovado",
    VIDEO_RECORDING: "Vídeo gravado",
    LIVE_VIDEO_CALL: "Videochamada ao vivo"
  };
  return labels[method] ?? humanize(method || "Método do Google");
}

function verificationOptionSummary(option: Record<string, unknown>) {
  const values = Object.entries(option)
    .filter(([key]) => !["verificationMethod", "method"].includes(key))
    .map(([key, value]) => `${humanize(key)}: ${formatOptionValue(value)}`)
    .filter(Boolean);
  return values.join(" | ") || "O Google exibirá as instruções após iniciar.";
}

function formatOptionValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatOptionValue).filter(Boolean).join(", ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(formatOptionValue).filter(Boolean).join(" ");
  return "";
}
