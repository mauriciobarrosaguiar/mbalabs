import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, BadgeCheck, Camera, History, KeyRound, Mail, MapPin, PencilLine, Phone, ShieldCheck, Trash2, UserRoundCheck, UsersRound } from "lucide-react";
import {
  createElshadayAccess,
  linkElshadayMemberAccess,
  setElshadayMemberStatus,
  updateElshadayMember
} from "../../actions";
import {
  addElshadayMemberRelation,
  removeElshadayMemberRelation,
  uploadElshadayMemberPhoto
} from "../../completion-actions";
import {
  changeElshadayMemberRole,
  syncElshadayMemberMinistries
} from "../hierarchy-actions";
import {
  dateBR,
  dateTimeBR,
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
  requireElshadayRole(context, ["admin", "pastor", "tesouraria", "secretaria", "lider"]);

  const canManage = hasElshadayRole(context.papel, ["admin", "pastor", "tesouraria", "secretaria", "lider"]);
  const canManageAccess = context.papel === "admin";
  const canCreateMemberAccess = hasElshadayRole(context.papel, ["admin", "pastor", "secretaria", "lider"]);
  const canChangeRole = hasElshadayRole(context.papel, ["admin", "pastor", "tesouraria"]);
  const canChangeMinistries = hasElshadayRole(context.papel, ["admin", "pastor", "tesouraria", "secretaria"]);

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

  const [
    relationsResult,
    allMembersResult,
    rolesResult,
    ministriesResult,
    memberMinistriesResult,
    historyResult
  ] = await Promise.all([
    context.admin
      .from("igreja_membro_relacoes")
      .select("id,parente_id,tipo,observacoes,created_at")
      .eq("igreja_id", context.igreja.id)
      .eq("membro_id", id)
      .order("created_at"),
    context.admin
      .from("igreja_membros")
      .select("id,nome,situacao")
      .eq("igreja_id", context.igreja.id)
      .neq("id", id)
      .order("nome"),
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
      .select("ministerio_id")
      .eq("igreja_id", context.igreja.id)
      .eq("membro_id", id),
    context.admin
      .from("igreja_membro_cargos_historico")
      .select("id,cargo_id,data_inicio,data_fim,observacao,alterado_por,alterado_em")
      .eq("igreja_id", context.igreja.id)
      .eq("membro_id", id)
      .order("data_inicio", { ascending: false })
  ]);

  const firstDetailError =
    relationsResult.error ?? allMembersResult.error ?? rolesResult.error ??
    ministriesResult.error ?? memberMinistriesResult.error ?? historyResult.error;
  if (firstDetailError) throw new Error("Falha ao carregar ficha completa: " + firstDetailError.message);

  const allMembers = allMembersResult.data ?? [];
  const memberNameById = new Map<string, string>(
    allMembers.map((item: any): [string, string] => [String(item.id), String(item.nome)])
  );
  const relations = relationsResult.data ?? [];
  const roles = rolesResult.data ?? [];
  const ministries = ministriesResult.data ?? [];
  const roleNameById = new Map<string, string>(
    roles.map((item: any): [string, string] => [String(item.id), String(item.nome)])
  );
  const ministryNameById = new Map<string, string>(
    ministries.map((item: any): [string, string] => [String(item.id), String(item.nome)])
  );
  const selectedMinistryIds = new Set<string>(
    (memberMinistriesResult.data ?? []).map((item: any) => String(item.ministerio_id))
  );
  const selectedMinistryNames = Array.from(selectedMinistryIds)
    .map((ministryId) => ministryNameById.get(ministryId))
    .filter(Boolean) as string[];
  const currentRoleName = roleNameById.get(String(member.cargo_id ?? "")) || member.cargo || "Membro";
  const history = historyResult.data ?? [];
  const actorIds = Array.from(new Set(history.map((item: any) => String(item.alterado_por ?? "")).filter(Boolean)));
  const { data: actors } = actorIds.length
    ? await context.admin.from("core_usuarios").select("auth_user_id,nome").in("auth_user_id", actorIds)
    : { data: [] };
  const actorNameById = new Map<string, string>(
    (actors ?? []).map((item: any): [string, string] => [String(item.auth_user_id), String(item.nome)])
  );

  let signedPhotoUrl: string | null = null;
  if (member.foto_url) {
    const { data: signed } = await context.admin.storage
      .from("igreja-membros")
      .createSignedUrl(String(member.foto_url), 60 * 60);
    signedPhotoUrl = signed?.signedUrl ?? null;
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
    <div className="mx-auto grid min-w-0 max-w-6xl gap-6">
      <header className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link className="inline-flex items-center gap-2 text-sm font-black text-[#176445]" href="/elshaday/membros">
            <ArrowLeft size={17} /> Voltar para membros
          </Link>
          <h1 className="mt-3 break-words text-2xl font-black leading-tight sm:text-3xl">{member.nome}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Status value={member.situacao} />
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {currentRoleName}
            </span>
            {selectedMinistryNames.map((ministry) => (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800" key={ministry}>
                {ministry}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {signedPhotoUrl ? (
            <img
              alt={"Foto de " + member.nome}
              className="size-20 rounded-2xl border border-emerald-950/10 object-cover shadow-sm"
              src={signedPhotoUrl}
            />
          ) : (
            <div className="grid size-20 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
              <UserRoundCheck size={32} />
            </div>
          )}
        </div>
      </header>

      {ok ? <Message kind="success">{successMessage(ok)}</Message> : null}
      {errorMessage ? <Message kind="error">{errorMessage}</Message> : null}

      <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          <Data label="Membro desde" value={dateBR(member.data_entrada)} />
          <Data label="Cargo" value={currentRoleName} />
          <Data label="Data da nomeação" value={dateBR(member.data_nomeacao)} />
          <Data label="Ministérios" value={selectedMinistryNames.join(" · ") || member.ministerio || "-"} />
          <Data label="Estado civil" value={member.estado_civil || "-"} />
          <Data label="Conversão" value={dateBR(member.data_conversao)} />
          <Data label="Batismo" value={dateBR(member.data_batismo)} />
          <Data label="Endereço" value={[member.endereco, member.bairro, member.cidade, member.estado].filter(Boolean).join(" · ") || "-"} />
        </div>

        {context.papel !== "lider" ? (
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-600">Observações</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{member.observacoes || "Nenhuma observação registrada."}</p>
          </div>
        ) : null}
      </section>

      <section className="grid min-w-0 gap-4 lg:grid-cols-2">
        <article className="rounded-[28px] border border-emerald-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <BadgeCheck className="text-[#176445]" size={20} />
            <h2 className="font-black">Cargo eclesiástico</h2>
          </div>
          <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Cargo atual</p>
            <p className="mt-1 text-xl font-black text-emerald-950">{currentRoleName}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-900/75">
              Nomeação: {dateBR(member.data_nomeacao)}
            </p>
          </div>

          {canChangeRole ? (
            <details className="mt-4 rounded-2xl border border-slate-200 p-4">
              <summary className="cursor-pointer list-none text-sm font-black text-[#176445]">Alterar cargo</summary>
              <form action={changeElshadayMemberRole} className="mt-4 grid min-w-0 gap-3">
                <input name="membro_id" type="hidden" value={member.id} />
                <select className="input" name="cargo_id" defaultValue={member.cargo_id ?? ""} required>
                  <option value="">Selecione o novo cargo</option>
                  {roles.filter((role: any) => role.ativo || role.id === member.cargo_id).map((role: any) => (
                    <option key={role.id} value={role.id}>{role.nome}</option>
                  ))}
                </select>
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Data de início/nomeação
                  <input className="input" defaultValue={member.data_nomeacao || new Date().toISOString().slice(0, 10)} name="data_inicio" type="date" required />
                </label>
                <input className="input" name="observacao" placeholder="Observação opcional" />
                <button className="min-h-11 rounded-xl bg-[#123d2d] px-5 text-sm font-black text-white" type="submit">
                  Confirmar alteração
                </button>
              </form>
            </details>
          ) : null}
        </article>

        <article className="rounded-[28px] border border-sky-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <UsersRound className="text-sky-800" size={20} />
            <h2 className="font-black">Ministérios</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedMinistryNames.length ? selectedMinistryNames.map((name) => (
              <span className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-black text-sky-900" key={name}>{name}</span>
            )) : <p className="text-sm text-slate-600">Nenhum ministério vinculado.</p>}
          </div>

          {canChangeMinistries ? (
            <details className="mt-4 rounded-2xl border border-slate-200 p-4">
              <summary className="cursor-pointer list-none text-sm font-black text-sky-900">Alterar ministérios</summary>
              <form action={syncElshadayMemberMinistries} className="mt-4 grid gap-2">
                <input name="membro_id" type="hidden" value={member.id} />
                {ministries.filter((ministry: any) => ministry.ativo || selectedMinistryIds.has(String(ministry.id))).map((ministry: any) => (
                  <label className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-50 px-3 text-sm font-bold" key={ministry.id}>
                    <input className="size-5 accent-[#176445]" defaultChecked={selectedMinistryIds.has(String(ministry.id))} name="ministerio_ids" type="checkbox" value={ministry.id} />
                    {ministry.nome}
                  </label>
                ))}
                <button className="mt-2 min-h-11 rounded-xl bg-sky-900 px-5 text-sm font-black text-white" type="submit">
                  Salvar ministérios
                </button>
              </form>
            </details>
          ) : null}
        </article>
      </section>

      <section className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
        <div className="flex items-center gap-2">
          <History className="text-[#176445]" size={20} />
          <h2 className="font-black">Histórico de cargos</h2>
        </div>
        {history.length ? (
          <div className="mt-4 grid gap-3">
            {history.map((item: any) => (
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-black text-slate-950">{roleNameById.get(String(item.cargo_id)) || "Cargo"}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {dateBR(item.data_inicio)} → {item.data_fim ? dateBR(item.data_fim) : "atual"}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-500">{dateTimeBR(item.alterado_em)}</span>
                </div>
                {item.observacao ? <p className="mt-2 text-sm text-slate-700">{item.observacao}</p> : null}
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Alterado por {actorNameById.get(String(item.alterado_por)) || "sistema"}
                </p>
              </article>
            ))}
          </div>
        ) : <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Nenhum histórico registrado.</p>}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
          <div className="flex items-center gap-2">
            <UsersRound size={19} className="text-[#176445]" />
            <h2 className="font-black">Família e relacionamentos</h2>
          </div>

          {relations.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Nenhum vínculo familiar registrado.
            </p>
          ) : (
            <div className="mt-4 grid gap-2">
              {relations.map((relation: any) => (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4" key={relation.id}>
                  <div>
                    <p className="font-black">{memberNameById.get(String(relation.parente_id)) || "Membro"}</p>
                    <p className="mt-1 text-xs text-slate-600">{relationLabel(relation.tipo)}</p>
                    {relation.observacoes ? (
                      <p className="mt-2 text-xs text-slate-600">{relation.observacoes}</p>
                    ) : null}
                  </div>
                  {canManage ? (
                    <form action={removeElshadayMemberRelation}>
                      <input type="hidden" name="membro_id" value={member.id} />
                      <input type="hidden" name="relacao_id" value={relation.id} />
                      <input type="hidden" name="return_to" value={"/elshaday/membros/" + member.id} />
                      <button className="grid size-9 place-items-center rounded-xl bg-white text-red-600" title="Remover vínculo">
                        <Trash2 size={16} />
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {canManage ? (
            <details className="mt-5 border-t border-slate-100 pt-4">
              <summary className="cursor-pointer list-none text-sm font-black text-[#176445]">
                Adicionar vínculo familiar
              </summary>
              <form action={addElshadayMemberRelation} className="mt-4 grid min-w-0 gap-3">
                <input type="hidden" name="membro_id" value={member.id} />
                <input type="hidden" name="return_to" value={"/elshaday/membros/" + member.id} />
                <select className="input" name="parente_id" defaultValue="" required>
                  <option value="">Selecione outro membro</option>
                  {allMembers.map((item: any) => (
                    <option key={item.id} value={item.id}>{item.nome} · {item.situacao}</option>
                  ))}
                </select>
                <select className="input" name="tipo" defaultValue="conjuge">
                  <option value="conjuge">Cônjuge</option>
                  <option value="pai">Pai</option>
                  <option value="mae">Mãe</option>
                  <option value="filho">Filho</option>
                  <option value="filha">Filha</option>
                  <option value="irmao">Irmão</option>
                  <option value="irma">Irmã</option>
                  <option value="responsavel">Responsável</option>
                  <option value="dependente">Dependente</option>
                  <option value="outro">Outro</option>
                </select>
                <input className="input" name="observacoes" placeholder="Observação opcional" />
                <button className="min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-black text-white">
                  Adicionar vínculo
                </button>
              </form>
            </details>
          ) : null}
        </article>

        <article className="rounded-[28px] border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-center gap-2 text-sky-950">
            <Camera size={19} />
            <h2 className="font-black">Foto do membro</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-sky-900/70">
            A foto fica em armazenamento privado e é exibida por link temporário autenticado.
          </p>
          {signedPhotoUrl ? (
            <img
              alt={"Foto de " + member.nome}
              className="mt-4 size-40 rounded-3xl object-cover shadow-sm"
              src={signedPhotoUrl}
            />
          ) : (
            <div className="mt-4 grid size-40 place-items-center rounded-3xl bg-white text-sky-900/40">
              <UserRoundCheck size={42} />
            </div>
          )}
          {canManage ? (
            <details className="mt-4">
              <summary className="cursor-pointer list-none text-sm font-black text-sky-900">
                {signedPhotoUrl ? "Trocar foto" : "Adicionar foto"}
              </summary>
              <form action={uploadElshadayMemberPhoto} className="mt-4 grid min-w-0 gap-3">
                <input type="hidden" name="membro_id" value={member.id} />
                <input type="hidden" name="return_to" value={"/elshaday/membros/" + member.id} />
                <input
                  className="w-full min-w-0 rounded-2xl border border-sky-200 bg-white p-3 text-sm text-slate-900"
                  name="foto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                />
                <button className="min-h-11 rounded-xl bg-sky-900 px-5 text-sm font-black text-white">
                  Enviar foto
                </button>
              </form>
            </details>
          ) : null}
        </article>
      </section>

      {canManage ? (
        <details className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
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
            <Field label="Endereço" name="endereco" defaultValue={member.endereco || ""} />
            <Field label="Bairro" name="bairro" defaultValue={member.bairro || ""} />
            <Field label="Cidade" name="cidade" defaultValue={member.cidade || ""} />
            <Field label="UF" name="estado" defaultValue={member.estado || ""} maxLength={2} />
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Estado civil
              <select className="input" name="estado_civil" defaultValue={member.estado_civil || ""}>
                <option value="">Não informado</option>
                <option value="solteiro">Solteiro(a)</option>
                <option value="casado">Casado(a)</option>
                <option value="uniao_estavel">União estável</option>
                <option value="divorciado">Divorciado(a)</option>
                <option value="viuvo">Viúvo(a)</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Sexo
              <select className="input" name="sexo" defaultValue={member.sexo || ""}>
                <option value="">Não informado</option>
                <option value="feminino">Feminino</option>
                <option value="masculino">Masculino</option>
                <option value="outro">Outro</option>
              </select>
            </label>
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

      {canCreateMemberAccess ? (
        <section className="rounded-[28px] border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-900 text-white">
              <KeyRound size={19} />
            </div>
            <div>
              <h2 className="font-black text-sky-950">Login e acesso do membro</h2>
              <p className="mt-1 text-sm leading-6 text-sky-900/75">
                {canManageAccess
                  ? "Vincule esta ficha a um acesso já criado ou envie um convite diretamente daqui."
                  : "Crie o login deste membro e envie o convite para ele definir a senha."}
              </p>
            </div>
          </div>

          {currentAccess ? (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-white p-4">
              <p className="font-black">{currentAccess.nome}</p>
              <p className="mt-1 text-sm text-slate-600">{currentAccess.email}</p>
              <p className="mt-2 text-xs font-black text-sky-800">
                Perfil: {roleLabel(String(currentAccess.permission?.perfil_app || "membro") as ElshadayRole)}
              </p>
            </div>
          ) : member.user_id ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
              Este membro já possui um login vinculado.
            </div>
          ) : null}

          {canManageAccess ? (
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
          ) : null}

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
                  {canManageAccess ? (
                    <select className="input" name="papel" defaultValue="membro">
                      {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                  ) : (
                    <>
                      <input type="hidden" name="papel" value="membro" />
                      <div className="flex min-h-12 items-center rounded-2xl border border-sky-200 bg-sky-50 px-4 text-sm font-black text-sky-950">
                        Perfil: Membro
                      </div>
                    </>
                  )}
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
          min-width: 0;
          width: 100%;
          border-radius: 1rem;
          border: 1px solid #cbd5e1;
          background: #fff;
          padding: 0 1rem;
          outline: none;
          color: #0f172a;
          -webkit-text-fill-color: #0f172a;
        }
        .textarea {
          min-height: 6rem;
          min-width: 0;
          width: 100%;
          border-radius: 1rem;
          border: 1px solid #cbd5e1;
          background: #fff;
          padding: 1rem;
          outline: none;
          color: #0f172a;
          -webkit-text-fill-color: #0f172a;
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
    convite: "Acesso criado e convite enviado para o e-mail do membro.",
    familia: "Vínculo familiar salvo.",
    familia_removida: "Vínculo familiar removido.",
    foto: "Foto do membro atualizada.",
    cargo: "Cargo alterado e histórico registrado.",
    ministerios: "Ministérios atualizados."
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
      <p className="text-xs font-black uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 [overflow-wrap:anywhere] text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="min-w-0 rounded-[24px] border border-emerald-950/10 bg-white p-5">
      <div className="text-[#176445]">{icon}</div>
      <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 [overflow-wrap:anywhere] text-sm font-bold text-slate-900">{value}</p>
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

function relationLabel(value: string) {
  const labels: Record<string, string> = {
    conjuge: "Cônjuge",
    pai: "Pai",
    mae: "Mãe",
    filho: "Filho",
    filha: "Filha",
    irmao: "Irmão",
    irma: "Irmã",
    responsavel: "Responsável",
    dependente: "Dependente",
    outro: "Outro"
  };
  return labels[value] ?? value;
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
