import { ExternalLink, PlugZap, ShieldCheck } from "lucide-react";
import { ConectorTribunalForm } from "@/components/lexgestor/ConectorTribunalForm";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";
import { listConectoresTribunais } from "@/lib/lexgestor/processos";

type ConectoresPageProps = {
  searchParams?: Promise<{ erro?: string; status?: string }>;
};

const sistemas = [
  { id: "eproc", nome: "eproc" },
  { id: "pje", nome: "PJe" },
  { id: "projudi", nome: "Projudi" },
  { id: "esaj", nome: "ESAJ" },
];

export default async function ConectoresPage({ searchParams }: ConectoresPageProps) {
  const params = (await searchParams) ?? {};
  const data = await getLexWorkspaceData("/lexgestor/conectores");
  const escritorioId = String(data.escritorio?.id ?? "");
  const conectores = await listConectoresTribunais({ current: data.current, escritorioId });

  return (
    <ResponsivePageContainer
      title="Conectores dos tribunais"
      description="Use conectores para facilitar o acesso aos sistemas dos tribunais sem salvar credenciais no LexGestor."
    >
      {params.erro ? <p className="notice danger" role="alert">{feedbackMessage(params.erro)}</p> : null}
      {params.status ? <p className="notice success" role="status">{feedbackMessage(params.status)}</p> : null}

      <p className="notice">
        Use conectores para facilitar o acesso aos sistemas dos tribunais. O LexGestor não salva senha, certificado digital ou login de tribunais. O acesso deve permanecer no navegador ou aparelho do advogado.
      </p>

      <section className="grid">
        {sistemas.map((sistema) => {
          const conector = conectores.find((item) => item.sistema === sistema.id);
          return (
            <article className="card stack" key={sistema.id}>
              <div className="section-title">
                <div>
                  <h2>{sistema.nome}</h2>
                  <p>{conector ? conector.nome || conector.tribunal : "Fluxo assistido disponível"}</p>
                </div>
                <span className={`status-pill${conector ? " success" : " warning"}`}>
                  {conector ? statusLabel(conector.status) : "Não configurado"}
                </span>
              </div>
              <div className="compact-stack">
                <span className="badge">Fluxo assistido disponível</span>
                <span className="badge">Conector local futuro</span>
              </div>
              <div className="button-row">
                <a className="button secondary" href="#configurar">
                  <PlugZap size={17} aria-hidden />
                  Configurar fluxo assistido
                </a>
                {conector?.urlBase ? (
                  <a className="button secondary" href={conector.urlBase} target="_blank" rel="noreferrer">
                    <ExternalLink size={17} aria-hidden />
                    Testar abertura
                  </a>
                ) : (
                  <button className="button secondary" type="button" disabled title="Cadastre a URL base para testar a abertura.">
                    Testar abertura
                  </button>
                )}
              </div>
              <details className="compact-stack">
                <summary className="button secondary">Abrir instruções</summary>
                <ol className="instruction-list">
                  <li>Abra o sistema oficial no navegador do advogado.</li>
                  <li>Faça login diretamente no tribunal.</li>
                  <li>Baixe o PDF desejado.</li>
                  <li>Anexe o PDF ao processo no LexGestor.</li>
                </ol>
              </details>
            </article>
          );
        })}
      </section>

      <section className="form-card stack" id="configurar">
        <div className="section-title">
          <div>
            <h2>Configurar fluxo assistido</h2>
            <p>Selecione sistema judicial, tribunal, UF e nome do conector por lista. Informe somente a URL de navegação do sistema oficial.</p>
          </div>
          <ShieldCheck size={22} color="var(--primary)" aria-hidden />
        </div>
        <ConectorTribunalForm advogados={data.advogados} />
      </section>

      {conectores.length > 0 ? (
        <section className="form-card stack">
          <div className="section-title">
            <div>
              <h2>Conectores cadastrados</h2>
              <p>Edite dados públicos de navegação quando o tribunal mudar endereço ou padrão.</p>
            </div>
          </div>
          <div className="compact-stack">
            {conectores.map((conector) => (
              <details className="card stack" key={conector.id}>
                <summary>
                  <strong>{conector.nome}</strong>
                  <span className="status-pill">{statusLabel(conector.status)}</span>
                </summary>
                <ConectorTribunalForm conector={conector} advogados={data.advogados} />
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </ResponsivePageContainer>
  );
}

function statusLabel(value: string) {
  if (value === "ativo") return "Fluxo assistido disponível";
  if (value === "pausado") return "Pausado";
  if (value === "inativo") return "Inativo";
  return value || "Não configurado";
}

function feedbackMessage(value: string) {
  const messages: Record<string, string> = {
    "conector-salvo": "Conector salvo com segurança.",
    "sem-permissao": "Seu perfil não permite editar conectores.",
    "configure-escritorio": "Configure o escritório antes de cadastrar conectores.",
  };
  return messages[value] ?? value;
}
