"use client";
import { AgroDocDroneIcon as Drone } from "./AgroDocDroneIcon";
import Link from "next/link";
import {
  CalendarDays,
  ChartNoAxesColumn,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Folder,
  Leaf,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
  Upload,
  Camera,
  CloudSun,
} from "lucide-react";
import {
  AgroDocCard,
  AgroDocHero,
  AgroDocKpiCard,
  AgroDocEmpty,
  AgroDocFlow,
  AgroDocError,
  useAgroData,
  ROOT,
} from "./AgroDocUi";
import { useEffect, useState } from "react";
type History = {
  items?: {
    id: string;
    created_at: string;
    detalhes?: { summary?: { finalizadaEm?: string } };
  }[];
};
type Diagnostic = {
  diagnostico?: {
    checklist?: Record<string, { status: string; validade?: string }>;
  };
};
type Corrections = {
  items: { id: string; ordemServicoNumero: string; motivo: string }[];
};
type AssignedOrders = {items?: {entityId:string;data?:{status?:string}}[]};
type State = {
  state?: {
    mission?: { ordemServicoId?: string };
    weather?: { temperature?: number; windSpeed?: number; capturedAt?: string };
  };
};
export function DroneHomeDashboard({
  userName,
  canManage,
}: {
  userName: string;
  canManage: boolean;
}) {
  const history = useAgroData<History>(
      "/api/dronegestor/state?history=1&limit=500",
    ),
    diagnostic = useAgroData<Diagnostic>("/api/dronegestor/diagnostico"),
    corrections = useAgroData<Corrections>(
      "/api/dronegestor/minhas-pendencias",
    ),
    weather = useAgroData<State>("/api/dronegestor/state"),
    assignedOrders = useAgroData<AssignedOrders>("/api/dronegestor/cadastros?type=os");
  const activeOs = weather.data?.state?.mission?.ordemServicoId;
  const recentDocs = useAgroData<{
    items: { id: string; nome: string; uploadedAt: string }[];
  }>(
    activeOs
      ? `/api/dronegestor/documentos?osId=${encodeURIComponent(activeOs)}`
      : null,
  );
  const [months, setMonths] = useState(6),
    [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const checklist = Object.values(
      diagnostic.data?.diagnostico?.checklist || {},
    ),
    applicable = checklist.filter((x) => x.status !== "nao_aplica"),
    done = applicable.filter((x) => x.status === "concluido").length;
  const pending = checklist.filter(
      (x) => !["concluido", "nao_aplica"].includes(x.status),
    ).length,
    upcoming = checklist.filter(
      (x) =>
        x.validade &&
        Date.parse(x.validade) >= Date.now() &&
        Date.parse(x.validade) <= Date.now() + 30 * 86400000,
    ).length;
  const items = history.data?.items || [],
    now = new Date(),
    labels = Array.from(
      { length: months },
      (_, i) => new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1),
    );
  const series = labels.map((d) => ({
    label: d.toLocaleDateString("pt-BR", { month: "short" }),
    n: items.filter((x) => {
      const date = new Date(x.detalhes?.summary?.finalizadaEm || x.created_at);
      return (
        date.getMonth() === d.getMonth() &&
        date.getFullYear() === d.getFullYear()
      );
    }).length,
  }));
  const max = Math.max(1, ...series.map((x) => x.n));
  const w = weather.data?.state?.weather;
  const weatherTimestamp = w?.capturedAt ? Date.parse(w.capturedAt) : Number.NaN;
  const weatherFresh = Number.isFinite(weatherTimestamp) && weatherTimestamp <= Date.now() && (Date.now()-weatherTimestamp) < 30*60*1000;
  const activeOrderStatuses = new Set(["aberta","preparacao","em_preparacao","em_execucao","suspensa"]);
  const orderIds = new Set<string>();
  const activeOrdersCount = assignedOrders.data ? (assignedOrders.data.items ?? []).filter(x => {
    if (!x.entityId || orderIds.has(x.entityId)) return false;
    orderIds.add(x.entityId);
    return activeOrderStatuses.has(String(x.data?.status || ""));
  }).length : "—";
  return (
    <>
      <div className="agro-home agro-home-desktop">
        <AgroDocHero
          large
          title={
            <>
              MBA <em>AgroDoc</em>
            </>
          }
          description="Gestão e regularização de operações com drones agrícolas"
        />
        <div className="agro-kpis">
          <AgroDocKpiCard
            icon={ShieldCheck}
            title="Status da regularização"
            value={
              diagnostic.data
                ? applicable.length
                  ? `${Math.round((done / applicable.length) * 100)}%`
                  : "Sem dados"
                : "—"
            }
            note="Conforme diagnóstico registrado"
            href={`${ROOT}/diagnostico`}
          />
          <AgroDocKpiCard
            icon={Drone}
            title="Operações do mês"
            value={history.data ? series.at(-1)?.n : "—"}
            note="Registros finalizados do período"
            href={`${ROOT}/gestao`}
          />
          <AgroDocKpiCard
            icon={TriangleAlert}
            title="Pendências"
            value={diagnostic.data ? pending : "—"}
            note="Itens do diagnóstico a conferir"
            href={`${ROOT}/diagnostico`}
          />
          <AgroDocKpiCard
            icon={CalendarDays}
            title="Próximos vencimentos"
            value={diagnostic.data ? upcoming : "—"}
            note="Vencimentos nos próximos 30 dias"
            href={`${ROOT}/diagnostico`}
          />
        </div>
        <AgroDocError error={history.error || diagnostic.error} />
        <AgroDocCard
          title="Fluxo da regularização e operação com drones"
          action={
            <Link href={`${ROOT}/regulacao`}>Ver detalhes do fluxo ↗</Link>
          }
        >
          <AgroDocFlow />
        </AgroDocCard>
        <div className="agro-home-bottom">
          <AgroDocCard
            title="Operações por mês"
            icon={ChartNoAxesColumn}
            action={
              <select
                aria-label="Período do gráfico"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
              >
                <option value={6}>Últimos 6 meses</option>
                <option value={3}>Últimos 3 meses</option>
              </select>
            }
          >
            <div
              className="agro-chart"
              aria-label="Operações finalizadas por mês"
            >
              {series.map((x) => (
                <div key={x.label}>
                  <b>{history.data ? x.n : "—"}</b>
                  <i style={{ height: `${(x.n / max) * 100}%` }} />
                  <small>{x.label}</small>
                </div>
              ))}
            </div>
            <small style={{ marginTop: 20, color: "#5a685f" }}>
              Histórico disponível: até 500 registros.{" "}
              {canManage
                ? "Visão conforme acesso da empresa."
                : "Somente suas operações."}
            </small>
          </AgroDocCard>
          <AgroDocCard title="Correções pendentes" icon={TriangleAlert}>
            {corrections.data?.items.length ? (
              corrections.data.items.slice(0, 3).map((x) => (
                <Link className="agro-row" key={x.id} href={`${ROOT}/fichas`}>
                  <FileText />
                  <div>
                    <b>{x.ordemServicoNumero || "Operação"}</b>
                    <small>{x.motivo}</small>
                  </div>
                  <ChevronRight />
                </Link>
              ))
            ) : (
              <AgroDocEmpty>
                {corrections.error || "Nenhuma correção solicitada para você."}
              </AgroDocEmpty>
            )}
            <Link className="agro-soft-link" href={`${ROOT}/fichas`}>
              Ver minhas operações <ChevronRight size={16} />
            </Link>
          </AgroDocCard>
          <AgroDocCard title="Últimos documentos" icon={FileText}>
            {recentDocs.data?.items.length ? (
              recentDocs.data.items.slice(0, 3).map((d) => (
                <Link
                  className="agro-row"
                  key={d.id}
                  href={`${ROOT}/documentos?osId=${encodeURIComponent(activeOs || "")}`}
                >
                  <FileText />
                  <div>
                    <b>{d.nome}</b>
                    <small>
                      {new Date(d.uploadedAt).toLocaleDateString("pt-BR")}
                    </small>
                  </div>
                </Link>
              ))
            ) : (
              <AgroDocEmpty>
                {recentDocs.error ||
                  "Selecione uma OS para consultar os documentos autorizados."}
              </AgroDocEmpty>
            )}
            <Link className="agro-soft-link" href={`${ROOT}/documentos`}>
              Ver todos os documentos <ChevronRight size={16} />
            </Link>
          </AgroDocCard>
        </div>
      </div>
      <div className="agro-pilot-mobile">
        <div className="agro-pilot-hero">
          <div className="agro-pilot-brand">
            <Leaf /> MBA <em>AgroDoc</em>
          </div>
          <div className="agro-pilot-weather">
            <b>Condições de voo</b>
            <p>
              {weatherFresh
                ? `${w?.temperature ?? "—"} °C · ${w?.windSpeed ?? "—"} km/h`
                : "Dados meteorológicos desatualizados"}
            </p>
            <small>
              {weatherFresh && w?.capturedAt
                ? `Modelo meteorológico · ${new Date(w.capturedAt).toLocaleString("pt-BR")} · Confirme no local`
                : w?.capturedAt
                  ? `Último registro: ${new Date(w.capturedAt).toLocaleString("pt-BR")}. Atualize antes do voo.`
                  : "Sem registro recente. Confirme as condições no local antes do voo."}
            </small>
          </div>
        </div>
        <Link className="agro-pilot-register" href={`${ROOT}/campo`}>
          <Drone /> Registrar operação <ChevronRight />
        </Link>
        {!online && (
          <p role="status" className="agro-form-note">
            Sem conexão. Continue no campo e acompanhe o estado de sincronização
            antes de sair.
          </p>
        )}
        <h2>Status das operações</h2>
        <div className="agro-pilot-counts">
          <Link href={`${ROOT}/fichas`}>
            <b>{history.data ? items.length : "—"}</b>Finalizadas
          </Link>
          <Link href={`${ROOT}/gestao`}>
            <b>{activeOrdersCount}</b>Em andamento
          </Link>
          <Link href={`${ROOT}/fichas`}>
            <b>{corrections.data?.items.length ?? "—"}</b>Com correção
          </Link>
        </div>
        <Link className="agro-pilot-notice" href={`${ROOT}/fichas`}>
          <TriangleAlert />
          <div>
            <b>Correções pendentes</b>
            <small>
              {corrections.data
                ? `${corrections.data.items.length} operação(ões) para conferir`
                : "Consultar minhas pendências"}
            </small>
          </div>
          <ChevronRight />
        </Link>
        <Link className="agro-pilot-files" href={`${ROOT}/documentos`}>
          <Upload />
          <div>
            <b>Enviar documentos</b>
            <small>Receituário, mapas, fotos e evidências</small>
          </div>
          <ChevronRight />
        </Link>
        <section className="agro-pilot-flow">
          <h2>Fluxo guiado da operação</h2>
          <div className="agro-pilot-steps">
            {[
              { icon: Drone, label: "Dados da operação", path: "campo" },
              { icon: CloudSun, label: "Condições climáticas", path: "campo" },
              { icon: Camera, label: "Evidências", path: "documentos" },
              {
                icon: Send,
                label: "Enviar para conferência",
                path: "pacote-operacao",
              },
            ].map(({ icon: Icon, label, path }) => (
              <Link key={path + label} href={`${ROOT}/${path}`}>
                <Icon />
                {label}
              </Link>
            ))}
          </div>
        </section>
        <p style={{ marginTop: 16, fontSize: 12, color: "#5a7162" }}>
          Olá, {userName.split(" ")[0]}. Seus registros e anexos seguem
          vinculados à sua conta.
        </p>
      </div>
    </>
  );
}
