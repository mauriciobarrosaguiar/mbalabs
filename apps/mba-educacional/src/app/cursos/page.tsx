import CourseCard from "@/components/course-card";
import SiteHeader from "@/components/site-header";
import { categories, courses } from "@/lib/mock-data";

export default function CoursesPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero"><div className="shell"><span className="eyebrow">Catálogo completo</span><h1>Escolha como você quer evoluir.</h1><p className="hero-copy">Filtre por tipo, área e formato para encontrar sua próxima formação.</p></div></section>
        <section className="section" style={{paddingTop: 10}}>
          <div className="shell filter-layout">
            <aside className="filters">
              <h3>Filtros</h3>
              <div className="filter-group"><strong>Tipo de curso</strong>{["Rápido","Profissionalizante","Pós-graduação","Técnico"].map(x=><label className="check" key={x}><input type="checkbox" /> {x}</label>)}</div>
              <div className="filter-group"><strong>Categoria</strong>{categories.slice(1,6).map(x=><label className="check" key={x}><input type="checkbox" /> {x}</label>)}</div>
            </aside>
            <div>
              <div className="catalog-top"><input className="search-box" placeholder="Busque por curso, área ou tema" /><select className="sort" defaultValue="destaques"><option value="destaques">Mais relevantes</option><option value="menor">Menor preço</option><option value="recentes">Mais recentes</option></select></div>
              <div className="course-grid">{courses.map(course=><CourseCard key={course.slug} course={course} />)}</div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
