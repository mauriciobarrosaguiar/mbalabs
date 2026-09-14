import Link from "next/link";

const cards = [
  ["Cursos publicados", "24", "+4 este mês"],
  ["Alunos ativos", "1.284", "+8,2%"],
  ["Instituições", "3", "2 integradas"],
  ["Certificados pendentes", "18", "Requer atenção"]
];

export default function AdminPage() {
  return (
    <main className="student-shell">
      <aside className="student-sidebar">
        <Link className="brand" href="/"><span className="brand-mark">M</span><span><strong>MBA</strong><small>Educação · Admin</small></span></Link>
        <nav className="side-nav"><Link className="active" href="/admin">⌂ Visão geral</Link><Link href="#">▦ Cursos</Link><Link href="#">♙ Alunos</Link><Link href="#">◇ Instituições</Link><Link href="#">▣ Certificados</Link><Link href="#">$ Financeiro</Link><Link href="#">⚙ Configurações</Link></nav>
      </aside>
      <section className="student-main">
        <header className="student-top"><div><small style={{color:"var(--muted)"}}>Gestão da plataforma</small><h1>Painel educacional</h1></div><Link className="primary-button compact" href="/cursos">Ver loja</Link></header>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14,marginTop:24}}>{cards.map(([label,value,note])=><article className="stat-card" key={label}><small>{label.toUpperCase()}</small><strong style={{display:"block",marginTop:8}}>{value}</strong><p>{note}</p></article>)}</div>
        <section className="section" style={{paddingBottom:0}}>
          <div className="section-heading"><div><h2>Operação das instituições</h2><p>Acompanhe matrícula, estudo e certificação em um único fluxo.</p></div></div>
          <div className="content-card" style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:720}}><thead><tr style={{textAlign:"left",color:"var(--muted)",fontSize:12}}><th style={{padding:12}}>Instituição</th><th>Oferta</th><th>Estudo</th><th>Certificação</th><th>Status</th></tr></thead><tbody>{[
              ["Faculdade parceira A","Pós-graduação","MBA LMS","API / upload","Ativa"],
              ["Escola técnica B","Técnicos","Portal parceiro","Link externo","Integração"],
              ["MBA Educação","Cursos livres","MBA LMS","MBA Educação","Ativa"]
            ].map(row=><tr key={row[0]} style={{borderTop:"1px solid var(--line)"}}>{row.map((cell,i)=><td key={i} style={{padding:14,fontSize:13,fontWeight:i===0?750:500,color:i===4?"#18875c":"inherit"}}>{cell}</td>)}</tr>)}</tbody></table>
          </div>
        </section>
      </section>
    </main>
  );
}
