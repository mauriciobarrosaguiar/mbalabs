import Link from "next/link";
import { salvarConfiguracoesLexGestor } from "@/app/lexgestor/actions";

type FormAdvogadoEscritorioProps = {
  escritorio?: Record<string, unknown> | null;
};

export function FormAdvogadoEscritorio({ escritorio }: FormAdvogadoEscritorioProps) {
  return (
    <form className="stack" action={salvarConfiguracoesLexGestor}>
      <section className="form-card stack">
        <div className="section-title">
          <div>
            <h2>1. Dados do escritório</h2>
            <p>Informações usadas em relatórios, dossiês e identificação do atendimento.</p>
          </div>
        </div>
        <div className="field-grid">
          <label className="field">
            Nome do escritório
            <input name="nome" defaultValue={text(escritorio?.nome)} placeholder="Ex.: Silva & Associados" required />
          </label>
          <label className="field">
            CNPJ ou CPF
            <input name="cnpj" defaultValue={text(escritorio?.cnpj)} placeholder="Documento do escritório" />
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
          <label className="field-full">
            Endereço
            <input name="endereco" defaultValue={text(escritorio?.endereco)} placeholder="Endereço completo" />
          </label>
        </div>
      </section>

      <section className="form-card stack">
        <div className="section-title">
          <div>
            <h2>2. Marca e identidade</h2>
            <p>Use URLs de imagens hospedadas para logo e marca d'água.</p>
          </div>
        </div>
        <div className="field-grid">
          <label className="field">
            Logo/marca
            <input name="logo_url" defaultValue={text(escritorio?.logo_url)} placeholder="https://..." />
          </label>
          <label className="field">
            Imagem de marca d'água
            <input name="watermark_image_url" defaultValue={text(escritorio?.watermark_image_url)} placeholder="https://..." />
          </label>
          <label className="field">
            Responsável principal
            <input name="responsavel_principal" defaultValue={text(escritorio?.responsavel_principal)} placeholder="Nome do responsável" />
          </label>
          <label className="field">
            OAB do responsável
            <input name="responsavel_oab" defaultValue={text(escritorio?.responsavel_oab)} placeholder="OAB/UF" />
          </label>
          <label className="field-full">
            Texto da marca d'água
            <input
              name="watermark_text"
              defaultValue={text(escritorio?.watermark_text)}
              placeholder="Ex.: Silva & Associados - uso restrito"
            />
          </label>
        </div>
      </section>

      <section className="split">
        <article className="card stack" id="armazenamento">
          <h2>3. Armazenamento</h2>
          <p>Os documentos ficam no armazenamento do escritório. O sistema guarda apenas as informações necessárias para organizar os arquivos.</p>
          <span className="badge">Dropbox por escritório</span>
        </article>
        <article className="card stack">
          <h2>4. Advogados/equipe</h2>
          <p>Gerencie perfis internos, vínculo com usuários MBA Labs e status de acesso.</p>
          <Link className="button secondary" href="/lexgestor/equipe">Abrir equipe</Link>
        </article>
      </section>

      <section className="split">
        <article className="card stack">
          <h2>5. Preferências do sistema</h2>
          <p>As preferências comerciais e de apresentação ficam vinculadas ao escritório.</p>
          <span className="badge">Modo demonstração disponível no dashboard</span>
        </article>
        <article className="card stack">
          <h2>6. Segurança</h2>
          <p>Cada tela valida o escritório do usuário logado antes de mostrar ou gravar informações.</p>
          <span className="badge">Isolamento por escritório</span>
        </article>
      </section>

      <div className="button-row">
        <button className="button" type="submit">
          Salvar configurações
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
