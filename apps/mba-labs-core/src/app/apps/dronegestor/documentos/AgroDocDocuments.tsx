"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DroneDocumentsCenter } from "./DroneDocumentsCenter";
import { uploadAgroDocToDrive } from "@/lib/agrodoc-cloud-upload-client";
import { agroDocFolders as folders, attachmentsInFolder } from "@/lib/dronegestor-document-folders";
import { useState, useEffect, useRef } from "react";
import {
  Folder,
  FileText,
  Upload,
  Eye,
  Download,
  Database,
  TriangleAlert,
  ExternalLink,
} from "lucide-react";
import {
  AgroDocHero,
  AgroDocCard,
  AgroDocKpiCard,
  AgroDocTable,
  AgroDocEmpty,
  AgroDocError,
  useAgroData,
  agroGet,
  ROOT,
} from "../AgroDocUi";
type Order = { entityId: string; data: { numero?: string; status?: string } };
type Doc = {
  id: string;
  nome: string;
  tipo: string;
  uploadedAt: string;
  uploadedBy: string;
  url: string;
  ordemServicoNumero: string;
  ordemServicoId: string;
};
export function AgroDocDocuments() {
  const searchParams=useSearchParams();
  const orders = useAgroData<{ items: Order[] }>(
    "/api/dronegestor/cadastros?type=os",
  );
  const [os, setOs] = useState(""),
    [docs, setDocs] = useState<Doc[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [query, setQuery] = useState(""),
    [folder, setFolder] = useState(0),
    [selected, setSelected] = useState<Doc | null>(null),
    [upload, setUpload] = useState(false),
    [type, setType] = useState("outro"),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [progress,setProgress] = useState<number|null>(null),
    [cloudAvailable,setCloudAvailable] = useState(false),
    [reload, setReload] = useState(0);
  const [fieldOsId,setFieldOsId]=useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const fileOsRef = useRef("");
  const sendingRef = useRef(false);
  useEffect(() => {
    fetch("/api/dronegestor/cloud",{cache:"no-store"})
      .then(async r=>r.ok?await r.json():null)
      .then(p=>setCloudAvailable(p?.google?.status==="connected"))
      .catch(()=>setCloudAvailable(false));
  },[]);
  useEffect(() => {
    const params=searchParams;
    setFieldOsId("");
    if(params.get("returnTo")==="campo"){
      try{setFieldOsId(JSON.parse(localStorage.getItem("dronegestor:mission:v2")||"{}").ordemServicoId||"")}catch{}
    }
    const id = params.get("osId");
    if (id) setOs(id);
    else
      try {
        setOs(
          JSON.parse(localStorage.getItem("dronegestor:mission:v2") || "{}")
            .ordemServicoId || "",
        );
      } catch {}
  }, [searchParams]);
  useEffect(() => {
    setSelected(null);
    setDocs([]);
    if (!os) return;
    let active = true;
    setLoading(true);
    setError("");
    agroGet<{ items: Doc[] }>(
      `/api/dronegestor/documentos?osId=${encodeURIComponent(os)}`,
    )
      .then((p) => {
        if (active) {
          setDocs(p.items);
          setSelected(p.items[0] || null);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [os, reload]);
  const selectedOrder = orders.data?.items.find(item => item.entityId === os);
  const readOnly = !selectedOrder || ["cancelada", "concluida"].includes(selectedOrder.data.status || "");
  function cancelUpload() {
    if (sendingRef.current) return;
    setFile(null); setUpload(false); setProgress(null); fileOsRef.current = "";
    if (fileRef.current) fileRef.current.value = "";
  }
  function changeOrder(nextOs: string) {
    if (sendingRef.current || busy || nextOs === os) return;
    if (file) { setError("Envie ou cancele o arquivo selecionado antes de trocar de OS."); return; }
    cancelUpload(); setError(""); setOs(nextOs);
  }
  const visible = docs.filter(
    (x) =>
      (!folder || attachmentsInFolder([x], folders[folder]).length > 0) &&
      x.nome.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  async function send() {
    if (sendingRef.current) return;
    if (readOnly) { setError("OS encerrada ou cancelada: somente consulta."); return; }
    if (!file || !os) return;
    if (fileOsRef.current !== os) { cancelUpload(); setError("A OS mudou. Selecione novamente o arquivo para a OS atual."); return; }
    sendingRef.current = true;
    setBusy(true);
    setError("");
    try {
      const statusResponse=await fetch("/api/dronegestor/cloud",{cache:"no-store"});
      if(!statusResponse.ok)throw new Error("Não foi possível confirmar o armazenamento escolhido. Tente novamente.");
      const status=await statusResponse.json();
      setCloudAvailable(status?.google?.status==="connected");
      if(status?.google?.status!=="connected" && file.size > 10*1024*1024)throw new Error("Sem Google Drive conectado, o limite atual do Supabase é de 10 MB.");
      if(status?.google?.status==="connected"){
        setProgress(0);
        await uploadAgroDocToDrive({file,osId:os,category:type,onProgress:setProgress});
      }else{
        const fd=new FormData();
        fd.append("arquivo",file);
        fd.append("tipo",type);
        fd.append("ordemServicoId",os);
        fd.append("ordemServicoNumero",orders.data?.items.find((x)=>x.entityId===os)?.data.numero||"");
        const r=await fetch("/api/dronegestor/documentos",{method:"POST",body:fd});
        const p=await r.json();
        if(!r.ok)throw new Error(p.error||"Falha ao enviar.");
      }
      setReload((v) => v + 1);
      setFile(null);
      setUpload(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      sendingRef.current = false;
      setBusy(false);
      setProgress(null);
    }
  }
  async function openDocument(doc: Doc, download = false) {
    setError("");
    try {
      const p = await agroGet<{ items: Doc[] }>(
        `/api/dronegestor/documentos?osId=${encodeURIComponent(doc.ordemServicoId)}`,
      );
      const fresh = p.items.find((x) => x.id === doc.id);
      if (!fresh?.url)
        throw new Error("Documento indisponível ou sem autorização.");
      if (download) {
        const r = await fetch(fresh.url);
        if (!r.ok) throw new Error("Não foi possível baixar o documento.");
        const url = URL.createObjectURL(await r.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = fresh.nome;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setSelected(fresh);
        window.open(fresh.url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao abrir documento");
    }
  }
  return (
    <>
      <AgroDocHero
        variant="documents"
        title={
          <>
            MBA <em>DroneGestor</em> · Documentos
          </>
        }
        description="Central de arquivos, evidências, relatórios e comprovantes."
      />
      <div className="agro-toolbar agro-toolbar-documents">
        <input
          type="search"
          placeholder="Buscar documento"
          aria-label="Buscar documento"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Operação vinculada"
          value={os}
          disabled={busy}
          onChange={(e) => changeOrder(e.target.value)}
        >
          <option value="">Selecionar OS</option>
          {orders.data?.items.map((x) => (
            <option key={x.entityId} value={x.entityId}>
              {x.data.numero || x.entityId}
            </option>
          ))}
        </select>
        <select
          aria-label="Tipo de documento"
          value={folder}
          onChange={(e) => setFolder(Number(e.target.value))}
        >
          {folders.map((f, i) => (
            <option key={f.label} value={i}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          className="agro-button agro-button-primary"
          disabled={!os || readOnly}
          onClick={() => setUpload(true)}
        >
          <Upload size={18} />
          Enviar documento
        </button>
        {os && os===fieldOsId && <Link className="agro-button" href={`${ROOT}/campo`}>Retornar à etapa no Modo Campo</Link>}
        {os && <Link className="agro-button" href={`${ROOT}/gestao?tab=os&osId=${encodeURIComponent(os)}`}>Voltar à ordem de serviço</Link>}
        {!os && <p className="agro-form-note" role="status" style={{gridColumn:"1 / -1"}}>Selecione uma ordem de serviço para habilitar o envio de documentos.</p>}
      </div>
      <div className="agro-kpis agro-kpis-three">
        <AgroDocKpiCard
          title="Documentos da operação"
          icon={FileText}
          value={os ? (loading ? "—" : docs.length) : "—"}
        />
        <AgroDocKpiCard
          title="Pendências de anexo"
          icon={TriangleAlert}
          value="Consultar"
          note="Checklist documental da OS"
          href={`${ROOT}/documentos?${new URLSearchParams({
            ...(os ? {osId:os} : {}),
            ...(searchParams.get("returnTo")==="campo" ? {returnTo:"campo"} : {}),
            checklist:"1",
          }).toString()}#agro-document-checklist`}
        />
        <AgroDocKpiCard
          title="Armazenamento"
          icon={Database}
          value="Privado"
          note="Métrica de volume não disponível"
        />
      </div>
      <AgroDocError error={error || orders.error} />
      <div className="agro-doc-columns">
        <AgroDocCard title="Pastas principais" icon={Folder}>
          {folders.slice(1).map((f, i) => (
            <button
              className="agro-doc-folder"
              aria-pressed={folder === i + 1}
              key={f.label}
              onClick={() => setFolder(folder === i + 1 ? 0 : i + 1)}
            >
              <Folder size={28} />
              <span>
                <b>{f.label}</b>
                <small>
                  {attachmentsInFolder(docs, f).length} arquivos
                  nesta OS
                </small>
              </span>
            </button>
          ))}
        </AgroDocCard>
        <AgroDocCard title="Últimos arquivos" icon={FileText}>
          <div className="hidden sm:block">
          <AgroDocTable head={["Arquivo", "Operação", "Data", "Ações"]}>
            {visible.map((x) => (
              <tr
                key={x.id}
                style={{
                  background: selected?.id === x.id ? "#edf7e9" : undefined,
                }}
              >
                <td>
                  <button
                    onClick={() => setSelected(x)}
                    style={{ textAlign: "left", fontWeight: 700 }}
                  >
                    {x.nome}
                  </button>
                </td>
                <td>{x.ordemServicoNumero || "—"}</td>
                <td>{new Date(x.uploadedAt).toLocaleDateString("pt-BR")}</td>
                <td>
                  <button
                    aria-label={`Visualizar ${x.nome}`}
                    onClick={() => setSelected(x)}
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    aria-label={`Baixar ${x.nome}`}
                    onClick={() => void openDocument(x, true)}
                    style={{ marginLeft: 10 }}
                  >
                    <Download size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </AgroDocTable>
          </div>
          <div className="grid gap-3 sm:hidden">
            {visible.map((x) => (
              <article key={x.id} className="min-w-0 rounded-2xl border border-[#d9e8df] bg-white p-4">
                <button type="button" className="block w-full break-all text-left font-bold text-[#143d31]" onClick={() => setSelected(x)}>
                  {x.nome}
                </button>
                <p className="mt-2 break-words text-sm text-slate-600">OS: {x.ordemServicoNumero || "—"}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Data: {new Date(x.uploadedAt).toLocaleDateString("pt-BR")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelected(x)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#bcd5c6] px-3 font-semibold text-[#176a4c]">
                    <Eye size={18} /> Visualizar
                  </button>
                  <button type="button" onClick={() => void openDocument(x, true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#bcd5c6] px-3 font-semibold text-[#176a4c]">
                    <Download size={18} /> Baixar
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!visible.length && (
            <AgroDocEmpty>
              {loading
                ? "Consultando arquivos..."
                : os
                  ? "Nenhum documento corresponde aos filtros."
                  : "Selecione uma OS para consultar os documentos."}
            </AgroDocEmpty>
          )}
        </AgroDocCard>
        <AgroDocCard
          title={selected?.nome || "Visualização do documento"}
          icon={FileText}
        >
          {selected ? (
            <>
              <AgroDocFilePreview document={selected} />
              <div className="agro-facts">
                <div>
                  <span>Tipo</span>
                  <b>{selected.tipo.replaceAll("_", " ")}</b>
                </div>
                <div>
                  <span>OS vinculada</span>
                  <b>{selected.ordemServicoNumero || "—"}</b>
                </div>
                <div>
                  <span>Data</span>
                  <b>
                    {new Date(selected.uploadedAt).toLocaleDateString("pt-BR")}
                  </b>
                </div>
                <div>
                  <span>Responsável</span>
                  <b>{selected.uploadedBy || "—"}</b>
                </div>
              </div>
              <div className="agro-actions">
                <button
                  className="agro-button agro-button-primary"
                  onClick={() => void openDocument(selected)}
                >
                  <Eye size={16} />
                  Visualizar
                </button>
                <button
                  className="agro-button"
                  onClick={() => void openDocument(selected, true)}
                >
                  <Download size={16} />
                  Baixar
                </button>
              </div>
              <p style={{ fontSize: 11, marginTop: 12 }}>
                Acesso temporário e privado. O destinatário deve ter acesso à
                OS.
              </p>
              <button
                className="agro-button"
                style={{ marginTop: 8 }}
                onClick={() => {
                  void navigator.clipboard
                    .writeText(
                      `${window.location.origin}${ROOT}/documentos?osId=${encodeURIComponent(selected.ordemServicoId)}`,
                    )
                    .then(() =>
                      setError(
                        "Link interno copiado. O destinatário precisa entrar e ter acesso à OS.",
                      ),
                    )
                    .catch(() =>
                      setError(
                        "Não foi possível copiar. Abra a central pela OS.",
                      ),
                    );
                }}
              >
                <ExternalLink size={16} />
                Copiar link interno
              </button>
            </>
          ) : (
            <AgroDocEmpty>Selecione um arquivo para visualizar.</AgroDocEmpty>
          )}
        </AgroDocCard>
      </div>
      <div
        className="agro-upload"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!os || readOnly) {
            setError("Selecione uma OS antes de anexar.");
            return;
          }
          const f = e.dataTransfer.files[0];
          if (f && !sendingRef.current) {
            fileOsRef.current = os;
            setFile(f);
            setUpload(true);
          }
        }}
      >
        <Upload />
        <button
          onClick={() => {
            setUpload(true);
            fileRef.current?.click();
          }}
          disabled={!os || readOnly}
        >
          <b>Arraste arquivos ou clique para anexar</b>
        </button>
        <small>
          Arquivos autorizados · Google Drive até 2 GB; Supabase até 10 MB · OS obrigatória
        </small>
      </div>
      {readOnly && selectedOrder && <p role="status">OS encerrada ou cancelada: somente consulta. Os documentos existentes continuam disponíveis.</p>}
      {upload && !readOnly && (
        <section className="agro-card agro-form" style={{ marginTop: 16 }}>
          <h2>Enviar documento para a OS selecionada</h2>
          <select
            aria-label="Categoria do anexo"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {[
              "outro",
              "receituario",
              "mapa_aplicacao",
              "sarpas_autorizacao",
              "sisant_certidao",
              "relatorio_mapa",
              "registro_mapa",
              "seguro",
              "exame_piloto_anac",
              "avaliacao_risco",
              ...(cloudAvailable?["foto","video","historico_voo","relatorio_operacional"]:[]),
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            ref={fileRef}
            disabled={busy}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.mp4,.mov,.zip,.kml,.kmz"
            onChange={(e) => { if (sendingRef.current) return; fileOsRef.current = os; setFile(e.target.files?.[0] || null); }}
          />
          {file && <p>{file.name}</p>}
          {!cloudAvailable && <p className="agro-form-note">Sem Drive conectado, anexos são armazenados no Supabase (até 10 MB).</p>}
          {progress!==null && <p role="status">Google Drive: {progress}% enviado</p>}
          <button
            className="agro-button agro-button-primary"
            disabled={
              !file ||
              !os || readOnly ||
              busy ||
              Boolean(file && file.size > 2 * 1024 * 1024 * 1024)
            }
            onClick={() => void send()}
          >
            {busy ? "Enviando..." : "Enviar arquivo"}
          </button>
          {file && file.size > 2 * 1024 * 1024 * 1024 && (
            <p role="alert">Arquivo maior que 2 GB.</p>
          )}
          <button className="agro-button" disabled={busy} onClick={cancelUpload}>
            Cancelar
          </button>
        </section>
      )}
      <details id="agro-document-checklist" open={searchParams.get("checklist")==="1"} style={{ marginTop: 20 }}>
        <summary className="agro-button">
          Fase 3 — Checklist documental e autorização SARPAS da OS selecionada
        </summary>
        <div className="agro-legacy">{os && <DroneDocumentsCenter key={`${os}:${reload}`} osId={os} readOnly={readOnly}/>}</div>
      </details>
    </>
  );
}
export function AgroDocFilePreview({ document: d }: { document: Doc }) {
  const extension = d.nome.split(".").pop()?.toLowerCase();
  if (!d.url) return <AgroDocEmpty>Prévia indisponível.</AgroDocEmpty>;
  if (["png", "jpg", "jpeg", "webp"].includes(extension || ""))
    return <img className="agro-doc-preview" src={d.url} alt={d.nome} />;
  if (extension === "pdf")
    return (
      <div>
        <p className="mb-3 text-sm">Se o navegador bloquear a prévia, <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-bold underline">abra o PDF em outra aba</a> ou use o download autorizado. O link pode expirar; recarregue os documentos se necessário.</p>
        <iframe className="agro-doc-preview" src={d.url} title={`Prévia de ${d.nome}`} sandbox="allow-same-origin" />
      </div>
    );
  return (
    <div className="agro-doc-preview agro-empty">
      <FileText size={50} />
      Prévia disponível pelo download autorizado.
    </div>
  );
}
