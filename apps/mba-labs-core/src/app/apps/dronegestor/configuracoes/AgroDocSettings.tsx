"use client";
import Link from "next/link";
import { AgroDocOperationalSettings } from "./AgroDocOperationalSettings";
import {
  Bell,
  Settings,
  Users,
  Link as LinkIcon,
  FileSpreadsheet,
  ShieldCheck,
  ExternalLink,
  History,
  Play,
  Folder,
} from "lucide-react";
import { AgroDocHero, AgroDocCard, AgroDocStatus, ROOT } from "../AgroDocUi";
import { OfficialMapTemplateManager } from "../relatorio-mensal/OfficialMapTemplateManager";
import { DroneOperationalProfile } from "../perfil-operacional/DroneOperationalProfile";
import { useState } from "react";
export function AgroDocSettings({ canManage }: { canManage: boolean }) {
  const [profile, setProfile] = useState(false);
  return (
    <>
      <AgroDocHero
        variant="settings"
        title="Configurações"
        description="Preferências do módulo, integrações, permissões e modelo oficial."
      />
      <div className="agro-settings">
        <aside className="agro-card agro-settings-nav">
          {[
            { id: "agro-general", label: "Geral", icon: Settings },
            { id: "agro-integrations", label: "Integrações", icon: LinkIcon },
            { id: "agro-notifications", label: "Notificações", icon: Bell },
            { id: "agro-permissions", label: "Permissões", icon: Users },
            {
              id: "agro-official",
              label: "Arquivos oficiais",
              icon: FileSpreadsheet,
            },
          ].map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#${id}`}>
              <Icon size={23} />
              {label}
            </a>
          ))}
        </aside>
        <div className="agro-stack">
          <div id="agro-integrations">
            <AgroDocCard title="Integrações e órgãos oficiais">
              {[
                {
                  name: "ANAC / SISANT",
                  text: "Dados de aeronaves e operadores",
                  url: "https://sistemas.anac.gov.br/sisant",
                  icon: ShieldCheck,
                },
                {
                  name: "DECEA / SARPAS",
                  text: "Solicitações e autorizações de voo",
                  url: "https://sarpas.decea.mil.br/",
                  icon: ExternalLink,
                },
                {
                  name: "MAPA",
                  text: "Modelo, regras e conformidade da operação",
                  url: "https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/aviacao-agricola",
                  icon: FileSpreadsheet,
                },
              ].map(({ name, text, url, icon: Icon }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="agro-row"
                  style={{
                    color: "inherit",
                    border: "1px solid #e3e6e4",
                    borderRadius: 10,
                    padding: "12px 16px",
                  }}
                >
                  <Icon size={30} />
                  <div>
                    <b>{name}</b>
                    <small>{text}</small>
                  </div>
                  <AgroDocStatus tone="warn">
                    Acompanhamento manual
                  </AgroDocStatus>
                  <ExternalLink size={16} />
                </a>
              ))}
              <Link
                href={`${ROOT}/documentos`}
                className="agro-row"
                style={{ color: "inherit", padding: "12px 16px" }}
              >
                <Folder size={30} />
                <div>
                  <b>Armazenamento de documentos</b>
                  <small>
                    Arquivos privados vinculados à OS. Consulte disponibilidade
                    na central.
                  </small>
                </div>
                <AgroDocStatus>Consultar</AgroDocStatus>
              </Link>
            </AgroDocCard>
          </div>
          <div id="agro-official">
            <OfficialMapTemplateManager />
            <p style={{ fontSize: 12, color: "#586c5d", padding: "0 16px" }}>
              A exportação preenche o arquivo cadastrado, preservando abas,
              fórmulas e validações. A disponibilidade é verificada pelo
              servidor.
            </p>
          </div>
          <div className="agro-two-col">
            <div id="agro-permissions">
              <AgroDocCard title="Permissões e notificações" icon={Bell}>
                <div className="agro-row">
                  <ShieldCheck />
                  <div>
                    <b>Aprovação restrita a gestor / RT</b>
                    <small>
                      Autorização aplicada no servidor em cada conferência.
                    </small>
                  </div>
                  <AgroDocStatus tone="good">Obrigatório</AgroDocStatus>
                </div>
                <div id="agro-notifications" className="agro-row">
                  <Bell />
                  <div>
                    <b>Pendências e vencimentos</b>
                    <small>
                      Consulte alertas no diagnóstico e correções na tela
                      inicial. Envio externo não configurado.
                    </small>
                  </div>
                  <Link className="agro-button" href={`${ROOT}/diagnostico`}>
                    Consultar
                  </Link>
                </div>
                <div className="agro-row">
                  <Users />
                  <div>
                    <b>Seu acesso atual</b>
                    <small>
                      {canManage
                        ? "Gestão operacional conforme permissões MBA Labs."
                        : "Piloto: operações e documentos autorizados."}
                    </small>
                  </div>
                  <Link href={`${ROOT}/pilotos`}>Equipe →</Link>
                </div>
              </AgroDocCard>
            </div>
            <AgroDocCard title="Ações do administrador" icon={ShieldCheck}>
              <div className="agro-stack">
                <button
                  className="agro-button agro-button-primary"
                  onClick={() => setProfile((v) => !v)}
                >
                  <Settings size={19} />
                  Dados e configurações gerais
                </button>
                <Link className="agro-button" href={`${ROOT}/relatorio-mensal`}>
                  <Play size={19} />
                  Testar exportação
                </Link>
                <Link className="agro-button" href={`${ROOT}/conferencia`}>
                  <History size={19} />
                  Ver histórico de revisões
                </Link>
              </div>
            </AgroDocCard>
          </div>
          <div id="agro-general">
            <AgroDocOperationalSettings />
            {profile ? (
              <div className="agro-legacy">
                <DroneOperationalProfile />
              </div>
            ) : (
              <button className="agro-button" onClick={() => setProfile(true)}>
                Abrir perfil operacional e responsável técnico
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
