import { Cloud, ExternalLink, PlugZap, Unplug } from "lucide-react";
import { desconectarArmazenamentoLexGestor, testarArmazenamentoLexGestor } from "@/app/lexgestor/actions";
import type { LexStorageConnection } from "@/lib/lexgestor/data";
import { storageProviderLabel } from "@/lib/lexgestor/data";

type DropboxStatusProps = {
  connections?: LexStorageConnection[];
};

export function DropboxStatus({ connections = [] }: DropboxStatusProps) {
  const connected = connections.find((connection) => connection.connected);
  const statusLabel = connected
    ? `${storageProviderLabel(connected.provider)} conectado`
    : "Nenhum armazenamento conectado";

  return (
    <section className="card storage-status" id="armazenamento">
      <Cloud size={24} color="var(--primary)" aria-hidden />
      <div>
        <h2>Armazenamento dos documentos</h2>
        <p>Use a conta Google Drive ou Dropbox do proprio escritorio.</p>
      </div>
      <div className="grid">
        <span className={`status-pill${connected ? " success" : " warning"}`}>{statusLabel}</span>
        <span className="badge">Pasta raiz: {connected?.rootFolderPath || "/LexGestor"}</span>
        {connected?.accountEmail ? <span className="badge">{connected.accountEmail}</span> : null}
      </div>
      <p className="notice">
        A MBA Labs salva apenas metadados, links e caminhos no Supabase. Arquivos originais e PDFs
        ficam no armazenamento conectado pelo escritorio.
      </p>
      <div className="button-row">
        <a className="button" href="/api/lexgestor/storage/connect/google_drive">
          <PlugZap size={17} aria-hidden />
          Conectar Google Drive
        </a>
        <a className="button secondary" href="/api/lexgestor/storage/connect/dropbox">
          <PlugZap size={17} aria-hidden />
          Conectar Dropbox
        </a>
        <form action={testarArmazenamentoLexGestor}>
          <button className="button secondary" type="submit">
            <ExternalLink size={17} aria-hidden />
            Testar conexao
          </button>
        </form>
        <form action={desconectarArmazenamentoLexGestor}>
          <button className="button secondary" type="submit">
            <Unplug size={17} aria-hidden />
            Desconectar
          </button>
        </form>
      </div>
    </section>
  );
}
