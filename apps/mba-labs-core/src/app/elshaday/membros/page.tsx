import { UserPlus, UsersRound } from "lucide-react";
import { createElshadayMember } from "../actions";
import {
  dateBR,
  hasElshadayRole,
  requireElshadayContext
} from "@/lib/elshaday";

export const dynamic = "force-dynamic";

export default async function ElshadayMembersPage() {
  const context = await requireElshadayContext("/elshaday/membros");
  const canManage = hasElshadayRole(context.papel, ["admin", "pastor", "secretaria"]);

  const { data: members, error } = await context.admin
    .from("igreja_membros")
    .select("id,nome,data_nascimento,telefone,whatsapp,email,cargo,ministerio,situacao,data_entrada")
    .eq("igreja_id", context.igreja.id)
    .order("nome", { ascending: true });

  if (error) throw new Error(\`Falha ao carregar membros: \${error.message}\`);

  const activeCount = (members ?? []).filter((member: any) => member.situacao === "ativo").length;

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Pessoas</p>
          <h1 className="mt-1 text-3xl font-black">Gestão de membros</h1>
          <p className="mt-2 text-slate-600">{activeCount} membros ativos · {(members ?? []).length} registros</p>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <UsersRound size={25} />
        </div>
      </header>

      {canManage ? (
        <details className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm" open={(members ?? []).length === 0}>
          <summary className="cursor-pointer list-none font-black">
            <span className="inline-flex items-center gap-2">
              <UserPlus size={19} className="text-[#176445]" />
              Cadastrar novo membro
            </span>
          </summary>
          <form action={createElshadayMember} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome completo" name="nome" required />
            <Field label="Nascimento" name="data_nascimento" type="date" />
            <Field label="Telefone" name="telefone" />
            <Field label="WhatsApp" name="whatsapp" />
            <Field label="E-mail" name="email" type="email" />
            <Field label="Data de entrada" name="data_entrada" type="date" />
            <Field label="Data de conversão" name="data_conversao" type="date" />
            <Field label="Data de batismo" name="data_batismo" type="date" />
            <Field label="Cargo/Função" name="cargo" />
            <Field label="Ministério" name="ministerio" />
            <Field label="Endereço" name="endereco" />
            <Field label="Bairro" name="bairro" />
            <Field label="Cidade" name="cidade" defaultValue="Palmas" />
            <Field label="UF" name="estado" defaultValue="TO" maxLength={2} />
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Situação
              <select className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-emerald-600" name="situacao" defaultValue="ativo">
                <option value="ativo">Ativo</option>
                <option value="afastado">Afastado</option>
                <option value="visitante">Visitante</option>
                <option value="transferido">Transferido</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2 lg:col-span-3">
              Observações
              <textarea className="min-h-24 rounded-2xl border border-slate-200 bg-white p-4 outline-none focus:border-emerald-600" name="observacoes" />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <button className="min-h-12 rounded-2xl bg-[#123d2d] px-6 font-black text-white" type="submit">
                Salvar membro
              </button>
            </div>
          </form>
        </details>
      ) : null}

      <section className="overflow-hidden rounded-[28px] border border-emerald-950/10 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-black">Membros cadastrados</h2>
        </div>
        {(members ?? []).length === 0 ? (
          <p className="p-8 text-center text-slate-500">Nenhum membro cadastrado.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Nome</th>
                    <th className="px-5 py-4">Contato</th>
                    <th className="px-5 py-4">Ministério</th>
                    <th className="px-5 py-4">Entrada</th>
                    <th className="px-5 py-4">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {(members ?? []).map((member: any) => (
                    <tr className="border-t border-slate-100" key={member.id}>
                      <td className="px-5 py-4">
                        <p className="font-black">{member.nome}</p>
                        <p className="mt-1 text-xs text-slate-500">{member.cargo || "Membro"}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{member.whatsapp || member.telefone || member.email || "-"}</td>
                      <td className="px-5 py-4 text-slate-600">{member.ministerio || "-"}</td>
                      <td className="px-5 py-4 text-slate-600">{dateBR(member.data_entrada)}</td>
                      <td className="px-5 py-4"><Status value={member.situacao} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {(members ?? []).map((member: any) => (
                <article className="rounded-2xl bg-slate-50 p-4" key={member.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{member.nome}</p>
                      <p className="mt-1 text-sm text-slate-500">{member.cargo || member.ministerio || "Membro"}</p>
                    </div>
                    <Status value={member.situacao} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{member.whatsapp || member.telefone || member.email || "Sem contato informado"}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  maxLength
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  maxLength?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input
        className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-emerald-600"
        defaultValue={defaultValue}
        maxLength={maxLength}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function Status({ value }: { value: string }) {
  const active = value === "ativo";
  return (
    <span className={\`inline-flex rounded-full px-3 py-1 text-xs font-black \${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}\`}>
      {value}
    </span>
  );
}
