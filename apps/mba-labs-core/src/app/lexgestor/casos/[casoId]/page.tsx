import { ChecklistCaso } from "@/components/lexgestor/ChecklistCaso";
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
      <ResponsivePageContainer title="Caso nao encontrado">
        <EmptyState title="Registro indisponivel" description="Verifique se o caso existe ou se o acesso esta liberado." />
      </ResponsivePageContainer>
    );
  }

  const checklist = obterChecklistPorAreaSubarea(caso.categoria, caso.subcategoria);
  const documentos = data.documentos.filter((documento) => documento.casoId === caso.id);

  return (
    <ResponsivePageContainer
      title={caso.titulo}
      description={`${caso.cliente} - ${caso.categoria} / ${caso.subcategoria}`}
    >
      <section className="tabs">
        <div className="tabs-nav" aria-label="Abas do caso">
          <a className="active" href="#resumo">Resumo</a>
          <a href="#processo">Processo</a>
          <a href="#relato">Relato</a>
          <a href="#checklist">Checklist</a>
          <a href="#documentos">Documentos</a>
          <a href="#prazos">Prazos</a>
          <a href="#dossie">Dossie</a>
        </div>
        <section className="tabs-panel stack" id="resumo">
          <h2>Resumo</h2>
          <div className="detail-grid">
            <Info label="Cliente" value={caso.cliente} />
            <Info label="Categoria" value={`${caso.categoria} / ${caso.subcategoria}`} />
            <Info label="Status" value={caso.status} />
            <Info label="Proximo prazo" value={caso.proximoPrazo || "Sem prazo"} />
            <Info label="Documentos" value={`${documentos.length} documento(s)`} />
            <Info label="Checklist" value={`${caso.checklistConcluido}/${caso.checklistTotal} concluido(s)`} />
          </div>
        </section>
        <section className="tabs-panel stack" id="processo">
          <h2>Dados do processo</h2>
          <div className="detail-grid">
            <Info label="Numero do processo" value={caso.numeroProcesso || "Nao informado"} />
            <Info label="Chave/eproc" value={caso.chaveProcesso || "Nao informada"} />
            <Info label="Sistema judicial" value={caso.sistemaJudicial || "Nao informado"} />
            <Info label="Tribunal" value={caso.tribunal} />
            <Info label="UF" value={caso.uf} />
            <Info label="Comarca/Subsecao" value={caso.comarca} />
            <Info label="Vara" value={caso.vara} />
            <Info label="Classe processual" value={caso.classeProcessual} />
            <Info label="Assunto" value={caso.assunto} />
            <Info label="Fase" value={caso.faseProcessual} />
            <Info label="Grau" value={caso.grau} />
            <Info label="Polo ativo" value={caso.poloAtivo} />
            <Info label="Polo passivo" value={caso.poloPassivo} />
            <Info label="Advogado" value={caso.advogadoResponsavel} />
            <Info label="Valor da causa" value={caso.valorCausa ? String(caso.valorCausa) : "-"} />
            <Info label="Justica gratuita" value={caso.justicaGratuita ? "Sim" : "Nao"} />
            <Info label="Segredo de justica" value={caso.segredoJustica ? "Sim" : "Nao"} />
            <Info label="Data de distribuicao" value={caso.dataDistribuicao} />
            <Info label="Tipo de prazo" value={caso.tipoPrazo} />
            <Info label="Link do processo" value={caso.linkProcesso} />
            <Info label="Observacoes" value={caso.observacoesProcesso} />
          </div>
        </section>
        <section className="tabs-panel" id="relato">
          <RelatoCliente />
        </section>
        <section className="tabs-panel" id="checklist">
          <ChecklistCaso items={checklist} />
        </section>
        <section className="tabs-panel" id="documentos">
          <UploadDocumentos
            clientes={data.clientes}
            casos={data.casos}
            categorias={data.categorias}
            connections={data.storageConnections}
            defaultClienteId={caso.clienteId}
            defaultCasoId={caso.id}
          />
        </section>
        <section className="tabs-panel stack" id="prazos">
          <h2>Prazos</h2>
          <div className="detail-grid">
            <Info label="Proximo prazo" value={caso.proximoPrazo || "Sem prazo"} />
            <Info label="Tipo de prazo" value={caso.tipoPrazo || "-"} />
            <Info label="Fase" value={caso.faseProcessual || "-"} />
          </div>
        </section>
        <section className="tabs-panel stack" id="dossie">
          <h2>Dossie do caso</h2>
          <PdfPreview />
          <div className="button-row">
            <a className="button" href={`/api/lexgestor/relatorios/pdf?tipo=dossie&caso=${caso.id}`}>
              Gerar dossie PDF
            </a>
            <a className="button secondary" href={`/lexgestor/documentos?caso=${caso.id}`}>
              Abrir pasta no armazenamento
            </a>
          </div>
        </section>
      </section>
    </ResponsivePageContainer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-box">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}
