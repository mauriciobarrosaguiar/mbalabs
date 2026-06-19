"use client";

import Link from "next/link";
import { useState } from "react";
import { Clipboard, ExternalLink, FileUp, Info } from "lucide-react";

type ProcessoTribunalActionsProps = {
  processoId: string;
  numeroCnj: string;
  chaveProcesso?: string;
  tribunalUrl?: string;
  anexarUrl: string;
  canAttach?: boolean;
  hasConnector?: boolean;
};

export function ProcessoTribunalActions({
  processoId,
  numeroCnj,
  chaveProcesso = "",
  tribunalUrl = "",
  anexarUrl,
  canAttach = true,
  hasConnector = false,
}: ProcessoTribunalActionsProps) {
  const [message, setMessage] = useState("");
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  async function audit(acao: string, detalhes: Record<string, unknown> = {}) {
    await fetch("/api/lexgestor/processos/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ processoId, acao, detalhes }),
    }).catch(() => null);
  }

  async function openTribunal() {
    if (!tribunalUrl) {
      setMessage("Configure o conector do tribunal para facilitar a abertura do sistema oficial.");
      return;
    }

    await audit("processo.abriu_tribunal", { destino: hasConnector ? "conector" : "link_processo" });
    window.open(tribunalUrl, "_blank", "noopener,noreferrer");
  }

  async function copyValue(value: string, label: string, acao: string) {
    if (!value) {
      setMessage(`${label} não informado neste processo.`);
      return;
    }

    await navigator.clipboard.writeText(value);
    await audit(acao);
    setMessage(`${label} copiado.`);
  }

  return (
    <div className="stack compact-stack">
      <div className="button-row">
        <button className="button" type="button" onClick={openTribunal}>
          <ExternalLink size={17} aria-hidden />
          Abrir processo no tribunal
        </button>
        <button className="button secondary" type="button" onClick={() => copyValue(numeroCnj, "Número CNJ", "processo.copiou_cnj")}>
          <Clipboard size={17} aria-hidden />
          Copiar número CNJ
        </button>
        <button className="button secondary" type="button" onClick={() => copyValue(chaveProcesso, "Chave do processo", "processo.copiou_chave")}>
          <Clipboard size={17} aria-hidden />
          Copiar chave do processo
        </button>
        <Link className="button secondary" href={anexarUrl}>
          <FileUp size={17} aria-hidden />
          {canAttach ? "Anexar PDF baixado" : "Criar caso para este processo"}
        </Link>
        <button className="button secondary" type="button" onClick={() => setInstructionsOpen(true)}>
          <Info size={17} aria-hidden />
          Ver instruções
        </button>
      </div>

      {message ? <span className="status-pill warning">{message}</span> : null}

      {instructionsOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setInstructionsOpen(false)}>
          <section className="modal-card stack" role="dialog" aria-modal="true" aria-label="Instruções do fluxo assistido" onClick={(event) => event.stopPropagation()}>
            <div className="section-title">
              <div>
                <h2>Fluxo assistido do tribunal</h2>
                <p>O acesso permanece no navegador ou aparelho do advogado.</p>
              </div>
              <button className="button secondary" type="button" onClick={() => setInstructionsOpen(false)}>Fechar</button>
            </div>
            <ol className="instruction-list">
              <li>Clique em Abrir processo no tribunal.</li>
              <li>Faça login no sistema oficial usando seu navegador ou aparelho.</li>
              <li>Baixe o PDF do evento desejado.</li>
              <li>Volte ao LexGestor e clique em Anexar PDF.</li>
              <li>O LexGestor salvará o arquivo no Dropbox ou Google Drive do escritório.</li>
            </ol>
          </section>
        </div>
      ) : null}
    </div>
  );
}
