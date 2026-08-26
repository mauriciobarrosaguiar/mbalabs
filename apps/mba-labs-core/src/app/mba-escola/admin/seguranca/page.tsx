"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileLock2,
  FileText,
  HardDrive,
  History,
  LoaderCircle,
  RefreshCw,
  Save,
  School,
  ShieldCheck,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMbaEscolaSupabase } from "@/lib/mba-escola/supabase-client";

const supabase = getMbaEscolaSupabase();

type SchoolRow = { id: string; nome: string; status: string; cnpj: string | null };
type PolicyRow = {
  escola_id: string;
  retencao_dias: number | null;
  exclusao_automatica: boolean;
  orfao_grace_horas: number;
  atualizado_em: string;
};
type PolicyDraft = { retencao_dias: string; exclusao_automatica: boolean; orfao_grace_horas: string };
type StatusRow = {
  metadata_ativos: number;
  metadata_excluidos: number;
  storage_total: number;
  storage_orfaos: number;
  metadata_sem_arquivo: number;
  exclusoes_pendentes_storage: number;
};
type DocumentRow = {
  id: string;
  escola_id: string;
  nome_arquivo: string;
  storage_path: string;
  mime_type: string | null;
  tamanho: number | null;
  criado_em: string;
  excluido_em: string | null;
  motivo_exclusao: string | null;
  escola?: { nome?: string } | null;
};
type AuditRow = {
  id: string;
  acao: string;
  recurso: string;
  recurso_id: string | null;
  detalhes: unknown;
  criado_em: string;
  escola?: { nome?: string } | null;
};
type EdgeResult = {
  ok?: boolean;
  candidatos?: number;
  removidos?: number;
  dryRun?: boolean;
  metadataAtivos?: number;
  metadataExcluidos?: number;
  storageTotal?: number;
  storageOrfaos?: number;
  metadataSemArquivo?: number;
  exclusoesPendentesStorage?: number;
};

const field = "min-h-11 w-full rounded-xl border border-[#DCE2EC] bg-white px-3 py-2 text-sm text-[#172033] outline-none transition focus:border-[#6574D9] focus:ring-4 focus:ring-[#EEF1FF]";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#4353C7] px-4 font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-[#3948B6] disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE2EC] bg-white px-3 text-sm font-bold text-[#465169] shadow-sm transition hover:bg-[#F7F8FC] disabled:cursor-not-allowed disabled:opacity-50";
const danger = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-sm font-bold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:opacity-50";
const emptyStatus: StatusRow = {
  metadata_ativos: 0,
  metadata_excluidos: 0,
  storage_total: 0,
  storage_orfaos: 0,
  metadata_sem_arquivo: 0,
  exclusoes_pendentes_storage: 0
};

export default function MbaEscolaSecurityPage() {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PolicyDraft>>({});
  const [status, setStatus] = useState<StatusRow>(emptyStatus);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      window.location.assign("/login?next=/mba-escola/admin/seguranca");
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("escola_super_admins")
      .select("user_id,ativo")
      .eq("user_id", session.user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (adminError || !admin) {
      setAuthorized(false);
      setError(adminError?.message || "Acesso restrito ao ADMIN MBA.");
      setLoading(false);
      return;
    }

    setAuthorized(true);
    const [schoolRes, policyRes, statusRes, documentRes, auditRes] = await Promise.all([
      supabase.from("escola_escolas").select("id,nome,status,cnpj").order("nome"),
      supabase.from("escola_documento_politicas").select("escola_id,retencao_dias,exclusao_automatica,orfao_grace_horas,atualizado_em"),
      supabase.rpc("escola_document_privacy_status"),
      supabase
        .from("escola_justificativa_arquivos")
        .select("id,escola_id,nome_arquivo,storage_path,mime_type,tamanho,criado_em,excluido_em,motivo_exclusao,escola:escola_escolas(nome)")
        .order("criado_em", { ascending: false })
        .limit(200),
      supabase
        .from("escola_auditoria")
        .select("id,acao,recurso,recurso_id,detalhes,criado_em,escola:escola_escolas(nome)")
        .in("recurso", ["escola_justificativa_arquivos", "escola_documento_politicas"])
        .order("criado_em", { ascending: false })
        .limit(120)
    ]);

    const firstError = [schoolRes, policyRes, statusRes, documentRes, auditRes].find(item => item.error)?.error;
    if (firstError) setError(firstError.message);

    const schoolData = (schoolRes.data ?? []) as SchoolRow[];
    const policyData = (policyRes.data ?? []) as PolicyRow[];
    setSchools(schoolData);
    setPolicies(policyData);
    setDocuments((documentRes.data ?? []) as unknown as DocumentRow[]);
    setAudit((auditRes.data ?? []) as unknown as AuditRow[]);

    const statusData = Array.isArray(statusRes.data) ? statusRes.data[0] : null;
    if (statusData) setStatus(statusData as StatusRow);

    const policyMap = new Map(policyData.map(item => [item.escola_id, item]));
    const nextDrafts: Record<string, PolicyDraft> = {};
    schoolData.forEach(school => {
      const policy = policyMap.get(school.id);
      nextDrafts[school.id] = {
        retencao_dias: policy?.retencao_dias ? String(policy.retencao_dias) : "",
        exclusao_automatica: policy?.exclusao_automatica ?? false,
        orfao_grace_horas: String(policy?.orfao_grace_horas ?? 24)
      };
    });
    setDrafts(nextDrafts);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeDocuments = useMemo(() => documents.filter(item => !item.excluido_em), [documents]);
  const deletedDocuments = useMemo(() => documents.filter(item => item.excluido_em), [documents]);
  const automaticPolicies = policies.filter(item => item.exclusao_automatica && item.retencao_dias).length;
  const issueCount = status.storage_orfaos + status.metadata_sem_arquivo + status.exclusoes_pendentes_storage;

  async function savePolicy(escolaId: string) {
    const draft = drafts[escolaId];
    if (!draft) return;

    const retention = draft.retencao_dias.trim() ? Number(draft.retencao_dias) : null;
    const grace = Number(draft.orfao_grace_horas);
    if (retention !== null && (!Number.isInteger(retention) || retention < 30 || retention > 3650)) {
      setError("A retenção deve ficar entre 30 e 3.650 dias, ou ser deixada em branco.");
      return;
    }
    if (draft.exclusao_automatica && retention === null) {
      setError("Defina o prazo de retenção antes de habilitar a exclusão por retenção.");
      return;
    }
    if (!Number.isInteger(grace) || grace < 1 || grace > 168) {
      setError("A carência de arquivos órfãos deve ficar entre 1 e 168 horas.");
      return;
    }

    setWorking(`policy-${escolaId}`);
    setMessage("");
    setError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setWorking("");
      setError("Sessão expirada.");
      return;
    }

    const { error: actionError } = await supabase.from("escola_documento_politicas").upsert({
      escola_id: escolaId,
      retencao_dias: retention,
      exclusao_automatica: draft.exclusao_automatica,
      orfao_grace_horas: grace,
      atualizado_por: userId,
      atualizado_em: new Date().toISOString()
    }, { onConflict: "escola_id" });

    if (actionError) setError(actionError.message);
    else {
      setMessage("Política de retenção atualizada e registrada na auditoria.");
      await load();
    }
    setWorking("");
  }

  async function invokePrivacy(action: string, body: Record<string, unknown> = {}) {
    const { data, error: actionError } = await supabase.functions.invoke("mba-escola-document-privacy", {
      body: { action, ...body }
    });
    if (actionError) throw actionError;
    return (data ?? {}) as EdgeResult;
  }

  async function simulateRetention() {
    setWorking("simulate");
    setMessage("");
    setError("");
    try {
      const result = await invokePrivacy("cleanup_retention", { dryRun: true });
      setMessage(`Simulação concluída: ${result.candidatos ?? 0} documento(s) atingiram o prazo configurado. Nenhum arquivo foi apagado.`);
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setWorking("");
    }
  }

  async function executeRetention() {
    const confirmation = window.prompt("Esta ação pode excluir documentos definitivamente. Digite EXCLUIR para continuar.");
    if (confirmation !== "EXCLUIR") return;

    setWorking("retention");
    setMessage("");
    setError("");
    try {
      const result = await invokePrivacy("cleanup_retention", { dryRun: false });
      setMessage(`Retenção executada: ${result.removidos ?? 0} documento(s) removidos com trilha de auditoria.`);
      await load();
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setWorking("");
    }
  }

  async function cleanupOrphans() {
    if (!window.confirm("Limpar arquivos órfãos que já ultrapassaram a carência configurada? Arquivos recentes permanecerão protegidos.")) return;
    setWorking("orphans");
    setMessage("");
    setError("");
    try {
      const result = await invokePrivacy("cleanup_orphans");
      setMessage(`Limpeza concluída: ${result.removidos ?? 0} arquivo(s) órfão(s) removido(s).`);
      await load();
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setWorking("");
    }
  }

  async function deleteDocument(item: DocumentRow) {
    const reason = window.prompt(`Informe o motivo da exclusão definitiva de “${item.nome_arquivo}”.`);
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) setError("Informe um motivo com pelo menos 5 caracteres.");
      return;
    }
    if (!window.confirm("Confirmar exclusão segura? O arquivo ficará bloqueado imediatamente e a ação será auditada.")) return;

    setWorking(`delete-${item.id}`);
    setMessage("");
    setError("");
    try {
      await invokePrivacy("delete_document", { documentId: item.id, reason: reason.trim() });
      setMessage("Documento excluído pelo fluxo seguro e registrado na auditoria.");
      await load();
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return (
      <main className="cotacoes-module grid min-h-screen place-items-center bg-[#F6F8FC] text-[#172033]">
        <div className="grid justify-items-center gap-3 text-[#4353C7]">
          <LoaderCircle className="animate-spin" size={38} />
          <p className="text-sm font-bold text-slate-500">Carregando Segurança e LGPD...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="cotacoes-module grid min-h-screen place-items-center bg-[#F6F8FC] p-4 text-[#172033]">
        <section className="w-full max-w-lg rounded-[28px] border border-rose-200 bg-white p-7 text-center shadow-sm">
          <ShieldAlert className="mx-auto text-rose-600" size={42} />
          <h1 className="mt-4 text-2xl font-black">Acesso restrito</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Esta área exige perfil ADMIN MBA e autenticação em duas etapas.</p>
          {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="cotacoes-module min-h-screen bg-[#F6F8FC] px-4 pb-12 pt-4 text-[#172033] sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-5">
        <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#3546AE] via-[#5061D3] to-[#1FA69A] p-5 text-white shadow-[0_28px_70px_-44px_rgba(47,55,130,0.8)] sm:p-7">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-white/75">
                <ShieldCheck size={16} /> Centro de proteção
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Segurança e LGPD</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80 sm:text-base">
                Controle documentos escolares sensíveis, retenção, integridade do Storage e histórico de exclusões em uma área protegida por MFA.
              </p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 ${issueCount === 0 ? "border-emerald-200/40 bg-emerald-400/15" : "border-amber-200/50 bg-amber-300/15"}`}>
              <p className="text-xs font-black uppercase tracking-[.12em] text-white/70">Saúde documental</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-black">
                {issueCount === 0 ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                {issueCount === 0 ? "Sem inconsistências" : `${issueCount} ponto(s) de atenção`}
              </p>
            </div>
          </div>
        </section>

        {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</p> : null}
        {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard icon={FileLock2} label="Documentos ativos" value={status.metadata_ativos} />
          <StatCard icon={History} label="Excluídos" value={status.metadata_excluidos} />
          <StatCard icon={HardDrive} label="Arquivos no Storage" value={status.storage_total} />
          <StatCard icon={AlertTriangle} label="Órfãos" value={status.storage_orfaos} warning={status.storage_orfaos > 0} />
          <StatCard icon={Database} label="Metadados sem arquivo" value={status.metadata_sem_arquivo} warning={status.metadata_sem_arquivo > 0} />
          <StatCard icon={Trash2} label="Exclusões pendentes" value={status.exclusoes_pendentes_storage} warning={status.exclusoes_pendentes_storage > 0} />
        </section>

        <Panel title="Ações de segurança" subtitle="Rotinas destrutivas exigem confirmação explícita e são executadas pela função protegida com MFA.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <button className={secondary} onClick={() => void load()} disabled={Boolean(working)} type="button">
              <RefreshCw size={17} /> Atualizar diagnóstico
            </button>
            <button className={secondary} onClick={() => void simulateRetention()} disabled={Boolean(working)} type="button">
              {working === "simulate" ? <LoaderCircle className="animate-spin" size={17} /> : <Clock3 size={17} />}
              Simular retenção
            </button>
            <button className={danger} onClick={() => void cleanupOrphans()} disabled={Boolean(working) || status.storage_orfaos === 0} type="button">
              {working === "orphans" ? <LoaderCircle className="animate-spin" size={17} /> : <Trash2 size={17} />}
              Limpar órfãos
            </button>
            <button className={danger} onClick={() => void executeRetention()} disabled={Boolean(working) || automaticPolicies === 0} type="button">
              {working === "retention" ? <LoaderCircle className="animate-spin" size={17} /> : <ShieldAlert size={17} />}
              Executar retenção
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            “Simular retenção” nunca apaga arquivos. “Executar retenção” considera somente escolas com prazo definido e exclusão por retenção habilitada.
          </p>
        </Panel>

        <Panel title="Retenção por escola" subtitle="Defina por quanto tempo comprovantes e atestados devem permanecer guardados. A exclusão por retenção começa desativada.">
          <div className="grid gap-3 xl:grid-cols-2">
            {schools.length ? schools.map(school => {
              const draft = drafts[school.id] ?? { retencao_dias: "", exclusao_automatica: false, orfao_grace_horas: "24" };
              const policy = policies.find(item => item.escola_id === school.id);
              return (
                <article className="rounded-2xl border border-[#E5EAF2] bg-[#FAFBFD] p-4" key={school.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 font-black"><School size={17} className="text-[#4353C7]" /> {school.nome}</p>
                      <p className="mt-1 text-xs text-slate-500">{school.cnpj ? formatCnpj(school.cnpj) : "CNPJ não informado"} · {school.status}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${draft.exclusao_automatica ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                      {draft.exclusao_automatica ? "Retenção habilitada" : "Somente retenção manual"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-bold text-[#465169]">
                      Prazo de retenção (dias)
                      <input
                        className={field}
                        inputMode="numeric"
                        min={30}
                        max={3650}
                        placeholder="Ex.: 365"
                        type="number"
                        value={draft.retencao_dias}
                        onChange={event => updateDraft(setDrafts, school.id, { retencao_dias: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-bold text-[#465169]">
                      Carência para órfãos (horas)
                      <input
                        className={field}
                        inputMode="numeric"
                        min={1}
                        max={168}
                        type="number"
                        value={draft.orfao_grace_horas}
                        onChange={event => updateDraft(setDrafts, school.id, { orfao_grace_horas: event.target.value })}
                      />
                    </label>
                  </div>

                  <label className="mt-4 flex items-start gap-3 rounded-xl border border-[#E1E6EF] bg-white p-3">
                    <input
                      className="mt-1 h-4 w-4 accent-[#4353C7]"
                      type="checkbox"
                      checked={draft.exclusao_automatica}
                      onChange={event => updateDraft(setDrafts, school.id, { exclusao_automatica: event.target.checked })}
                    />
                    <span>
                      <span className="block text-sm font-black">Permitir exclusão ao atingir o prazo</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">Nada é apagado silenciosamente pela tela. A rotina protegida usa esta autorização quando for executada.</span>
                    </span>
                  </label>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">{policy?.atualizado_em ? `Atualizado em ${formatDateTime(policy.atualizado_em)}` : "Política padrão"}</p>
                    <button className={primary} onClick={() => void savePolicy(school.id)} disabled={Boolean(working)} type="button">
                      {working === `policy-${school.id}` ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
                      Salvar política
                    </button>
                  </div>
                </article>
              );
            }) : <Empty text="Nenhuma escola cadastrada." />}
          </div>
        </Panel>

        <section className="grid gap-5 xl:grid-cols-2">
          <Panel title="Documentos ativos" subtitle="Somente o ADMIN MBA com MFA visualiza esta listagem global.">
            <div className="grid gap-2">
              {activeDocuments.length ? activeDocuments.slice(0, 50).map(item => (
                <article className="rounded-2xl border border-[#E8ECF3] bg-[#FAFBFD] p-4" key={item.id}>
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-black"><FileText size={16} className="shrink-0 text-[#4353C7]" /><span className="truncate">{item.nome_arquivo}</span></p>
                      <p className="mt-1 text-xs text-slate-500">{item.escola?.nome || "Escola"} · {formatDateTime(item.criado_em)} · {formatBytes(item.tamanho)}</p>
                    </div>
                    <button className={danger} disabled={Boolean(working)} onClick={() => void deleteDocument(item)} type="button">
                      {working === `delete-${item.id}` ? <LoaderCircle className="animate-spin" size={16} /> : <Trash2 size={16} />}
                      Excluir com registro
                    </button>
                  </div>
                </article>
              )) : <Empty text="Nenhum documento ativo armazenado." />}
            </div>
          </Panel>

          <Panel title="Histórico de exclusões" subtitle="Registros permanecem para auditoria mesmo depois da remoção física do arquivo.">
            <div className="grid gap-2">
              {deletedDocuments.length ? deletedDocuments.slice(0, 50).map(item => (
                <article className="rounded-2xl border border-[#E8ECF3] bg-[#FAFBFD] p-4" key={item.id}>
                  <p className="font-black">{item.nome_arquivo}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.escola?.nome || "Escola"} · excluído em {formatDateTime(item.excluido_em)}</p>
                  <p className="mt-2 rounded-xl bg-white p-2.5 text-sm text-slate-600">{item.motivo_exclusao || "Motivo não informado"}</p>
                </article>
              )) : <Empty text="Nenhum documento foi excluído até agora." />}
            </div>
          </Panel>
        </section>

        <Panel title="Auditoria de privacidade" subtitle="Últimas alterações de política e operações com documentos sensíveis.">
          <div className="grid gap-2">
            {audit.length ? audit.map(item => (
              <article className="flex flex-col justify-between gap-2 rounded-2xl border border-[#E8ECF3] bg-[#FAFBFD] p-4 sm:flex-row sm:items-center" key={item.id}>
                <div>
                  <p className="font-black">{auditLabel(item)}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.escola?.nome || "Plataforma"} · {item.recurso}</p>
                </div>
                <time className="text-xs font-bold text-slate-500">{formatDateTime(item.criado_em)}</time>
              </article>
            )) : <Empty text="Ainda não há eventos de privacidade registrados." />}
          </div>
        </Panel>
      </div>
    </main>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-[#E2E7F0] bg-white p-5 shadow-[0_18px_55px_-45px_rgba(30,41,59,0.55)] sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-black tracking-tight sm:text-xl">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function StatCard({ icon: Icon, label, value, warning = false }: { icon: typeof FileLock2; label: string; value: number; warning?: boolean }) {
  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm ${warning ? "border-amber-200" : "border-[#E4E9F1]"}`}>
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${warning ? "bg-amber-50 text-amber-700" : "bg-[#EEF1FF] text-[#4353C7]"}`}><Icon size={18} /></span>
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{label}</p>
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-[#DCE2EC] bg-[#FAFBFD] p-5 text-sm text-slate-500">{text}</p>;
}

function updateDraft(
  setter: React.Dispatch<React.SetStateAction<Record<string, PolicyDraft>>>,
  escolaId: string,
  patch: Partial<PolicyDraft>
) {
  setter(current => ({
    ...current,
    [escolaId]: { ...(current[escolaId] ?? { retencao_dias: "", exclusao_automatica: false, orfao_grace_horas: "24" }), ...patch }
  }));
}

function auditLabel(item: AuditRow) {
  if (item.acao === "documento_excluido_seguro") return "Documento excluído com segurança";
  if (item.acao === "documento_exclusao_storage_pendente") return "Exclusão física pendente";
  if (item.recurso === "escola_documento_politicas" && item.acao === "alterado") return "Política de retenção alterada";
  if (item.recurso === "escola_documento_politicas" && item.acao === "criado") return "Política de retenção criada";
  return `${item.acao} · ${item.recurso}`;
}

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Não foi possível concluir a operação de segurança.";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Araguaina"
  }).format(new Date(value));
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined) return "tamanho não informado";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCnpj(value: string) {
  const number = value.replace(/\D/g, "").slice(0, 14);
  if (number.length !== 14) return value;
  return number.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
