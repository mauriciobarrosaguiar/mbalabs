import { salvarClienteLexGestor } from "@/app/lexgestor/actions";

export function FormCliente() {
  return (
    <form className="form-card stack" action={salvarClienteLexGestor}>
      <div>
        <h2>Dados do cliente</h2>
        <p>Preencha o essencial. Os detalhes podem ser completados depois.</p>
      </div>
      <div className="field-grid">
        <label className="field">
          Nome completo ou razao social
          <input name="nome" placeholder="Ex.: Maria de Souza" required />
        </label>
        <label className="field">
          CPF/CNPJ
          <input name="cpf_cnpj" placeholder="000.000.000-00" />
        </label>
        <label className="field">
          RG
          <input name="rg" placeholder="Documento de identidade" />
        </label>
        <label className="field">
          Data de nascimento
          <input name="data_nascimento" type="date" />
        </label>
        <label className="field">
          Estado civil
          <input name="estado_civil" placeholder="Ex.: solteiro(a)" />
        </label>
        <label className="field">
          Profissao
          <input name="profissao" placeholder="Ex.: motorista" />
        </label>
        <label className="field">
          Telefone
          <input name="telefone" placeholder="(00) 00000-0000" />
        </label>
        <label className="field">
          WhatsApp
          <input name="whatsapp" placeholder="(00) 00000-0000" />
        </label>
        <label className="field">
          E-mail
          <input name="email" type="email" placeholder="cliente@email.com" />
        </label>
        <label className="field">
          Origem/indicacao
          <input name="origem" placeholder="Ex.: indicacao de cliente" />
        </label>
        <label className="field">
          Status
          <select name="status" defaultValue="Ativo">
            <option>Ativo</option>
            <option>Aguardando retorno</option>
            <option>Sem contrato</option>
            <option>Inativo</option>
          </select>
        </label>
        <label className="field-full">
          Endereco
          <input name="endereco" placeholder="Rua, numero, bairro, cidade e UF" />
        </label>
        <label className="field-full">
          Observacoes
          <textarea name="observacoes" placeholder="Informacoes relevantes do atendimento." />
        </label>
      </div>
      <div className="button-row">
        <button className="button" type="submit">
          Salvar cliente
        </button>
        <button className="button secondary" type="reset">
          Limpar
        </button>
      </div>
    </form>
  );
}
