import Link from "next/link";

export default function StudentDashboardPage() {
  return (
    <main className="student-shell">
      <aside className="student-sidebar">
        <Link className="brand" href="/"><span className="brand-mark">M</span><span><strong>MBA</strong><small>Educação</small></span></Link>
        <nav className="side-nav"><Link className="active" href="/aluno">⌂ Início</Link><Link href="#">▶ Meus cursos</Link><Link href="#">▣ Certificados</Link><Link href="#">♡ Favoritos</Link><Link href="/cursos">⌕ Explorar cursos</Link><Link href="#">⚙ Configurações</Link></nav>
      </aside>
      <section className="student-main">
        <header className="student-top"><div><small style={{color:"var(--muted)"}}>Área do aluno</small><h1>Olá, Maurício 👋</h1></div><div className="avatar">MB</div></header>
        <div className="dashboard-grid">
          <article className="continue-card"><div><small>CONTINUAR ESTUDANDO</small><h2>Piloto de Drone Agrícola</h2><p>Módulo 3 · Segurança, planejamento e operação</p></div><div><div className="progress"><span /></div><p style={{fontSize:12}}>68% concluído</p><Link className="primary-button" href="/curso/piloto-drone-agricola">Continuar curso →</Link></div></article>
          <div style={{display:"grid",gap:14}}><article className="stat-card"><small>CURSOS ATIVOS</small><strong style={{display:"block",marginTop:8}}>3</strong><p>Você está evoluindo em 3 trilhas.</p></article><article className="stat-card"><small>CERTIFICADOS</small><strong style={{display:"block",marginTop:8}}>2</strong><p>Documentos disponíveis para consulta.</p></article></div>
        </div>
        <section className="section" style={{paddingBottom:0}}><div className="section-heading"><div><h2>Meus cursos</h2><p>Continue de onde parou.</p></div><Link className="link-arrow" href="/cursos">Explorar mais →</Link></div><div className="my-courses"><article className="my-course"><div className="my-course-top"><div><h3>Excel Prático para Vendas</h3><small>Curso rápido · 12h</small></div><b>42%</b></div><div className="progress"><span style={{width:"42%"}} /></div></article><article className="my-course"><div className="my-course-top"><div><h3>Gestão Comercial e Alta Performance</h3><small>Pós-graduação · Instituição parceira</small></div><b>12%</b></div><div className="progress"><span style={{width:"12%"}} /></div></article></div></section>
      </section>
      <nav className="mobile-nav"><Link href="/aluno">Início</Link><Link href="/cursos">Cursos</Link><Link href="#">Certificados</Link></nav>
    </main>
  );
}
