import { salvarConfiguracoesLexGestor } from "@/app/lexgestor/actions";

type FormAdvogadoEscritorioProps = {
  escritorio?: Record<string, unknown> | null;
};

export function FormAdvogadoEscritorio({ escritorio }: FormAdvogadoEscritorioProps) {
  return (
    <form className="stack" action={salvarConfiguracoesLexGestor}>
      <section className="form-card stack">
        <div>
          <h2>Dados do escritorio</h2>
          <p>Esses dados aparecem em relatorios, dossies e marca d'agua.</p>
        </div>
        <div className="field-grid">
          <label className="field">
            Nome do escritorio
            <input name="nome" defaultValue={text(escritorio?.nome)} placeholder="Ex.: Silva & Associados" required />
          </label>
          <label className="field">
            CNPJ ou CPF
            <input name="cnpj" defaultValue={text(escritorio?.cnpj)} placeholder="Documento do escritorio" />
          </label>
          <label className="field">
            Telefone
            <input name="telefone" defaultValue={text(escritorio?.telefone)} placeholder="(00) 0000-0000" />
          </label>
          <label className="field">
            WhatsApp
            <input name="whatsapp" defaultValue={text(escritorio?.whatsapp)} placeholder="(00) 00000-0000" />
          </label>
          <label className="field">
            E-mail
            <input name="email" defaultValue={text(escritorio?.email)} type="email" placeholder="contato@escritorio.com" />
          </label>
          <label className="field">
            Logo do escritorio
            <input type="file" accept="image/*" />
          </label>
          <label className="field-full">
            Endereco
            <input name="endereco" defaultValue={text(escritorio?.endereco)} placeholder="Endereco completo" />
          </label>
          <label className="field-full">
            Texto da marca d'agua
            <input
              name="watermark_text"
              defaultValue={text(escritorio?.watermark_text)}
              placeholder="Ex.: Silva & Associados - uso restrito"
            />
          </label>
        </div>
      </section>

      <section className="form-card stack">
        <div>
          <h2>Dados do advogado</h2>
          <p>Use o responsavel principal. Outros usuarios podem ser adicionados depois.</p>
        </div>
        <div className="field-grid">
          <label className="field">
            Nome do advogado
            <input name="advogado_nome" placeholder="Nome completo" />
          </label>
          <label className="field">
            OAB
            <input name="oab" placeholder="Numero da OAB" />
          </label>
          <label className="field">
            UF da OAB
            <input name="uf_oab" placeholder="UF" maxLength={2} />
          </label>
          <label className="field">
            E-mail
            <input name="advogado_email" type="email" placeholder="advogado@email.com" />
          </label>
          <label className="field">
            Telefone
            <input name="advogado_telefone" placeholder="(00) 00000-0000" />
          </label>
          <label className="field">
            Cargo/funcao
            <input name="cargo" placeholder="Ex.: socio, associado, coordenador" />
          </label>
        </div>
      </section>

      <div className="button-row">
        <button className="button" type="submit">
          Salvar configuracoes
        </button>
        <button className="button secondary" type="reset">
          Limpar
        </button>
      </div>
    </form>
  );
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}
