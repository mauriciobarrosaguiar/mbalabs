import {
  Link2,
  LockKeyhole,
  MailPlus,
  ShieldCheck,
  UserPlus,
  UserRoundCog
} from "lucide-react";
import {
  createElshadayAccess,
  linkElshadayAccessMember,
  sendElshadayPasswordEmail,
  setElshadayAccessStatus,
  updateElshadayAccessRole
} from "../actions";
import { ElshadaySubmitButton } from "../ElshadaySubmitButton";
import {
  requireElshadayContext,
  requireElshadayRole,
  roleLabel,
  type ElshadayRole
} from "@/lib/elshaday";

export const dynamic = "force-dynamic";

const ROLE_OPTIONS: Array<{ value: ElshadayRole; label: string; detail: string }> = [
  { value: "admin", label: "Administrador", detail: "Gerencia acessos e todos os módulos da igreja." },
  { value: "pastor", label: "Pastor", detail: "Membros, cultos, pregações e acompanhamento." },
  { value: "tesouraria", label: "Tesouraria", detail: "Dízimos, ofertas e relatórios financeiros." },
  { value: "secretaria", label: "Secretaria", detail: "Cadastro de membros, cultos e organização." },
  { value: "lider", label: "Líder", detail: "Membros, cultos e pregações conforme o ministério." },
  { value: "membro", label: "Membro", detail: "Bíblia, agenda, pregações e recursos do membro." }
];

export default async function ElshadayAccessPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = await requireElshadayContext("/elshaday/acessos");
  requireElshadayRole(context, ["admin"]);

  if (!context.igreja.empresa_id) {
    throw new Error("A igreja ainda não está vinculada a uma organização do MBA Labs.");
  }

  const { data: app, error: appError } = await context.admin
    .from("core_apps")
    .select("id")
    .eq("slug", "elshaday")
    .maybeSingle();

  if (appError || !app?.id) {
    throw new Error("O app Elshaday não foi localizado no MBA Labs.");
  }

  const [usersResult, permissionsResult, profilesResult, membersResult] = await Promise.all([
    context.admin
      .from("core_usuarios")
      .select("id,auth_user_id,nome,email,telefone,status,created_at")
      .eq("empresa_id", context.igreja.empresa_id)
      .order("nome"),
    context.admin
      .from("core_usuario_app_permissoes")
      .select("id,usuario_id,perfil_app,status,updated_at")
      .eq("empresa_id", context.igreja.empresa_id)
      .eq("app_id", app.id),
    context.admin
      .from("igreja_perfis")
      .select("user_id,papel,ativo,updated_at")
      .eq("igreja_id", context.igreja.id),
    context.admin
      .from("igreja_membros")
      .select("id,nome,email,telefone,whatsapp,user_id,situacao")
      .eq("igreja_id", context.igreja.id)
      .order("nome")
  ]);

  const firstError =
    usersResult.error ?? permissionsResult.error ?? profilesResult.error ?? membersResult.error;
  if (firstError) throw new Error(`Falha ao carregar acessos: ${firstError.message}`);

  const users = usersResult.data ?? [];
  const permissions = permissionsResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const members = membersResult.data ?? [];

  const permissionByUser = new Map<string, any>(
    permissions.map((row: any) => [String(row.usuario_id), row])
  );
  const profileByAuth = new Map<string, any>(
    profiles.map((row: any) => [String(row.user_id), row])
  );
  const memberByAuth = new Map<string, any>(
    members.filter((row: any) => row.user_id).map((row: any) => [String(row.user_id), row])
  );

  const rows = users
    .map((user: any) => {
      const permission = permissionByUser.get(String(user.id));
      const profile = user.auth_user_id ? profileByAuth.get(String(user.auth_user_id)) : null;
      if (!permission && !profile) return null;
      return {
        ...user,
        permission,
        profile,
        member: user.auth_user_id ? memberByAuth.get(String(user.auth_user_id)) : null,
        papel: String(profile?.papel ?? permission?.perfil_app ?? "membro") as ElshadayRole,
        accessStatus: String(permission?.status ?? (profile?.ativo ? "ativo" : "bloqueado"))
      };
    })
    .filter(Boolean) as any[];

  const active = rows.filter((row) => row.accessStatus === "ativo").length;
  const blocked = rows.filter((row) => row.accessStatus !== "ativo").length;
  const linked = rows.filter((row) => row.member).length;

  const ok = typeof params.ok === "string" ? params.ok : "";
  const error = typeof params.erro === "string" ? params.erro : "";

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Administração</p>
          <h1 className="mt-1 text-3xl font-black">Acessos e perfis</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Controle quem entra no Elshaday Gestão e exatamente o que cada pessoa pode acessar.
          </p>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <ShieldCheck size={25} />
        </div>
      </header>

      {ok ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          {successMessage(ok)}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Acessos ativos" value={active} detail="Podem entrar no Elshaday" />
        <Kpi label="Bloqueados" value={blocked} detail="Sem acesso ao app" />
        <Kpi label="Vinculados a membro" value={linked} detail="Login ligado à ficha de membro" />
      </section>

      <section className="rounded-[26px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <div className="flex gap-3">
          <LockKeyhole className="mt-0.5 shrink-0" size={20} />
          <div>
            <p className="font-black">Administrador do Elshaday não vira Admin da empresa</p>
            <p className="mt-1">
              O papel Administrador concede poderes somente dentro da igreja. Isso evita que um usuário
              do Elshaday ganhe acesso administrativo a outros sistemas do MBA Labs.
            </p>
          </div>
        </div>
      </section>

      <details className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer list-none font-black">
          <span className="inline-flex items-center gap-2">
            <UserPlus size={19} className="text-[#176445]" />
            Criar ou liberar novo acesso
          </span>
        </summary>

        <form action={createElshadayAccess} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome completo" name="nome" required />
          <Field label="E-mail" name="email" type="email" required />
          <Field label="Telefone" name="telefone" />

          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Perfil no Elshaday
            <select className="input" name="papel" defaultValue="membro" required>
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">
            Vincular a membro já cadastrado
            <select className="input" name="membro_id" defaultValue="">
              <option value="">Não vincular agora</option>
              {members.map((member: any) => (
                <option key={member.id} value={member.id}>
                  {member.nome}{member.user_id ? " · já possui login" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2 lg:col-span-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Para um e-mail novo, o MBA Labs enviará um convite seguro para a própria pessoa definir a senha.
            Se o e-mail já pertencer a um usuário desta igreja, o acesso ao Elshaday será atualizado sem criar duplicidade.
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <ElshadaySubmitButton className="min-h-12 rounded-2xl bg-[#123d2d] px-6 font-black text-white" pendingLabel="Criando acesso...">
              Criar acesso e enviar convite
            </ElshadaySubmitButton>
          </div>
        </form>
      </details>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">Usuários</p>
            <h2 className="mt-1 text-2xl font-black">Quem pode acessar a igreja</h2>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
            {rows.length} acessos
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            <UserRoundCog className="mx-auto mb-3" size={30} />
            Nenhum acesso da igreja foi cadastrado ainda.
          </div>
        ) : (
          <div className="grid gap-4">
            {rows.map((row) => {
              const isSelf = String(row.auth_user_id ?? "") === context.current.authUser.id;
              const isActive = row.accessStatus === "ativo";
              return (
                <article className="rounded-[28px] border border-emerald-950/10 bg-white p-5" key={row.id}>
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black">{row.nome}</h3>
                        <Status active={isActive} />
                        {isSelf ? (
                          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-800">Você</span>
                        ) : null}
                      </div>
                      <p className="mt-1 break-all text-sm text-slate-500">{row.email}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">{roleLabel(row.papel)}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                          {row.member ? `Membro: ${row.member.nome}` : "Sem vínculo com membro"}
                        </span>
                      </div>
                    </div>

                    <form action={setElshadayAccessStatus}>
                      <input type="hidden" name="usuario_id" value={row.id} />
                      <input type="hidden" name="status" value={isActive ? "bloqueado" : "ativo"} />
                      <button
                        className={`min-h-10 rounded-xl px-4 text-sm font-black ${
                          isActive
                            ? "border border-red-200 bg-red-50 text-red-700"
                            : "bg-emerald-700 text-white"
                        }`}
                        disabled={isSelf}
                        title={isSelf ? "Você não pode bloquear o próprio acesso." : undefined}
                        type="submit"
                      >
                        {isActive ? "Bloquear acesso" : "Reativar acesso"}
                      </button>
                    </form>
                  </div>

                  <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 lg:grid-cols-3">
                    <form action={updateElshadayAccessRole} className="grid gap-2">
                      <input type="hidden" name="usuario_id" value={row.id} />
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">Perfil</label>
                      <div className="flex gap-2">
                        <select className="input min-w-0 flex-1" name="papel" defaultValue={row.papel} disabled={isSelf}>
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                        <button className="rounded-xl bg-slate-900 px-4 text-sm font-black text-white" disabled={isSelf} type="submit">
                          Salvar
                        </button>
                      </div>
                    </form>

                    <form action={linkElshadayAccessMember} className="grid gap-2">
                      <input type="hidden" name="usuario_id" value={row.id} />
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">Vínculo com membro</label>
                      <div className="flex gap-2">
                        <select className="input min-w-0 flex-1" name="membro_id" defaultValue={row.member?.id ?? ""}>
                          <option value="">Sem vínculo</option>
                          {members.map((member: any) => (
                            <option key={member.id} value={member.id}>{member.nome}</option>
                          ))}
                        </select>
                        <button className="rounded-xl border border-slate-200 bg-white px-4 text-sm font-black" type="submit">
                          <Link2 size={16} />
                        </button>
                      </div>
                    </form>

                    <form action={sendElshadayPasswordEmail} className="grid content-end">
                      <input type="hidden" name="usuario_id" value={row.id} />
                      <button className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black" type="submit">
                        <MailPlus size={17} />
                        Enviar link para definir senha
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
        <h2 className="font-black">O que cada perfil pode fazer</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ROLE_OPTIONS.map((role) => (
            <div className="rounded-2xl bg-slate-50 p-4" key={role.value}>
              <p className="font-black">{role.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{role.detail}</p>
            </div>
          ))}
        </div>
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
        .input:focus { border-color: rgb(5 150 105); }
        .input:disabled { background: rgb(248 250 252); color: rgb(100 116 139); }
      `}</style>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input className="input" name={name} required={required} type={type} />
    </label>
  );
}

function Kpi({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="rounded-[24px] border border-emerald-950/10 bg-white p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function Status({ active }: { active: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
      active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
    }`}>
      {active ? "Ativo" : "Bloqueado"}
    </span>
  );
}

function successMessage(code: string) {
  const messages: Record<string, string> = {
    convite: "Acesso criado. Se o e-mail era novo, o convite para definir senha foi enviado.",
    perfil: "Perfil atualizado com sucesso.",
    status: "Status do acesso atualizado.",
    membro: "Vínculo com o membro atualizado.",
    senha: "Link para definição de senha enviado para o e-mail do usuário."
  };
  return messages[code] ?? "Alteração concluída.";
}
