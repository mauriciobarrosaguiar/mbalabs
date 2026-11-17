"use client";

import Link from "next/link";
import {
  AgroDocHero,
  AgroDocCard,
  AgroDocEmpty,
  AgroDocStatus,
  AgroDocError,
  AgroDocTable,
  useAgroData,
  ROOT,
  currentAgroMonth,
} from "../AgroDocUi";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

type Product = { nome?: string; dose?: number; unidade?: string };
type Summary = {
  climaCampoConfirmado?: boolean;
  sarpasConfirmado?: boolean;
  ordemServicoId?: string;
  iniciadaEm?: string;
  ordemServicoNumero?: string;
  piloto?: string;
  clienteNome?: string;
  fazendaNome?: string;
  municipio?: string;
  uf?: string;
  areaConcluidaHa?: number;
  areaHa?: number;
  drone?: string;
  registroAnac?: string;
  cultura?: string;
  tipoAtividade?: string;
  produtos?: Product[];
  finalizadaEm?: string;
  climaCampo?: {
    temperaturaC?: number | null;
    umidadePct?: number | null;
    ventoKmh?: number | null;
    direcaoVento?: string;
  };
};
type Review = {
  status: "aprovado" | "correcao";
  category?: string;
  classe?: string;
  tipoAeronave?: string;
  tipoServico?: string;
  horasAplicacao?: string;
  observacao?: string;
  reviewedByName?: string;
  reviewedAt?: string;
};
type Item = { id: string; summary: Summary; review: Review | null };
type Draft = {
  category: string;
  classe: string;
  tipoAeronave: string;
  tipoServico: string;
  horasAplicacao: string;
  observacao: string;
};
const serviceOptions = [
  "APLICAÇÃO DE AGROTÓXICO",
  "APLICAÇÃO DE BIOINSUMO",
  "APLICAÇÃO DE FERTILIZANTE",
  "APLICAÇÃO ADJUVANTE",
  "SEMEADURA",
  "OUTROS",
];
const categoryOptions = [
  { value: "", label: "Selecione a categoria" },
  { value: "agrotoxico", label: "Agrotóxico" },
  { value: "bioinsumo", label: "Bioinsumo" },
  { value: "outros", label: "Fertilizante, adjuvante ou outro" },
  { value: "semeadura", label: "Semeadura" },
];
function currentMonth() {
  return currentAgroMonth();
}
function dateLabel(value?: string) {
  return value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Data não informada";
}
function initial(item: Item): Draft {
  return {
    category: item.review?.category || "",
    classe: item.review?.classe || "",
    tipoAeronave: item.review?.tipoAeronave || "Drone",
    tipoServico: item.review?.tipoServico || "",
    horasAplicacao: item.review?.horasAplicacao || "",
    observacao: item.review?.observacao || "",
  };
}
function OperationRow({ item, done }: { item: Item; done: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => initial(item));
  const [openData, setOpenData] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const s = item.summary,
    p = s.produtos || [];
  const many = p.length > 1;
  async function save(status: "aprovado" | "correcao") {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/dronegestor/conferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationEventId: item.id, status, ...draft }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || "Erro na conferência");
      done();
    } catch (e) {
      setOpenData(true);
      setMessage(e instanceof Error ? e.message : "Falha ao enviar revisão");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="agro-card">
      <details
        open={openData}
        onToggle={(e) => setOpenData(e.currentTarget.open)}
      >
        <summary
          className="agro-button"
          style={{ width: "100%", marginBottom: 12 }}
        >
          Dados MAPA, horas efetivas e motivo de correção
        </summary>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
              OS {s.ordemServicoNumero || item.id.slice(0, 8)}
            </span>
            <h3 className="mt-1 text-base font-black text-slate-900">
              {s.fazendaNome || s.clienteNome || "Operação em campo"}
            </h3>
            <p className="text-xs text-slate-600">
              {s.piloto || "Piloto não informado"} ·{" "}
              {s.municipio || "Município pendente"}/{s.uf || "UF"} ·{" "}
              {dateLabel(s.finalizadaEm)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${item.review?.status === "aprovado" ? "bg-emerald-100 text-emerald-900" : item.review?.status === "correcao" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}
          >
            {item.review?.status === "aprovado"
              ? "Aprovado"
              : item.review?.status === "correcao"
                ? "Correção solicitada"
                : "Aguardando conferência"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4">
          <span>
            <b>Área</b>
            <br />
            {Number(s.areaConcluidaHa ?? s.areaHa ?? 0).toLocaleString(
              "pt-BR",
            )}{" "}
            ha
          </span>
          <span>
            <b>Drone</b>
            <br />
            {s.drone || "—"}
          </span>
          <span>
            <b>ANAC</b>
            <br />
            {s.registroAnac || "—"}
          </span>
          <span>
            <b>Cultura</b>
            <br />
            {s.cultura || "—"}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-700">
          <strong>Produtos:</strong>{" "}
          {p
            .map(
              (x) =>
                `${x.nome || "Sem nome"} (${x.dose || "?"} ${x.unidade || ""})`,
            )
            .join(", ") || "Nenhum produto informado"}
        </p>
        {many && (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
            <TriangleAlert className="mt-0.5 shrink-0" size={15} />
            Mais de um produto na mesma operação: exportação automática
            bloqueada até conferir como lançar sem duplicar área e horas.
          </p>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">
            Categoria do produto
            <select
              value={draft.category}
              onChange={(e) => {
                const c = e.target.value;
                setDraft({
                  ...draft,
                  category: c,
                  classe: "",
                  tipoServico:
                    c === "agrotoxico"
                      ? "APLICAÇÃO DE AGROTÓXICO"
                      : c === "bioinsumo"
                        ? "APLICAÇÃO DE BIOINSUMO"
                        : c === "semeadura"
                          ? "SEMEADURA"
                          : "",
                });
              }}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
            >
              {categoryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">
            Classe (conforme produto/receituário)
            <input
              value={draft.classe}
              onChange={(e) => setDraft({ ...draft, classe: e.target.value })}
              placeholder="Ex.: Herbicida, Fungicida"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Tipo de aeronave (modelo MAPA)
            <select
              value={draft.tipoAeronave}
              onChange={(e) =>
                setDraft({ ...draft, tipoAeronave: e.target.value })
              }
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
            >
              <option value="Drone">Drone</option>
              <option value="Convencional">Convencional</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">
            Tipo de serviço (modelo MAPA)
            <select
              value={draft.tipoServico}
              onChange={(e) =>
                setDraft({ ...draft, tipoServico: e.target.value })
              }
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
            >
              <option value="">Selecione o serviço</option>
              {serviceOptions.map((o) => (
                <option value={o} key={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-xs font-bold text-slate-700">
          Tempo efetivo de aplicação (HH:MM, sem pausas)
          <input
            value={draft.horasAplicacao}
            onChange={(e) =>
              setDraft({ ...draft, horasAplicacao: e.target.value })
            }
            inputMode="numeric"
            placeholder="Ex.: 02:30"
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
          />
          <span className="mt-1 block font-normal text-slate-500">
            Não use apenas o intervalo entre início e fim se houve paralisação;
            confira o registro do drone.
          </span>
        </label>
        <label className="mt-3 block text-xs font-bold text-slate-700">
          Observação / motivo de correção
          <textarea
            value={draft.observacao}
            onChange={(e) => setDraft({ ...draft, observacao: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Oriente o piloto a corrigir os dados, caso necessário."
          />
        </label>
        {item.review?.reviewedAt && (
          <p className="mt-2 text-[11px] text-slate-500">
            Última revisão: {dateLabel(item.review.reviewedAt)} por{" "}
            {item.review.reviewedByName || "revisor"}
          </p>
        )}
      </details>
      {message && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700"
        >
          {message}
        </p>
      )}
      <div className="agro-decision-actions mt-4 flex flex-wrap gap-2">
        <button
          disabled={busy || many}
          onClick={() => void save("aprovado")}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 size={17} />
          Aprovar para MAPA
        </button>
        <button
          disabled={busy || !draft.observacao.trim()}
          onClick={() => void save("correcao")}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-black text-amber-900 disabled:opacity-50"
        >
          <TriangleAlert size={17} />
          Solicitar correção
        </button>
      </div>
    </article>
  );
}
function OperationEvidence({ osId }: { osId?: string }) {
  const { data, error } = useAgroData<{
    items: { id: string; nome: string; tipo: string; url: string }[];
  }>(
    osId
      ? `/api/dronegestor/documentos?osId=${encodeURIComponent(osId)}`
      : null,
  );
  return (
    <AgroDocCard title="Evidências anexadas">
      <AgroDocError error={osId ? error : ""} />
      {data?.items.length ? (
        <div className="agro-grid-three">
          {data.items.map((d) => (
            <a
              key={d.id}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="agro-card"
              style={{ color: "#174b31", fontSize: 12 }}
            >
              <ClipboardCheck size={30} />
              <b>{d.nome}</b>
              <small style={{ display: "block" }}>{d.tipo}</small>
            </a>
          ))}
        </div>
      ) : (
        <AgroDocEmpty>
          {osId
            ? "Nenhuma evidência disponível para consulta."
            : "Registro legado sem vínculo identificável da OS. Consulte os documentos pela operação."}
        </AgroDocEmpty>
      )}
      {osId && (
        <Link
          className="agro-soft-link"
          href={`${ROOT}/documentos?osId=${encodeURIComponent(osId)}`}
        >
          Abrir documentos da OS →
        </Link>
      )}
    </AgroDocCard>
  );
}
export function AgroDocReviewCenter() {
  const [month, setMonth] = useState(currentMonth),
    [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [selected, setSelected] = useState(0);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("month");
    if (m && /^20\d{2}-(0[1-9]|1[0-2])$/.test(m)) setMonth(m);
  }, []);
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(
            `/api/dronegestor/conferencia?month=${encodeURIComponent(month)}`,
            { cache: "no-store" },
          ),
          p = await r.json().catch(() => null);
        if (!r.ok) throw new Error(p?.error || "Falha ao carregar");
        if (active) setItems(p?.items || []);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Falha ao consultar operações",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [month, reload]);
  const item = items[Math.min(selected, Math.max(0, items.length - 1))],
    summary = item?.summary;
  return (
    <div>
      <AgroDocHero
        variant="review"
        title={
          <>
            Conferência <em>AgroDoc</em>
          </>
        }
        description="Validação técnica e documental antes do relatório oficial do MAPA."
      />
      <div className="agro-toolbar">
        <select
          aria-label="Selecionar operação para conferência"
          value={item?.id || ""}
          onChange={(e) =>
            setSelected(items.findIndex((x) => x.id === e.target.value))
          }
        >
          <option value="" disabled>
            Selecione uma operação
          </option>
          {items.map((x) => (
            <option key={x.id} value={x.id}>
              Operação #{x.summary.ordemServicoNumero || x.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <AgroDocStatus
          tone={item?.review?.status === "aprovado" ? "good" : "warn"}
        >
          {item?.review?.status === "aprovado"
            ? "Aprovada"
            : item?.review?.status === "correcao"
              ? "Correção solicitada"
              : item
                ? "Aguardando conferência"
                : "Sem operação"}
        </AgroDocStatus>
        <input
          aria-label="Competência da conferência"
          type="month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setSelected(0);
          }}
        />
        <button className="agro-button" onClick={() => setReload((x) => x + 1)}>
          <RefreshCw size={17} />
          Atualizar
        </button>
        <button
          className="agro-button"
          disabled={selected <= 0}
          aria-label="Operação anterior"
          onClick={() => setSelected((x) => x - 1)}
        >
          ‹
        </button>
        <small>
          {items.length ? selected + 1 : 0} de {items.length}
        </small>
        <button
          className="agro-button"
          disabled={selected >= items.length - 1}
          aria-label="Próxima operação"
          onClick={() => setSelected((x) => x + 1)}
        >
          ›
        </button>
      </div>
      <AgroDocError error={error} />
      {loading ? (
        <AgroDocEmpty>Carregando operações...</AgroDocEmpty>
      ) : !item ? (
        <AgroDocCard title="Conferência de operações">
          <AgroDocEmpty>
            {error
              ? "Consulta não disponível para este acesso."
              : "Nenhuma operação finalizada nesta competência."}
          </AgroDocEmpty>
        </AgroDocCard>
      ) : (
        <div className="agro-review-columns">
          <div className="agro-stack">
            <AgroDocCard title="Dados completos da operação">
              <div className="agro-review-photo">
                Operação #{summary?.ordemServicoNumero || item.id.slice(0, 8)}
              </div>
              <div className="agro-facts">
                {[
                  ["Contratante", summary?.clienteNome],
                  ["Propriedade", summary?.fazendaNome],
                  ["Cultura", summary?.cultura],
                  ["Produto", summary?.produtos?.map((x) => x.nome).join(", ")],
                  [
                    "Dosagem",
                    summary?.produtos
                      ?.map((x) => `${x.dose || "—"} ${x.unidade || ""}`)
                      .join(", "),
                  ],
                  [
                    "Data",
                    summary?.finalizadaEm
                      ? new Date(summary.finalizadaEm).toLocaleDateString(
                          "pt-BR",
                        )
                      : "—",
                  ],
                  [
                    "Hora início",
                    summary?.iniciadaEm
                      ? new Date(summary.iniciadaEm).toLocaleTimeString("pt-BR")
                      : "—",
                  ],
                  [
                    "Hora término",
                    summary?.finalizadaEm
                      ? new Date(summary.finalizadaEm).toLocaleTimeString(
                          "pt-BR",
                        )
                      : "—",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <b>{value || "Não informado"}</b>
                  </div>
                ))}
              </div>
            </AgroDocCard>
            <AgroDocCard title="Condições climáticas">
              <div className="agro-weather">
                {[
                  [
                    "Temperatura",
                    summary?.climaCampo?.temperaturaC != null
                      ? `${summary.climaCampo.temperaturaC} °C`
                      : "—",
                  ],
                  [
                    "Umidade relativa",
                    summary?.climaCampo?.umidadePct != null
                      ? `${summary.climaCampo.umidadePct}%`
                      : "—",
                  ],
                  [
                    "Vento",
                    summary?.climaCampo?.ventoKmh != null
                      ? `${summary.climaCampo.ventoKmh} km/h`
                      : "—",
                  ],
                  [
                    "Direção do vento",
                    summary?.climaCampo?.direcaoVento || "—",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <small>{label}</small>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, marginTop: 12 }}>
                Condições registradas no campo pelo piloto. Campos ausentes
                aparecem como “—”.
              </p>
              <Link className="agro-soft-link" href={`${ROOT}/fichas`}>
                Abrir ficha do voo →
              </Link>
            </AgroDocCard>
          </div>
          <div className="agro-stack">
            <AgroDocCard title="Checklist de conferência" icon={ClipboardCheck}>
              {[
                [
                  "Dados da operação preenchidos",
                  Boolean(
                    summary?.municipio &&
                    summary?.uf &&
                    summary?.registroAnac &&
                    Number(summary?.areaConcluidaHa ?? summary?.areaHa) > 0,
                  ),
                ],
                [
                  "Produto e dosagem registrados",
                  Boolean(
                    summary?.produtos?.length === 1 &&
                    summary.produtos[0].nome &&
                    Number(summary.produtos[0].dose) > 0,
                  ),
                ],
                [
                  "Condições climáticas confirmadas no campo",
                  summary?.climaCampoConfirmado === true,
                ],
                [
                  "Liberação SARPAS registrada pelo piloto",
                  summary?.sarpasConfirmado === true,
                ],
                [
                  "Horas efetivas revisadas",
                  Boolean(item.review?.horasAplicacao),
                ],
                [
                  "Aprovação registrada pelo gestor / RT",
                  item.review?.status === "aprovado",
                ],
              ].map(([label, ok]) => (
                <label className="agro-review-check" key={String(label)}>
                  <input
                    type="checkbox"
                    checked={Boolean(ok)}
                    readOnly
                    aria-label={String(label)}
                  />
                  {label}
                </label>
              ))}
            </AgroDocCard>
            <OperationEvidence key={item.id} osId={summary?.ordemServicoId} />
            <OperationRow
              key={item.id + `-${item.review?.reviewedAt || ""}`}
              item={item}
              done={() => setReload((x) => x + 1)}
            />
            <Link
              className="agro-soft-link"
              href={`${ROOT}/relatorio-mensal?month=${month}`}
            >
              <FileSpreadsheet size={20} />
              Planilha MAPA 2026 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
