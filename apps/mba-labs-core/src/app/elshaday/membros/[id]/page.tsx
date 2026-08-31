import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, KeyRound, Mail, MapPin, PencilLine, Phone, ShieldCheck, UserRoundCheck } from "lucide-react";
import {
  createElshadayAccess,
  linkElshadayMemberAccess,
  setElshadayMemberStatus,
  updateElshadayMember
} from "../../actions";
import {
  dateBR,
  hasElshadayRole,
  requireElshadayContext,
  requireElshadayRole,
  roleLabel,
  type ElshadayRole
} from "@/lib/elshaday";

export const dynamic = "force-dynamic";

const ROLES: Array<{ value: ElshadayRole; label: string }> = [
  { value: "admin", label: "Administrador" },
  { value: "pastor", label: "Pastor" },
  { value: "tesouraria", label: "Tesouraria" },
  { value: "secretaria", label: "Secretaria" },
  { value: "lider", label: "Líder" },
  { value: "membro", label: "Membro" }
];

export default async function ElshadayMemberDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const context = await requireElshadayContext(`/elshaday/membros/${id}`);
  requireElshadayRole(context, ["admin", "pastor", "secretaria", "lider"]);

  const canManage = hasElshadayRole(context.papel, ["admin", "pastor", "secretaria"]);
  const canManageAccess = context.papel === "admin";

  const { data: member, error } = await context.admin
    .from("igreja_membros")
    .select("*")
    .eq("id", id)
    .eq("igreja_id", context.igreja.id)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar membro: ${error.message}`);
  if (!member) {
    return (
      <div className="mx-auto max-w-3xl rounded-[28px] border border-slate-200 bg-white p-8 text-center">
        <p className="font-black">Membro não encontrado.</p>
        <Link className="mt-4 inline-flex font-black text-[#176445]" href="/elshaday/membros">Voltar para membros</Link>
      </div>
    );
  }

  let accessUsers: any[] = [];
  let currentAccess: any = null;

  if (canManageAccess && context.igreja.empresa_id) {
    const { data: app } = await context.admin
      .from("core_apps")
      .select("id")
      .eq("slug", "elshaday")
      .maybeSingle();

    if (app?.id) {
      const { data: permissions, error: permissionsError } = await context.admin
        .from("core_usuario_app_permissoes")
        .select("usuario_id,perfil_app,status")
        .eq("empresa_id", context.igreja.empresa_id)
        .eq("app_id", app.id);

      if (permissionsError) throw new Error(`Falha ao carregar acessos: ${permissionsError.message}`);

      const userIds = (permissions ?? []).map((row: any) => String(row.usuario_id));
      const { data: users, error: usersError } = userIds.length
        ? await context.admin
            .from("core_usuarios")
            .select("id,auth_user_id,nome,email,status")
            .eq("empresa_id", context.igreja.empresa_id)
            .in("id", userIds)
            .order("nome")
        : { data: [], error: null };

      if (usersError) throw new Error(`Falha ao carregar usuários: ${usersError.message}`);

      const permissionByUser = new Map<string, any>(
        (permissions ?? []).map((row: any) => [String(row.usuario_id), row])
      );

      accessUsers = (users ?? [])
        .map((user: any) => ({
          ...user,
          permission: permissionByUser.get(String(user.id))
        }))
        .filter((user: any) => user.auth_user_id && user.permission?.status === "ativo");

      currentAccess = member.user_id
        ? accessUsers.find((user: any) => String(user.auth_user_id) === String(member.user_id)) ?? null
        : null;
    }
  }

  const ok = readParam(query.ok);
  const errorMessage = readParam(query.erro);

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link className="inline-flex items-center gap-2 text-sm font-black text-[#176445]" href="/elshaday/membros">
            <ArrowLeft size={17} /> Voltar para membros
          </Link>
          <h1 className="mt-3 text-3xl font-black">{member.nome}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Status value={member.situacao} />
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {member.cargo || "Membro"}
            </span>
            {member.ministerio ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                {member.ministerio}
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <UserRoundCheck size={25} />
        </div>
      </header>

      {ok ? <Message kind="success">{successMessage(ok)}</Message> : null}
      {errorMessage ? <Message kind="error">{errorMessage}</Message> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Info icon={<Phone size={18} />} label="Telefone/WhatsApp" value={member.whatsapp || member.telefone || "-"} />
        <Info icon={<Mail size={18} />} label="E-mail" value={member.email || "-"} />
        <Info icon={<MapPin size={18} />} label="Localização" value={[member.bairro, member.cidade, member.estado].filter(Boolean).join(" · ") || "-"} />
        <Info icon={<ShieldCheck size={18} />} label="Acesso digital" value={member.user_id ? "Vinculado" : "Sem login"} />
      </section>

      <section className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
        <h2 className="font-black">Ficha do membro</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Data label="Nascimento" value={dateBR(member.data_nascimento)} />
          <Data label="CPF" value={member.cpf || "-"} />
          <Data label="Data de entrada" value={dateBR(member.data_entrada)} />
          <Data label="Conversão" value={dateBR(member.data_conversao)} />
          <Data label="Batismo" value={dateBR(member.data_batismo)} />
          <Data label="Endereço" value={[member.endereco, member.bairro, member.cidade, member.estado].filter(Boolean).join(" · ") || "-"} />
        </div>

        {context.papel !== "lider" ? (
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Observações</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{member.observacoes || "Nenhuma observação registrada."}</p>
          </div>
        ) : null}
      </section>

      {canManage ? (
        <details className="rounded-[28px] border border-emerald-950/10 bg-white p-5" open={false}>
          <summary className="cursor-pointer list-none font-black">
            <span className="inline-flex items-center gap-2"><PencilLine size={18} /> Editar ficha</span>
          </summary>
          <form action={updateElshadayMember} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="membro_id" value={member.id} />
            <input type="hidden" name="return_to" value={`/elshaday/membros/${member.id}`} />
            <Field label="Nome completo" name="nome" defaultValue={member.nome} required />
            <Field label="Nascimento" name="data_nascimento" type="date" defaultValue={member.data_nascimento || ""} />
            <Field label="CPF" name="cpf" defaultValue={member.cpf || ""} />
            <Field label="Telefone" name="telefone" defaultValue={member.telefone || ""} />
            <Field label="WhatsApp" name="whatsapp" defaultValue={member.whatsapp || ""} />
            <Field label="E-mail" name="email" type="email" defaultValue={member.email || ""} />
            <Field label="Data de entrada" name="data_entrada" type="date" defaultValue={member.data_entrada || ""} />
            <Field label="Data de conversão" name="data_conversao" type="date" defaultValue={member.data_conversao || ""} />
            <Field label="Data de batismo" name="data_batismo" type="date" defaultValue={member.data_batismo || ""} />
            <Field label="Cargo/Função" name="cargo" defaultValue={member.cargo || ""} />
            <Field label="Ministério" name="ministerio" defaultValue={member.ministerio || ""} />
            <Field label="Endereço" name="endereco" defaultValue={member.endereco || ""} />
            <Field label="Bairro" name="bairro" defaultValue={member.bairro || ""} />
            <Field label="Cidade" name="cidade" defaultValue={member.cidade || ""} />
            <Field label="UF" name="estado" defaultValue={member.estado || ""} maxLength={2} />
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Situação
              <select className="input" name="situacao" defaultValue={member.situacao}>
                <option value="ativo">Ativo</option>
                <option value="afastado">Afastado</option>
                <option value="visitante">Visitante</option>
                <option value="transferido">Transferido</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2 lg:col-span-3">
              Observações
              <textarea className="textarea" defaultValue={member.observacoes || ""} name="observacoes" />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <button className="min-h-12 rounded-2xl bg-[#123d2d] px-6 font-black text-white" type="submit">
                Salvar alterações
              </button>
            </div>
          </form>
        </details>
      ) : null}

      {canManage ? (
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-black text-amber-950">Situação do cadastro</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900/80">
            Inativar preserva todo o histórico e é preferível a excluir o registro.
          </p>
          <form action={setElshadayMemberStatus} className="mt-4">
            <input type="hidden" name="membro_id" value={member.id} />
            <input type="hidden" name="return_to" value={`/elshaday/membros/${member.id}`} />
            <input type="hidden" name="situacao" value={member.situacao === "inativo" ? "ativo" : "inativo"} />
            <button
              className={`min-h-11 rounded-xl px-5 text-sm font-black ${
                member.situacao === "inativo"
                  ? "bg-emerald-700 text-white"
                  : "border border-amber-300 bg-white text-amber-900"
              }`}
              type="submit"
            >
              {member.situacao === "inativo" ? "Reativar membro" : "Inativar membro"}
            </button>
          </form>
        </section>
      ) : null}

      {canManageAccess ? (
        <section className="rounded-[28px] border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-900 text-white">
              <KeyRound size={19} />
            </div>
            <div>
              <h2 className="font-black text-sky-950">Login e acesso do membro</h2>
              <p className="mt-1 text-sm leading-6 text-sky-900/75">
                Vincule esta ficha a um acesso já criado ou envie um convite diretamente daqui.
              </p>
            </div>
          </div>

          {currentAccess ? (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-white p-4">
              <p className="font-black">{currentAccess.nome}</p>
              <p className="mt-1 text-sm text-slate-500">{currentAccess.email}</p>
              <p className="mt-2 text-xs font-black text-sky-800">
                Perfil: {roleLabel(String(currentAccess.permission?.perfil_app || "membro") as ElshadayRole)}
              </p>
            </div>
          ) : member.user_id ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Existe um vínculo de autenticação, mas o acesso ativo do Elshaday não foi localizado. Você pode escolher outro acesso abaixo.
            </div>
          ) : null}

          <form action={linkElshadayMemberAccess} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <input type="hidden" name="membro_id" value={member.id} />
            <input type="hidden" name="return_to" value={`/elshaday/membros/${member.id}`} />
            <select
              className="input"
              name="usuario_id"
              defaultValue={currentAccess?.id ?? ""}
            >
              <option value="">Sem vínculo com login</option>
              {accessUsers.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.nome} · {user.email} · {roleLabel(String(user.permission?.perfil_app || "membro") as ElshadayRole)}
                </option>
              ))}
            </select>
            <button className="rounded-2xl bg-sky-900 px-5 font-black text-white" type="submit">
              Atualizar vínculo
            </button>
          </form>

          {!member.user_id ? (
            member.email ? (
              <details className="mt-5 rounded-2xl border border-sky-200 bg-white p-4">
                <summary className="cursor-pointer list-none font-black">Criar acesso para este membro</summary>
                <form action={createElshadayAccess} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input type="hidden" name="nome" value={member.nome} />
                  <input type="hidden" name="email" value={member.email} />
                  <input type="hidden" name="telefone" value={member.telefone || member.whatsapp || ""} />
                  <input type="hidden" name="membro_id" value={member.id} />
                  <input type="hidden" name="return_to" value={`/elshaday/membros/${member.id}`} />
                  <select className="input" name="papel" defaultValue="membro">
                    {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                  <button className="rounded-2xl bg-[#123d2d] px-5 font-black text-white" type="submit">
                    Criar e enviar convite
                  </button>
                </form>
              </details>
            ) : (
              <p className="mt-5 rounded-2xl bg-white p-4 text-sm text-slate-600">
                Informe um e-mail na ficha para poder criar um novo login para este membro.
              </p>
            )
          ) : null}
        </section>
      ) : null}

      <style>{`
        .input {
          min-height: 3rem;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0 1rem;
          outline: none;
        }
        .textarea {
          min-height: 6rem;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 1rem;
          outline: none;
        }
        .input:focus, .textarea:focus { border-color: rgb(5 150 105); }
      `}</style>
    </div>
  );
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function successMessage(code: string) {
  const map: Record<string, string> = {
    cadastrado: "Membro cadastrado com sucesso.",
    atualizado: "Ficha atualizada com sucesso.",
    situacao: "Situação do membro atualizada.",
    vinculo: "Vínculo com o acesso digital atualizado.",
    convite: "Acesso criado e convite enviado para o e-mail do membro."
  };
  return map[code] ?? "Alteração concluída.";
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required = false,
  maxLength
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input className="input" defaultValue={defaultValue} maxLength={maxLength} name={name} required={required} type={type} />
    </label>
  );
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="rounded-[24px] border border-emerald-950/10 bg-white p-5">
      <div className="text-[#176445]">{icon}</div>
      <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold">{value}</p>
    </article>
  );
}

function Message({ kind, children }: { kind: "success" | "error"; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 text-sm font-bold ${
      kind === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-red-200 bg-red-50 text-red-800"
    }`}>
      {children}
    </div>
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
    <span className={`rounded-full px-3 py-1 text-xs font-black ${styles[value] ?? styles.inativo}`}>
      {value}
    </span>
  );
}
