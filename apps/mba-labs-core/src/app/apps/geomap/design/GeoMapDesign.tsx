"use client";
import { PreparationPage } from "./routes/processing-preparation";
import { PhotoPreflightPage } from "./routes/photo-preflight";
import { RealDashboard,RealProjects,RealWizard,RealDetail } from "./routes/real-projects";
import { PageHeader,Panel } from "./components/geo/ui";
import { Link } from "./lib/navigation";
import { GeoMapWorkspace } from "../GeoMapWorkspace";
import type { ProjectList } from "../project-model";
const labels:Record<string,string>={"planejamento":"Planejamento de voo","processamento":"Central de processamento","geostudio":"GeoStudio","topografia":"Topografia","visualizador-3d":"Visualizador 3D","agricultura":"Agricultura de precisão","relatorios":"Relatórios","exportacoes":"Exportações","equipamentos":"Equipamentos","servidores":"Servidores","armazenamento":"Armazenamento","notificacoes":"Notificações","configuracoes":"Configurações"};
export function GeoMapDesign({segments=[],data}:{segments?:string[];data:ProjectList}) {
 const [section,project]=segments;
 if(!section)return <RealDashboard data={data}/>;
 if(section==="preparar-processamento")return <PreparationPage/>;
 if(section==="fotografias")return <PhotoPreflightPage/>;
 if(section==="novo-projeto")return <RealWizard ready={data.ready}/>;
 if(section==="projetos")return project?<RealDetail p={data.projects.find(p=>p.id===project)} ready={data.ready}/>:<RealProjects data={data}/>;
 if(section==="relatorios"&&project==="gerador")return <GeoMapWorkspace/>;
 return <div><PageHeader title={labels[section]??"Página não encontrada"} demo={false}/><Panel><p className="text-sm text-muted-foreground">Funcionalidade ainda não conectada.</p>{section==="relatorios"&&<Link to="/relatorios/gerador" className="mt-3 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Abrir gerador PDF / HTML existente</Link>}{section==="processamento"&&<Link to="/preparar-processamento" className="mr-4 mt-3 inline-flex text-sm text-primary">Preparar processamento</Link>}{section==="processamento"&&<a href="https://github.com/mauriciobarrosaguiar/mbalabs/actions/runs/46135088554" className="mt-3 inline-flex text-sm text-primary">Consultar teste real público 003</a>}</Panel></div>;
}
