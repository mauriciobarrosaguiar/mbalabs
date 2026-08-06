import {
  Bell,
  BookOpenText,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  House,
  MessageSquareText,
  Settings,
  UserPlus,
  UsersRound
} from "lucide-react";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Profile = {
  nome: string;
  papel: "direcao" | "coordenacao" | "professor" | "responsavel";
  escola_id: string;
  escola?: { nome: string } | null;
};

type OwnerProfile = {
  nome: string;
  email: string;
};

type Announcement = {
  id: string;
  titulo: string;
  resumo: string | null;
  publicado_em: string;
};

type School = {
  id: string;
  nome: string;
  status: string;
};

export default async function AppPage() {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/login");

  const [{ data: profileData }, { data: ownerData }] = await Promise.all([
    supabase
      .from("escola_perfis")
      .select("nome, papel, escola_id, escola:escola_escolas(nome)")
      .eq("id", authData.user.id)
      .maybeSingle(),
    supabase
      .from("escola_super_admins")
      .select("nome, email")
      .eq("user_id", authData.user.id)
      .eq("ativo", true)
      .maybeSingle()
  ]);

  const profile = profileData as unknown as Profile | null;
  const owner = ownerData as unknown as OwnerProfile | null;
  const isOwner = Boolean(owner);

  if (!profile && !owner) {
    return <AccessPending />;
  }

  let announcements: Announcement[] = [];
  let schools: School[] = [];
  let pendingInvites = 0;

  if (isOwner) {
    const [{ data: schoolData }, { count }] = await Promise.all([
      supabase
        .from("escola_escolas")
        .select("id, nome, status")
        .order("nome")
        .limit(8),
      supabase
        .from("escola_convites")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente")
    ]);

    schools = (schoolData ?? []) as School[];
    pendingInvites = count ?? 0;
  } else {
    const { data: announcementData } = await supabase
      .from("escola_comunicados")
      .select("id, titulo, resumo, publicado_em")
      .eq("status", "publicado")
      .order("publicado_em", { ascending: false })
      .limit(4);

    announcements = (announcementData ?? []) as Announcement[];
  }

  const isGuardian = profile?.papel === "responsavel";
  const displayName = owner?.nome || profile?.nome || "Usuário";
  const firstName = displayName.split(" ")[0];
  const shortcuts = isOwner ? ownerShortcuts : isGuardian ? guardianShortcuts : staffShortcuts;

  return (
    <main className="safe-bottom min-h-screen bg-[#f5f8fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="page-shell flex min-h-20 items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#176b5b] text-white">
              <GraduationCap size={28} />
            </div>
            <div>
              <p className="font-black">MBA Escola</p>
              <p className="line-clamp-1 text-sm text-slate-500">
                {isOwner ? "Administração geral" : profile?.escola?.nome || "Sua escola"}
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="page-shell grid gap-7 py-7">
        <section>
          <p className="text-sm font-bold text-[#176b5b]">
            {isOwner ? "Dono do sistema" : roleLabel(profile?.papel)}
          </p>
          <h1 className="mt-1 text-3xl font-black">Olá, {firstName}</h1>
          <p className="mt-2 leading-7 text-slate-500">
            {isOwner
              ? "Administre escolas, acessos e configurações do MBA Escola."
              : isGuardian
                ? "Aqui está o que você precisa acompanhar sobre seus filhos."
                : "Veja os principais registros e ações da rotina escolar."}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {shortcuts.map(({ label, description, Icon }) => (
            <article className="card min-h-36 p-4" key={label}>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-[#e9f6f2] text-[#176b5b]">
                <Icon size={23} />
              </div>
              <h2 className="font-black">{label}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <div className="card p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#176b5b]">{isOwner ? "Administração" : "Mural"}</p>
                <h2 className="text-2xl font-black">{isOwner ? "Escolas cadastradas" : "Informações recentes"}</h2>
              </div>
              {isOwner ? <Building2 className="text-[#176b5b]" /> : <Bell className="text-[#176b5b]" />}
            </div>

            {isOwner ? (
              schools.length ? (
                <div className="grid gap-3">
                  {schools.map((school) => (
                    <article className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4" key={school.id}>
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9f6f2] text-[#176b5b]">
                        <Building2 size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-black">{school.nome}</h3>
                        <p className="mt-1 text-sm capitalize text-slate-500">Status: {school.status}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState description="Cadastre a primeira escola para iniciar a operação." title="Nenhuma escola cadastrada" />
              )
            ) : announcements.length ? (
              <div className="grid gap-3">
                {announcements.map((announcement) => (
                  <article className="rounded-2xl border border-slate-200 p-4" key={announcement.id}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
                        <MessageSquareText size={19} />
                      </div>
                      <div>
                        <h3 className="font-black">{announcement.titulo}</h3>
                        {announcement.resumo ? <p className="mt-1 text-sm leading-6 text-slate-500">{announcement.resumo}</p> : null}
                        <p className="mt-2 text-xs font-semibold text-slate-400">{formatDate(announcement.publicado_em)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description="Quando a escola publicar um comunicado, ele aparecerá aqui."
                title="Nenhuma informação nova"
              />
            )}
          </div>

          <aside className="card p-5 sm:p-6">
            <p className="text-sm font-bold text-[#176b5b]">Hoje</p>
            <h2 className="text-2xl font-black">Visão rápida</h2>
            <div className="mt-5 grid gap-3">
              {isOwner ? (
                <>
                  <StatusItem icon={<Building2 size={20} />} label="Escolas" value={`${schools.length} cadastrada(s)`} />
                  <StatusItem icon={<UserPlus size={20} />} label="Convites pendentes" value={`${pendingInvites}`} />
                  <StatusItem icon={<CheckCircle2 size={20} />} label="Sistema" value="Estrutura inicial pronta" />
                </>
              ) : (
                <>
                  <StatusItem icon={<CheckCircle2 size={20} />} label="Comunicados" value="Em dia" />
                  <StatusItem icon={<ClipboardList size={20} />} label="Atividades" value="Ver pendências" />
                  <StatusItem icon={<CalendarDays size={20} />} label="Próxima reunião" value="Sem agendamento" />
                </>
              )}
            </div>
          </aside>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          <NavItem active icon={<House size={21} />} label="Início" />
          <NavItem icon={isOwner ? <Building2 size={21} /> : <Bell size={21} />} label={isOwner ? "Escolas" : "Mural"} />
          <NavItem icon={isOwner ? <UserPlus size={21} /> : <ClipboardList size={21} />} label={isOwner ? "Convites" : "Atividades"} />
          <NavItem icon={isOwner ? <Settings size={21} /> : <UsersRound size={21} />} label={isOwner ? "Config." : isGuardian ? "Filhos" : "Turmas"} />
        </div>
      </nav>
    </main>
  );
}

const ownerShortcuts = [
  { label: "Escolas", description: "Cadastros e situação das escolas", Icon: Building2 },
  { label: "Convites", description: "Autorize novos acessos", Icon: UserPlus },
  { label: "Usuários", description: "Gerencie perfis e permissões", Icon: UsersRound },
  { label: "Configurações", description: "Ajustes gerais do sistema", Icon: Settings }
];

const guardianShortcuts = [
  { label: "Comunicados", description: "Avisos da escola e da turma", Icon: Bell },
  { label: "Atividades", description: "Tarefas e trabalhos pendentes", Icon: ClipboardList },
  { label: "Reuniões", description: "Datas, horários e registros", Icon: CalendarDays },
  { label: "Meus filhos", description: "Acompanhamento individual", Icon: UsersRound }
];

const staffShortcuts = [
  { label: "Comunicado", description: "Publique uma informação", Icon: Bell },
  { label: "Registrar aula", description: "Conteúdo e tarefa do dia", Icon: BookOpenText },
  { label: "Atividade", description: "Crie e acompanhe entregas", Icon: ClipboardList },
  { label: "Reunião", description: "Agende com os responsáveis", Icon: CalendarDays }
];

function roleLabel(role?: Profile["papel"]) {
  const labels = {
    direcao: "Direção",
    coordenacao: "Coordenação",
    professor: "Professor",
    responsavel: "Responsável"
  };
  return role ? labels[role] : "Portal escolar";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(new Date(value));
}

function AccessPending() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-5">
      <section className="card max-w-lg p-7 text-center">
        <GraduationCap className="mx-auto text-[#176b5b]" size={48} />
        <h1 className="mt-5 text-2xl font-black">Acesso aguardando autorização</h1>
        <p className="mt-3 leading-7 text-slate-500">
          Sua conta foi criada, mas ainda não está vinculada a uma escola ou à administração do sistema.
        </p>
        <div className="mt-6 flex justify-center">
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center">
      <p className="font-black">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function StatusItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
      <span className="text-[#176b5b]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black">{label}</span>
        <span className="block truncate text-xs text-slate-500">{value}</span>
      </span>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button className={`grid min-h-14 place-items-center rounded-xl text-xs font-bold ${active ? "text-[#176b5b]" : "text-slate-500"}`} type="button">
      {icon}
      <span>{label}</span>
    </button>
  );
}
