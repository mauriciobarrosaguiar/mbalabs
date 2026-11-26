"use client";

import Link from "next/link";
import {
  AgroDocHero,
  AgroDocKpiCard,
  AgroDocCard,
  AgroDocTable,
  AgroDocError,
} from "../AgroDocUi";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

type State = "pendente" | "andamento" | "concluido" | "nao_aplica";
type TaskState = {
  status: State;
  validade: string;
  numero: string;
  justificativa: string;
};
type Diagnostic = {
  tipo: string;
  uf: string;
  modo: string;
  documento: string;
  quantidadeDrones: number;
  checklist: Record<string, TaskState>;
};
type Task = {
  id: string;
  name: string;
  owner: string;
  link: string;
  description: string;
  conditional?: boolean;
};
const TASKS: Task[] = [
  {
    id: "anac",
    name: "Cadastro da aeronave / SISANT",
    owner: "Proprietário / gestor",
    link: "https://sistemas.anac.gov.br/sisant",
    description: "Cadastre a aeronave aplicável e mantenha certificado válido",
  },
  {
    id: "anatel",
    name: "Homologação ANATEL",
    owner: "Proprietário / gestor",
    link: "https://www.gov.br/anatel/pt-br/assuntos/certificacao-de-produtos",
    description: "Confira se o equipamento e os rádios já possuem homologação",
  },
  {
    id: "decea",
    name: "Acesso ao espaço aéreo / SARPAS",
    owner: "Piloto e gestor",
    link: "https://sarpas.decea.mil.br/",
    description:
      "Documente cadastro e solicite acesso para cada operação quando requerido",
  },
  {
    id: "mapa",
    name: "Registro do operador / SIPEAGRO",
    owner: "Administrador",
    link: "https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/aviacao-agricola/registro",
    description:
      "Regularize a atividade aeroagrícola conforme o tipo do operador",
  },
  {
    id: "caar",
    name: "Qualificação CAAR",
    owner: "Piloto / aplicador",
    link: "https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/aviacao-agricola",
    description: "Verifique a habilitação e os certificados dos profissionais",
  },
  {
    id: "crea",
    name: "Responsável técnico / CREA / ART",
    owner: "Responsável técnico",
    link: "https://www.confea.org.br/",
    description:
      "Verifique vínculo, ART e registro, conforme perfil da empresa",
    conditional: true,
  },
  {
    id: "ibama",
    name: "CTF/APP e obrigações ambientais",
    owner: "Administrador / responsável ambiental",
    link: "https://www.gov.br/ibama/pt-br/servicos/cadastros/ctf/ctf-app",
    description:
      "Analise se a atividade está enquadrada e se o cadastro é exigível",
    conditional: true,
  },
  {
    id: "estadual",
    name: "Cadastro/obrigações do Estado",
    owner: "Administrador / RT",
    link: "https://www.to.gov.br/adapec",
    description:
      "Confirme exigências do órgão estadual conforme UF e atividade",
    conditional: true,
  },
  {
    id: "relatorio",
    name: "Relatório mensal MAPA / SEI",
    owner: "Gestor / RT",
    link: "https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/aviacao-agricola/relatorios-mensais/relatorios-mensais",
    description: "Consolide as operações validadas no modelo oficial de 2026",
  },
];
const TYPES = [
  ["produtor_rural", "Produtor rural"],
  ["prestador_servicos", "Prestador de serviços"],
  ["usina", "Usina"],
  ["cooperativa", "Cooperativa"],
];
const STATUSES: [State, string][] = [
  ["pendente", "A fazer"],
  ["andamento", "Em andamento"],
  ["concluido", "Concluído"],
  ["nao_aplica", "Não se aplica"],
];
const UFS =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
    " ",
  );
function empty(): Diagnostic {
  return {
    tipo: "prestador_servicos",
    uf: "TO",
    modo: "equipe",
    documento: "",
    quantidadeDrones: 1,
    checklist: {},
  };
}
function dateStatus(value: string) {
  if (!value) return null;
  const days = Math.ceil(
    (Date.parse(value + "T12:00:00") - Date.now()) / 86400000,
  );
  return days < 0 ? "Vencido" : days <= 30 ? "Vence em até 30 dias" : null;
}
function taskItem(d: Diagnostic, id: string): TaskState {
  return (
    d.checklist[id] ?? {
      status: "pendente",
      validade: "",
      numero: "",
      justificativa: "",
    }
  );
}
export function AgroDocDiagnostic() {
  const [data, setData] = useState<Diagnostic>(empty),
    [canManage, setCanManage] = useState(false),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [loadFailed, setLoadFailed] = useState(false);

  const pending = useMemo(
    () =>
      TASKS.filter(
        (x) =>
          taskItem(data, x.id).status !== "concluido" &&
          taskItem(data, x.id).status !== "nao_aplica",
      ).length,
    [data],
  );
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/dronegestor/diagnostico", {
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          }),
          j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || "Falha ao carregar");
        setCanManage(Boolean(j?.canManage));
        if (j?.diagnostico)
          setData({
            ...empty(),
            ...j.diagnostico,
            checklist: j.diagnostico.checklist || {},
          });
      } catch (e) {
        setLoadFailed(true);
        setMessage(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const r = await fetch("/api/dronegestor/diagnostico", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
        j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "Erro ao salvar");
      setMessage(
        "Diagnóstico e pendências atualizados no histórico da empresa.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }
  function setTask(id: string, patch: Partial<TaskState>) {
    setData((d) => ({
      ...d,
      checklist: { ...d.checklist, [id]: { ...taskItem(d, id), ...patch } },
    }));
  }
  return (
    <div className="agro-diagnostic">
      <AgroDocHero
        variant="diagnostic"
        title={
          <>
            Diagnóstico e <em>regularização</em>
          </>
        }
        description="Mapeie o perfil do operador e acompanhe as obrigações regulatórias."
      />
      <div className="agro-kpis">
        {[
          ["Itens do checklist", TASKS.length],
          [
            "Concluídos (declarados)",
            TASKS.filter((t) => taskItem(data, t.id).status === "concluido")
              .length,
          ],
          [
            "Pendentes",
            TASKS.filter((t) => taskItem(data, t.id).status === "pendente")
              .length,
          ],
          [
            "Em andamento",
            TASKS.filter((t) => taskItem(data, t.id).status === "andamento")
              .length,
          ],
        ].map(([title, value]) => (
          <AgroDocKpiCard
            key={title}
            title={String(title)}
            value={loading || loadFailed ? "—" : value}
            icon={ShieldCheck}
          />
        ))}
      </div>
      <AgroDocError error={message} />
      {loadFailed ? (
        <p role="alert" className="agro-error">
          Diagnóstico indisponível. Recarregue a página para tentar novamente.
        </p>
      ) : loading ? (
        <p role="status" className="agro-empty">
          Carregando diagnóstico...
        </p>
      ) : (
        <>
          <div className="agro-diagnostic-grid">
            <AgroDocCard title="Perfil do operador" icon={ShieldCheck}>
              <div className="agro-form">
                <label>
                  Tipo de operador *
                  <select
                    disabled={!canManage}
                    value={data.tipo}
                    onChange={(e) => setData({ ...data, tipo: e.target.value })}
                  >
                    {TYPES.map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  UF principal *
                  <select
                    disabled={!canManage}
                    value={data.uf}
                    onChange={(e) => setData({ ...data, uf: e.target.value })}
                  >
                    {UFS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Documento (CNPJ/CPF) *
                  <input
                    disabled={!canManage}
                    inputMode="numeric"
                    value={data.documento}
                    onChange={(e) =>
                      setData({ ...data, documento: e.target.value })
                    }
                  />
                </label>
                <label>
                  Quantidade de drones *
                  <input
                    disabled={!canManage}
                    type="number"
                    min={0}
                    max={999}
                    value={data.quantidadeDrones}
                    onChange={(e) =>
                      setData({
                        ...data,
                        quantidadeDrones: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <div className="agro-form-note">
                  Verifique a aplicabilidade de cada item conforme o tipo de
                  operação, UF e documentação. Registros neste painel não
                  substituem autorizações oficiais.
                </div>
              </div>
            </AgroDocCard>
            <AgroDocCard title="Checklist de regularização">
              <p className="mb-3 text-sm text-slate-600">Situações declaradas pelo operador, não verificadas pelos órgãos oficiais.</p>
              <div className="hidden md:block"><AgroDocTable
                head={[
                  "Item / órgão",
                  "Responsável",
                  "Situação",
                  "Nº / protocolo",
                  "Validade",
                ]}
              >
                {TASKS.map((task) => {
                  const cur = taskItem(data, task.id);
                  return (
                    <tr key={task.id} className="agro-diagnostic-table">
                      <td>
                        <a
                          href={
                            task.id === "estadual" && data.uf !== "TO"
                              ? "https://www.gov.br/pt-br"
                              : task.link
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {{
                            anac: "ANAC / SISANT",
                            anatel: "ANATEL",
                            decea: "DECEA / SARPAS",
                            mapa: "MAPA / SIPEAGRO",
                            caar: "CAAR",
                            crea: "CREA / ART",
                            ibama: "IBAMA / CTF",
                            estadual: "Órgão estadual",
                            relatorio: "Relatório mensal MAPA",
                          }[task.id] || task.name}
                        </a>
                        {dateStatus(cur.validade) && (
                          <small style={{ display: "block", color: "#ac4019" }}>
                            {dateStatus(cur.validade)}
                          </small>
                        )}
                      </td>
                      <td>{task.owner}</td>
                      <td>
                        <select
                          aria-label={`Situação: ${task.name}`}
                          disabled={!canManage}
                          value={cur.status}
                          onChange={(e) =>
                            setTask(task.id, {
                              status: e.target.value as State,
                            })
                          }
                        >
                          {STATUSES.map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                        </select>
                        {cur.status === "nao_aplica" && (
                          <input
                            aria-label={`Justificativa: ${task.name}`}
                            placeholder="Justificativa obrigatória"
                            disabled={!canManage}
                            value={cur.justificativa}
                            onChange={(e) =>
                              setTask(task.id, {
                                justificativa: e.target.value,
                              })
                            }
                          />
                        )}
                      </td>
                      <td>
                        <input
                          aria-label={`Protocolo: ${task.name}`}
                          disabled={!canManage}
                          value={cur.numero}
                          onChange={(e) =>
                            setTask(task.id, { numero: e.target.value })
                          }
                          placeholder="—"
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Validade: ${task.name}`}
                          type="date"
                          disabled={!canManage}
                          value={cur.validade}
                          onChange={(e) =>
                            setTask(task.id, { validade: e.target.value })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </AgroDocTable></div>
              <div className="grid gap-3 md:hidden">{TASKS.map(task=>{const cur=taskItem(data,task.id);return <article key={task.id} className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-3"><div><a className="font-bold text-emerald-800" href={task.id==="estadual"&&data.uf!=="TO"?"https://www.gov.br/pt-br":task.link} target="_blank" rel="noreferrer">{task.name}</a><p className="mt-1 text-xs text-slate-600">{task.owner}</p>{dateStatus(cur.validade)&&<p className="text-sm text-amber-800">{dateStatus(cur.validade)}</p>}</div><div className="agro-form"><label>Situação<select disabled={!canManage} value={cur.status} onChange={e=>setTask(task.id,{status:e.target.value as State})}>{STATUSES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{cur.status==="nao_aplica"&&<label>Justificativa<input disabled={!canManage} value={cur.justificativa} onChange={e=>setTask(task.id,{justificativa:e.target.value})}/></label>}<label>Nº / protocolo<input disabled={!canManage} value={cur.numero} onChange={e=>setTask(task.id,{numero:e.target.value})}/></label><label>Validade<input type="date" disabled={!canManage} value={cur.validade} onChange={e=>setTask(task.id,{validade:e.target.value})}/></label></div></article>})}</div>
            </AgroDocCard>
          </div>
          <div className="agro-diagnostic-lower">
            <AgroDocCard title="Próximas ações" icon={ClipboardCheck}>
              <div className="agro-grid-three">
                {TASKS.filter(
                  (t) =>
                    !["concluido", "nao_aplica"].includes(
                      taskItem(data, t.id).status,
                    ),
                )
                  .slice(0, 3)
                  .map((t) => (
                    <a
                      key={t.id}
                      href={
                        t.id === "estadual" && data.uf !== "TO"
                          ? "https://www.gov.br/pt-br"
                          : t.link
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="agro-card"
                      style={{ color: "#123c29" }}
                    >
                      <b>{t.name} ↗</b>
                      <p style={{ fontSize: 12, marginTop: 12 }}>
                        Responsável: {t.owner}
                      </p>
                      <p style={{ fontSize: 11, marginTop: 8 }}>
                        {t.description}
                      </p>
                    </a>
                  ))}
              </div>
              {pending === 0 && (
                <p>Nenhum item declarado pendente. Confira a validade e autenticidade dos registros.</p>
              )}
            </AgroDocCard>
            <AgroDocCard title="Direcionamento oficial" icon={ExternalLink}>
              <div className="agro-official-links">
                {TASKS.filter((t) =>
                  ["anac", "decea", "mapa", "estadual", "ibama"].includes(t.id),
                ).map((t) => (
                  <a
                    key={t.id}
                    href={
                      t.id === "estadual" && data.uf !== "TO"
                        ? "https://www.gov.br/pt-br"
                        : t.link
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.id === "estadual"
                      ? data.uf === "TO"
                        ? "ADAPEC / TO"
                        : "Órgão estadual"
                      : t.id.toUpperCase()}
                    <ExternalLink size={15} />
                  </a>
                ))}
              </div>
            </AgroDocCard>
          </div>
        </>
      )}
      <div className="agro-actions">
        <button
          className="agro-button agro-button-primary"
          disabled={!canManage || saving || loading}
          onClick={() => void save()}
        >
          <CheckCircle2 size={18} />
          {saving ? "Salvando..." : "Salvar diagnóstico"}
        </button>
        <Link className="agro-button" href="/apps/dronegestor/conferencia">
          <ClipboardCheck size={18} />
          Ir para conferência
        </Link>
      </div>
      {!canManage && !loading && (
        <p className="agro-form-note">
          Somente o gestor ou RT pode atualizar este diagnóstico.
        </p>
      )}
    </div>
  );
}
