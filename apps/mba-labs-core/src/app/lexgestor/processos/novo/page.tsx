import { salvarProcessoLexGestor } from "@/app/lexgestor/actions";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";
import { listTribunaisDataJud } from "@/lib/lexgestor/processos";

type NovoProcessoPageProps = {
  searchParams?: Promise<{ erro?: string }>;
};

export default async function NovoProcessoPage({ searchParams }: NovoProcessoPageProps) {
  const params = (await searchParams) ?? {};
  const data = await getLexWorkspaceData("/lexgestor/processos/novo");
  const tribunais = await listTribunaisDataJud();

  return (
    <ResponsivePageContainer
      title="Novo processo"
      description="Cadastre o número CNJ, vincule cliente/caso e deixe o LexGestor pronto para consultar movimentações públicas pelo DataJud/CNJ."
    >
      {params.erro ? <p className="notice danger" role="alert">{feedbackMessage(params.erro)}</p> : null}

      <form className="form-card stack" action={salvarProcessoLexGestor}>
        <div className="section-title">
          <div>
            <h2>Dados do processo</h2>
            <p>O LexGestor não salva login, senha, certificado digital ou credenciais de tribunais.</p>
          </div>
        </div>

        <div className="field-grid">
          <label className="field">
            Número CNJ
            <input name="numero_cnj" required placeholder="0000000-00.0000.0.00.0000" inputMode="numeric" />
          </label>

          <label className="field">
            Tribunal
            <select name="tribunal" required defaultValue="">
              <option value="" disabled>Escolha o tribunal</option>
              {tribunais.map((tribunal) => (
                <option value={tribunal.sigla} key={tribunal.sigla}>
                  {tribunal.sigla} - {tribunal.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Alias DataJud
            <select name="tribunal_alias_datajud" required defaultValue="">
              <option value="" disabled>Escolha o alias</option>
              {tribunais.map((tribunal) => (
                <option value={tribunal.aliasDatajud} key={tribunal.aliasDatajud}>
                  {tribunal.sigla} - {tribunal.aliasDatajud}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Sistema judicial
            <select name="sistema_judicial" required defaultValue="eproc">
              <option value="eproc">eproc</option>
              <option value="pje">PJe</option>
              <option value="projudi">Projudi</option>
              <option value="esaj">ESAJ</option>
              <option value="outro">Outro</option>
            </select>
          </label>

          <label className="field">
            Grau
            <select name="grau" required defaultValue="1 grau">
              <option value="1 grau">1 grau</option>
              <option value="2 grau">2 grau</option>
            </select>
          </label>

          <label className="field">
            Cliente vinculado
            <select name="cliente_id" required defaultValue="">
              <option value="" disabled>Escolha o cliente</option>
              {data.clientes.map((cliente) => (
                <option value={cliente.id} key={cliente.id}>{cliente.nome}</option>
              ))}
            </select>
          </label>

          <label className="field">
            Caso vinculado
            <select name="caso_id" defaultValue="">
              <option value="">Sem caso vinculado</option>
              {data.casos.map((caso) => (
                <option value={caso.id} key={caso.id}>
                  {caso.cliente} - {caso.titulo}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Categoria
            <select name="categoria" defaultValue="">
              <option value="">Selecione</option>
              {data.categorias.map((categoria) => (
                <option value={categoria.nome} key={categoria.nome}>{categoria.nome}</option>
              ))}
            </select>
          </label>

          <label className="field">
            Subcategoria
            <input name="subcategoria" placeholder="Ex.: Pensao alimenticia" />
          </label>

          <label className="field">
            Chave do processo opcional
            <input name="chave_eproc_opcional" placeholder="Chave do processo, se houver" />
          </label>

          <label className="field">
            Link do sistema oficial
            <input name="url_eproc" type="url" placeholder="https://..." />
          </label>

          <label className="field">
            Status
            <select name="status" defaultValue="ativo">
              <option value="ativo">Ativo</option>
              <option value="suspenso">Suspenso</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </label>

          <label className="field-full">
            Observações
            <textarea name="observacoes" placeholder="Observações internas do escritório." />
          </label>
        </div>

        <p className="notice">
          As movimentações são consultadas por metadados públicos do DataJud/CNJ. PDFs e anexos internos do tribunal devem ser baixados pelo advogado no sistema oficial e anexados ao LexGestor.
        </p>

        <div className="button-row">
          <button className="button" type="submit">Salvar processo</button>
          <a className="button secondary" href="/lexgestor/processos">Cancelar</a>
        </div>
      </form>
    </ResponsivePageContainer>
  );
}

function feedbackMessage(value: string) {
  const messages: Record<string, string> = {
    "configure-escritorio": "Configure o escritório antes de cadastrar processos.",
    "numero-cnj-invalido": "Informe um número CNJ válido.",
    "cliente-invalido": "Cliente indisponível para este escritório.",
    "caso-invalido": "Caso indisponível ou vinculado a outro cliente.",
  };
  return messages[value] ?? value;
}
