"use client";
import { Dashboard } from "./routes/index";
import { Projects } from "./routes/projetos.index";
import { ProjectPage } from "./routes/projetos.$id";
import { Wizard } from "./routes/novo-projeto";
import { PageHeader,Panel } from "./components/geo/ui";
import { Link } from "./lib/navigation";
import { GeoMapWorkspace } from "../GeoMapWorkspace";
const labels:Record<string,string>={"planejamento":"Planejamento de voo","processamento":"Central de processamento","geostudio":"GeoStudio","topografia":"Topografia","visualizador-3d":"Visualizador 3D","agricultura":"Agricultura de precisão","relatorios":"Relatórios","exportacoes":"Exportações","equipamentos":"Equipamentos","servidores":"Servidores","armazenamento":"Armazenamento","notificacoes":"Notificações","configuracoes":"Configurações"};
export function GeoMapDesign({segments=[]}:{segments?:string[]}) {
 const [section,project]=segments;
 let content;
 if(!section)content=<Dashboard/>;
 else if(section==="novo-projeto")content=<Wizard/>;
 else if(section==="projetos")content=project?<ProjectPage id={project}/>:<Projects/>;
 else if(section==="relatorios"&&project==="gerador")content=<GeoMapWorkspace/>;
 else content=<div><PageHeader title={labels[section]??"Página não encontrada"}/><Panel><p className="text-sm text-muted-foreground">Esta tela ainda será detalhada no protótipo.</p>{section==="relatorios"&&<Link to="/relatorios/gerador" className="mt-3 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Abrir gerador PDF / HTML existente</Link>}{section==="processamento"&&<a href="https://github.com/mauriciobarrosaguiar/mbalabs/actions/runs/46135088554" className="mt-3 inline-flex text-sm text-primary">Consultar teste real público 003</a>}</Panel></div>;
 return content;
}
