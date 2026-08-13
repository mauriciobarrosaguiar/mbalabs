import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/">
          <span className="brand-mark">M</span>
          <span><strong>MBA</strong><small>Educação</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="Principal">
          <Link href="/cursos">Cursos</Link>
          <Link href="/cursos?tipo=pos">Pós-graduação</Link>
          <Link href="/cursos?tipo=tecnico">Técnicos</Link>
          <Link href="/cursos?tipo=rapido">Cursos rápidos</Link>
        </nav>
        <div className="header-actions">
          <button className="icon-button" aria-label="Pesquisar">⌕</button>
          <Link className="ghost-button" href="/aluno">Área do aluno</Link>
          <Link className="primary-button compact" href="/cursos">Explorar cursos</Link>
        </div>
      </div>
    </header>
  );
}
