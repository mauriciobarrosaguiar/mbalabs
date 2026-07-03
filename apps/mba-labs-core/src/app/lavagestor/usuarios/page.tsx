import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDate } from "@/components/ui-kit";
import { saveLavaGestorUsuario, updateLavaGestorUsuarioStatus } from "@/lib/actions/lavagestor-usuarios-actions";
import { firstParam } from "@/lib/form-utils";
import { LAVA_USUARIO_STATUS, getLavaGestorUsuariosData } from "@/lib/lavagestor-usuarios-data";

export const dynamic = "force-dynamic";

export default async function LavaGestorUsuariosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await getLavaGestorUsuariosData();

  return (
    <LavaGestorShell activePath="/lavagestor/usuarios">
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="Usuários e acessos"
          description="Crie logins da própria empresa para o LavaGestor e vincule ao funcionário quando precisar."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Novo usuário</h2>
          <UsuarioForm profiles={data.profiles} funcionarios={data.funcionarios} />
        </section>

        <section className="grid gap-3">
          {data.usuarios.length === 0 ? <p className="rounded-xl border border-border bg-white p-4 text-sm font-semibold text-muted-foreground">Nenhum usuário da empresa ainda.</p> : null}
          {data.usuarios.map((row) => (
            <article className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm" key={String(row.id)}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="break-words text-lg font-black">{String(row.nome)}</h2>
                  <p className="text-sm font-semibold text-muted-foreground">{String(row.email)}</p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">{String(row.status)}</span>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <Info label="Perfil" value={String(row.perfil_app || "-")} />
                <Info label="Permissão" value={String(row.permissao_status || "-")} />
                <Info label="Criado em" value={formatDate(row.created_at)} />
              </div>
              <UsuarioForm profiles={data.profiles} funcionarios={data.funcionarios} usuario={row} />
              <div className="flex flex-wrap gap-2">
                <StatusButton id={String(row.id)} status={row.status === "ativo" ? "inativo" : "ativo"} label={row.status === "ativo" ? "Inativar" : "Ativar"} />
              </div>
            </article>
          ))}
        </section>
      </section>
    </LavaGestorShell>
  );
}

function UsuarioForm({
  profiles,
  funcionarios,
  usuario
}: {
  profiles: Array<{ value: string; label: string }>;
  funcionarios: Array<Record<string, unknown>>;
  usuario?: Record<string, unknown>;
}) {
  const isEditing = Boolean(usuario?.id);
  return (
    <form action={saveLavaGestorUsuario} className="grid gap-3">
      {isEditing ? <input name="id" type="hidden" value={String(usuario?.id)} /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input label="Nome" name="nome" defaultValue={String(usuario?.nome ?? "")} required />
        <Input label="E-mail/login" name="email" type="email" defaultValue={String(usuario?.email ?? "")} required />
        <Input label="WhatsApp" name="telefone" defaultValue={String(usuario?.telefone ?? "")} />
        <Input label={isEditing ? "Nova senha (opcional)" : "Senha provisória"} name="senha_provisoria" type="password" required={!isEditing} />
        <Select label="Perfil LavaGestor" name="perfil_app" defaultValue={String(usuario?.perfil_app ?? "lavador")} options={profiles} />
        <Select label="Status" name="status" defaultValue={String(usuario?.status ?? "ativo")} options={LAVA_USUARIO_STATUS} />
        <Select
          label="Funcionário vinculado"
          name="funcionario_id"
          defaultValue={String(usuario?.funcionario_id ?? "")}
          options={[
            { value: "", label: "Sem vínculo" },
            ...funcionarios.map((row) => ({ value: String(row.id), label: `${String(row.nome)}${row.ativo === false ? " (inativo)" : ""}` }))
          ]}
        />
      </div>
      <button className="button-primary w-fit" type="submit">{isEditing ? "Salvar usuário" : "Criar usuário"}</button>
    </form>
  );
}

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={updateLavaGestorUsuarioStatus}>
      <input name="id" type="hidden" value={id} />
      <input name="status" type="hidden" value={status} />
      <button className="button-secondary" type="submit">{label}</button>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <span className="rounded-lg bg-muted px-2 py-2"><span className="block text-[10px] font-black uppercase text-muted-foreground">{label}</span><strong className="block truncate text-sm" title={value}>{value}</strong></span>;
}

function Input({ label, name, type = "text", defaultValue = "", required = false }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean }) {
  return <label className="grid gap-2"><span className="text-sm font-black">{label}</span><input className="input" name={name} type={type} defaultValue={defaultValue} required={required} /></label>;
}

function Select({ label, name, options, defaultValue = "" }: { label: string; name: string; options: Array<{ value: string; label: string }>; defaultValue?: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black">{label}</span>
      <select className="input" name={name} defaultValue={defaultValue}>
        {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
  );
}
