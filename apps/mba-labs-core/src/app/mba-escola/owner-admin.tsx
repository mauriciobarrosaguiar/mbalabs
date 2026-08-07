"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Building2,
  CirclePlus,
  KeyRound,
  MailPlus,
  Pencil,
  RefreshCw,
  School,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
  UsersRound
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "overview" | "schools" | "users" | "invites";

type SchoolRow = {
  id: string;
  nome: string;
  slug: string;
  status: "ativa" | "teste" | "bloqueada" | "cancelada";
  criado_em: string;
  total_usuarios: number;
  total_alunos: number;
  total_turmas: number;
};

type UserRow = {
  user_id: string;
  nome: string;
  email: string;
  papel: "dono_sistema" | "direcao" | "coordenacao" | "professor" | "responsavel";
  escola_id: string | null;
  escola_nome: string | null;
  ativo: boolean;
  criado_em: string;
  ultimo_acesso: string | null;
  dono_sistema: boolean;
};

type InviteRow = {
  id: string;
  escola_id: string | null;
  escola_nome: string | null;
  nome: string;
  email: string;
  papel: "direcao" | "coordenacao" | "professor" | "responsavel";
  status: string;
  criado_em: string;
  aceito_em: string | null;
};

type Props = {
  supabase: SupabaseClient;
  ownerName: string;
};

const roleOptions = [
  { value: "direcao", label: "Direção" },
  { value: "coordenacao", label: "Coordenação" },
  { value: "professor", label: "Professor" },
  { value: "responsavel", label: "Responsável" }
] as const;

const schoolStatusOptions = [
  { value: "ativa", label: "Ativa" },
  { value: "teste", label: "Em implantação" },
  { value: "bloqueada", label: "Bloqueada" },
  { value: "cancelada", label: "Cancelada" }
] as const;

export default function OwnerAdmin({ supabase, ownerName }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [newSchoolName, setNewSchoolName] = useState("");
  const [editingSchool, setEditingSchool] = useState<SchoolRow | null>(null);

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSchoolId, setInviteSchoolId] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof roleOptions)[number]["value"]>("responsavel");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const [schoolResult, userResult, inviteResult] = await Promise.all([
      supabase.rpc("escola_admin_list_schools"),
      supabase.rpc("escola_admin_list_users"),
      supabase.rpc("escola_admin_list_invites")
    ]);

    const firstError = schoolResult.error || userResult.error || inviteResult.error;
    if (firstError) {
      setError(
        firstError.message.includes("Could not find the function")
          ? "O painel administrativo precisa da atualização do banco do MBA Escola."
          : firstError.message
      );
    } else {
      setSchools((schoolResult.data ?? []) as SchoolRow[]);
      setUsers((userResult.data ?? []) as UserRow[]);
      setInvites((inviteResult.data ?? []) as InviteRow[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.nome, user.email, user.escola_nome ?? "", roleLabel(user.papel)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [search, users]);

  const pendingInvites = invites.filter((invite) => invite.status === "pendente").length;
  const activeSchools = schools.filter((school) => school.status === "ativa" || school.status === "teste").length;
  const activeUsers = users.filter((user) => user.ativo).length;

  function flash(message: string) {
    setNotice(message);
    setError("");
    window.setTimeout(() => setNotice(""), 3500);
  }

  async function runAction(action: () => Promise<{ error: { message: string } | null }>, successMessage: string) {
    setWorking(true);
    setError("");
    const result = await action();
    setWorking(false);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    flash(successMessage);
    await loadData();
    return true;
  }

  async function createSchool(event: React.FormEvent) {
    event.preventDefault();
    const nome = newSchoolName.trim();
    if (!nome) return;
    const slug = slugify(nome);
    const ok = await runAction(
      async () => {
        const { error } = await supabase.rpc("escola_admin_create_school", { p_nome: nome, p_slug: slug });
        return { error };
      },
      "Escola cadastrada com sucesso."
    );
    if (ok) setNewSchoolName("");
  }

  async function saveSchool(event: React.FormEvent) {
    event.preventDefault();
    if (!editingSchool) return;
    const ok = await runAction(
      async () => {
        const { error } = await supabase.rpc("escola_admin_update_school", {
          p_id: editingSchool.id,
          p_nome: editingSchool.nome,
          p_status: editingSchool.status
        });
        return { error };
      },
      "Escola atualizada."
    );
    if (ok) setEditingSchool(null);
  }

  async function deleteSchool(school: SchoolRow) {
    const confirmed = window.confirm(
      `Excluir permanentemente a escola “${school.nome}”?\n\nIsso também apagará os usuários vinculados e os dados escolares dessa escola. Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;
    await runAction(
      async () => {
        const { error } = await supabase.rpc("escola_admin_delete_school", { p_id: school.id });
        return { error };
      },
      "Escola excluída permanentemente."
    );
  }

  async function createInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!inviteSchoolId || !inviteEmail.trim() || !inviteName.trim()) return;
    const ok = await runAction(
      async () => {
        const { error } = await supabase.rpc("escola_admin_create_invite", {
          p_escola_id: inviteSchoolId,
          p_nome: inviteName.trim(),
          p_email: inviteEmail.trim().toLowerCase(),
          p_papel: inviteRole
        });
        return { error };
      },
      "Login liberado para primeiro acesso."
    );
    if (ok) {
      setInviteName("");
      setInviteEmail("");
      setInviteRole("responsavel");
    }
  }

  async function saveUser(event: React.FormEvent) {
    event.preventDefault();
    if (!editingUser || editingUser.dono_sistema || !editingUser.escola_id) return;
    const ok = await runAction(
      async () => {
        const { error } = await supabase.rpc("escola_admin_update_user", {
          p_user_id: editingUser.user_id,
          p_nome: editingUser.nome,
          p_escola_id: editingUser.escola_id,
          p_papel: editingUser.papel,
          p_ativo: editingUser.ativo
        });
        return { error };
      },
      "Usuário atualizado."
    );
    if (ok) setEditingUser(null);
  }

  async function toggleUser(user: UserRow) {
    if (user.dono_sistema) return;
    await runAction(
      async () => {
        const { error } = await supabase.rpc("escola_admin_set_user_active", {
          p_user_id: user.user_id,
          p_ativo: !user.ativo
        });
        return { error };
      },
      user.ativo ? "Usuário inativado." : "Usuário reativado."
    );
  }

  async function deleteUser(user: UserRow) {
    if (user.dono_sistema) return;
    if (!window.confirm(`Excluir permanentemente o login de ${user.nome} (${user.email})?`)) return;
    await runAction(
      async () => {
        const { error } = await supabase.rpc("escola_admin_delete_user", { p_user_id: user.user_id });
        return { error };
      },
      "Login excluído permanentemente."
    );
  }

  async function resetPassword(user: UserRow) {
    setWorking(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/mba-escola`
    });
    setWorking(false);
    if (error) setError(error.message);
    else flash(`E-mail de redefinição enviado para ${user.email}.`);
  }

  async function cancelInvite(invite: InviteRow) {
    await runAction(
      async () => {
        const { error } = await supabase.rpc("escola_admin_cancel_invite", { p_id: invite.id });
        return { error };
      },
      "Convite cancelado."
    );
  }

  async function deleteInvite(invite: InviteRow) {
    if (!window.confirm(`Excluir o convite de ${invite.email}?`)) return;
    await runAction(
      async () => {
        const { error } = await supabase.rpc("escola_admin_delete_invite", { p_id: invite.id });
        return { error };
      },
      "Convite excluído."
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.12em] text-emerald-700">
              <ShieldCheck size={18} /> Dono do sistema
            </p>
            <h2 className="mt-2 text-2xl font-black">Administração geral do MBA Escola</h2>
            <p className="mt-1 text-sm text-emerald-800">{ownerName} possui acesso global a todas as escolas e logins.</p>
          </div>
          <button
            className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 font-bold text-emerald-800"
            disabled={loading || working}
            onClick={() => void loadData()}
            type="button"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} size={18} /> Atualizar
          </button>
        </div>
      </section>

      <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-4">
        <TabButton active={tab === "overview"} icon={<Building2 size={18} />} label="Visão geral" onClick={() => setTab("overview")} />
        <TabButton active={tab === "schools"} icon={<School size={18} />} label="Escolas" onClick={() => setTab("schools")} />
        <TabButton active={tab === "users"} icon={<UsersRound size={18} />} label="Usuários" onClick={() => setTab("users")} />
        <TabButton active={tab === "invites"} icon={<MailPlus size={18} />} label="Convites" onClick={() => setTab("invites")} />
      </nav>

      {notice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{notice}</p> : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-black">Não foi possível concluir</p>
          <p className="mt-1 text-sm leading-6">{error}</p>
        </div>
      ) : null}

      {loading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">Carregando administração...</section>
      ) : null}

      {!loading && tab === "overview" ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={<School size={22} />} label="Escolas" value={String(schools.length)} helper={`${activeSchools} ativas/implantação`} />
            <Metric icon={<UsersRound size={22} />} label="Logins" value={String(users.length)} helper={`${activeUsers} ativos`} />
            <Metric icon={<MailPlus size={22} />} label="Convites pendentes" value={String(pendingInvites)} helper="Aguardando primeiro acesso" />
            <Metric icon={<UserCheck size={22} />} label="Alunos" value={String(schools.reduce((sum, item) => sum + Number(item.total_alunos || 0), 0))} helper="Todas as escolas" />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-black">Ações rápidas</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button className="rounded-2xl bg-[#176b5b] p-4 text-left font-black text-white" onClick={() => setTab("schools")} type="button">
                  <CirclePlus className="mb-3" size={24} /> Cadastrar escola
                </button>
                <button className="rounded-2xl border border-slate-200 p-4 text-left font-black" onClick={() => setTab("invites")} type="button">
                  <MailPlus className="mb-3 text-[#176b5b]" size={24} /> Liberar novo login
                </button>
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-black">Controle total</h3>
              <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-600">
                <p>• Cadastrar, editar, bloquear, cancelar e excluir escolas.</p>
                <p>• Alterar perfil e escola de cada usuário.</p>
                <p>• Inativar, reativar ou excluir logins.</p>
                <p>• Liberar primeiro acesso e reenviar redefinição de senha.</p>
              </div>
            </article>
          </section>
        </>
      ) : null}

      {!loading && tab === "schools" ? (
        <section className="grid gap-5">
          <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={createSchool}>
            <h3 className="text-xl font-black">Cadastrar escola</h3>
            <p className="mt-1 text-sm text-slate-500">A nova escola começa em modo de implantação.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input className="min-h-12 flex-1 rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-700" onChange={(e) => setNewSchoolName(e.target.value)} placeholder="Nome da escola" value={newSchoolName} />
              <button className="min-h-12 rounded-xl bg-[#176b5b] px-5 font-black text-white disabled:opacity-60" disabled={working || !newSchoolName.trim()} type="submit">Cadastrar</button>
            </div>
          </form>

          <div className="grid gap-3">
            {schools.map((school) => (
              <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" key={school.id}>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black">{school.nome}</h3>
                      <StatusBadge status={school.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">/{school.slug}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                      <span className="rounded-full bg-slate-100 px-3 py-1">{school.total_usuarios} usuários</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{school.total_alunos} alunos</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{school.total_turmas} turmas</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 font-bold" onClick={() => setEditingSchool({ ...school })} type="button"><Pencil size={17} /> Editar</button>
                    <button className="flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-3 font-bold text-red-700" onClick={() => void deleteSchool(school)} type="button"><Trash2 size={17} /> Excluir</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && tab === "users" ? (
        <section className="grid gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-xl font-black">Usuários e logins</h3>
                <p className="mt-1 text-sm text-slate-500">Controle de acesso de todas as escolas.</p>
              </div>
              <input className="min-h-11 rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-700" onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, e-mail ou escola" value={search} />
            </div>
          </div>

          <div className="grid gap-3">
            {filteredUsers.map((user) => (
              <article className={`rounded-3xl border bg-white p-5 shadow-sm ${user.ativo ? "border-slate-200" : "border-amber-200 opacity-80"}`} key={user.user_id}>
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{user.nome}</p>
                      {user.dono_sistema ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">Dono do sistema</span> : null}
                      {!user.ativo ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">Inativo</span> : null}
                    </div>
                    <p className="mt-1 break-all text-sm text-slate-500">{user.email}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{user.dono_sistema ? "Acesso global" : `${roleLabel(user.papel)} • ${user.escola_nome || "Sem escola"}`}</p>
                    <p className="mt-1 text-xs text-slate-400">Último acesso: {formatDateTime(user.ultimo_acesso)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold" onClick={() => void resetPassword(user)} type="button"><KeyRound size={16} /> Redefinir senha</button>
                    {!user.dono_sistema ? (
                      <>
                        <button className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold" onClick={() => setEditingUser({ ...user })} type="button"><UserCog size={16} /> Editar</button>
                        <button className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold ${user.ativo ? "border-amber-200 text-amber-700" : "border-emerald-200 text-emerald-700"}`} onClick={() => void toggleUser(user)} type="button">
                          {user.ativo ? <UserX size={16} /> : <UserCheck size={16} />} {user.ativo ? "Inativar" : "Ativar"}
                        </button>
                        <button className="flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-700" onClick={() => void deleteUser(user)} type="button"><Trash2 size={16} /> Excluir</button>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && tab === "invites" ? (
        <section className="grid gap-5">
          <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={createInvite}>
            <h3 className="text-xl font-black">Liberar novo login</h3>
            <p className="mt-1 text-sm text-slate-500">A pessoa usará “Primeiro acesso” para criar a própria senha.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input className="min-h-12 rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-700" onChange={(e) => setInviteName(e.target.value)} placeholder="Nome completo" required value={inviteName} />
              <input className="min-h-12 rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-700" onChange={(e) => setInviteEmail(e.target.value)} placeholder="E-mail" required type="email" value={inviteEmail} />
              <select className="min-h-12 rounded-xl border border-slate-300 bg-white px-4" onChange={(e) => setInviteSchoolId(e.target.value)} required value={inviteSchoolId}>
                <option value="">Selecione a escola</option>
                {schools.filter((school) => school.status !== "cancelada").map((school) => <option key={school.id} value={school.id}>{school.nome}</option>)}
              </select>
              <select className="min-h-12 rounded-xl border border-slate-300 bg-white px-4" onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)} value={inviteRole}>
                {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </div>
            <button className="mt-4 min-h-12 rounded-xl bg-[#176b5b] px-5 font-black text-white disabled:opacity-60" disabled={working} type="submit"><span className="flex items-center gap-2"><MailPlus size={18} /> Liberar acesso</span></button>
          </form>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-black">Histórico de convites</h3>
            <div className="mt-5 grid gap-3">
              {invites.length === 0 ? <p className="text-sm text-slate-500">Nenhum convite registrado.</p> : null}
              {invites.map((invite) => (
                <article className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 p-4 lg:flex-row lg:items-center" key={invite.id}>
                  <div>
                    <p className="font-black">{invite.nome}</p>
                    <p className="mt-1 break-all text-sm text-slate-500">{invite.email}</p>
                    <p className="mt-1 text-sm text-slate-600">{roleLabel(invite.papel)} • {invite.escola_nome || "Sem escola"}</p>
                    <p className="mt-1 text-xs text-slate-400">Status: {inviteStatusLabel(invite.status)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {invite.status === "pendente" ? <button className="rounded-xl border border-amber-200 px-3 py-2 text-sm font-bold text-amber-700" onClick={() => void cancelInvite(invite)} type="button">Cancelar</button> : null}
                    <button className="flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700" onClick={() => void deleteInvite(invite)} type="button"><Trash2 size={15} /> Excluir</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {editingSchool ? (
        <Modal title="Editar escola" onClose={() => setEditingSchool(null)}>
          <form className="grid gap-4" onSubmit={saveSchool}>
            <label className="grid gap-2 text-sm font-bold">Nome
              <input className="min-h-12 rounded-xl border border-slate-300 px-4" onChange={(e) => setEditingSchool({ ...editingSchool, nome: e.target.value })} value={editingSchool.nome} />
            </label>
            <label className="grid gap-2 text-sm font-bold">Status
              <select className="min-h-12 rounded-xl border border-slate-300 bg-white px-4" onChange={(e) => setEditingSchool({ ...editingSchool, status: e.target.value as SchoolRow["status"] })} value={editingSchool.status}>
                {schoolStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>
            <button className="min-h-12 rounded-xl bg-[#176b5b] px-5 font-black text-white" disabled={working} type="submit">Salvar alterações</button>
          </form>
        </Modal>
      ) : null}

      {editingUser ? (
        <Modal title="Editar usuário" onClose={() => setEditingUser(null)}>
          <form className="grid gap-4" onSubmit={saveUser}>
            <label className="grid gap-2 text-sm font-bold">Nome
              <input className="min-h-12 rounded-xl border border-slate-300 px-4" onChange={(e) => setEditingUser({ ...editingUser, nome: e.target.value })} value={editingUser.nome} />
            </label>
            <label className="grid gap-2 text-sm font-bold">Escola
              <select className="min-h-12 rounded-xl border border-slate-300 bg-white px-4" onChange={(e) => setEditingUser({ ...editingUser, escola_id: e.target.value })} value={editingUser.escola_id ?? ""}>
                <option value="">Selecione</option>
                {schools.map((school) => <option key={school.id} value={school.id}>{school.nome}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">Perfil
              <select className="min-h-12 rounded-xl border border-slate-300 bg-white px-4" onChange={(e) => setEditingUser({ ...editingUser, papel: e.target.value as UserRow["papel"] })} value={editingUser.papel}>
                {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 font-bold">
              <input checked={editingUser.ativo} onChange={(e) => setEditingUser({ ...editingUser, ativo: e.target.checked })} type="checkbox" /> Usuário ativo
            </label>
            <button className="min-h-12 rounded-xl bg-[#176b5b] px-5 font-black text-white" disabled={working || !editingUser.escola_id} type="submit">Salvar usuário</button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black ${active ? "bg-[#176b5b] text-white" : "text-slate-600 hover:bg-slate-50"}`} onClick={onClick} type="button">{icon}{label}</button>;
}

function Metric({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-[#176b5b]">{icon}</div>
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: SchoolRow["status"] }) {
  const styles: Record<SchoolRow["status"], string> = {
    ativa: "bg-emerald-100 text-emerald-800",
    teste: "bg-blue-100 text-blue-800",
    bloqueada: "bg-amber-100 text-amber-800",
    cancelada: "bg-red-100 text-red-800"
  };
  const label = schoolStatusOptions.find((item) => item.value === status)?.label ?? status;
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${styles[status]}`}>{label}</span>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-3 sm:place-items-center" role="dialog" aria-modal="true">
      <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-xl font-black">{title}</h3>
          <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" onClick={onClose} type="button">Fechar</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    dono_sistema: "Dono do sistema",
    direcao: "Direção",
    coordenacao: "Coordenação",
    professor: "Professor",
    responsavel: "Responsável"
  };
  return labels[role] ?? role;
}

function inviteStatusLabel(status: string) {
  const labels: Record<string, string> = { pendente: "Pendente", aceito: "Aceito", cancelado: "Cancelado" };
  return labels[status] ?? status;
}

function formatDateTime(value: string | null) {
  if (!value) return "Nunca";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return "-";
  }
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
