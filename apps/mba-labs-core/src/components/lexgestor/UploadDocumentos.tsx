"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
};

type ChecklistAnexoEvent = {
  tipoDocumento?: string;
  observacoes?: string;
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
}: UploadDocumentosProps) {
  const [clienteId, setClienteId] = useState(defaultClienteId);
  const [casoId, setCasoId] = useState(defaultCasoId);
  const [fileName, setFileName] = useState("Nenhum arquivo selecionado");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tipoInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hasStorage = connections.some((connection) => connection.connected);

  const casosFiltrados = useMemo(
    () => casos.filter((caso) => !clienteId || caso.clienteId === clienteId),
    [casos, clienteId],
  );

  const casoSelecionado = casos.find((caso) => caso.id === casoId);
  const categoriaInicial = casoSelecionado?.categoria || defaultCategoria;
  const subcategoriaInicial = casoSelecionado?.subcategoria || defaultSubcategoria;

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
  }

  return (
    <section className="form-card stack" id="documentos">
      <div className="section-title">
        <div>
          <h2>Anexar documento</h2>
          <p>Selecione cliente, caso e categoria antes de enviar o arquivo.</p>
        </div>
        <span className={`status-pill${hasStorage ? " success" : " warning"}`}>
          {hasStorage ? "Armazenamento conectado" : "Aguardando armazenamento"}
        </span>
      </div>

      {!hasStorage ? (
        <p className="notice">
          Conecte Google Drive ou Dropbox para salvar arquivos reais. Sem conexão, o documento
          fica cadastrado como pendente e o envio externo não será feito.
        </p>
      ) : null}

      <form className="stack" id="lexgestor-upload-documento" ref={formRef} onSubmit={handleSubmit}>
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
            Provedor
            <select name="provider" defaultValue={connections.find((item) => item.connected)?.provider ?? "google_drive"}>
              <option value="google_drive">Google Drive</option>
              <option value="dropbox">Dropbox</option>
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
