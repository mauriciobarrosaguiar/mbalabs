import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { courses } from "@/lib/mock-data";

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = courses.find(item => item.slug === slug);
  if (!course) notFound();

  return (
    <>
      <SiteHeader />
      <main>
        <section className="detail-hero">
          <div className="shell detail-grid">
            <div className="detail-copy">
              <span className="eyebrow">{course.kind} · {course.category}</span>
              <h1>{course.title}</h1>
              <p>Uma formação objetiva, organizada por módulos e preparada para uma experiência simples do início ao certificado.</p>
              <div className="detail-tags"><span className="detail-tag">⏱ {course.hours}</span><span className="detail-tag">▶ Aulas online</span><span className="detail-tag">▣ Materiais de apoio</span><span className="detail-tag">✓ Certificação identificada</span></div>
            </div>
            <aside className="buy-card">
              <div className={`buy-cover tone-${course.tone}`}>✦</div>
              <div className="buy-content"><small>Investimento</small><div className="buy-price">{course.price}</div>{course.oldPrice && <del>{course.oldPrice}</del>}<Link className="primary-button" href="/aluno">Começar agora</Link><div className="buy-points"><span>✓ Acesso individual do aluno</span><span>✓ Progresso salvo automaticamente</span><span>✓ Material complementar</span><span>✓ Suporte à certificação</span></div></div>
            </aside>
          </div>
        </section>
        <section><div className="shell content-grid">
          <div className="content-card"><h2>O que você vai aprender</h2><p className="hero-copy">Conteúdo estruturado para transformar conhecimento em aplicação prática, com trilha clara e acompanhamento do progresso.</p><div className="module"><b>Módulo 1 · Fundamentos</b><span>Introdução, contexto, conceitos essenciais e materiais de apoio.</span></div><div className="module"><b>Módulo 2 · Prática guiada</b><span>Aplicações, exemplos, exercícios e situações reais.</span></div><div className="module"><b>Módulo 3 · Consolidação</b><span>Revisão, avaliação e preparação para conclusão.</span></div></div>
          <div className="content-card"><h3>Certificação</h3><p style={{color:"var(--muted)",lineHeight:1.6}}>Antes da matrícula, o sistema identifica quem é o responsável acadêmico. Em cursos próprios, a emissão segue as regras do curso livre. Em formações parceiras, a instituição responsável aparece de forma destacada.</p>{course.partner && <p className="partner-line">✓ Responsável: {course.partner}</p>}</div>
        </div></section>
      </main>
    </>
  );
}
