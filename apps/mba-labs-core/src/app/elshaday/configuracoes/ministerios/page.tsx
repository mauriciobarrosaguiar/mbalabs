import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, PencilLine, Plus, Power, Trash2, UserRoundPlus, UsersRound } from "lucide-react";
import { ElshadaySubmitButton } from "../../ElshadaySubmitButton";
import { requireElshadayContext, requireElshadayRole } from "@/lib/elshaday";
import {
  createElshadayMinistry,
  deleteElshadayMinistry,
  syncElshadayMinistryMembers,
  toggleElshadayMinistry,
  updateElshadayMinistry
} from "../../membros/hierarchy-actions";

export const dynamic = "force-dynamic";

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ElshadayMinistriesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/configuracoes/ministerios");
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);

  const [ministriesResult, membersResult, linksResult] = await Promise.all([
    context.admin
      .from("igreja_ministerios")
      .select("id,nome,descricao,ativo")
      .eq("igreja_id", context.igreja.id)
      .order("nome"),
    context.admin
      .from("igreja_membros")
      .select("id,nome,situacao")
      .eq("igreja_id", context.igreja.id)
      .order("nome"),
    context.admin
      .from("igreja_membro_ministerios")
      .select("membro_id,ministerio_id")
      .eq("igreja_id", context.igreja.id)
  ]);

  const firstError = ministriesResult.error ?? membersResult.error ?? linksResult.error;
  if (firstError) throw new Error("Falha ao carregar ministérios: " + firstError.message);

  const ministries = ministriesResult.data ?? [];
  const members = membersResult.data ?? [];
  const membersByMinistry = new Map<string, Set<string>>();
  for (const link of linksResult.data ?? []) {
    const ministryId = String(link.ministerio_id);
    if (!membersByMinistry.has(ministryId)) membersByMinistry.set(ministryId, new Set());
    membersByMinistry.get(ministryId)?.add(String(link.membro_id));
  }

  return (
    <div className="mx-auto grid min-w-0 max-w-5xl gap-5">
      <header>
        <Link className="inline-flex items-center gap-2 text-sm font-black text-[#176445]" href="/elshaday/configuracoes">
          <ArrowLeft size={17} /> Voltar para configurações
        </Link>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.15em] text-[#176445]">Equipes e departamentos</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">Ministérios</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Um membro pode participar de vários ministérios ao mesmo tempo.
            </p>
          </div>
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
            <UsersRound size={24} />
          </div>
        </div>
      </header>

      {read(query.ok) ? <Message kind="ok">{read(query.ok)}</Message> : null}
      {read(query.erro) ? <Message kind="erro">{read(query.erro)}</Message> : null}

      <details className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5">
        <summary className="cursor-pointer list-none font-black text-emerald-950">
          <span className="inline-flex items-center gap-2"><Plus size={18} /> Cadastrar ministério</span>
        </summary>
        <form action={createElshadayMinistry} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
          <input className="input" name="nome" placeholder="Nome do ministério" required />
          <input className="input" name="descricao" placeholder="Descrição opcional" />
          <ElshadaySubmitButton className="min-h-12 rounded-2xl bg-[#123d2d] px-5 font-black text-white sm:col-span-2" pendingLabel="Salvando...">
            Cadastrar ministério
          </ElshadaySubmitButton>
        </form>
      </details>

      <section className="grid gap-4 sm:grid-cols-2">
        {ministries.map((ministry: any) => {
          const selected = membersByMinistry.get(String(ministry.id)) ?? new Set<string>();
          return (
            <article className={"min-w-0 rounded-[26px] border bg-white p-5 " + (ministry.ativo ? "border-emerald-950/10" : "border-slate-200 opacity-75")} key={ministry.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black text-slate-950">{ministry.nome}</h2>
                    <span className={"rounded-full px-2.5 py-1 text-[11px] font-black " + (ministry.ativo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600")}>
                      {ministry.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{ministry.descricao || "Sem descrição"}</p>
                  <p className="mt-2 text-xs font-black text-[#176445]">{selected.size} participante(s)</p>
                </div>
                <UserRoundPlus className="shrink-0 text-[#176445]" size={20} />
              </div>

              <details className="mt-4 rounded-2xl bg-slate-50 p-4">
                <summary className="cursor-pointer list-none text-sm font-black text-slate-800">
                  Selecionar participantes
                </summary>
                <form action={syncElshadayMinistryMembers} className="mt-4">
                  <input name="ministerio_id" type="hidden" value={ministry.id} />
                  <div className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1">
                    {members.map((member: any) => (
                      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800" key={member.id}>
                        <input className="size-5 accent-[#176445]" defaultChecked={selected.has(String(member.id))} name="membro_ids" type="checkbox" value={member.id} />
                        <span className="min-w-0 flex-1 truncate">{member.nome}</span>
                        <span className="text-[10px] uppercase text-slate-500">{member.situacao}</span>
                      </label>
                    ))}
                  </div>
                  <ElshadaySubmitButton className="mt-3 min-h-11 w-full rounded-xl bg-[#123d2d] px-4 text-sm font-black text-white" pendingLabel="Atualizando...">
                    Salvar participantes
                  </ElshadaySubmitButton>
                </form>
              </details>

              <details className="mt-3 rounded-2xl border border-slate-200 p-4">
                <summary className="cursor-pointer list-none text-sm font-black text-slate-800">
                  <span className="inline-flex items-center gap-2"><PencilLine size={16} /> Editar ministério</span>
                </summary>
                <form action={updateElshadayMinistry} className="mt-4 grid gap-3">
                  <input name="id" type="hidden" value={ministry.id} />
                  <input className="input" defaultValue={ministry.nome} name="nome" required />
                  <input className="input" defaultValue={ministry.descricao ?? ""} name="descricao" placeholder="Descrição opcional" />
                  <ElshadaySubmitButton className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-black text-white" pendingLabel="Salvando...">
                    Salvar alterações
                  </ElshadaySubmitButton>
                </form>
                <div className="mt-3 grid gap-2">
                  <form action={toggleElshadayMinistry}>
                    <input name="id" type="hidden" value={ministry.id} />
                    <input name="ativo" type="hidden" value={ministry.ativo ? "false" : "true"} />
                    <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black" type="submit">
                      <Power size={16} /> {ministry.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                  <form action={deleteElshadayMinistry}>
                    <input name="id" type="hidden" value={ministry.id} />
                    <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700" type="submit">
                      <Trash2 size={16} /> Excluir se estiver vazio
                    </button>
                  </form>
                </div>
              </details>
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

function Message({ kind, children }: { kind: "ok" | "erro"; children: ReactNode }) {
  return (
    <div className={"rounded-2xl border p-4 text-sm font-bold " + (kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800")}>
      {children}
    </div>
  );
}
