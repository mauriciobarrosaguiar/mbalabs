import { atualizarClienteLexGestor, salvarClienteLexGestor } from "@/app/lexgestor/actions";

export type ClienteFormData = {
  id?: string;
  nome?: string;
  cpfCnpj?: string;
  rg?: string;
  dataNascimento?: string;
  estadoCivil?: string;
  profissao?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  origem?: string;
  status?: string;
  endereco?: string;
  observacoes?: string;
};

export function FormCliente({ cliente }: { cliente?: ClienteFormData }) {
  const isEditing = Boolean(cliente?.id);
  const action = isEditing ? atualizarClienteLexGestor : salvarClienteLexGestor;

  return (
    <form className="form-card stack" action={action}>
      {cliente?.id ? <input type="hidden" name="id" value={cliente.id} /> : null}

      <div>
        <h2>{isEditing ? "Editar dados do cliente" : "Dados do cliente"}</h2>
        <p>
          {isEditing
            ? "Atualize os dados cadastrais, contatos e observações do atendimento."
            : "Preencha o essencial. Os detalhes podem ser completados depois."}
        </p>
      </div>

      <div className="field-grid">
        <label className="field">
          Nome completo ou razão social
          <input name="nome" placeholder="Ex.: Maria de Souza" defaultValue={cliente?.nome ?? ""} required />
        </label>

        <label className="field">
          CPF/CNPJ
          <input name="cpf_cnpj" placeholder="000.000.000-00" defaultValue={cliente?.cpfCnpj ?? ""} />
        </label>

        <label className="field">
          RG
          <input name="rg" placeholder="Documento de identidade" defaultValue={cliente?.rg ?? ""} />
        </label>

        <label className="field">
          Data de nascimento
          <input name="data_nascimento" type="date" defaultValue={cliente?.dataNascimento ?? ""} />
        </label>

        <label className="field">
          Estado civil
          <input name="estado_civil" placeholder="Ex.: solteiro(a)" defaultValue={cliente?.estadoCivil ?? ""} />
        </label>

        <label className="field">
          Profissão
          <input name="profissao" placeholder="Ex.: motorista" defaultValue={cliente?.profissao ?? ""} />
        </label>

        <label className="field">
          Telefone
          <input name="telefone" placeholder="(00) 00000-0000" defaultValue={cliente?.telefone ?? ""} />
        </label>

        <label className="field">
          WhatsApp
          <input name="whatsapp" placeholder="(00) 00000-0000" defaultValue={cliente?.whatsapp ?? ""} />
        </label>

        <label className="field">
          E-mail
          <input name="email" type="email" placeholder="cliente@email.com" defaultValue={cliente?.email ?? ""} />
        </label>

        <label className="field">
          Origem/indicação
          <input name="origem" placeholder="Ex.: indicação de cliente" defaultValue={cliente?.origem ?? ""} />
        </label>

        <label className="field">
          Status
          <select name="status" defaultValue={cliente?.status || "Ativo"}>
            <option>Ativo</option>
            <option>Aguardando retorno</option>
            <option>Sem contrato</option>
            <option>Inativo</option>
          </select>
        </label>

        <label className="field-full">
          Endereço
          <input
            name="endereco"
            placeholder="Rua, número, bairro, cidade e UF"
            defaultValue={cliente?.endereco ?? ""}
          />
        </label>

        <label className="field-full">
          Observações
          <textarea
            name="observacoes"
            placeholder="Informações relevantes do atendimento."
            defaultValue={cliente?.observacoes ?? ""}
          />
        </label>
      </div>

      <div className="button-row">
        <button className="button" type="submit">
          {isEditing ? "Salvar alterações" : "Salvar cliente"}
        </button>

        {!isEditing ? (
          <button className="button secondary" type="reset">
            Limpar
          </button>
        ) : null}
      </div>
    </form>
  );
}
