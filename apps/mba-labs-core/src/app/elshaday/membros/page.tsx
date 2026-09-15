import Link from "next/link";
import { Link2, FileSpreadsheet, Search, Upload, UserCheck, UserPlus, UsersRound } from "lucide-react";
import { createElshadayMember } from "../actions";
import { importElshadayMembers } from "../completion-actions";
import { ElshadaySubmitButton } from "../ElshadaySubmitButton";
import { ShareMemberRegistration } from "./ShareMemberRegistration";
import { createElshadayMemberRegistrationToken } from "@/lib/elshaday-member-registration";
import {
  dateBR,
  hasElshadayRole,
  requireElshadayContext,
  requireElshadayRole
} from "@/lib/elshaday";

export const dynamic = "force-dynamic";

export default async function ElshadayMembersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = await requireElshadayContext("/elshaday/membros");
  requireElshadayRole(context, ["admin", "pastor", "tesouraria", "secretaria", "lider"]);
  const canManage = hasElshadayRole(context.papel, ["admin", "pastor", "tesouraria", "secretaria", "lider"]);
  const canShareRegistration = hasElshadayRole(context.papel, ["admin", "pastor", "tesouraria", "secretaria"]);
  const registrationPath = canShareRegistration
    ? "/cadastro-membro?convite=" + createElshadayMemberRegistrationToken(context.igreja.id)
    : "";

  const [membersResult, rolesResult, ministriesResult, linksResult] = await Promise.all([
    context.admin
      .from("igreja_membros")
      .select("id,user_id,nome,data_nascimento,sexo,telefone,whatsapp,email,cargo,cargo_id,ministerio,situacao,data_entrada")
      .eq("igreja_id", context.igreja.id)
      .order("nome", { ascending: true }),
    context.admin
      .from("igreja_cargos")
      .select("id,nome,ordem,ativo")
      .eq("igreja_id", context.igreja.id)
      .order("ordem")
      .order("nome"),
    context.admin
      .from("igreja_ministerios")
      .select("id,nome,ativo")
      .eq("igreja_id", context.igreja.id)
      .order("nome"),
    context.admin
      .from("igreja_membro_ministerios")
      .select("membro_id,ministerio_id")
      .eq("igreja_id", context.igreja.id)
  ]);

  const firstError = membersResult.error ?? rolesResult.error ?? ministriesResult.error ?? linksResult.error;
  if (firstError) throw new Error(`Falha ao carregar membros: ${firstError.message}`);

  const roles = rolesResult.data ?? [];
  const ministries = ministriesResult.data ?? [];
  const roleById = new Map<string, string>(
    roles.map((role: any): [string, string] => [String(role.id), String(role.nome)])
  );
  const ministryById = new Map<string, string>(
    ministries.map((ministry: any): [string, string] => [String(ministry.id), String(ministry.nome)])
  );
  const ministryIdsByMember = new Map<string, Set<string>>();
  for (const link of linksResult.data ?? []) {
    const memberId = String(link.membro_id);
    if (!ministryIdsByMember.has(memberId)) ministryIdsByMember.set(memberId, new Set());
    ministryIdsByMember.get(memberId)?.add(String(link.ministerio_id));
  }

  const allMembers = (membersResult.data ?? []).map((member: any) => {
    const ministryIds = ministryIdsByMember.get(String(member.id)) ?? new Set<string>();
    const ministryNames = Array.from(ministryIds).map((id) => ministryById.get(id)).filter(Boolean) as string[];
    return {
      ...member,
      cargo_nome: roleById.get(String(member.cargo_id ?? "")) || member.cargo_nome || member.cargo || "Membro",
      ministerio_ids: ministryIds,
      ministerios: ministryNames.length ? ministryNames : String(member.ministerio ?? "").split(/[,;/]/).map((name) => name.trim()).filter(Boolean)
    };
  });

  const q = readParam(params.q).toLocaleLowerCase("pt-BR");
  const situacao = readParam(params.situacao);
  const cargoId = readParam(params.cargo_id);
  const ministerioId = readParam(params.ministerio_id);
  const acesso = readParam(params.acesso);
  const sexo = readParam(params.sexo);
  const faixaEtaria = readParam(params.faixa_etaria);

  const filtered = allMembers.filter((member: any) => {
    if (situacao && String(member.situacao) !== situacao) return false;
    if (cargoId && String(member.cargo_id ?? "") !== cargoId) return false;
    if (ministerioId && !member.ministerio_ids.has(ministerioId)) return false;
    if (acesso === "com" && !member.user_id) return false;
    if (acesso === "sem" && member.user_id) return false;
    if (sexo && String(member.sexo ?? "") !== sexo) return false;
    if (faixaEtaria && !matchesAgeRange(member.data_nascimento, faixaEtaria)) return false;
    if (!q) return true;

    const haystack = [
      member.nome,
      member.email,
      member.telefone,
      member.whatsapp,
      member.cargo_nome,
      ...member.ministerios
    ]
      .map((value) => String(value ?? "").toLocaleLowerCase("pt-BR"))
      .join(" ");

    return haystack.includes(q);
  });

  const activeCount = allMembers.filter((member: any) => member.situacao === "ativo").length;
  const visitorCount = allMembers.filter((member: any) => member.situacao === "visitante").length;
  const linkedCount = allMembers.filter((member: any) => Boolean(member.user_id)).length;

  return (
    <div className="mx-auto grid min-w-0 max-w-7xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Pessoas</p>
          <h1 className="mt-1 text-3xl font-black">Gestão de membros</h1>
          <p className="mt-2 text-slate-600">
            Cadastro, acompanhamento, situação e vínculo com o acesso digital da igreja.
          </p>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <UsersRound size={25} />
        </div>
      </header>

      {readParam(params.ok) ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          {memberSuccess(readParam(params.ok))}
        </div>
      ) : null}
      {readParam(params.erro) ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          {readParam(params.erro)}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Membros ativos" value={activeCount} />
        <Kpi label="Visitantes" value={visitorCount} />
        <Kpi label="Com acesso digital" value={linkedCount} />
      </section>

      {canShareRegistration ? (
        <section className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] md:items-center">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-white text-[#176445] shadow-sm">
                <Link2 size={20} />
              </div>
              <div>
                <h2 className="font-black text-emerald-950">Link para cadastro de membros</h2>
                <p className="mt-1 text-sm text-emerald-900/80">
                  Envie este link para o membro preencher a própria ficha.
                </p>
              </div>
            </div>
            <ShareMemberRegistration registrationPath={registrationPath} />
          </div>
        </section>
      ) : null}

      {canManage ? (
        <details className="rounded-[28px] border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <summary className="cursor-pointer list-none font-black text-sky-950">
            <span className="inline-flex items-center gap-2">
              <FileSpreadsheet size={19} /> Importar membros por CSV/XLSX
            </span>
          </summary>
          <form action={importElshadayMembers} className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Arquivo
              <input
                className="rounded-2xl border border-sky-200 bg-white p-3"
                name="arquivo"
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
              />
            </label>
            <div className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-slate-600">
              Colunas reconhecidas: <strong>nome</strong>, nascimento/data_nascimento, CPF, telefone,
              WhatsApp, e-mail, endereço, bairro, cidade, UF/estado, cargo, ministério, situação e observações.
              Registros já existentes por e-mail ou CPF são ignorados.
            </div>
            <div className="flex flex-wrap gap-2">
              <ElshadaySubmitButton className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-sky-900 px-5 font-black text-white" pendingLabel="Importando...">
                <Upload size={17} /> Importar arquivo
              </ElshadaySubmitButton>
              <a
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-5 font-black text-sky-900"
                href="/api/elshaday/membros/modelo-importacao"
              >
                <FileSpreadsheet size={17} /> Baixar modelo XLSX
              </a>
            </div>
          </form>
        </details>
      ) : null}

      {canManage ? (
        <details
          className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm"
        >
          <summary className="cursor-pointer list-none font-black">
            <span className="inline-flex items-center gap-2">
              <UserPlus size={19} className="text-[#176445]" />
              Cadastrar novo membro
            </span>
          </summary>
          <form action={createElshadayMember} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome completo" name="nome" required />
            <Field label="Nascimento" name="data_nascimento" type="date" />
            <Field label="CPF" name="cpf" />
            <Field label="Telefone" name="telefone" />
            <Field label="WhatsApp" name="whatsapp" />
            <Field label="E-mail" name="email" type="email" />
            <Field label="Data de entrada" name="data_entrada" type="date" />
            <Field label="Data de conversão" name="data_conversao" type="date" />
            <Field label="Data de batismo" name="data_batismo" type="date" />
            <Field label="Endereço" name="endereco" />
            <Field label="Bairro" name="bairro" />
            <Field label="Cidade" name="cidade" defaultValue="Palmas" />
            <Field label="UF" name="estado" defaultValue="TO" maxLength={2} />
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Situação
              <select className="input w-full min-w-0" name="situacao" defaultValue="ativo">
                <option value="ativo">Ativo</option>
                <option value="afastado">Afastado</option>
                <option value="visitante">Visitante</option>
                <option value="transferido">Transferido</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2 lg:col-span-3">
              Observações
              <textarea className="textarea" name="observacoes" />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <ElshadaySubmitButton className="min-h-12 rounded-2xl bg-[#123d2d] px-6 font-black text-white" pendingLabel="Salvando membro...">
                Salvar e abrir ficha
              </ElshadaySubmitButton>
            </div>
          </form>
        </details>
      ) : null}

      <section className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm">
        <details open={Boolean(q || situacao || cargoId || ministerioId || acesso || sexo || faixaEtaria)} className="group">
          <summary className="cursor-pointer list-none font-black text-slate-900">
            <span className="inline-flex items-center gap-2"><Search size={18} className="text-[#176445]" /> Busca e filtros</span>
          </summary>
          <form className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
            <label className="relative sm:col-span-2 lg:col-span-4">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
              <input className="input w-full pl-11" defaultValue={readParam(params.q)} name="q" placeholder="Nome, telefone, e-mail, cargo ou ministério" />
            </label>
            <select className="input" defaultValue={cargoId} name="cargo_id">
              <option value="">Todos os cargos</option>
              {roles.map((role: any) => <option key={role.id} value={role.id}>{role.nome}</option>)}
            </select>
            <select className="input" defaultValue={ministerioId} name="ministerio_id">
              <option value="">Todos os ministérios</option>
              {ministries.map((ministry: any) => <option key={ministry.id} value={ministry.id}>{ministry.nome}</option>)}
            </select>
            <select className="input" defaultValue={situacao} name="situacao">
              <option value="">Todas as situações</option>
              <option value="ativo">Ativos</option>
              <option value="afastado">Afastados</option>
              <option value="visitante">Visitantes</option>
              <option value="transferido">Transferidos</option>
              <option value="inativo">Inativos</option>
            </select>
            <select className="input" defaultValue={acesso} name="acesso">
              <option value="">Com ou sem acesso</option>
              <option value="com">Com acesso ao app</option>
              <option value="sem">Sem acesso ao app</option>
            </select>
            <select className="input" defaultValue={sexo} name="sexo">
              <option value="">Todos os sexos</option>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
              <option value="outro">Outro</option>
            </select>
            <select className="input" defaultValue={faixaEtaria} name="faixa_etaria">
              <option value="">Todas as faixas etárias</option>
              <option value="crianca">Crianças (0–11)</option>
              <option value="adolescente">Adolescentes (12–17)</option>
              <option value="adulto">Adultos (18–59)</option>
              <option value="idoso">Idosos (60+)</option>
            </select>
            <button className="min-h-12 rounded-2xl bg-slate-900 px-5 font-black text-white sm:col-span-2" type="submit">
              Aplicar filtros
            </button>
          </form>
          {(q || situacao || cargoId || ministerioId || acesso || sexo || faixaEtaria) ? (
            <div className="mt-3 flex justify-end">
              <Link className="text-sm font-black text-[#176445]" href="/elshaday/membros">Limpar filtros</Link>
            </div>
          ) : null}
        </details>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-emerald-950/10 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="font-black">Membros cadastrados</h2>
            <p className="mt-1 text-sm text-slate-600">{filtered.length} exibido(s) de {allMembers.length}</p>
          </div>
          <UserCheck size={21} className="text-[#176445]" />
        </div>

        {filtered.length === 0 ? (
          <p className="p-8 text-center text-slate-600">Nenhum membro encontrado.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-5 py-4">Nome</th>
                    <th className="px-5 py-4">Contato</th>
                    <th className="px-5 py-4">Ministério</th>
                    <th className="px-5 py-4">Entrada</th>
                    <th className="px-5 py-4">Acesso</th>
                    <th className="px-5 py-4">Situação</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((member: any) => (
                    <tr className="border-t border-slate-100" key={member.id}>
                      <td className="px-5 py-4">
                        <p className="font-black">{member.nome}</p>
                        <p className="mt-1 text-xs text-slate-600">{member.cargo_nome || member.cargo || "Membro"}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {member.whatsapp || member.telefone || member.email || "-"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{member.ministerios.join(", ") || member.ministerio || "-"}</td>
                      <td className="px-5 py-4 text-slate-600">{dateBR(member.data_entrada)}</td>
                      <td className="px-5 py-4">
                        <AccessBadge linked={Boolean(member.user_id)} />
                      </td>
                      <td className="px-5 py-4"><Status value={member.situacao} /></td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black"
                          href={`/elshaday/membros/${member.id}`}
                        >
                          Abrir ficha
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 md:hidden">
              {filtered.map((member: any) => (
                <Link
                  className="rounded-2xl bg-slate-50 p-4 transition active:scale-[.99]"
                  href={`/elshaday/membros/${member.id}`}
                  key={member.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{member.nome}</p>
                      <p className="mt-1 text-sm text-slate-600">{member.cargo_nome || member.ministerios[0] || "Membro"}</p>
                    </div>
                    <Status value={member.situacao} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {member.whatsapp || member.telefone || member.email || "Sem contato informado"}
                  </p>
                  <div className="mt-3">
                    <AccessBadge linked={Boolean(member.user_id)} />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      <style>{`
        .input {
          min-height: 3rem;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0 1rem;
          outline: none;
        }
        .input:focus, .textarea:focus { border-color: rgb(5 150 105); }
        .textarea {
          min-height: 6rem;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 1rem;
          outline: none;
        }
      `}</style>
    </div>
  );
}

function matchesAgeRange(birthDate: string | null, range: string) {
  if (!birthDate) return false;
  const birth = new Date(birthDate + "T12:00:00Z");
  if (Number.isNaN(birth.getTime())) return false;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  if (range === "crianca") return age >= 0 && age <= 11;
  if (range === "adolescente") return age >= 12 && age <= 17;
  if (range === "adulto") return age >= 18 && age <= 59;
  if (range === "idoso") return age >= 60;
  return true;
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function memberSuccess(code: string) {
  if (code.startsWith("importados:")) {
    const parts = code.split(":");
    return "Importação concluída: " + (parts[1] ?? "0") + " membro(s) importado(s) e " + (parts[2] ?? "0") + " ignorado(s).";
  }
  if (code === "excluido") {
    return "Cadastro e convite pendente excluídos. O mesmo e-mail já pode receber um novo convite.";
  }
  return "Operação concluída.";
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
        className="input w-full min-w-0"
        defaultValue={defaultValue}
        maxLength={maxLength}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[24px] border border-emerald-950/10 bg-white p-5">
      <p className="text-sm font-bold text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </article>
  );
}

function AccessBadge({ linked }: { linked: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
      linked ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"
    }`}>
      {linked ? "Vinculado" : "Sem login"}
    </span>
  );
}

function Status({ value }: { value: string }) {
  const styles: Record<string, string> = {
    ativo: "bg-emerald-100 text-emerald-800",
    visitante: "bg-sky-100 text-sky-800",
    afastado: "bg-amber-100 text-amber-800",
    transferido: "bg-violet-100 text-violet-800",
    inativo: "bg-slate-100 text-slate-600"
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${styles[value] ?? styles.inativo}`}>
      {value}
    </span>
  );
}
