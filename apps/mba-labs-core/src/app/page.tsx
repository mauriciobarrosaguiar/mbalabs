import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  Boxes,
  ChartLine,
  Cloud,
  Droplets,
  FileText,
  Headphones,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  Puzzle,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSiteConfig } from "@/lib/site-config";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type Product = {
  name: string;
  category: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: "tonePurple" | "toneCyan" | "toneGreen" | "tonePink" | "toneAmber";
  wide?: boolean;
};

type Benefit = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const benefits: Benefit[] = [
  {
    title: "Implantação rápida",
    description: "Seu sistema no ar em dias, não em meses — com dados migrados e equipe treinada.",
    icon: Zap
  },
  {
    title: "Feito para o seu setor",
    description: "Cada produto nasce observando a rotina real do negócio, sem funcionalidades inúteis.",
    icon: Puzzle
  },
  {
    title: "Decisões com dados",
    description: "Relatórios claros e indicadores em tempo real para você enxergar o negócio de verdade.",
    icon: ChartLine
  },
  {
    title: "Segurança e backup",
    description: "Seus dados protegidos e disponíveis, com backups automáticos e acesso controlado.",
    icon: ShieldCheck
  },
  {
    title: "100% na nuvem",
    description: "Acesse de qualquer lugar, em qualquer dispositivo, sem instalar nada.",
    icon: Cloud
  },
  {
    title: "Suporte humano",
    description: "Atendimento real por trás de cada sistema, pronto para ajudar quando você precisar.",
    icon: Headphones
  }
];

const marqueeItems = ["Cotações", "Lava-jato", "Bicicletarias", "Jurídico", "Associações", "Gestão", "Automação"];

export default async function HomePage() {
  const config = await getSiteConfig();
  const whatsappHref = config.whatsappUrl || process.env.NEXT_PUBLIC_MBA_WHATSAPP_URL || "#";

  const cotacoes = config.systems.find((system) => system.key === "mbacotacoes");
  const lavagestor = config.systems.find((system) => system.key === "lavagestor");
  const bikecomanda = config.systems.find((system) => system.key === "bikecomanda");

  const products: Product[] = [
    {
      name: cotacoes?.name || "MBA Cotações",
      category: "Vendas & Orçamentos",
      description:
        cotacoes?.description ||
        "Monte cotações profissionais em segundos, acompanhe negociações e converta mais propostas em vendas fechadas.",
      href: cotacoes?.href || "/apps/mbacotacoes",
      icon: FileText,
      tone: "tonePurple",
      wide: true
    },
    {
      name: lavagestor?.name || "LavaGestor",
      category: "Estética Automotiva",
      description:
        lavagestor?.description ||
        "Fila de serviços, comandas e financeiro de lava-jatos e estéticas automotivas em um só painel.",
      href: lavagestor?.href || "/apps/lavagestor",
      icon: Droplets,
      tone: "toneCyan"
    },
    {
      name: bikecomanda?.name || "BikeComanda",
      category: "Bicicletarias & Oficinas",
      description:
        bikecomanda?.description ||
        "Ordens de serviço, peças e histórico de manutenção para lojas e oficinas de bicicletas.",
      href: bikecomanda?.href || "/apps/bikecomanda",
      icon: Bike,
      tone: "toneGreen"
    },
    {
      name: "LexGestor",
      category: "Escritórios Jurídicos",
      description: "Processos, prazos, clientes e documentos organizados com segurança para rotinas jurídicas.",
      href: "/lexgestor",
      icon: Scale,
      tone: "tonePink"
    },
    {
      name: "Portal Associativo",
      category: "Associações & Clubes",
      description: "Gestão de associados, mensalidades, comunicados e eventos em um portal moderno e simples.",
      href: "/portal-associativo",
      icon: Users,
      tone: "toneAmber"
    }
  ];

  return (
    <main className={styles.landing}>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link className={styles.brand} href="#top" aria-label="Voltar ao início">
            <span className={styles.brandMark} aria-hidden>
              <Boxes size={19} />
            </span>
            <span>
              MBA <span className={styles.brandGradient}>Labs</span>
            </span>
          </Link>

          <nav className={styles.desktopNav} aria-label="Navegação principal">
            <a href="#produtos">Produtos</a>
            <a href="#diferenciais">Diferenciais</a>
            <a href="#contato">Contato</a>
          </nav>

          <div className={styles.headerActions}>
            <Link className={styles.loginLink} href="/login">
              Entrar
            </Link>
            <a className={styles.headerCta} href={whatsappHref} target="_blank" rel="noreferrer">
              Falar com a equipe <ArrowUpRight size={16} />
            </a>
          </div>

          <details className={styles.mobileMenu}>
            <summary aria-label="Abrir menu">
              <Menu size={23} />
            </summary>
            <nav className={styles.mobilePanel} aria-label="Menu mobile">
              <a href="#produtos">Produtos</a>
              <a href="#diferenciais">Diferenciais</a>
              <a href="#contato">Contato</a>
              <Link href="/login">Entrar na plataforma</Link>
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                Falar com a equipe
              </a>
            </nav>
          </details>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.gridOverlay} aria-hidden />
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div>
            <span className={styles.badge}>
              <Sparkles size={14} /> Uma fábrica de sistemas sob medida
            </span>
            <h1 className={styles.heroTitle}>
              Sistemas que fazem
              <br />
              seu negócio <span className={styles.gradientText}>rodar de verdade.</span>
            </h1>
            <p className={styles.heroText}>
              A MBA Labs desenvolve plataformas de gestão sob medida para setores específicos — de cotações a lava-jatos,
              de bicicletarias a escritórios jurídicos e associações. Menos planilha, mais controle.
            </p>

            <div className={styles.heroButtons}>
              <a className={styles.primaryButton} href="#produtos">
                Conhecer os sistemas <ArrowRight size={17} />
              </a>
              <a className={styles.secondaryButton} href={whatsappHref} target="_blank" rel="noreferrer">
                Solicitar demonstração
              </a>
            </div>

            <div className={styles.stats}>
              <div className={styles.stat}>
                <strong>5</strong>
                sistemas em operação
              </div>
              <span className={styles.statDivider} aria-hidden />
              <div className={styles.stat}>
                <strong>100%</strong>
                foco em nichos reais
              </div>
              <span className={styles.statDivider} aria-hidden />
              <div className={styles.stat}>
                <strong>24/7</strong>
                acesso à operação
              </div>
            </div>
          </div>

          <div className={styles.floatingArea} aria-label="Sistemas da MBA Labs">
            <FloatingCard className={styles.floatCotacoes} icon={FileText} name="MBA Cotações" />
            <FloatingCard className={styles.floatLava} icon={Droplets} name="LavaGestor" />
            <FloatingCard className={styles.floatBike} icon={Bike} name="BikeComanda" />
            <FloatingCard className={styles.floatLex} icon={Scale} name="LexGestor" />
            <FloatingCard className={styles.floatPortal} icon={Users} name="Portal Associativo" />
          </div>
        </div>
      </section>

      <section className={styles.section} id="produtos">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.kicker}>Nosso ecossistema</span>
              <h2 className={styles.sectionTitle}>Cinco sistemas, cada um construído para um negócio real.</h2>
            </div>
            <p className={styles.sectionIntro}>
              Nenhum sistema genérico. Cada produto da MBA Labs nasce da rotina de um setor específico — por isso resolve
              de verdade.
            </p>
          </div>

          <div className={styles.productsGrid}>
            {products.map((product) => {
              const Icon = product.icon;
              return (
                <article
                  className={`${styles.productCard} ${styles[product.tone]} ${product.wide ? styles.productWide : ""}`}
                  key={product.name}
                >
                  <span className={styles.productGlow} aria-hidden />
                  <div className={styles.productIcon}>
                    <Icon size={23} />
                  </div>
                  <p className={styles.productCategory}>{product.category}</p>
                  <h3 className={styles.productTitle}>{product.name}</h3>
                  <p className={styles.productDescription}>{product.description}</p>
                  <Link className={styles.productLink} href={product.href}>
                    Ver detalhes <ArrowUpRight size={16} />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>

        <div className={styles.marquee} aria-label="Áreas atendidas">
          <div className={styles.marqueeTrack}>
            {[...marqueeItems, ...marqueeItems, ...marqueeItems].map((item, index) => (
              <span className={styles.marqueeItem} key={`${item}-${index}`}>
                {item} <span>•</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionSoft}`} id="diferenciais">
        <div className={styles.container}>
          <div>
            <span className={styles.kicker}>Por que a MBA Labs</span>
            <h2 className={styles.sectionTitle}>Tecnologia séria, sem complicação.</h2>
          </div>

          <div className={styles.benefitList}>
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <article className={styles.benefitRow} key={benefit.title}>
                  <div className={styles.benefitIcon}>
                    <Icon size={21} />
                  </div>
                  <h3 className={styles.benefitTitle}>{benefit.title}</h3>
                  <p className={styles.benefitText}>{benefit.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection} id="contato">
        <div className={styles.container}>
          <div className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>Pronto para colocar seu negócio no piloto certo?</h2>
            <p className={styles.ctaText}>
              Conte para a nossa equipe o que você precisa e receba uma demonstração personalizada do sistema mais
              adequado ao seu negócio.
            </p>
            <div className={styles.ctaActions}>
              <a className={styles.primaryButton} href={whatsappHref} target="_blank" rel="noreferrer">
                Falar com a equipe <ArrowRight size={17} />
              </a>
              <a className={styles.darkButton} href={whatsappHref} target="_blank" rel="noreferrer">
                <Phone size={16} /> Agendar conversa
              </a>
            </div>
            <a className={styles.ctaEmail} href="mailto:contato@mbalabs.com.br">
              <Mail size={15} /> contato@mbalabs.com.br
            </a>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerGrid}`}>
          <div>
            <Link className={styles.brand} href="#top">
              <span className={styles.brandMark} aria-hidden>
                <Boxes size={19} />
              </span>
              <span>
                MBA <span className={styles.brandGradient}>Labs</span>
              </span>
            </Link>
            <p className={styles.footerDescription}>
              Sistemas de gestão sob medida para negócios que precisam de mais controle e menos planilha.
            </p>
          </div>

          <FooterColumn title="Produtos">
            {products.map((product) => (
              <Link href={product.href} key={product.name}>
                {product.name}
              </Link>
            ))}
          </FooterColumn>

          <FooterColumn title="Empresa">
            <a href="#diferenciais">Diferenciais</a>
            <a href="#contato">Contato</a>
            <Link href="/login">Entrar</Link>
          </FooterColumn>

          <FooterColumn title="Contato">
            <a href="mailto:contato@mbalabs.com.br">contato@mbalabs.com.br</a>
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              <MessageCircle size={14} /> WhatsApp MBA Labs
            </a>
          </FooterColumn>
        </div>
        <div className={styles.copyright}>
          <div className={styles.container}>© 2026 MBA Labs. Todos os direitos reservados.</div>
        </div>
      </footer>
    </main>
  );
}

function FloatingCard({ className, icon: Icon, name }: { className: string; icon: LucideIcon; name: string }) {
  return (
    <div className={`${styles.floatCard} ${className}`}>
      <div className={styles.floatIcon}>
        <Icon size={18} />
      </div>
      <p>{name}</p>
      <div className={styles.progress} aria-hidden>
        <span />
      </div>
    </div>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className={styles.footerHeading}>{title}</h3>
      <div className={styles.footerLinks}>{children}</div>
    </div>
  );
}
