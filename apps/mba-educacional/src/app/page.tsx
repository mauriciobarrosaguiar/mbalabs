import Link from "next/link";
import CourseCard from "@/components/course-card";
import SiteHeader from "@/components/site-header";
import { categories, courses } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="shell hero-grid">
            <div>
              <span className="eyebrow">✦ Aprenda no seu ritmo. Evolua de verdade.</span>
              <h1>Seu próximo passo profissional <span>começa aqui.</span></h1>
              <p className="hero-copy">Cursos rápidos, profissionalizantes, técnicos e pós-graduação em uma experiência simples, moderna e centralizada.</p>
              <div className="hero-actions">
                <Link className="primary-button" href="/cursos">Explorar cursos</Link>
                <Link className="secondary-button" href="/aluno">Ver área do aluno</Link>
              </div>
              <div className="trust-row">
                <span>Certificados verificáveis</span>
                <span>Instituições parceiras</span>
                <span>Acesso pelo celular</span>
              </div>
            </div>
            <div className="hero-visual" aria-label="Prévia da experiência do aluno">
              <div className="visual-panel">
                <div className="visual-content">
                  <div><small>Uma plataforma. Várias possibilidades.</small><h2>Aprendizado que acompanha sua rotina.</h2></div>
                  <div className="mini-course"><p>Piloto de Drone Agrícola</p><div className="progress"><span /></div></div>
                </div>
              </div>
              <div className="floating-stat"><strong>+4 trilhas</strong><small>em um único ambiente</small></div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="shell">
            <div className="section-heading">
              <div><h2>Encontre o curso ideal</h2><p>Do conhecimento rápido à formação completa.</p></div>
              <Link className="link-arrow" href="/cursos">Ver todos →</Link>
            </div>
            <div className="category-row">
              {categories.map((category, index) => <Link key={category} className={`category-pill ${index === 0 ? "active" : ""}`} href={`/cursos?categoria=${encodeURIComponent(category)}`}>{category}</Link>)}
            </div>
          </div>
        </section>

        <section className="section" style={{paddingTop: 8}}>
          <div className="shell course-grid">
            {courses.slice(0, 6).map(course => <CourseCard key={course.slug} course={course} />)}
          </div>
        </section>

        <section className="section">
          <div className="shell benefit-strip">
            <div className="benefit"><b>100% digital</b><p>Estude pelo computador, tablet ou celular.</p></div>
            <div className="benefit"><b>Progresso centralizado</b><p>Aulas, materiais, avaliações e conclusão no mesmo painel.</p></div>
            <div className="benefit"><b>Certificação clara</b><p>Curso próprio ou parceiro identificado antes da matrícula.</p></div>
            <div className="benefit"><b>Validação online</b><p>Estrutura preparada para QR Code e consulta pública.</p></div>
          </div>
        </section>

        <section className="section">
          <div className="shell partner-banner">
            <div><h3>Formação parceira, experiência MBA.</h3><p>A estrutura já nasce preparada para receber pós-graduações e cursos técnicos de instituições responsáveis pela oferta acadêmica e certificação.</p></div>
            <Link className="primary-button" href="/cursos?tipo=pos">Conhecer formações</Link>
          </div>
        </section>
      </main>
      <footer className="footer"><div className="shell footer-inner"><span>© 2026 MBA Educação · MBA Labs</span><span>Cursos · Certificados · Parceiros · Suporte</span></div></footer>
    </>
  );
}
