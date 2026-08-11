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
    title: "Implantação objetiva",
    description: "Entramos em produção por etapas, com homologação antes de liberar cada solução para clientes reais.",
    icon: Zap
  },
  {
    title: "Feito para o seu setor",
    description: "Cada produto nasce observando a rotina real do negócio, sem funcionalidades inúteis.",
    icon: Puzzle
  },
  {
    title: "Decisões com dados",
    description: "Relatórios claros e indicadores para você enxergar o negócio e acompanhar a operação.",
    icon: ChartLine
  },
  {
    title: "Acesso controlado",
    description: "Acesso por usuário, regras por empresa e revisão contínua de segurança antes de ampliar cada produto.",
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
      category: "Disponível · Vendas & Orçamentos",
      description:
        cotacoes?.description ||
        "Crie cotações, receba respostas de fornecedores, analise vencedores e gere pedidos em um fluxo único.",
      href: cotacoes?.href || "/apps/mbacotacoes",
      icon: FileText,
      tone: "tonePurple",
      wide: true
    },
    {
      name: "Portal Associativo",
      category: "Disponível · Associações & Clubes",
      description: "Gestão de associados, financeiro, comprovantes, comunicados, permissões e relatórios em um único portal.",
      href: "/portal-associativo",
      icon: Users,
      tone: "toneAmber"
    },
    {
      name: lavagestor?.name || "LavaGestor",
      category: "Em finalização · Estética Automotiva",
      description:
        "Fluxo de clientes, veículos, lavagens, comissões, pagamentos e relatórios em homologação para operação comercial.",
      href: lavagestor?.href || "/apps/lavagestor",
      icon: Droplets,
      tone: "toneCyan"
    },
    {
      name: bikecomanda?.name || "BikeComanda",
      category: "Em finalização · Bicicletarias & Oficinas",
      description:
        "Comandas, clientes, bicicletas, serviços e financeiro em processo de integração nativa ao ecossistema MBA Labs.",
      href: bikecomanda?.href || "/apps/bikecomanda",
      icon: Bike,
      tone: "toneGreen"
    },
    {
      name: "LexGestor",
      category: "Em revisão de segurança · Escritórios Jurídicos",
      description: "Módulo jurídico temporariamente em homologação de segurança antes da liberação para novos clientes reais.",
      href: "/login",
      icon: Scale,
      tone: "tonePink"
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
              <Sparkles size={14} /> Sistemas SaaS para rotinas reais
            </span>
            <h1 className={styles.heroTitle}>
              Sistemas que fazem
              <br />
              seu negócio <span className={styles.gradientText}>rodar de verdade.</span>
            </h1>
            <p className={styles.heroText}>
              A MBA Labs desenvolve plataformas de gestão para nichos específicos. Cada solução passa por homologação
              antes de ser liberada para clientes, com foco em operação simples, controle e evolução contínua.
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
                <strong>2</strong>
                soluções disponíveis
              </div>
              <span className={styles.statDivider} aria-hidden />
              <div className={styles.stat}>
                <strong>3</strong>
                módulos em homologação
              </div>
              <span className={styles.statDivider} aria-hidden />
              <div className={styles.stat}>
                <strong>24/7</strong>
                acesso à operação
              </div>
            </div>
          </div>

          <div className={styles.floatingArea} aria-label="Sistemas da MBA Labs">
            <FloatingCard className={styles.floatCotacoes} icon={FileText} name="MBA Cotações · disponível" />
            <FloatingCard className={styles.floatPortal} icon={Users} name="Portal Associativo · disponível" />
            <FloatingCard className={styles.floatLava} icon={Droplets} name="LavaGestor · finalização" />
            <FloatingCard className={styles.floatBike} icon={Bike} name="BikeComanda · finalização" />
            <FloatingCard className={styles.floatLex} icon={Scale} name="LexGestor · revisão" />
          </div>
        </div>
      </section>

      <section className={styles.section} id="produtos">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.kicker}>Nosso ecossistema</span>
              <h2 className={styles.sectionTitle}>Soluções em estágios claros de disponibilidade.</h2>
            </div>
            <p className={styles.sectionIntro}>
              Aqui você vê o que já está disponível para operação e o que ainda está em finalização ou revisão antes de
              receber novos clientes.
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
            <h2 className={styles.ctaTitle}>Quer conhecer uma solução já disponível?</h2>
            <p className={styles.ctaText}>
              Fale com a MBA Labs para conhecer os sistemas liberados para operação ou acompanhar os módulos que ainda
              estão em homologação.
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
              Sistemas de gestão para negócios que precisam de mais controle, menos planilha e uma operação mais simples.
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
