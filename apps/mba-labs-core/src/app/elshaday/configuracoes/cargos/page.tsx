import Link from "next/link";
import { ArrowLeft, BarChart3, Church, PencilLine, Plus, Power, Trash2, UsersRound } from "lucide-react";
import { ElshadaySubmitButton } from "../../ElshadaySubmitButton";
import { hasElshadayRole, requireElshadayContext, requireElshadayRole } from "@/lib/elshaday";
import {
  createElshadayChurchRole,
  deleteElshadayChurchRole,
  toggleElshadayChurchRole,
  updateElshadayChurchRole
} from "../../membros/hierarchy-actions";

export const dynamic = "force-dynamic";

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ElshadayChurchRolesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/configuracoes/cargos");
  requireElshadayRole(context, ["admin", "pastor", "tesouraria", "secretaria", "lider"]);
  const canEdit = hasElshadayRole(context.papel, ["admin"]);

  const [rolesResult, membersResult] = await Promise.all([
    context.admin
      .from("igreja_cargos")
      .select("id,nome,ordem,ativo")
      .eq("igreja_id", context.igreja.id)
      .order("ordem")
      .order("nome"),
    context.admin
      .from("igreja_membros")
      .select("id,cargo_id")
      .eq("igreja_id", context.igreja.id)
  ]);

  if (rolesResult.error) throw new Error("Falha ao carregar cargos: " + rolesResult.error.message);
  if (membersResult.error) throw new Error("Falha ao compor a hierarquia: " + membersResult.error.message);

  const roles = rolesResult.data ?? [];
  const counts = new Map<string, number>();
  for (const member of membersResult.data ?? []) {
    const key = String(member.cargo_id ?? "");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return (
    <div className="mx-auto grid min-w-0 max-w-5xl gap-5">
      <header>
        <Link className="inline-flex items-center gap-2 text-sm font-black text-[#176445]" href="/elshaday/configuracoes">
          <ArrowLeft size={17} /> Voltar para configurações
        </Link>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.15em] text-[#176445]">Organização da igreja</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">Cargos e hierarquia</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Cargo eclesiástico é independente do perfil de acesso ao aplicativo.
            </p>
          </div>
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
            <Church size={24} />
          </div>
        </div>
      </header>

      {read(query.ok) ? <Message kind="ok">{read(query.ok)}</Message> : null}
      {read(query.erro) ? <Message kind="erro">{read(query.erro)}</Message> : null}

      <section className="rounded-[26px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
        Alterar um cargo nunca concede acesso administrativo, pastoral ou financeiro. As permissões continuam sendo controladas somente em “Acessos e perfis”.
      </section>

      <section className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-[#176445]" size={21} />
          <div>
            <h2 className="font-black">Composição da igreja</h2>
            <p className="text-xs text-slate-600">Toque em um cargo para ver seus membros.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {roles.map((role: any) => (
            <Link
              className="min-w-0 rounded-2xl bg-slate-50 p-4 transition active:scale-[.99]"
              href={"/elshaday/membros?cargo_id=" + role.id}
              key={role.id}
            >
              <p className="truncate text-xs font-black uppercase tracking-wide text-slate-600">{role.nome}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{counts.get(String(role.id)) ?? 0}</p>
            </Link>
          ))}
        </div>
      </section>

      {canEdit ? (
        <details className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5">
          <summary className="cursor-pointer list-none font-black text-emerald-950">
            <span className="inline-flex items-center gap-2"><Plus size={18} /> Cadastrar cargo</span>
          </summary>
          <form action={createElshadayChurchRole} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_130px_auto]">
            <input className="input" name="nome" placeholder="Nome do cargo" required />
            <input className="input" min={0} max={9999} name="ordem" placeholder="Ordem" type="number" defaultValue={100} />
            <ElshadaySubmitButton className="min-h-12 rounded-2xl bg-[#123d2d] px-5 font-black text-white" pendingLabel="Salvando...">
              Cadastrar
            </ElshadaySubmitButton>
          </form>
        </details>
      ) : null}

      <section className="grid gap-3">
        {roles.map((role: any) => {
          const usage = counts.get(String(role.id)) ?? 0;
          return (
            <article className={"rounded-[24px] border bg-white p-4 " + (role.ativo ? "border-emerald-950/10" : "border-slate-200 opacity-75")} key={role.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-950">{role.nome}</h3>
                    <span className={"rounded-full px-2.5 py-1 text-[11px] font-black " + (role.ativo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600")}>
                      {role.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-600">Ordem {role.ordem} · {usage} membro(s)</p>
                </div>
                <UsersRound className="shrink-0 text-[#176445]" size={20} />
              </div>

              {canEdit ? (
                <details className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <summary className="cursor-pointer list-none text-sm font-black text-slate-800">
                    <span className="inline-flex items-center gap-2"><PencilLine size={16} /> Editar cargo</span>
                  </summary>
                  <form action={updateElshadayChurchRole} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                    <input name="id" type="hidden" value={role.id} />
                    <input className="input" defaultValue={role.nome} name="nome" required />
                    <input className="input" defaultValue={role.ordem} min={0} max={9999} name="ordem" type="number" />
                    <ElshadaySubmitButton className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-black text-white" pendingLabel="Salvando...">
                      Salvar
                    </ElshadaySubmitButton>
                  </form>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <form action={toggleElshadayChurchRole}>
                      <input name="id" type="hidden" value={role.id} />
                      <input name="ativo" type="hidden" value={role.ativo ? "false" : "true"} />
                      <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black" type="submit">
                        <Power size={16} /> {role.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </form>
                    <form action={deleteElshadayChurchRole}>
                      <input name="id" type="hidden" value={role.id} />
                      <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700" type="submit">
                        <Trash2 size={16} /> Excluir se não estiver em uso
                      </button>
                    </form>
                  </div>
                </details>
              ) : null}
            </article>
          );
        })}
      </section>

      <style>{`
        .input {
          min-height: 3rem; min-width: 0; width: 100%; border-radius: 1rem;
          border: 1px solid #cbd5e1; background: white; padding: 0 1rem;
          color: #0f172a; outline: none;
        }
        .input:focus { border-color: #176445; box-shadow: 0 0 0 3px rgba(23,100,69,.12); }
      `}</style>
    </div>
  );
}

function Message({ kind, children }: { kind: "ok" | "erro"; children: React.ReactNode }) {
  return (
    <div className={"rounded-2xl border p-4 text-sm font-bold " + (kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800")}>
      {children}
    </div>
  );
}
