"use client";
import {PageHeader,Panel,Field,StatusBadge} from "../components/geo/ui";
import {Button} from "../components/ui/button";
import {Link} from "../lib/navigation";
import {products} from "../../processing-plan";
import type {SavedPlan} from "../../plan-store";
import type {ProjectList} from "../../project-model";
export function ProcessingCenter({data,saved}:{data:ProjectList;saved:{ready:boolean;plans:SavedPlan[]}}){
 return <div className="space-y-4"><PageHeader title="Central de processamento" subtitle="Planos e tarefas de levantamentos" demo={false} actions={<Button asChild><Link to="/novo-projeto">Novo projeto</Link></Button>}/>
 <Panel title="Situação do motor"><p className="text-sm text-muted-foreground">Motor validado com amostra pública. Fila privada, upload e servidor definitivo ainda não habilitados.</p><a className="mt-2 inline-flex text-sm text-primary" href="https://github.com/mauriciobarrosaguiar/mbalabs/actions/runs/46135088554">Consultar teste público 003</a></Panel>
 <Panel title="Planos salvos"><p className="mb-3 text-xs text-muted-foreground">Apenas configurações e contagens declaradas; nenhum arquivo foi enviado e nenhum plano foi colocado na fila.</p>{!saved.ready?<p className="text-sm text-warning">Banco de planos ainda não habilitado.</p>:saved.plans.length===0?<p className="text-sm text-muted-foreground">Nenhum plano salvo.</p>:<div className="grid gap-3 md:grid-cols-2">{saved.plans.map(({project_id,plan})=><div key={project_id} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><Link to="/projetos/$id" params={{id:project_id}} className="font-semibold text-primary">{data.projects.find(p=>p.id===project_id)?.name??"Projeto"}</Link><StatusBadge status="Rascunho"/></div><Field label="Fotografias declaradas" value={plan.photos.count}/><Field label="Produtos" value={plan.requiredProducts.map(id=>products.find(p=>p.id===id)?.name).join(", ")}/><Field label="Prazo após conclusão" value="7 dias"/><Field label="Upload" value="Não realizado"/></div>)}</div>}</Panel>
 <Button variant="outline" asChild><Link to="/preparar-processamento">Preparar plano avulso</Link></Button></div>
}
