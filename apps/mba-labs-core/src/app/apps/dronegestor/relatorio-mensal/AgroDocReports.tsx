"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Download,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  FileSpreadsheet,
  Table2,
} from "lucide-react";
import {
  AgroDocHero,
  AgroDocCard,
  AgroDocKpiCard,
  AgroDocTable,
  AgroDocEmpty,
  AgroDocStatus,
  AgroDocError,
  useAgroData,
  ROOT,
  currentAgroMonth,
} from "../AgroDocUi";
import { OfficialMapTemplateManager } from "./OfficialMapTemplateManager";
type Summary = {
  municipio?: string;
  uf?: string;
  registroAnac?: string;
  cultura?: string;
  areaHa?: number;
  areaConcluidaHa?: number;
  totalCaldaRealL?: number;
  totalCaldaL?: number;
  produtos?: { nome: string; dose: number; unidade: string }[];
  ordemServicoNumero?: string;
};
type Review = {
  status: string;
  horasAplicacao?: string;
  classe?: string;
  tipoServico?: string;
  tipoAeronave?: string;
};
type Item = { id: string; summary: Summary; review: Review | null };
export function AgroDocReports({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentAgroMonth),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const reviews = useAgroData<{ items: Item[] }>(
      `/api/dronegestor/conferencia?month=${month}`,
    ),
    model = useAgroData<{
      model: { fileName: string; uploadedAt: string } | null;
    }>("/api/dronegestor/relatorio-mensal/modelo-oficial"),
    profile = useAgroData<{
      profile: {
        operadorNome?: string;
        registroMapa?: string;
        rtNome?: string;
      };
    }>("/api/dronegestor/perfil-operacional");
  const items = reviews.data?.items || [],
    approved = items.filter((x) => x.review?.status === "aprovado"),
    pending = items.filter(
      (x) =>
        x.review?.status !== "aprovado" || x.summary.produtos?.length !== 1,
    ),
    hasProfile = Boolean(
      profile.data?.profile.operadorNome &&
      profile.data?.profile.registroMapa,
    );
  const ready = Boolean(
    reviews.data &&
    model.data?.model &&
    hasProfile &&
    !pending.length,
  );
  async function download() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/dronegestor/relatorio-mensal/xlsx?month=${encodeURIComponent(month)}`,
        { cache: "no-store" },
      );
      if (!r.ok) {
        const p = await r.json();
        throw new Error(p.error || "Exportação bloqueada.");
      }
      if (r.headers.get("X-DroneGestor-Modelo") !== "oficial-2026-validado")
        throw new Error(
          "Arquivo não identificado como modelo oficial validado.",
        );
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-MAPA-oficial-2026-${month}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <AgroDocHero
        variant="reports"
        title={
          <>
            Relatórios <em>MAPA</em>
          </>
        }
        description="Consolidação mensal, conferência e exportação do modelo oficial 2026."
      />
      <div className="agro-toolbar agro-toolbar-reports">
        <input
          type="month"
          aria-label="Competência do relatório"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <Link className="agro-button agro-report-operator" href={`${ROOT}/perfil-operacional`} title={profile.data?.profile.operadorNome || "Perfil do operador"} aria-label="Abrir perfil do operador">
          {profile.data?.profile.operadorNome || "Perfil do operador"}
        </Link>
        <button
          className="agro-button"
          onClick={() => {
            reviews.refresh();
            model.refresh();
            profile.refresh();
          }}
        >
          <RefreshCw size={20} />
          Atualizar
        </button>
        <button
          className="agro-button agro-button-primary"
          disabled={!ready || busy}
          onClick={() => void download()}
        >
          <Download size={20} />
          {busy ? "Gerando..." : "Baixar XLSX oficial"}
        </button>
      </div>
      <div className="agro-kpis">
        <AgroDocKpiCard
          title="Operações aprovadas"
          icon={ShieldCheck}
          value={reviews.data ? approved.length : "—"}
        />
        <AgroDocKpiCard
          title="Linhas conferidas"
          value={
            reviews.data
              ? approved.filter((x) => x.summary.produtos?.length === 1).length
              : "—"
          }
        />
        <AgroDocKpiCard
          title="Pendências bloqueantes"
          icon={TriangleAlert}
          value={
            reviews.data
              ? pending.length +
                (model.data && !model.data.model ? 1 : 0) +
                (profile.data && !hasProfile ? 1 : 0)
              : "—"
          }
        />
        <AgroDocKpiCard
          title="Modelo oficial carregado"
          icon={FileSpreadsheet}
          value={model.data ? (model.data.model ? "2026" : "Ausente") : "—"}
        />
      </div>
      <AgroDocError
        error={error || reviews.error || model.error || profile.error}
      />
      <div className="agro-two-col">
        <AgroDocCard title="Resumo da competência">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
              flexWrap: "wrap",
            }}
          >
            <div
              className="agro-donut"
              style={{
                background: items.length
                  ? `conic-gradient(#169a30 ${(approved.length / items.length) * 100}%, #edaf28 0)`
                  : "#dce4de",
              }}
            >
              <b>{reviews.data ? items.length : "—"}</b>
              <small>operações</small>
            </div>
            <div className="agro-stack" style={{ flex: 1 }}>
              {[
                [
                  "Operações conferidas",
                  Boolean(reviews.data && items.length && !pending.length),
                ],
                ["Modelo oficial 2026 cadastrado", Boolean(model.data?.model)],
                ["Perfil operacional preenchido", hasProfile],
                [
                  "Horas efetivas revisadas",
                  Boolean(
                    approved.length &&
                    approved.every((x) => x.review?.horasAplicacao),
                  ),
                ],
              ].map(([label, ok]) => (
                <div className="agro-row" key={String(label)}>
                  <AgroDocStatus tone={ok ? "good" : "warn"}>
                    {ok ? "✓" : "!"}
                  </AgroDocStatus>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </AgroDocCard>
        <AgroDocCard title="Pendências para exportação" icon={TriangleAlert}>
          {pending.slice(0, 3).map((x) => (
            <Link
              key={x.id}
              href={`${ROOT}/conferencia?month=${month}&operation=${encodeURIComponent(x.id)}`}
              className="agro-row"
              style={{ color: "inherit" }}
            >
              <FileSpreadsheet />
              <div>
                <b>
                  Operação {x.summary.ordemServicoNumero || x.id.slice(0, 8)}
                </b>
                <small>
                  {x.summary.produtos?.length !== 1
                    ? "Conferir produtos sem duplicar área e horas."
                    : "Operação ainda não aprovada."}
                </small>
              </div>
            </Link>
          ))}
          {!model.data?.model && (
            <p className="agro-form-note">
              Cadastre o XLSX oficial para liberar a exportação.
            </p>
          )}
          {!hasProfile && (
            <Link className="agro-row" href={`${ROOT}/perfil-operacional`}>
              Completar perfil operacional →
            </Link>
          )}
          {!pending.length && ready && (
            <AgroDocEmpty>
              Sem pendências na conferência. O servidor valida os dados
              novamente ao exportar.
            </AgroDocEmpty>
          )}
          <Link
            className="agro-soft-link"
            href={`${ROOT}/conferencia?month=${month}`}
          >
            Ver todas as pendências →
          </Link>
        </AgroDocCard>
      </div>
      <div className="agro-two-col" style={{ marginTop: 20 }}>
        <AgroDocCard title="Prévia dos dados da planilha oficial" icon={Table2}>
          <AgroDocTable
            head={[
              "UF",
              "Município",
              "Tipo aeronave",
              "Prefixo",
              "Horas efetivas",
              "Cultura",
              "Tipo de serviço",
              "Classe",
              "Área (ha)",
              "Produto",
              "Volume (L)",
              "Dosagem",
            ]}
          >
            {approved.slice(0, 8).map((x) => (
              <tr key={x.id}>
                <td>{x.summary.uf}</td>
                <td>{x.summary.municipio}</td>
                <td>{x.review?.tipoAeronave}</td>
                <td>{x.summary.registroAnac}</td>
                <td>{x.review?.horasAplicacao}</td>
                <td>{x.summary.cultura}</td>
                <td>{x.review?.tipoServico}</td>
                <td>{x.review?.classe}</td>
                <td>{x.summary.areaConcluidaHa ?? x.summary.areaHa}</td>
                <td>{x.summary.produtos?.[0]?.nome}</td>
                <td>
                  {x.summary.totalCaldaRealL ?? x.summary.totalCaldaL ?? "—"}
                </td>
                <td>
                  {x.summary.produtos?.[0]?.dose}{" "}
                  {x.summary.produtos?.[0]?.unidade}
                </td>
              </tr>
            ))}
          </AgroDocTable>
          {!approved.length && (
            <AgroDocEmpty>
              Nenhuma operação aprovada nesta competência.
            </AgroDocEmpty>
          )}
        </AgroDocCard>
        <AgroDocCard title="Arquivos oficiais">
          <OfficialMapTemplateManager />
        </AgroDocCard>
      </div>
      <details style={{ marginTop: 22 }}>
        <summary className="agro-button">
          Abrir relatório operacional para impressão e dados detalhados
        </summary>
        <div className="agro-legacy">{children}</div>
      </details>
    </>
  );
}
