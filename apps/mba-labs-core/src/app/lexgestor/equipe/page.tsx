import { CheckCircle2, Plus, Trash2, UserRoundCog } from "lucide-react";
import {
  alterarStatusAdvogadoLexGestor,
  excluirOuInativarAdvogadoLexGestor,
  salvarAdvogadoLexGestor,
} from "@/app/lexgestor/actions";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData, type LexAdvogado, type LexCoreUsuario } from "@/lib/lexgestor/data";
import { PERFIS_LEXGESTOR } from "@/lib/lexgestor/permissions";
import { resumoLimite } from "@/lib/lexgestor/plans";

type EquipePageProps = {
  searchParams?: Promise<{ erro?: string; status?: string }>;
};

export default async function EquipePage({ searchParams }: EquipePageProps) {
  const params = (await searchParams) ?? {};
  const data = await getLexWorkspaceData("/lexgestor/equipe");
  const ativos = data.advogados.filter((advogado) => advogado.status === "Ativo").length;

  return (
    <ResponsivePageContainer
      title="Equipe"
      description="Advogados, assistentes e perfis internos do escritório."
    >
      {params.erro ? <p className="notice danger" role="alert">{feedbackMessage(params.erro)}</p> : null}
      {params.status ? <p className="notice success" role="status">{feedbackMessage(params.status)}</p> : null}

      <section className="split">
        <article className="card stack">
          <div className="section-title">
            <div>
              <h2>Plano e limites</h2>
              <p>{data.plano.nome}</p>
            </div>
            <span className="status-pill">{ativos}/{resumoLimite(data.plano.limiteAdvogados)} usuários</span>
          </div>
          <div className="grid">
            <span className="badge">Clientes: {data.usoPlano.clientes}/{resumoLimite(data.plano.limiteClientes)}</span>
            <span className="badge">Casos ativos: {data.usoPlano.casosAtivos}/{resumoLimite(data.plano.limiteCasosAtivos)}</span>
            <span className="badge">Documentos: {data.usoPlano.documentos}/{resumoLimite(data.plano.limiteDocumentos)}</span>
            <span className="badge">{data.plano.permiteDossie ? "Dossiê liberado" : "Dossiê não incluso"}</span>
          </div>
        </article>

        <article className="card stack">
          <div className="section-title">
            <div>
              <h2>Perfis de acesso</h2>
              <p>Permissões aplicadas no servidor conforme o perfil interno.</p>
            </div>
            <UserRoundCog size={24} color="var(--primary)" aria-hidden />
          </div>
          <div className="compact-stack">
            {PERFIS_LEXGESTOR.map((perfil) => (
              <p className="muted" key={perfil.value}>
                <strong>{perfil.label}:</strong> {perfil.resumo}
              </p>
            ))}
          </div>
        </article>
      </section>

      <section className="form-card stack">
        <div className="section-title">
          <div>
            <h2>Novo profissional</h2>
            <p>Cadastre a pessoa e vincule ao login MBA Labs quando já existir.</p>
          </div>
          <Plus size={24} color="var(--primary)" aria-hidden />
        </div>
        <EquipeForm usuarios={data.usuariosEmpresa} />
      </section>

      <section className="stack">
        <div className="section-title">
          <div>
            <h2>Profissionais cadastrados</h2>
            <p>Cards fechados no mobile, com ações dentro da edição.</p>
          </div>
          <span className="badge">{data.advogados.length} registro(s)</span>
        </div>

        {data.advogados.length === 0 ? (
          <article className="empty-state">
            <strong>Nenhum profissional cadastrado</strong>
            <p>Cadastre o responsável principal do escritório para começar.</p>
          </article>
        ) : (
          <div className="team-grid">
            {data.advogados.map((advogado) => (
              <article className="card stack team-card" key={advogado.id}>
                <div className="section-title">
                  <div>
                    <h2>{advogado.nome}</h2>
                    <p>{advogado.cargo || perfilLabel(advogado.perfilAcesso)}</p>
                  </div>
                  <span className={`status-pill ${advogado.status === "Ativo" ? "success" : "warning"}`}>
                    {advogado.status}
                  </span>
                </div>
                <div className="detail-grid">
                  <Info label="E-mail" value={advogado.email} />
                  <Info label="WhatsApp" value={advogado.whatsapp} />
                  <Info label="OAB" value={advogado.oab ? `${advogado.oab}/${advogado.ufOab}` : "-"} />
                  <Info label="Perfil" value={perfilLabel(advogado.perfilAcesso)} />
                  <Info label="Casos" value={`${advogado.casosResponsavelCount}`} />
                  <Info label="Login MBA Labs" value={advogado.coreUsuarioId ? "Vinculado" : "Pendente"} />
                </div>

                <details className="team-edit">
                  <summary>Editar profissional</summary>
                  <EquipeForm advogado={advogado} usuarios={data.usuariosEmpresa} />
                </details>

                <div className="button-row">
                  <form action={alterarStatusAdvogadoLexGestor}>
                    <input type="hidden" name="id" value={advogado.id} />
                    <input type="hidden" name="status" value={advogado.status === "Ativo" ? "inativo" : "ativo"} />
                    <button className="button secondary" type="submit">
                      <CheckCircle2 size={17} aria-hidden />
                      {advogado.status === "Ativo" ? "Inativar" : "Ativar"}
                    </button>
                  </form>
                  <form action={excluirOuInativarAdvogadoLexGestor}>
                    <input type="hidden" name="id" value={advogado.id} />
                    <button className="button secondary danger-text" type="submit">
                      <Trash2 size={17} aria-hidden />
                      Excluir
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </ResponsivePageContainer>
  );
}

function EquipeForm({
  advogado,
  usuarios,
}: {
  advogado?: LexAdvogado;
  usuarios: LexCoreUsuario[];
}) {
  return (
    <form className="stack" action={salvarAdvogadoLexGestor}>
      {advogado ? <input type="hidden" name="id" value={advogado.id} /> : null}
      <div className="field-grid">
        <label className="field">
          Nome
          <input name="nome" defaultValue={advogado?.nome ?? ""} placeholder="Nome completo" required />
        </label>
        <label className="field">
          E-mail
          <input name="email" type="email" defaultValue={advogado?.email ?? ""} placeholder="email@escritorio.com" />
        </label>
        <label className="field">
          Telefone
          <input name="telefone" defaultValue={advogado?.telefone ?? ""} placeholder="(00) 0000-0000" />
        </label>
        <label className="field">
          WhatsApp
          <input name="whatsapp" defaultValue={advogado?.whatsapp ?? ""} placeholder="(00) 00000-0000" />
        </label>
        <label className="field">
          OAB
          <input name="oab" defaultValue={advogado?.oab ?? ""} placeholder="Número da OAB" />
        </label>
        <label className="field">
          UF da OAB
          <input name="uf_oab" defaultValue={advogado?.ufOab ?? ""} placeholder="UF" maxLength={2} />
        </label>
        <label className="field">
          Cargo/função
          <input name="cargo" defaultValue={advogado?.cargo ?? ""} placeholder="Sócio, advogado, assistente..." />
        </label>
        <label className="field">
          Perfil de acesso
          <select name="perfil_acesso" defaultValue={advogado?.perfilAcesso ?? "advogado"}>
            {PERFIS_LEXGESTOR.map((perfil) => (
              <option value={perfil.value} key={perfil.value}>{perfil.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Status
          <select name="status" defaultValue={advogado?.status === "Inativo" ? "inativo" : advogado?.status === "Pendente" ? "pendente" : "ativo"}>
            <option value="ativo">Ativo</option>
            <option value="pendente">Pendente</option>
            <option value="inativo">Inativo</option>
          </select>
        </label>
        <label className="field">
          Usuário MBA Labs
          <select name="core_usuario_id" defaultValue={advogado?.coreUsuarioId ?? ""}>
            <option value="">Vincular depois</option>
            {usuarios.map((usuario) => (
              <option value={usuario.id} key={usuario.id}>
                {usuario.nome} - {usuario.email}
              </option>
            ))}
          </select>
        </label>
        <label className="field-full">
          Observações
          <textarea name="observacoes" defaultValue={advogado?.observacoes ?? ""} placeholder="Observações internas sobre acesso, atuação ou convite." />
        </label>
      </div>
      <div className="button-row">
        <button className="button" type="submit">{advogado ? "Salvar alterações" : "Cadastrar profissional"}</button>
      </div>
    </form>
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

function perfilLabel(value: string) {
  return PERFIS_LEXGESTOR.find((perfil) => perfil.value === value)?.label ?? value;
}

function feedbackMessage(value: string) {
  const messages: Record<string, string> = {
    "advogado-criado": "Profissional cadastrado.",
    "advogado-atualizado": "Profissional atualizado.",
    "advogado-ativado": "Profissional ativado.",
    "advogado-inativado": "Profissional inativado.",
    "advogado-excluido": "Profissional excluído.",
    "configure-escritorio": "Configure o escritório antes de cadastrar a equipe.",
    "usuario-invalido": "O usuário escolhido não pertence a este escritório.",
  };

  return messages[value] ?? value;
}
