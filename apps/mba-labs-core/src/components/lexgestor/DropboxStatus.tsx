import { Cloud, ExternalLink, PlugZap, Unplug } from "lucide-react";
import { desconectarArmazenamentoLexGestor, testarArmazenamentoLexGestor } from "@/app/lexgestor/actions";
import type { LexStorageConnection } from "@/lib/lexgestor/data";
import { storageProviderLabel } from "@/lib/lexgestor/data";

type DropboxStatusProps = {
  connections?: LexStorageConnection[];
};

const providers = ["dropbox", "google_drive"] as const;

export function DropboxStatus({ connections = [] }: DropboxStatusProps) {
  const connectedCount = connections.filter((connection) => connection.connected).length;

  return (
    <section className="storage-status" id="armazenamento">
      <div className="section-title">
        <div>
          <h2>Armazenamento</h2>
        </div>
        <Cloud size={24} color="var(--primary)" aria-hidden />
      </div>

      <div className="storage-provider-list">
        {providers.map((provider) => {
          const connection = connections.find((item) => item.provider === provider && item.connected);
          const label = storageProviderLabel(provider);

          return (
            <article className="storage-provider-card" key={provider}>
              <header>
                <div>
                  <h3>{label}</h3>
                </div>
                <span className={`status-pill${connection ? " success" : " warning"}`}>
                  {connection ? "Conectado" : "Não conectado"}
                </span>
              </header>

              <div className="storage-meta">
                <span className="badge">{connection?.rootFolderPath || "/LexGestor"}</span>
                {connection?.accountEmail ? <span className="badge">{connection.accountEmail}</span> : null}
              </div>

              <div className="button-row">
                <a className={`button${connection ? " secondary" : ""}`} href={`/api/lexgestor/storage/connect/${provider}`}>
                  <PlugZap size={17} aria-hidden />
                  {connection ? `Reconectar ${label}` : `Conectar ${label}`}
                </a>
                <form action={testarArmazenamentoLexGestor}>
                  <input type="hidden" name="provider" value={provider} />
                  <button className="button secondary" type="submit" disabled={!connection}>
                    <ExternalLink size={17} aria-hidden />
                    Testar
                  </button>
                </form>
                <form action={desconectarArmazenamentoLexGestor}>
                  <input type="hidden" name="provider" value={provider} />
                  <button className="button secondary" type="submit" disabled={!connection}>
                    <Unplug size={17} aria-hidden />
                    Desconectar
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>

      <span className={`status-pill${connectedCount > 0 ? " success" : " warning"}`}>
        {connectedCount > 0 ? `${connectedCount} conectado(s)` : "Nenhum armazenamento conectado"}
      </span>
    </section>
  );
}
