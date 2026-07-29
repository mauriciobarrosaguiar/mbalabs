import type { CSSProperties } from "react";
import Link from "next/link";
import { Building2, Clock3, Download, Plus, Send, ShieldCheck, Sparkles } from "lucide-react";
import { GoogleEmpresasNav } from "@/components/google-empresas/GoogleEmpresasNav";
import { GoogleEmpresasTable, type GoogleEmpresasTableRow } from "@/components/google-empresas/GoogleEmpresasTable";
import { MessageBanner, formatDate } from "@/components/ui-kit";
import { formatGoogleEmpresaStatus, getGoogleEmpresasDashboard } from "@/lib/google-empresas/data";

export const dynamic = "force-dynamic";

export default async function GoogleEmpresasPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const { empresas, error } = await getGoogleEmpresasDashboard();
  const rows: GoogleEmpresasTableRow[] = empresas.map((empresa) => ({
    id: empresa.id,
    nome: empresa.nome,
    categoria: empresa.google_categoria_nome ?? empresa.categoria_principal,
    cidade_uf: [empresa.cidade, empresa.estado].filter(Boolean).join(" — ") || "-",
    status: formatGoogleEmpresaStatus(empresa.status),
    status_codigo: empresa.status,
    google: empresa.google_location_name ? "Perfil vinculado" : empresa.google_account_name ? "Conta autorizada" : "Não conectado",
    atualizado: formatDate(empresa.updated_at)
  }));

  const awaitingClient = empresas.filter((item) => item.status === "aguardando_cliente").length;
  const inVerification = empresas.filter((item) => item.status === "aguardando_verificacao").length;
  const verified = empresas.filter((item) => item.status === "verificado").length;
  const verifiedPercentage = empresas.length ? Math.round((verified / empresas.length) * 100) : 0;

  const stats = [
    {
      label: "Empresas",
      value: empresas.length,
      note: "Cadastros do painel",
      icon: Building2,
      color: "#c084fc",
      glow: "rgba(168, 85, 247, 0.28)"
    },
    {
      label: "Aguardando cliente",
      value: awaitingClient,
      note: "Autorizações pendentes",
      icon: Send,
      color: "#f3b942",
      glow: "rgba(243, 185, 66, 0.24)"
    },
    {
      label: "Em verificação",
      value: inVerification,
      note: "Google analisando",
      icon: Clock3,
      color: "#24c8d8",
      glow: "rgba(36, 200, 216, 0.22)"
    },
    {
      label: "Verificadas",
      value: verified,
      note: `${verifiedPercentage}% do total`,
      icon: ShieldCheck,
      color: "#20d7a0",
      glow: "rgba(32, 215, 160, 0.22)"
    }
  ];

  const steps = [
    ["1", "Cadastre os dados", "Preencha as informações reais da empresa."],
    ["2", "Envie o link ao cliente", "Autorização por link seguro."],
    ["3", "Sincronize duplicidades", "Confira perfis já existentes no Google."],
    ["4", "Crie ou solicite acesso", "Perfil novo ou acesso ao existente."],
    ["5", "Acompanhe a verificação", "Status do processo dentro do painel."]
  ];

  return (
    <main className="google-empresas-module">
      <GoogleEmpresasNav active="dashboard" />
      <section className="google-empresas-content">
        <div className="google-empresas-hero">
          <div className="google-empresas-hero-copy">
            <div className="google-empresas-badge">
              <Sparkles size={14} />
              Painel Google Empresas
            </div>
            <h1 className="google-empresas-title">
              Cadastre, autorize e verifique
              <span className="google-empresas-title-gradient">sem sair do painel</span>
            </h1>
            <p className="google-empresas-description">
              Envie autorizações ao cliente, pesquise perfis existentes, crie o Perfil da Empresa e acompanhe a verificação em tempo real — tudo no MBA Labs.
            </p>
          </div>
          <div className="google-hero-actions">
            <a
              className="google-checklist-action"
              href="/api/google-empresas/checklist-documentos"
              download
            >
              <Download size={18} />
              Baixar lista de documentos
            </a>
            <Link className="google-primary-action" href="/google-empresas/nova">
              <Plus size={18} />
              Nova empresa
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <MessageBanner ok={first(query.ok)} error={first(query.error) ?? error ?? undefined} />
        </div>

        <section className="google-stat-grid" aria-label="Resumo do painel">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <article
                className="google-stat-card"
                key={item.label}
                style={{ "--google-stat-color": item.color, "--google-stat-glow": item.glow } as CSSProperties}
              >
                <div className="google-stat-top">
                  <div>
                    <div className="google-stat-value">{item.value}</div>
                    <div className="google-stat-label">{item.label}</div>
                  </div>
                  <span className="google-stat-icon">
                    <Icon size={21} />
                  </span>
                </div>
                <div className="google-stat-note">{item.note}</div>
              </article>
            );
          })}
        </section>

        <section className="google-flow-card">
          <div className="google-section-heading">
            <h2>Fluxo do painel</h2>
          </div>
          <div className="google-flow-grid">
            {steps.map(([number, title, description]) => (
              <article className="google-flow-step" key={number}>
                <div className="google-flow-step-head">
                  <span className="google-flow-number">{number}</span>
                  <strong>{title}</strong>
                </div>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <GoogleEmpresasTable rows={rows} />
      </section>
    </main>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
