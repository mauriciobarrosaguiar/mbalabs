"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Bell,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  CirclePlus,
  GraduationCap,
  MailPlus,
  Pencil,
  RefreshCw,
  School,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRoundCog,
  UserX,
  UsersRound,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "overview" | "classes" | "team" | "students" | "guardians" | "invites";
type ManagedRole = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel" | "aluno";

type Dashboard = {
  turmas: number;
  alunos: number;
  professores: number;
  responsaveis: number;
  convites_pendentes: number;
};

type ClassRow = {
  id: string;
  nome: string;
  ano_letivo: number;
  turno: "matutino" | "vespertino" | "noturno" | "integral";
  ativa: boolean;
  professor_responsavel_id: string | null;
  professor_nome: string | null;
  total_alunos: number;
};

type ProfileRow = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  papel: ManagedRole;
  ativo: boolean;
  is_teste: boolean;
  criado_em: string;
};

type StudentRow = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  turma_id: string | null;
  turma_nome: string | null;
  ativo: boolean;
  perfil_id: string | null;
  login_email: string | null;
  total_responsaveis: number;
};

type GuardianRow = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  total_alunos: number;
};

type InviteRow = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  status: string;
  aluno_id: string | null;
  criado_em: string;
  expira_em: string;
};

type StudentGuardian = {
  responsavel_id: string;
  nome: string;
  email: string | null;
  parentesco: string | null;
  principal: boolean;
  autorizado_buscar: boolean;
};

type Props = {
  supabase: SupabaseClient;
  schoolName: string;
  role: "admin_escola" | "direcao";
};

const inviteRoles = [
  { value: "coordenacao", label: "Coordenação" },
  { value: "professor", label: "Professor" },
  { value: "responsavel", label: "Responsável" }
] as const;

const shiftOptions = [
  { value: "matutino", label: "Matutino" },
  { value: "vespertino", label: "Vespertino" },
  { value: "noturno", label: "Noturno" },
  { value: "integral", label: "Integral" }
] as const;

export default function SchoolManagement({ supabase, schoolName, role }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [dashboard, setDashboard] = useState<Dashboard>({ turmas: 0, alunos: 0, professores: 0, responsaveis: 0, convites_pendentes: 0 });
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [classModal, setClassModal] = useState<ClassRow | "new" | null>(null);
  const [studentModal, setStudentModal] = useState<StudentRow | "new" | null>(null);
  const [inviteModal, setInviteModal] = useState<"team" | "guardian" | null>(null);
  const [studentLoginModal, setStudentLoginModal] = useState<StudentRow | null>(null);
  const [guardianStudent, setGuardianStudent] = useState<StudentRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [dash, classResult, profileResult, studentResult, guardianResult, inviteResult] = await Promise.all([
      supabase.rpc("escola_school_dashboard"),
      supabase.rpc("escola_school_list_classes"),
      supabase.rpc("escola_school_list_profiles"),
      supabase.rpc("escola_school_list_students"),
      supabase.rpc("escola_school_list_guardians"),
      supabase.rpc("escola_school_list_invites")
    ]);

    const firstError = dash.error || classResult.error || profileResult.error || studentResult.error || guardianResult.error || inviteResult.error;
    if (firstError) {
      setError(firstError.message);
    } else {
      const d = Array.isArray(dash.data) ? dash.data[0] : dash.data;
      setDashboard({
        turmas: Number(d?.turmas ?? 0),
        alunos: Number(d?.alunos ?? 0),
        professores: Number(d?.professores ?? 0),
        responsaveis: Number(d?.responsaveis ?? 0),
        convites_pendentes: Number(d?.convites_pendentes ?? 0)
      });
      setClasses(((classResult.data ?? []) as ClassRow[]).map((item) => ({ ...item, total_alunos: Number(item.total_alunos ?? 0) })));
      setProfiles((profileResult.data ?? []) as ProfileRow[]);
      setStudents(((studentResult.data ?? []) as StudentRow[]).map((item) => ({ ...item, total_responsaveis: Number(item.total_responsaveis ?? 0) })));
      setGuardians(((guardianResult.data ?? []) as GuardianRow[]).map((item) => ({ ...item, total_alunos: Number(item.total_alunos ?? 0) })));
      setInvites((inviteResult.data ?? []) as InviteRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const teachers = useMemo(() => profiles.filter((profile) => profile.papel === "professor"), [profiles]);
  const team = useMemo(() => profiles.filter((profile) => ["admin_escola", "direcao", "coordenacao", "professor"].includes(profile.papel)), [profiles]);
  const filteredStudents = useMemo(() => filterBySearch(students, search, (item) => [item.nome, item.turma_nome ?? "", item.login_email ?? ""]), [students, search]);
  const filteredTeam = useMemo(() => filterBySearch(team, search, (item) => [item.nome, item.email ?? "", roleLabel(item.papel)]), [team, search]);
  const filteredGuardians = useMemo(() => filterBySearch(guardians, search, (item) => [item.nome, item.email ?? ""]), [guardians, search]);

  function flash(message: string) {
    setNotice(message);
    setError("");
    window.setTimeout(() => setNotice(""), 3200);
  }

  async function mutate(action: () => Promise<{ error: { message: string } | null }>, success: string) {
    setWorking(true);
    setError("");
    const result = await action();
    setWorking(false);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    flash(success);
    await loadData();
    return true;
  }

  async function toggleProfile(profile: ProfileRow) {
    await mutate(async () => {
      const { error: rpcError } = await supabase.rpc("escola_school_set_profile_active", { p_id: profile.id, p_ativo: !profile.ativo });
      return { error: rpcError };
    }, profile.ativo ? "Acesso inativado." : "Acesso reativado.");
  }

  async function toggleStudent(student: StudentRow) {
    await mutate(async () => {
      const { error: rpcError } = await supabase.rpc("escola_school_upsert_student", {
        p_id: student.id,
        p_nome: student.nome,
        p_data_nascimento: student.data_nascimento,
        p_turma_id: student.turma_id,
        p_ativo: !student.ativo
      });
      return { error: rpcError };
    }, student.ativo ? "Aluno inativado." : "Aluno reativado.");
  }

  async function toggleClass(item: ClassRow) {
    await mutate(async () => {
      const { error: rpcError } = await supabase.rpc("escola_school_upsert_class", {
        p_id: item.id,
        p_nome: item.nome,
        p_ano_letivo: item.ano_letivo,
        p_turno: item.turno,
        p_professor_id: item.professor_responsavel_id,
        p_ativa: !item.ativa
      });
      return { error: rpcError };
    }, item.ativa ? "Turma inativada." : "Turma reativada.");
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.12em] text-emerald-700"><ShieldCheck size={18} /> {role === "admin_escola" ? "Administração da escola" : "Direção"}</p>
            <h2 className="mt-2 text-2xl font-black">{schoolName}</h2>
            <p className="mt-1 text-sm leading-6 text-emerald-800">Cadastre e organize turmas, equipe, alunos, responsáveis e acessos da sua escola.</p>
          </div>
          <button className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 font-bold text-emerald-800 disabled:opacity-50" disabled={loading || working} onClick={() => void loadData()} type="button"><RefreshCw className={loading ? "animate-spin" : ""} size={18} /> Atualizar</button>
        </div>
      </section>

      <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 md:grid-cols-3 xl:grid-cols-6">
        <TabButton active={tab === "overview"} label="Visão geral" icon={<GraduationCap size={17} />} onClick={() => { setTab("overview"); setSearch(""); }} />
        <TabButton active={tab === "classes"} label="Turmas" icon={<School size={17} />} onClick={() => { setTab("classes"); setSearch(""); }} />
        <TabButton active={tab === "team"} label="Equipe" icon={<UsersRound size={17} />} onClick={() => { setTab("team"); setSearch(""); }} />
        <TabButton active={tab === "students"} label="Alunos" icon={<GraduationCap size={17} />} onClick={() => { setTab("students"); setSearch(""); }} />
        <TabButton active={tab === "guardians"} label="Responsáveis" icon={<UserRoundCog size={17} />} onClick={() => { setTab("guardians"); setSearch(""); }} />
        <TabButton active={tab === "invites"} label="Acessos" icon={<MailPlus size={17} />} onClick={() => { setTab("invites"); setSearch(""); }} />
      </nav>

      {notice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{notice}</p> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"><p className="font-black">Não foi possível concluir</p><p className="mt-1 text-sm leading-6">{error}</p></div> : null}

      {loading ? <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">Carregando gestão escolar...</section> : null}

      {!loading && tab === "overview" ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Turmas ativas" value={dashboard.turmas} icon={<School size={22} />} />
            <Metric label="Alunos ativos" value={dashboard.alunos} icon={<GraduationCap size={22} />} />
            <Metric label="Professores" value={dashboard.professores} icon={<BookOpenText size={22} />} />
            <Metric label="Responsáveis" value={dashboard.responsaveis} icon={<UsersRound size={22} />} />
            <Metric label="Acessos pendentes" value={dashboard.convites_pendentes} icon={<MailPlus size={22} />} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-black text-[#176b5b]">Ações rápidas</p>
              <h3 className="mt-1 text-xl font-black">Organização da escola</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <QuickAction title="Nova turma" description="Crie série, turno e professor." icon={<School size={21} />} onClick={() => setClassModal("new")} />
                <QuickAction title="Novo aluno" description="Cadastre mesmo sem login." icon={<GraduationCap size={21} />} onClick={() => setStudentModal("new")} />
                <QuickAction title="Convidar professor" description="Libere o primeiro acesso." icon={<UserPlus size={21} />} onClick={() => setInviteModal("team")} />
                <QuickAction title="Convidar responsável" description="Depois vincule ao aluno." icon={<MailPlus size={21} />} onClick={() => setInviteModal("guardian")} />
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-black text-[#176b5b]">Fluxo recomendado</p>
              <h3 className="mt-1 text-xl font-black">Implantação em 4 passos</h3>
              <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
                <Step number="1" text="Cadastre as turmas do ano letivo." />
                <Step number="2" text="Libere acesso para professores e coordenação." />
                <Step number="3" text="Cadastre os alunos e coloque cada um na turma correta." />
                <Step number="4" text="Cadastre responsáveis e faça o vínculo com os filhos." />
              </div>
            </article>
          </section>
        </>
      ) : null}

      {!loading && tab === "classes" ? (
        <section className="grid gap-4">
          <SectionHeader title="Turmas" description="Organize ano letivo, turno e professor responsável." button="Nova turma" onClick={() => setClassModal("new")} />
          <div className="grid gap-3">
            {classes.length === 0 ? <EmptyState title="Nenhuma turma cadastrada" text="Cadastre a primeira turma para começar a organizar alunos e professores." /> : null}
            {classes.map((item) => (
              <article className={`rounded-3xl border bg-white p-5 shadow-sm ${item.ativa ? "border-slate-200" : "border-amber-200 opacity-75"}`} key={item.id}>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{item.nome}</h3><Status active={item.ativa} /></div>
                    <p className="mt-1 text-sm text-slate-500">{item.ano_letivo} · {shiftLabel(item.turno)} · {item.total_alunos} aluno(s)</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">Professor responsável: {item.professor_nome || "Não definido"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SmallButton icon={<Pencil size={16} />} label="Editar" onClick={() => setClassModal(item)} />
                    <SmallButton icon={item.ativa ? <UserX size={16} /> : <UserCheck size={16} />} label={item.ativa ? "Inativar" : "Ativar"} tone={item.ativa ? "warning" : "success"} onClick={() => void toggleClass(item)} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && tab === "team" ? (
        <section className="grid gap-4">
          <SectionHeader title="Equipe e acessos" description="Direção, coordenação e professores vinculados a esta escola." button="Convidar pessoa" onClick={() => setInviteModal("team")} search={search} setSearch={setSearch} />
          <div className="grid gap-3">
            {filteredTeam.map((profile) => (
              <article className={`rounded-3xl border bg-white p-5 shadow-sm ${profile.ativo ? "border-slate-200" : "border-amber-200 opacity-75"}`} key={profile.id}>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-black">{profile.nome}</p><RoleBadge role={profile.papel} />{profile.is_teste ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-black text-violet-700">Teste</span> : null}<Status active={profile.ativo} /></div>
                    <p className="mt-1 text-sm text-slate-500">{profile.email || "Sem e-mail registrado"}</p>
                  </div>
                  {profile.papel !== "admin_escola" ? <SmallButton icon={profile.ativo ? <UserX size={16} /> : <UserCheck size={16} />} label={profile.ativo ? "Inativar" : "Ativar"} tone={profile.ativo ? "warning" : "success"} onClick={() => void toggleProfile(profile)} /> : <span className="text-xs font-bold text-slate-400">Protegido pelo ADMIN MBA</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && tab === "students" ? (
        <section className="grid gap-4">
          <SectionHeader title="Alunos" description="Cadastro escolar, turma, responsáveis e acesso do aluno." button="Novo aluno" onClick={() => setStudentModal("new")} search={search} setSearch={setSearch} />
          <div className="grid gap-3">
            {filteredStudents.length === 0 ? <EmptyState title="Nenhum aluno encontrado" text="Cadastre alunos e organize por turma." /> : null}
            {filteredStudents.map((student) => (
              <article className={`rounded-3xl border bg-white p-5 shadow-sm ${student.ativo ? "border-slate-200" : "border-amber-200 opacity-75"}`} key={student.id}>
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-black">{student.nome}</p><Status active={student.ativo} />{student.perfil_id ? <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">Login ativo</span> : null}</div>
                    <p className="mt-1 text-sm text-slate-500">{student.turma_nome || "Sem turma"} · {student.total_responsaveis} responsável(is)</p>
                    {student.login_email ? <p className="mt-1 text-xs font-semibold text-slate-400">{student.login_email}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SmallButton icon={<UsersRound size={16} />} label="Responsáveis" onClick={() => setGuardianStudent(student)} />
                    {!student.perfil_id ? <SmallButton icon={<MailPlus size={16} />} label="Liberar login" onClick={() => setStudentLoginModal(student)} /> : null}
                    <SmallButton icon={<Pencil size={16} />} label="Editar" onClick={() => setStudentModal(student)} />
                    <SmallButton icon={student.ativo ? <UserX size={16} /> : <UserCheck size={16} />} label={student.ativo ? "Inativar" : "Ativar"} tone={student.ativo ? "warning" : "success"} onClick={() => void toggleStudent(student)} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && tab === "guardians" ? (
        <section className="grid gap-4">
          <SectionHeader title="Responsáveis" description="Pais e responsáveis com acesso à escola e seus vínculos." button="Convidar responsável" onClick={() => setInviteModal("guardian")} search={search} setSearch={setSearch} />
          <div className="grid gap-3">
            {filteredGuardians.length === 0 ? <EmptyState title="Nenhum responsável encontrado" text="Convide o primeiro responsável e depois vincule ao aluno." /> : null}
            {filteredGuardians.map((guardian) => {
              const profile = profiles.find((item) => item.id === guardian.id);
              return (
                <article className={`rounded-3xl border bg-white p-5 shadow-sm ${guardian.ativo ? "border-slate-200" : "border-amber-200 opacity-75"}`} key={guardian.id}>
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div><div className="flex flex-wrap items-center gap-2"><p className="font-black">{guardian.nome}</p><Status active={guardian.ativo} /></div><p className="mt-1 text-sm text-slate-500">{guardian.email || "Sem e-mail"} · {guardian.total_alunos} aluno(s) vinculado(s)</p></div>
                    {profile ? <SmallButton icon={guardian.ativo ? <UserX size={16} /> : <UserCheck size={16} />} label={guardian.ativo ? "Inativar" : "Ativar"} tone={guardian.ativo ? "warning" : "success"} onClick={() => void toggleProfile(profile)} /> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!loading && tab === "invites" ? (
        <section className="grid gap-4">
          <SectionHeader title="Acessos e convites" description="Acompanhe quem ainda precisa concluir o primeiro acesso." button="Novo convite" onClick={() => setInviteModal("team")} />
          <div className="grid gap-3">
            {invites.length === 0 ? <EmptyState title="Nenhum convite" text="Os acessos liberados aparecerão aqui." /> : null}
            {invites.map((invite) => (
              <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" key={invite.id}>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div><div className="flex flex-wrap items-center gap-2"><p className="font-black">{invite.nome}</p><InviteStatus status={invite.status} /></div><p className="mt-1 text-sm text-slate-500">{invite.email} · {roleLabel(invite.papel)}</p><p className="mt-1 text-xs text-slate-400">Criado em {dateLabel(invite.criado_em)}</p></div>
                  {invite.status === "pendente" ? <SmallButton icon={<X size={16} />} label="Revogar" tone="warning" onClick={() => void mutate(async () => { const { error: rpcError } = await supabase.rpc("escola_school_revoke_invite", { p_id: invite.id }); return { error: rpcError }; }, "Convite revogado.")} /> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {classModal ? <ClassModal value={classModal} teachers={teachers} working={working} onClose={() => setClassModal(null)} onSave={async (payload) => {
        const ok = await mutate(async () => { const { error: rpcError } = await supabase.rpc("escola_school_upsert_class", payload); return { error: rpcError }; }, payload.p_id ? "Turma atualizada." : "Turma cadastrada.");
        if (ok) setClassModal(null);
      }} /> : null}

      {studentModal ? <StudentModal value={studentModal} classes={classes} working={working} onClose={() => setStudentModal(null)} onSave={async (payload) => {
        const ok = await mutate(async () => { const { error: rpcError } = await supabase.rpc("escola_school_upsert_student", payload); return { error: rpcError }; }, payload.p_id ? "Aluno atualizado." : "Aluno cadastrado.");
        if (ok) setStudentModal(null);
      }} /> : null}

      {inviteModal ? <InviteModal mode={inviteModal} working={working} onClose={() => setInviteModal(null)} onSave={async ({ nome, email, papel }) => {
        const ok = await mutate(async () => { const { error: rpcError } = await supabase.rpc("escola_school_create_invite", { p_nome: nome, p_email: email, p_papel: papel, p_aluno_id: null }); return { error: rpcError }; }, "Acesso liberado. A pessoa pode usar Primeiro acesso.");
        if (ok) setInviteModal(null);
      }} /> : null}

      {studentLoginModal ? <StudentLoginModal student={studentLoginModal} working={working} onClose={() => setStudentLoginModal(null)} onSave={async (email) => {
        const ok = await mutate(async () => { const { error: rpcError } = await supabase.rpc("escola_school_create_invite", { p_nome: studentLoginModal.nome, p_email: email, p_papel: "aluno", p_aluno_id: studentLoginModal.id }); return { error: rpcError }; }, "Login do aluno liberado para primeiro acesso.");
        if (ok) setStudentLoginModal(null);
      }} /> : null}

      {guardianStudent ? <StudentGuardiansModal student={guardianStudent} guardians={guardians.filter((item) => item.ativo)} supabase={supabase} working={working} onClose={() => setGuardianStudent(null)} onChanged={async (message) => { flash(message); await loadData(); }} /> : null}
    </div>
  );
}

function ClassModal({ value, teachers, working, onClose, onSave }: { value: ClassRow | "new"; teachers: ProfileRow[]; working: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const editing = value !== "new";
  const [nome, setNome] = useState(editing ? value.nome : "");
  const [ano, setAno] = useState(editing ? value.ano_letivo : new Date().getFullYear());
  const [turno, setTurno] = useState<ClassRow["turno"]>(editing ? value.turno : "matutino");
  const [professor, setProfessor] = useState(editing ? value.professor_responsavel_id ?? "" : "");

  return <Modal title={editing ? "Editar turma" : "Nova turma"} onClose={onClose}><form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void onSave({ p_id: editing ? value.id : null, p_nome: nome.trim(), p_ano_letivo: ano, p_turno: turno, p_professor_id: professor || null, p_ativa: editing ? value.ativa : true }); }}>
    <Field label="Nome da turma"><input className="input" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: 6º Ano A" /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Ano letivo"><input className="input" type="number" min="2020" max="2100" value={ano} onChange={(e) => setAno(Number(e.target.value))} /></Field><Field label="Turno"><select className="input" value={turno} onChange={(e) => setTurno(e.target.value as ClassRow["turno"])}>{shiftOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field></div>
    <Field label="Professor responsável"><select className="input" value={professor} onChange={(e) => setProfessor(e.target.value)}><option value="">Não definido</option>{teachers.filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
    <SubmitButton working={working} label={editing ? "Salvar turma" : "Cadastrar turma"} />
  </form></Modal>;
}

function StudentModal({ value, classes, working, onClose, onSave }: { value: StudentRow | "new"; classes: ClassRow[]; working: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const editing = value !== "new";
  const [nome, setNome] = useState(editing ? value.nome : "");
  const [birth, setBirth] = useState(editing ? value.data_nascimento ?? "" : "");
  const [classId, setClassId] = useState(editing ? value.turma_id ?? "" : "");

  return <Modal title={editing ? "Editar aluno" : "Novo aluno"} onClose={onClose}><form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void onSave({ p_id: editing ? value.id : null, p_nome: nome.trim(), p_data_nascimento: birth || null, p_turma_id: classId || null, p_ativo: editing ? value.ativo : true }); }}>
    <Field label="Nome completo"><input className="input" required value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
    <Field label="Data de nascimento"><input className="input" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} /></Field>
    <Field label="Turma"><select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Sem turma</option>{classes.filter((item) => item.ativa).map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.ano_letivo}</option>)}</select></Field>
    <p className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-800">O aluno pode ser cadastrado agora sem e-mail. O login pode ser liberado depois.</p>
    <SubmitButton working={working} label={editing ? "Salvar aluno" : "Cadastrar aluno"} />
  </form></Modal>;
}

function InviteModal({ mode, working, onClose, onSave }: { mode: "team" | "guardian"; working: boolean; onClose: () => void; onSave: (data: { nome: string; email: string; papel: string }) => Promise<void> }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState(mode === "guardian" ? "responsavel" : "professor");
  return <Modal title={mode === "guardian" ? "Convidar responsável" : "Convidar equipe"} onClose={onClose}><form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void onSave({ nome: nome.trim(), email: email.trim().toLowerCase(), papel }); }}>
    <Field label="Nome completo"><input className="input" required value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
    <Field label="E-mail"><input className="input" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
    {mode === "team" ? <Field label="Perfil"><select className="input" value={papel} onChange={(e) => setPapel(e.target.value)}>{inviteRoles.filter((item) => item.value !== "responsavel").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field> : null}
    <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">O usuário entrará em “Primeiro acesso” usando este e-mail para criar a senha.</p>
    <SubmitButton working={working} label="Liberar acesso" />
  </form></Modal>;
}

function StudentLoginModal({ student, working, onClose, onSave }: { student: StudentRow; working: boolean; onClose: () => void; onSave: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  return <Modal title="Liberar login do aluno" onClose={onClose}><form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void onSave(email.trim().toLowerCase()); }}><p className="text-sm leading-6 text-slate-600">Aluno: <strong>{student.nome}</strong></p><Field label="E-mail de acesso"><input className="input" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field><SubmitButton working={working} label="Liberar primeiro acesso" /></form></Modal>;
}

function StudentGuardiansModal({ student, guardians, supabase, working, onClose, onChanged }: { student: StudentRow; guardians: GuardianRow[]; supabase: SupabaseClient; working: boolean; onClose: () => void; onChanged: (message: string) => Promise<void> }) {
  const [links, setLinks] = useState<StudentGuardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardianId, setGuardianId] = useState("");
  const [kinship, setKinship] = useState("");
  const [principal, setPrincipal] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const [localError, setLocalError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("escola_school_student_guardians", { p_aluno_id: student.id });
    if (error) setLocalError(error.message); else { setLinks((data ?? []) as StudentGuardian[]); setLocalError(""); }
    setLoading(false);
  }, [student.id, supabase]);

  useEffect(() => { void reload(); }, [reload]);

  async function link(e: React.FormEvent) {
    e.preventDefault();
    if (!guardianId) return;
    const { error } = await supabase.rpc("escola_school_link_guardian", { p_aluno_id: student.id, p_responsavel_id: guardianId, p_parentesco: kinship, p_principal: principal, p_autorizado_buscar: authorized });
    if (error) { setLocalError(error.message); return; }
    setGuardianId(""); setKinship(""); setPrincipal(false); setAuthorized(true);
    await reload(); await onChanged("Responsável vinculado ao aluno.");
  }

  async function unlink(id: string) {
    const { error } = await supabase.rpc("escola_school_unlink_guardian", { p_aluno_id: student.id, p_responsavel_id: id });
    if (error) { setLocalError(error.message); return; }
    await reload(); await onChanged("Vínculo removido.");
  }

  return <Modal title={`Responsáveis · ${student.nome}`} onClose={onClose} wide><div className="grid gap-5">
    {localError ? <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{localError}</p> : null}
    <form className="grid gap-3 rounded-2xl border border-slate-200 p-4" onSubmit={link}>
      <p className="font-black">Adicionar responsável</p>
      <select className="input" required value={guardianId} onChange={(e) => setGuardianId(e.target.value)}><option value="">Selecione</option>{guardians.filter((g) => !links.some((l) => l.responsavel_id === g.id)).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select>
      <input className="input" placeholder="Parentesco: mãe, pai, avó..." value={kinship} onChange={(e) => setKinship(e.target.value)} />
      <div className="grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} /> Responsável principal</label><label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} /> Autorizado a buscar</label></div>
      <button className="min-h-11 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50" disabled={working || !guardianId} type="submit">Vincular responsável</button>
    </form>

    <div className="grid gap-2"><p className="font-black">Vínculos atuais</p>{loading ? <p className="text-sm text-slate-500">Carregando...</p> : null}{!loading && links.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum responsável vinculado.</p> : null}{links.map((link) => <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center" key={link.responsavel_id}><div><p className="font-black">{link.nome}</p><p className="mt-1 text-sm text-slate-500">{link.parentesco || "Parentesco não informado"}{link.principal ? " · Principal" : ""}{link.autorizado_buscar ? " · Pode buscar" : ""}</p></div><button className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700" onClick={() => void unlink(link.responsavel_id)} type="button">Remover vínculo</button></div>)}</div>
  </div></Modal>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-3 sm:place-items-center" role="dialog" aria-modal="true"><section className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ${wide ? "max-w-2xl" : "max-w-lg"}`}><div className="mb-5 flex items-center justify-between gap-3"><h3 className="text-xl font-black">{title}</h3><button className="rounded-xl border border-slate-200 p-2" onClick={onClose} type="button" aria-label="Fechar"><X size={19} /></button></div>{children}</section></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-bold">{label}{children}</label>; }
function SubmitButton({ working, label }: { working: boolean; label: string }) { return <button className="min-h-12 rounded-xl bg-[#176b5b] px-5 font-black text-white disabled:opacity-50" disabled={working} type="submit">{working ? "Salvando..." : label}</button>; }

function TabButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) { return <button className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black ${active ? "bg-[#176b5b] text-white" : "text-slate-600 hover:bg-slate-50"}`} onClick={onClick} type="button">{icon}{label}</button>; }
function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-[#176b5b]">{icon}</div><p className="mt-4 text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></article>; }
function Step({ number, text }: { number: string; text: string }) { return <div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 font-black text-emerald-800">{number}</span><p>{text}</p></div>; }
function QuickAction({ title, description, icon, onClick }: { title: string; description: string; icon: React.ReactNode; onClick: () => void }) { return <button className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50" onClick={onClick} type="button"><span className="text-[#176b5b]">{icon}</span><p className="mt-3 font-black">{title}</p><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></button>; }

function SectionHeader({ title, description, button, onClick, search, setSearch }: { title: string; description: string; button: string; onClick: () => void; search?: string; setSearch?: (value: string) => void }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h2 className="text-2xl font-black">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div><div className="flex flex-col gap-2 sm:flex-row">{setSearch ? <input className="min-h-11 rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-700" placeholder="Buscar..." value={search ?? ""} onChange={(e) => setSearch(e.target.value)} /> : null}<button className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white" onClick={onClick} type="button"><CirclePlus size={18} />{button}</button></div></div></div>;
}

function SmallButton({ icon, label, onClick, tone = "default" }: { icon: React.ReactNode; label: string; onClick: () => void; tone?: "default" | "warning" | "success" }) {
  const style = tone === "warning" ? "border-amber-200 text-amber-700" : tone === "success" ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-700";
  return <button className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold ${style}`} onClick={onClick} type="button">{icon}{label}</button>;
}

function Status({ active }: { active: boolean }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{active ? "Ativo" : "Inativo"}</span>; }
function RoleBadge({ role }: { role: ManagedRole }) { return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{roleLabel(role)}</span>; }
function InviteStatus({ status }: { status: string }) { const active = status === "pendente"; const done = status === "aceito"; return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${done ? "bg-emerald-100 text-emerald-800" : active ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}>{status === "pendente" ? "Pendente" : status === "aceito" ? "Aceito" : status === "revogado" ? "Revogado" : status}</span>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><CheckCircle2 className="mx-auto text-slate-400" size={30} /><p className="mt-3 font-black">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></div>; }

function roleLabel(role: string) {
  const labels: Record<string, string> = { admin_escola: "Admin da Escola", direcao: "Direção", coordenacao: "Coordenação", professor: "Professor", responsavel: "Responsável", aluno: "Aluno" };
  return labels[role] ?? role;
}
function shiftLabel(value: string) { return shiftOptions.find((item) => item.value === value)?.label ?? value; }
function dateLabel(value: string) { try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); } catch { return "-"; } }
function filterBySearch<T>(items: T[], search: string, fields: (item: T) => string[]) { const q = search.trim().toLowerCase(); return q ? items.filter((item) => fields(item).join(" ").toLowerCase().includes(q)) : items; }
