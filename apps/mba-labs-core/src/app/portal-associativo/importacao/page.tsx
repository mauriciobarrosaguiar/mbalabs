import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, DataTable, FormSelect, MessageBanner, PageHeader, ResourceForm, SubmitButton, formatDate } from "@/components/ui-kit";
import { importPortalCsv } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, listPortalImportacoes } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

type PortalRow = Record<string, unknown>;

export default async function PortalImportacaoPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tipo = firstParam(params.tipo) ?? "pessoas";
  const data = await listPortalImportacoes();
  if (!canPortalAccess(data.perfil, "importacao")) {
    redirect("/portal-associativo");
  }

  return (
    <PortalAssociativoShell activePath="/portal-associativo/importacao" can={(section) => canPortalAccess(data.perfil, section)} companyName={data.companyName} roleLabel={data.perfilLabel} userName={data.current.usuario.nome}>
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Importação em massa"
          description="Importe pessoas, unidades e cobranças por CSV. O arquivo é validado antes de salvar; se houver erro grave, nenhuma linha é gravada."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <section className="panel grid gap-4 p-5">
          <h2 className="text-xl font-black">Modelos</h2>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" href="/api/portal-associativo/importacao/modelo?tipo=pessoas">Modelo pessoas CSV</Link>
            <Link className="button-secondary" href="/api/portal-associativo/importacao/modelo?tipo=unidades">Modelo unidades CSV</Link>
            <Link className="button-secondary" href="/api/portal-associativo/importacao/modelo?tipo=cobrancas">Modelo cobranças CSV</Link>
          </div>
        </section>

        <form action={importPortalCsv} encType="multipart/form-data">
          <ResourceForm title="Importar arquivo" actions={<SubmitButton>Validar e importar</SubmitButton>}>
            <FormSelect
              label="Tipo de importação"
              name="tipo"
              defaultValue={tipo}
              options={[
                { value: "pessoas", label: "Pessoas" },
                { value: "unidades", label: "Unidades" },
                { value: "cobrancas", label: "Cobranças" }
              ]}
              required
            />
            <label className="grid gap-2">
              <span className="text-sm font-bold">Arquivo CSV</span>
              <input className="input" name="arquivo" type="file" accept=".csv,text/csv" required />
            </label>
          </ResourceForm>
        </form>

        <DataTable
          columns={[
            { key: "tipo", label: "Tipo" },
            { key: "status", label: "Status" },
            { key: "total_linhas", label: "Linhas" },
            { key: "linhas_importadas", label: "Importadas" },
            { key: "erros_count", label: "Erros" },
            { key: "criado_em", label: "Criado em" }
          ]}
          rows={data.rows.map((row: PortalRow) => ({
            ...row,
            erros_count: Array.isArray(row.erros) ? row.erros.length : 0,
            criado_em: formatDate(row.criado_em)
          }))}
        />
      </section>
    </PortalAssociativoShell>
  );
}
