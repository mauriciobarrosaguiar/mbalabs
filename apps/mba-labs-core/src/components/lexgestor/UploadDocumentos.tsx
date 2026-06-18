"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileUp, ShieldCheck } from "lucide-react";
import type { CategoriaJuridica } from "@/data/lexgestor/areas";
import type { LexCaso, LexCliente, LexStorageConnection } from "@/lib/lexgestor/data";
import { CategorySubcategoryFields } from "./CategorySubcategoryFields";

type UploadDocumentosProps = {
  clientes?: LexCliente[];
  casos?: LexCaso[];
  categorias?: CategoriaJuridica[];
  connections?: LexStorageConnection[];
  defaultClienteId?: string;
  defaultCasoId?: string;
  defaultCategoria?: string;
  defaultSubcategoria?: string;
  defaultTipoDocumento?: string;
  defaultObservacoes?: string;
  replaceDocumentId?: string;
};

type ChecklistAnexoEvent = {
  tipoDocumento?: string;
  observacoes?: string;
  area?: string;
  subarea?: string;
  ordem?: number;
  titulo?: string;
};

type ChecklistMeta = {
  area: string;
  subarea: string;
  ordem: string;
  titulo: string;
};

export function UploadDocumentos({
  clientes = [],
  casos = [],
  categorias = [],
  connections = [],
  defaultClienteId = "",
  defaultCasoId = "",
  defaultCategoria = "",
  defaultSubcategoria = "",
  defaultTipoDocumento = "",
  defaultObservacoes = "",
  replaceDocumentId = "",
}: UploadDocumentosProps) {
  const router = useRouter();
  const casoInicial = casos.find((caso) => caso.id === defaultCasoId);
  const [clienteId, setClienteId] = useState(defaultClienteId || casoInicial?.clienteId || "");
  const [casoId, setCasoId] = useState(defaultCasoId);
  const [fileName, setFileName] = useState("Nenhum arquivo selecionado");
  const [tipoDocumento, setTipoDocumento] = useState(defaultTipoDocumento);
  const [observacoes, setObservacoes] = useState(defaultObservacoes);
  const [status, setStatus] = useState("");
  const [checklistMeta, setChecklistMeta] = useState<ChecklistMeta | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tipoInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const connectedProviders = connections.filter((connection) => connection.connected);
  const hasStorage = connectedProviders.length > 0;
  const defaultProvider = connectedProviders[0]?.provider ?? "dropbox";
  const providerOptions = hasStorage
    ? connectedProviders
    : ([
        { provider: "dropbox", connected: false, id: "dropbox", status: "nao_conectado", accountEmail: "", rootFolderPath: "", rootFolderId: "" },
        { provider: "google_drive", connected: false, id: "google_drive", status: "nao_conectado", accountEmail: "", rootFolderPath: "", rootFolderId: "" },
      ] satisfies LexStorageConnection[]);

  const casosFiltrados = useMemo(
    () => casos.filter((caso) => !clienteId || caso.clienteId === clienteId),
    [casos, clienteId],
  );

  const casoSelecionado = casos.find((caso) => caso.id === casoId);
  const categoriaInicial = casoSelecionado?.categoria || defaultCategoria;
  const subcategoriaInicial = casoSelecionado?.subcategoria || defaultSubcategoria;

  useEffect(() => {
    setClienteId(defaultClienteId || casoInicial?.clienteId || "");
    setCasoId(defaultCasoId);
    setTipoDocumento(defaultTipoDocumento);
    setObservacoes(defaultObservacoes);
  }, [casoInicial?.clienteId, defaultCasoId, defaultClienteId, defaultObservacoes, defaultTipoDocumento]);

  useEffect(() => {
    if (!casoSelecionado?.clienteId) return;
    if (clienteId !== casoSelecionado.clienteId) {
      setClienteId(casoSelecionado.clienteId);
    }
  }, [casoSelecionado?.clienteId, clienteId]);

  useEffect(() => {
    function handleChecklistAnexo(event: Event) {
      const detail = (event as CustomEvent<ChecklistAnexoEvent>).detail ?? {};
      const tipo = detail.tipoDocumento?.trim();

      if (tipo) {
        setTipoDocumento(tipo);
      }

      if (detail.observacoes) {
        setObservacoes(detail.observacoes);
      }

      setChecklistMeta({
        area: detail.area ?? "",
        subarea: detail.subarea ?? "",
        ordem: detail.ordem ? String(detail.ordem) : "",
        titulo: detail.titulo ?? tipo ?? "",
      });
      setStatus(tipo ? `Documento selecionado pelo checklist: ${tipo}. Escolha o arquivo e envie.` : "Escolha o arquivo e envie.");

      window.setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        tipoInputRef.current?.focus();
      }, 80);
    }

    window.addEventListener("lexgestor:anexar-documento", handleChecklistAnexo);
    return () => window.removeEventListener("lexgestor:anexar-documento", handleChecklistAnexo);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setSubmitting(true);
    setStatus("Enviando...");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/lexgestor/documentos/upload", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));

    setSubmitting(false);
    setStatus(payload.message || payload.error || "Documento processado.");

    if (response.ok && !payload.error) {
      setFileName("Nenhum arquivo selecionado");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (checklistMeta) {
        window.dispatchEvent(
          new CustomEvent("lexgestor:checklist-documento-recebido", {
            detail: checklistMeta,
          }),
        );
      }
      router.refresh();
    }
  }

  return (
    <section className="form-card stack" id="documentos">
      <div className="section-title">
        <div>
          <h2>Anexar documento</h2>
          <p>Selecione cliente, caso e categoria antes de enviar o arquivo.</p>
        </div>
        <span className={`status-pill${hasStorage ? " success" : " warning"}`}>
          {hasStorage
            ? connectedProviders.length === 1
              ? `${storageProviderLabel(connectedProviders[0].provider)} conectado`
              : `${connectedProviders.length} armazenamentos conectados`
            : "Aguardando armazenamento"}
        </span>
      </div>

      {!hasStorage ? (
        <p className="notice">
          Conecte Dropbox ou Google Drive para salvar arquivos reais. Sem conexão, o documento
          fica como pendente e poderá ser reenviado depois.
        </p>
      ) : null}

      <form className="stack" id="lexgestor-upload-documento" ref={formRef} onSubmit={handleSubmit}>
        {replaceDocumentId ? <input type="hidden" name="documento_id" value={replaceDocumentId} /> : null}
        {checklistMeta ? (
          <>
            <input type="hidden" name="checklist_area" value={checklistMeta.area} />
            <input type="hidden" name="checklist_subarea" value={checklistMeta.subarea} />
            <input type="hidden" name="checklist_ordem" value={checklistMeta.ordem} />
            <input type="hidden" name="checklist_titulo" value={checklistMeta.titulo} />
          </>
        ) : null}
        <div className="field-grid">
          <label className="field">
            Cliente
            <select
              name="cliente_id"
              required
              value={clienteId}
              onChange={(event) => {
                setClienteId(event.target.value);
                setCasoId("");
              }}
            >
              <option value="">Escolha o cliente</option>
              {clientes.map((cliente) => (
                <option value={cliente.id} key={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Caso
            <select name="caso_id" required value={casoId} onChange={(event) => setCasoId(event.target.value)}>
              <option value="">Escolha o caso</option>
              {casosFiltrados.map((caso) => (
                <option value={caso.id} key={caso.id}>
                  {caso.titulo} - {caso.categoria}
                </option>
              ))}
            </select>
          </label>
          <CategorySubcategoryFields
            key={`${casoId || "sem-caso"}-${categoriaInicial}-${subcategoriaInicial}`}
            categorias={categorias}
            compact
            defaultCategoria={categoriaInicial}
            defaultSubcategoria={subcategoriaInicial}
          />
          <label className="field">
            Tipo de documento
            <input
              name="tipo_documento"
              placeholder="Ex.: RG, CNIS, contrato, print"
              ref={tipoInputRef}
              required
              value={tipoDocumento}
              onChange={(event) => setTipoDocumento(event.target.value)}
            />
          </label>
          <label className="field">
            Origem
            <select name="origem" defaultValue="Upload">
              <option>Upload</option>
              <option>Foto pelo celular</option>
              <option>WhatsApp</option>
              <option>Scanner</option>
              <option>Outro</option>
            </select>
          </label>
          <label className="field">
            Salvar em
            <select name="provider" defaultValue={defaultProvider}>
              {providerOptions.map((connection) => (
                <option value={connection.provider} key={connection.provider}>
                  {storageProviderLabel(connection.provider)}
                  {connection.connected ? "" : " (conectar depois)"}
                </option>
              ))}
            </select>
          </label>
          <label className="field-full">
            Observações
            <textarea
              name="observacoes"
              placeholder="Informações importantes sobre este documento."
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
            />
          </label>
        </div>

        <div className="upload-zone">
          <FileUp size={36} color="var(--primary)" aria-hidden />
          <div>
            <strong>Enviar arquivo, foto ou print</strong>
            <p>O original será preservado. PDF com marca d'água pode ser gerado junto.</p>
          </div>
          <input
            ref={fileInputRef}
            name="arquivo"
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            capture="environment"
            required
            onChange={(event) => {
              setFileName(event.target.files?.[0]?.name ?? "Nenhum arquivo selecionado");
            }}
          />
          <span className="badge warning">{fileName}</span>
        </div>

        <label className="check-option">
          <input type="checkbox" name="gerar_pdf" value="sim" />
          <span>Gerar PDF com marca d'água</span>
        </label>

        <div className="button-row">
          <button className="button" type="submit" disabled={isSubmitting}>
            <FileUp size={17} aria-hidden />
            {isSubmitting ? "Enviando..." : "Enviar arquivo"}
          </button>
          <button className="button secondary" type="button" onClick={() => fileInputRef.current?.click()}>
            <Camera size={17} aria-hidden />
            Tirar foto pelo celular
          </button>
          <button className="button secondary" type="submit" name="gerar_pdf" value="sim" disabled={isSubmitting}>
            <ShieldCheck size={17} aria-hidden />
            Gerar PDF com marca d'água
          </button>
        </div>
        {status ? <span className="status-pill">{status}</span> : null}
      </form>
    </section>
  );
}

function storageProviderLabel(provider: string) {
  if (provider === "google_drive") return "Google Drive";
  if (provider === "dropbox") return "Dropbox";
  return "Armazenamento";
}
