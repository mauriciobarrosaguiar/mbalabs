import { ChecklistCaso } from "@/components/lexgestor/ChecklistCaso";
import { atualizarResponsavelCasoLexGestor } from "@/app/lexgestor/actions";
import { EmptyState } from "@/components/lexgestor/EmptyState";
import { PdfPreview } from "@/components/lexgestor/PdfPreview";
import { RelatoCliente } from "@/components/lexgestor/RelatoCliente";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { UploadDocumentos } from "@/components/lexgestor/UploadDocumentos";
import { obterChecklistPorAreaSubarea } from "@/lib/lexgestor/checklist";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

type CasoDetalhePageProps = {
  params: Promise<{ casoId: string }>;
};

export default async function CasoDetalhePage({ params }: CasoDetalhePageProps) {
  const { casoId } = await params;
  const data = await getLexWorkspaceData(`/lexgestor/casos/${casoId}`);
  const caso = data.casos.find((item) => item.id === casoId);

  if (!caso) {
    return (
      <ResponsivePageContainer title="Caso não encontrado">
        <EmptyState title="Registro indisponível" description="Verifique se o caso existe ou se o acesso está liberado." />
      </ResponsivePageContainer>
    );
  }

  const checklist = obterChecklistPorAreaSubarea(caso.categoria, caso.subcategoria);
  const documentos = data.documentos.filter((documento) => documento.casoId === caso.id);
  const dossieUrl = `/api/lexgestor/relatorios/pdf?tipo=dossie&caso=${caso.id}`;

  return (
    <ResponsivePageContainer
      title={caso.titulo}
      description={`${caso.cliente} - ${caso.categoria} / ${caso.subcategoria}`}
    >
      <section className="tabs stack">
        <nav className="button-row" aria-label="Atalhos do caso">
          <a className="button secondary" href="#resumo">Resumo</a>
          <a className="button secondary" href="#processo">Processo</a>
          <a className="button secondary" href="#relato">Relato</a>
          <a className="button secondary" href="#checklist">Checklist</a>
          <a className="button secondary" href="#documentos">Documentos</a>
          <a className="button secondary" href="#prazos">Prazos</a>
          <a className="button secondary" href="#dossie">Dossiê</a>
        </nav>

        <section className="tabs-panel stack" id="resumo">
          <h2>Resumo</h2>
          <div className="detail-grid">
            <Info label="Cliente" value={caso.cliente} />
            <Info label="Categoria" value={`${caso.categoria} / ${caso.subcategoria}`} />
            <Info label="Status" value={caso.status} />
            <Info label="Próximo prazo" value={caso.proximoPrazo || "Sem prazo"} />
            <Info label="Documentos" value={`${documentos.length} documento(s)`} />
            <Info label="Checklist" value={`${caso.checklistConcluido}/${caso.checklistTotal} concluído(s)`} />
          </div>
        </section>

        <section className="tabs-panel stack" id="processo">
          <h2>Dados do processo</h2>
          <div className="detail-grid">
            <Info label="Número do processo" value={caso.numeroProcesso || "Não informado"} />
            <Info label="Chave/eproc" value={caso.chaveProcesso || "Não informada"} />
            <Info label="Sistema judicial" value={caso.sistemaJudicial || "Não informado"} />
            <Info label="Tribunal" value={caso.tribunal} />
            <Info label="UF" value={caso.uf} />
            <Info label="Comarca/Subseção" value={caso.comarca} />
            <Info label="Vara" value={caso.vara} />
            <Info label="Classe processual" value={caso.classeProcessual} />
            <Info label="Assunto" value={caso.assunto} />
            <Info label="Fase" value={caso.faseProcessual} />
            <Info label="Grau" value={caso.grau} />
            <Info label="Polo ativo" value={caso.poloAtivo} />
            <Info label="Polo passivo" value={caso.poloPassivo} />
            <Info label="Advogado" value={caso.advogadoResponsavel} />
            <Info label="Valor da causa" value={caso.valorCausa ? String(caso.valorCausa) : "-"} />
            <Info label="Justiça gratuita" value={caso.justicaGratuita ? "Sim" : "Não"} />
            <Info label="Segredo de justiça" value={caso.segredoJustica ? "Sim" : "Não"} />
            <Info label="Data de distribuição" value={caso.dataDistribuicao} />
            <Info label="Tipo de prazo" value={caso.tipoPrazo} />
            <Info label="Link do processo" value={caso.linkProcesso} />
            <Info label="Observações" value={caso.observacoesProcesso} />
          </div>
          <form className="card compact-stack" action={atualizarResponsavelCasoLexGestor}>
            <input type="hidden" name="caso_id" value={caso.id} />
            <label className="field">
              Trocar advogado responsável
              <select name="advogado_responsavel_id" defaultValue={caso.advogadoResponsavelId}>
                <option value="">Sem responsável</option>
                {data.advogados.filter((advogado) => advogado.status === "Ativo").map((advogado) => (
                  <option value={advogado.id} key={advogado.id}>
                    {advogado.nome}{advogado.oab ? ` - OAB ${advogado.oab}/${advogado.ufOab}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button className="button secondary" type="submit">Atualizar responsável</button>
              <a className="button secondary" href="/lexgestor/equipe">Gerenciar equipe</a>
            </div>
          </form>
        </section>

        <section className="tabs-panel" id="relato">
          <RelatoCliente />
        </section>

        <section className="tabs-panel" id="checklist">
          <ChecklistCaso
            items={checklist}
            clienteId={caso.clienteId}
            casoId={caso.id}
            categoria={caso.categoria}
            subcategoria={caso.subcategoria}
          />
        </section>

        <section className="tabs-panel" id="documentos">
          <UploadDocumentos
            clientes={data.clientes}
            casos={data.casos}
            categorias={data.categorias}
            connections={data.storageConnections}
            defaultClienteId={caso.clienteId}
            defaultCasoId={caso.id}
            defaultCategoria={caso.categoria}
            defaultSubcategoria={caso.subcategoria}
          />
        </section>

        <section className="tabs-panel stack" id="prazos">
          <h2>Prazos</h2>
          <div className="detail-grid">
            <Info label="Próximo prazo" value={caso.proximoPrazo || "Sem prazo"} />
            <Info label="Tipo de prazo" value={caso.tipoPrazo || "-"} />
            <Info label="Fase" value={caso.faseProcessual || "-"} />
          </div>
        </section>

        <section className="tabs-panel stack" id="dossie">
          <h2>Dossiê do caso</h2>
          <PdfPreview href={dossieUrl} />
          <div className="button-row">
            <a className="button" href={dossieUrl}>
              Gerar dossiê do caso
            </a>
            <a className="button secondary" href={`/lexgestor/documentos?caso=${caso.id}`}>
              Ver documentos do caso
            </a>
          </div>
        </section>
      </section>
    </ResponsivePageContainer>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="detail-box">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}
