"use client";
import { AgroDocDroneIcon as Drone } from "./AgroDocDroneIcon";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  Clock,
  Plus,
  Search,
  TriangleAlert,
  CheckCircle2,
} from "lucide-react";
import {
  AgroDocHero,
  AgroDocCard,
  AgroDocKpiCard,
  AgroDocTable,
  AgroDocStatus,
  AgroDocFlow,
  AgroDocEmpty,
  AgroDocError,
  useAgroData,
  ROOT,
  currentAgroMonth,
} from "./AgroDocUi";
type Item = {
  osId: string;
  numero: string;
  status: string;
  stage: string;
  stageLabel: string;
  pilotName: string;
  fazenda: string;
  cultura: string;
  areaHa: number;
  dataPrevista: string;
  createdAt: string;
};
type Payload = {
  items: Item[];
  counts: {
    total: number;
    aplicando: number;
    regularizacao: number;
    prontaEncerrar: number;
  };
};
export function AgroDocOperations({
  children,
  canManage,
}: {
  children: ReactNode;
  canManage: boolean;
}) {
  const { data, error } = useAgroData<Payload>(
    canManage ? "/api/dronegestor/painel-gestor" : null,
  );
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [month, setMonth] = useState(""),
    [page, setPage] = useState(0),
    [size, setSize] = useState(6),
    [selected, setSelected] = useState<Item | null>(null),
    [editor, setEditor] = useState(false);
  const items = data?.items || [],
    filtered = items.filter(
      (x) =>
        (!status || x.stage === status) &&
        (!month || (x.dataPrevista || x.createdAt).startsWith(month)) &&
        `${x.numero} ${x.fazenda} ${x.pilotName}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    );
  const pageItems = filtered.slice(page * size, (page + 1) * size);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Araguaina",
  }).format(new Date());
  const agenda = items.filter((x) => x.dataPrevista?.startsWith(today));
  function openEditor() {
    setEditor(true);
    setTimeout(
      () =>
        document
          .getElementById("agro-operation-editor")
          ?.scrollIntoView({ behavior: "smooth" }),
      0,
    );
  }
  if (!canManage)
    return (
      <>
        <AgroDocHero
          variant="operations"
          title="Minhas operações"
          description="Ordens atribuídas a você, execução em campo e acompanhamento dos registros."
        />
        <div className="agro-legacy">{children}</div>
      </>
    );
  return (
    <>
      <AgroDocHero
        variant="operations"
        large
        title="Operações"
        description="Ordens de serviço, execução em campo e acompanhamento das aplicações."
      />
      <div className="agro-toolbar agro-toolbar-operations">
        <input
          type="search"
          aria-label="Buscar operações"
          placeholder="Buscar por OS, fazenda ou piloto"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Status das operações"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Todos os status</option>
          {Array.from(new Set(items.map((x) => x.stage))).map((s) => (
            <option key={s} value={s}>
              {items.find((x) => x.stage === s)?.stageLabel}
            </option>
          ))}
        </select>
        <input
          type="month"
          aria-label="Período das operações"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setPage(0);
          }}
        />
        {canManage ? (
          <button
            className="agro-button agro-button-primary"
            onClick={openEditor}
          >
            <Plus size={20} />
            Nova operação
          </button>
        ) : (
          <Link
            className="agro-button agro-button-primary"
            href={`${ROOT}/campo`}
          >
            <Drone size={20} />
            Abrir campo
          </Link>
        )}
      </div>
      <div className="agro-kpis">
        <AgroDocKpiCard
          title="OS ativas"
          value={data ? data.counts.total : "—"}
        />
        <AgroDocKpiCard
          title="Em campo"
          icon={Drone}
          value={data ? data.counts.aplicando : "—"}
        />
        <AgroDocKpiCard
          title="Regularização / conferência"
          icon={TriangleAlert}
          value={
            data ? data.counts.regularizacao + data.counts.prontaEncerrar : "—"
          }
        />
        <AgroDocKpiCard
          title="OS encerradas no mês"
          icon={CheckCircle2}
          value={
            data
              ? items.filter(
                  (x) =>
                    x.stage === "encerrada" &&
                    (x.dataPrevista || x.createdAt).startsWith(
                      currentAgroMonth(),
                    ),
                ).length
              : "—"
          }
          note="Conforme data prevista da OS"
        />
      </div>
      <AgroDocError error={error} />
      <div className="agro-two-col">
        <AgroDocCard
          title="Lista de operações"
          action={<small>{filtered.length} {filtered.length === 1 ? "operação" : "operações"}</small>}
        >
          <AgroDocTable
            head={[
              "OS",
              "Fazenda",
              "Piloto",
              "Cultura",
              "Área",
              "Data",
              "Status",
            ]}
          >
            {pageItems.map((x) => (
              <tr
                key={x.osId}
                onClick={() => setSelected(x)}
                style={{
                  background: selected?.osId === x.osId ? "#ecf8eb" : undefined,
                }}
              >
                <td>
                  <button
                    style={{ color: "#00572e", fontWeight: 700 }}
                    onClick={() => setSelected(x)}
                  >
                    {x.numero}
                  </button>
                </td>
                <td>{x.fazenda}</td>
                <td>{x.pilotName}</td>
                <td>{x.cultura || "—"}</td>
                <td>{x.areaHa.toLocaleString("pt-BR")} ha</td>
                <td>
                  {x.dataPrevista
                    ? new Date(
                        x.dataPrevista.slice(0, 10) + "T12:00:00",
                      ).toLocaleDateString("pt-BR")
                    : "—"}
                </td>
                <td>
                  <AgroDocStatus
                    tone={
                      x.stage === "encerrada"
                        ? "good"
                        : x.stage === "cancelada"
                          ? "bad"
                          : "warn"
                    }
                  >
                    {x.stageLabel}
                  </AgroDocStatus>
                </td>
              </tr>
            ))}
          </AgroDocTable>
          {!pageItems.length && (
            <AgroDocEmpty>
              {data
                ? "Nenhuma operação corresponde aos filtros."
                : error
                  ? "Consulta indisponível."
                  : "Carregando operações..."}
            </AgroDocEmpty>
          )}
          <div
            className="agro-toolbar agro-operation-pagination"
            style={{ border: 0, marginTop: 16, padding: 0 }}
          >
            <button className="agro-button" onClick={openEditor}>
              <Search size={16} />
              Ver gestão e atribuição
            </button>
            <select
              aria-label="Itens por página"
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                setPage(0);
              }}
            >
              {[6, 10, 20].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <button
              className="agro-button"
              aria-label="Página anterior"
              disabled={!page}
              onClick={() => setPage((v) => v - 1)}
            >
              ‹
            </button>
            <small>
              {page + 1} / {Math.max(1, Math.ceil(filtered.length / size))}
            </small>
            <button
              className="agro-button"
              aria-label="Próxima página"
              disabled={(page + 1) * size >= filtered.length}
              onClick={() => setPage((v) => v + 1)}
            >
              ›
            </button>
          </div>
        </AgroDocCard>
        <div className="agro-stack">
          <AgroDocCard title="Agenda de hoje" icon={CalendarDays}>
            {agenda.length ? (
              agenda.map((x) => (
                <button
                  className="agro-row"
                  style={{ width: "100%", textAlign: "left" }}
                  key={x.osId}
                  onClick={() => setSelected(x)}
                >
                  <Clock size={20} />
                  <div>
                    <b>{x.fazenda}</b>
                    <small>
                      {x.numero} · {x.pilotName}
                    </small>
                  </div>
                  <AgroDocStatus>{x.stageLabel}</AgroDocStatus>
                </button>
              ))
            ) : (
              <AgroDocEmpty>Nenhuma OS prevista para hoje.</AgroDocEmpty>
            )}
          </AgroDocCard>
          <AgroDocCard title="Etapas da operação">
            <AgroDocFlow compact />
            {selected && (
              <p style={{ marginTop: 16, fontSize: 12 }}>
                <b>{selected.numero}</b> · {selected.stageLabel}
                <br />
                {selected.fazenda} · {selected.pilotName}
              </p>
            )}
          </AgroDocCard>
        </div>
      </div>
      <div
        id="agro-operation-editor"
        className="agro-legacy"
        style={{ marginTop: 20 }}
      >
        {editor && children}
      </div>
    </>
  );
}
