import Link from "next/link";
import { BriefcaseBusiness, Eye } from "lucide-react";
import { BotaoWhatsAppCliente } from "./BotaoWhatsAppCliente";

export type ClienteCardData = {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  origem: string;
};

export function CardCliente({ cliente }: { cliente: ClienteCardData }) {
  return (
    <article className="card stack">
      <div>
        <h3>{cliente.nome}</h3>
        <p>{cliente.documento}</p>
      </div>
      <div className="grid">
        <span className="badge">{cliente.telefone}</span>
        <span className="badge">{cliente.origem}</span>
      </div>
      <div className="button-row">
        <Link className="button secondary" href={`/lexgestor/clientes/${cliente.id}`}>
          <Eye size={17} aria-hidden />
          Ver detalhes
        </Link>
        <Link className="button secondary" href="/lexgestor/casos/novo">
          <BriefcaseBusiness size={17} aria-hidden />
          Abrir caso
        </Link>
        <BotaoWhatsAppCliente telefone={cliente.telefone} />
      </div>
    </article>
  );
}
