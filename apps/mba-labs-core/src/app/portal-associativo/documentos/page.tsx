import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import {
  BackButton,
  DataTable,
  FormCheckbox,
  FormInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SubmitButton,
  formatDate
} from "@/components/ui-kit";
import { deletePortalArquivo, togglePortalArquivoLiberado } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import {
  canPortalAccess,
  getPortalLookups,
  listPortalArquivos,
  listPortalCobrancas,
  listPortalProjetos,
  listPortalReunioes,
  unitOptionLabel
} from "@/lib/portal-associativo-data";
import { portalStorageProviderLabel } from "@/lib/portal-associativo-storage";

export const dynamic = "force-dynamic";

export default async function PortalDocumentosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = {
    q: firstParam(params.q) ?? "",
    pessoa: firstParam(params.pessoa) ?? "",
    unidade: firstParam(params.unidade) ?? "",
    cobranca: firstParam(params.cobranca) ?? "",
    reuniao: firstParam(params.reuniao) ?? "",
    projeto: firstParam(params.projeto) ?? "",
    categoria: firstParam(params.categoria) ?? "",
    liberado: firstParam(params.liberado) ?? ""
  };
  const data = await listPortalArquivos(filters);
  if (!canPortalAccess(data.perfil, "documentos")) {
    redirect("/portal-associativo");
  }

  const [lookups, cobrancas, reunioes, projetos] = await Promise.all([
    getPortalLookups("/portal-associativo/documentos"),
    listPortalCobrancas(),
    listPortalReunioes(),
    listPortalProjetos()
  ]);
  const personOptions = lookups.pessoas.map((person: Record<string, unknown>) => ({ value: String(person.id), label: String(person.nome_completo) }));
  const unitOptions = lookups.unidades.map((unit: Record<string, unknown>) => ({ value: String(unit.id), label: unitOptionLabel(unit) }));
  const cobrancaOptions = cobrancas.rows.slice(0, 200).map((row) => ({ value: String(row.id), label: `${row.descricao} - ${row.unidade} - ${row.responsavel}` }));
  const reuniaoOptions = (reunioes.rows as Array<Record<string, unknown>>).map((row) => ({ value: String(row.id), label: String(row.titulo) }));
  const projetoOptions = (projetos.rows as Array<Record<string, unknown>>).map((row) => ({ value: String(row.id), label: String(row.nome) }));

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/documentos"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Documentos e anexos"
          description="Envie documentos para o Dropbox ou Google Drive da propria entidade e mantenha no MBA Labs apenas metadados e vinculos."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <form action="/api/portal-associativo/documentos/upload" method="post" encType="multipart/form-data">
          <ResourceForm title="Enviar documento ou imagem" actions={<SubmitButton>Enviar arquivo</SubmitButton>}>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-bold">Arquivo</span>
              <input className="input" name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" multiple required />
            </label>
            <FormSelect label="Provedor" name="provedor" options={[{ value: "dropbox", label: "Dropbox" }, { value: "google_drive", label: "Google Drive" }]} />
            <FormInput label="Categoria" name="categoria" defaultValue="Documentos" />
            <FormSelect label="Pessoa" name="pessoa_id" options={personOptions} />
            <FormSelect label="Unidade" name="unidade_id" options={unitOptions} />
            <FormSelect label="Cobranca" name="cobranca_id" options={cobrancaOptions} />
            <FormSelect label="Reuniao" name="reuniao_id" options={reuniaoOptions} />
            <FormSelect label="Projeto" name="projeto_id" options={projetoOptions} />
            <FormCheckbox label="Liberado para associado" name="liberado_associado" />
            <FormTextarea label="Descricao" name="descricao" />
          </ResourceForm>
        </form>

        <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_180px_180px_160px_auto]" action="">
          <input className="input" name="q" defaultValue={filters.q} placeholder="Buscar por arquivo, pessoa, unidade, categoria ou descricao" />
          <select className="input" name="pessoa" defaultValue={filters.pessoa}>
            <option value="">Todas as pessoas</option>
            {personOptions.map((option: { value: string; label: string }) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="input" name="unidade" defaultValue={filters.unidade}>
            <option value="">Todas as unidades</option>
            {unitOptions.map((option: { value: string; label: string }) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="input" name="liberado" defaultValue={filters.liberado}>
            <option value="">Liberado e interno</option>
            <option value="sim">Liberado</option>
            <option value="nao">Interno</option>
          </select>
          <button className="button-secondary" type="submit">Filtrar</button>
        </form>

        <DataTable
          columns={[
            { key: "file_name", label: "Arquivo" },
            { key: "categoria", label: "Categoria" },
            { key: "pessoa", label: "Pessoa" },
            { key: "unidade", label: "Unidade" },
            { key: "provedor_label", label: "Provedor" },
            { key: "liberado_label", label: "Associado" },
            { key: "criado_em", label: "Criado em" }
          ]}
          rows={data.rows.map((row) => ({
            ...row,
            provedor_label: portalStorageProviderLabel(String(row.provedor ?? "")),
            liberado_label: row.liberado_associado === true ? "Liberado" : "Interno",
            criado_em: formatDate(row.criado_em)
          }))}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Link className="button-secondary" href={`/api/portal-associativo/documentos/${row.id}/open`} target="_blank">Abrir</Link>
              <Link className="button-secondary" href={`/api/portal-associativo/documentos/${row.id}/open?download=1`} target="_blank">Baixar</Link>
              <form action={togglePortalArquivoLiberado}>
                <input name="id" type="hidden" value={String(row.id)} />
                <input name="liberado_associado" type="hidden" value={row.liberado_associado === true ? "false" : "true"} />
                <button className="button-secondary" type="submit">{row.liberado_associado === true ? "Tornar interno" : "Liberar"}</button>
              </form>
              <details className="w-full rounded-lg border border-red-200 bg-red-50 p-2 lg:w-auto">
                <summary className="cursor-pointer text-sm font-bold text-red-700">Excluir</summary>
                <form action={deletePortalArquivo} className="mt-2 grid gap-2">
                  <input name="id" type="hidden" value={String(row.id)} />
                  <input className="input" name="confirmacao" placeholder="Digite EXCLUIR" required />
                  <button className="button-danger" type="submit">Confirmar exclusao</button>
                </form>
              </details>
            </div>
          )}
        />
      </section>
    </PortalAssociativoShell>
  );
}
