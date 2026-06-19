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
  defaultProcessoId?: string;
  defaultMovimentacaoId?: string;
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

const tiposFamiliaPensao = [
  "RG",
  "CPF",
  "Certidão de casamento",
  "Certidão de nascimento dos filhos",
  "Comprovante de residência",
  "Comprovante de renda",
  "Documentos dos bens",
  "Escritura de imóvel",
  "Documento de veículo",
  "Extratos bancários",
  "Comprovantes de despesas dos filhos",
  "Print WhatsApp",
  "Boletim de ocorrência",
  "Procuração",
  "Contrato",
];

const tiposPadrao = [
  "RG",
  "CPF",
  "CNIS",
  "Comprovante de residência",
  "Contrato",
  "Procuração",
  "Print WhatsApp",
  "Documento do processo",
  "Petição",
  "Decisão",
  "Outros documentos",
];

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
  defaultProcessoId = "",
  defaultMovimentacaoId = "",
}: UploadDocumentosProps) {
  const router = useRouter();
  const casoInicial = casos.find((caso) => caso.id === defaultCasoId);
  const [clienteId, setClienteId] = useState(defaultClienteId || casoInicial?.clienteId || "");
  const [casoId, setCasoId] = useState(defaultCasoId);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<string[]>(defaultTipoDocumento ? [defaultTipoDocumento] : []);
  const [outroTipo, setOutroTipo] = useState("");
  const [showOutroTipo, setShowOutroTipo] = useState(false);
  const [fileTypes, setFileTypes] = useState<Record<number, string>>({});
  const [observacoes, setObservacoes] = useState(defaultObservacoes);
  const [status, setStatus] = useState("");
  const [checklistMeta, setChecklistMeta] = useState<ChecklistMeta | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const connectedProviders = connections.filter((connection) => connection.connected);
  const hasStorage = connectedProviders.length > 0;
  const defaultProvider = connectedProviders[0]?.provider ?? "dropbox";

  const casosFiltrados = useMemo(
    () => casos.filter((caso) => !clienteId || caso.clienteId === clienteId),
    [casos, clienteId],
  );

  const casoSelecionado = casos.find((caso) => caso.id === casoId);
  const categoriaAtual = casoSelecionado?.categoria || defaultCategoria;
  const subcategoriaAtual = casoSelecionado?.subcategoria || defaultSubcategoria;
  const tiposChecklist = useMemo(
    () => tiposPorCategoria(categoriaAtual, subcategoriaAtual),
    [categoriaAtual, subcategoriaAtual],
  );
  const tiposDisponiveis = useMemo(() => {
    const set = new Set([...tiposChecklist, ...selectedTipos, defaultTipoDocumento].filter(Boolean));
    return Array.from(set);
  }, [defaultTipoDocumento, selectedTipos, tiposChecklist]);

  useEffect(() => {
    setClienteId(defaultClienteId || casoInicial?.clienteId || "");
    setCasoId(defaultCasoId);
    setSelectedTipos(defaultTipoDocumento ? [defaultTipoDocumento] : []);
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
        setSelectedTipos([tipo]);
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
        fileInputRef.current?.focus();
      }, 80);
    }

    window.addEventListener("lexgestor:anexar-documento", handleChecklistAnexo);
    return () => window.removeEventListener("lexgestor:anexar-documento", handleChecklistAnexo);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!hasStorage) {
      setStatus("Configure o Dropbox ou Google Drive do escritório antes de salvar documentos jurídicos.");
      return;
    }

    if (selectedFiles.length === 0) {
      setStatus("Selecione um ou mais arquivos.");
      return;
    }

    setSubmitting(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const generatedPdf = (event.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement &&
      ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement).value === "sim";

    formData.delete("arquivo");
    formData.delete("tipo_documento");
    selectedFiles.forEach((file, index) => {
      formData.append("arquivo", file);
      formData.set(`tipo_documento_${index}`, resolveFileType(file, index));
    });

    const tipoPrincipal = selectedTipos.length > 1 ? selectedTipos.join("; ") : selectedTipos[0];
    formData.set("tipo_documento", tipoPrincipal || outroTipo || defaultTipoDocumento || "Documento");
    if (generatedPdf || formData.get("gerar_pdf") === "sim") formData.set("gerar_pdf", "sim");

    setStatus(`Enviando ${selectedFiles.length} arquivo(s)...`);
    const response = await fetch("/api/lexgestor/documentos/upload", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    const message = payload.message || payload.error || "Falha no envio.";
    setStatus(message);

    setSubmitting(false);
    if (response.ok && Number(payload.successCount ?? 0) > 0) {
      setSelectedFiles([]);
      setFileTypes({});
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    if (response.ok && checklistMeta) {
      window.dispatchEvent(new CustomEvent("lexgestor:checklist-documento-recebido", { detail: checklistMeta }));
    }
    router.refresh();

    function resolveFileType(file: File, index: number) {
      if (fileTypes[index]) return fileTypes[index];
      if (selectedTipos.length === 1) return selectedTipos[0];

      const inferred = inferDocumentTypeFromName(file.name, selectedTipos.length > 1 ? selectedTipos : tiposDisponiveis);
      return inferred || selectedTipos[0] || outroTipo || defaultTipoDocumento || "Documento";
    }
  }

  return (
    <section className="form-card stack" id="documentos">
      <div className="section-title">
        <div>
          <h2>Anexar documento</h2>
          <p>Selecione cliente, caso, tipos e um ou mais arquivos.</p>
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
        <p className="notice danger">
          Configure o Dropbox ou Google Drive do escritório antes de salvar documentos jurídicos.
        </p>
      ) : null}

      <form className="stack" id="lexgestor-upload-documento" ref={formRef} onSubmit={handleSubmit}>
        {replaceDocumentId ? <input type="hidden" name="documento_id" value={replaceDocumentId} /> : null}
        {defaultProcessoId ? <input type="hidden" name="processo_id" value={defaultProcessoId} /> : null}
        {defaultMovimentacaoId ? <input type="hidden" name="movimentacao_id" value={defaultMovimentacaoId} /> : null}
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
                <option value={cliente.id} key={cliente.id}>{cliente.nome}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Caso
            <select name="caso_id" required value={casoId} onChange={(event) => setCasoId(event.target.value)}>
              <option value="">Escolha o caso</option>
              {casosFiltrados.map((caso) => (
                <option value={caso.id} key={caso.id}>{caso.titulo} - {caso.categoria}</option>
              ))}
            </select>
          </label>
          <CategorySubcategoryFields
            key={`${casoId || "sem-caso"}-${categoriaAtual}-${subcategoriaAtual}`}
            categorias={categorias}
            compact
            defaultCategoria={categoriaAtual}
            defaultSubcategoria={subcategoriaAtual}
          />
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
            <select name="provider" defaultValue={defaultProvider} disabled={!hasStorage}>
              {connectedProviders.length > 0 ? (
                connectedProviders.map((connection) => (
                  <option value={connection.provider} key={connection.provider}>{storageProviderLabel(connection.provider)}</option>
                ))
              ) : (
                <option value="dropbox">Dropbox</option>
              )}
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

        <fieldset className="checklist-box">
          <legend>Tipo de documento</legend>
          <div className="checkbox-grid">
            {tiposDisponiveis.map((tipo) => (
              <label className="check-option" key={tipo}>
                <input
                  type="checkbox"
                  checked={selectedTipos.includes(tipo)}
                  onChange={(event) => {
                    setSelectedTipos((current) =>
                      event.target.checked ? [...current, tipo] : current.filter((item) => item !== tipo),
                    );
                  }}
                />
                <span>{tipo}</span>
              </label>
            ))}
            <label className="check-option">
              <input
                type="checkbox"
                checked={showOutroTipo}
                onChange={(event) => {
                  setShowOutroTipo(event.target.checked);
                  if (!event.target.checked) setOutroTipo("");
                }}
              />
              <span>Outros</span>
            </label>
          </div>
          {showOutroTipo ? (
            <input
              className="input"
              placeholder="Digite outro tipo de documento"
              value={outroTipo}
              onChange={(event) => setOutroTipo(event.target.value)}
            />
          ) : null}
        </fieldset>

        <div className="upload-zone">
          <FileUp size={36} color="var(--primary)" aria-hidden />
          <div>
            <strong>Enviar arquivos, fotos ou prints</strong>
            <p>jpg, jpeg, png, webp, pdf, doc e docx. Cada arquivo será salvo no armazenamento do escritório.</p>
          </div>
          <input
            ref={fileInputRef}
            name="arquivo"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,image/jpeg,image/png,image/webp,application/pdf"
            multiple
            required
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setSelectedFiles(files);
              setFileTypes({});
            }}
          />
          <span className="badge warning">
            {selectedFiles.length === 0 ? "Nenhum arquivo selecionado" : `${selectedFiles.length} arquivo(s) selecionado(s)`}
          </span>
        </div>

        {selectedFiles.length > 1 ? (
          <div className="file-type-list">
            {selectedFiles.map((file, index) => (
              <label className="field" key={`${file.name}-${index}`}>
                {file.name}
                <input type="hidden" name={`tipo_documento_${index}`} value={fileTypes[index] || inferDocumentTypeFromName(file.name, selectedTipos.length > 1 ? selectedTipos : tiposDisponiveis) || selectedTipos[0] || outroTipo || defaultTipoDocumento || "Documento"} />
                <select
                  value={fileTypes[index] || inferDocumentTypeFromName(file.name, selectedTipos.length > 1 ? selectedTipos : tiposDisponiveis) || selectedTipos[0] || outroTipo || ""}
                  onChange={(event) => setFileTypes((current) => ({ ...current, [index]: event.target.value }))}
                >
                  <option value="">Usar tipo principal</option>
                  {[...tiposDisponiveis, outroTipo].filter(Boolean).map((tipo) => (
                    <option value={tipo} key={tipo}>{tipo}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}

        <label className="check-option">
          <input type="checkbox" name="gerar_pdf" value="sim" />
          <span>Gerar PDF com marca d'água após upload</span>
        </label>

        <div className="button-row">
          <button className="button" type="submit" disabled={isSubmitting || !hasStorage}>
            <FileUp size={17} aria-hidden />
            {isSubmitting ? "Enviando..." : "Enviar arquivo(s)"}
          </button>
          <button className="button secondary" type="button" onClick={() => fileInputRef.current?.click()} disabled={!hasStorage}>
            <Camera size={17} aria-hidden />
            Selecionar fotos
          </button>
          <button className="button secondary" type="submit" name="gerar_pdf" value="sim" disabled={isSubmitting || !hasStorage}>
            <ShieldCheck size={17} aria-hidden />
            Enviar e gerar PDF
          </button>
        </div>
        {status ? <span className="status-pill">{status}</span> : null}
      </form>
    </section>
  );
}

function tiposPorCategoria(categoria: string, subcategoria: string) {
  const normalized = `${categoria} ${subcategoria}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("familia") && normalized.includes("pens")) return tiposFamiliaPensao;
  return tiposPadrao;
}

function inferDocumentTypeFromName(fileName: string, availableTypes: string[]) {
  const normalizedName = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const rules: Array<[string, string[]]> = [
    ["RG", ["rg", "identidade", "cnh"]],
    ["CPF", ["cpf"]],
    ["CNIS", ["cnis"]],
    ["Comprovante de residência", ["comprovante", "residencia", "endereco", "conta luz", "agua"]],
    ["Contrato", ["contrato", "honorario"]],
    ["Procuração", ["procuracao", "procuração"]],
    ["Print WhatsApp", ["whatsapp", "print", "conversa", "screenshot"]],
    ["Documento do processo", ["processo", "peticao", "decisao", "sentenca", "despacho", "cnj"]],
  ];

  for (const [type, terms] of rules) {
    if (!availableTypes.includes(type)) continue;
    if (terms.some((term) => normalizedName.includes(term))) return type;
  }

  return "";
}

function storageProviderLabel(provider: string) {
  if (provider === "google_drive") return "Google Drive";
  if (provider === "dropbox") return "Dropbox";
  return "Armazenamento";
}
