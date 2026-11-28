// Pure notification template and expiry decision; no delivery or storage side effects.
export const RETENTION_MS=7*24*60*60*1000;
export function availability(completedAt:string,nowMs:number){
 const complete=Date.parse(completedAt);
 if(!Number.isFinite(complete)||!Number.isFinite(nowMs)||nowMs<complete)throw Error("Data inválida");
 const expires=complete+RETENTION_MS;
 return {expiresAt:new Date(expires).toISOString(),available:nowMs<expires,reminderDue:nowMs>=expires-24*60*60*1000&&nowMs<expires,deleteDue:nowMs>=expires};
}
export function notificationText(input:{projectName:string;projectId:string;completedAt:string;nowMs:number;origin:string;event:"completed"|"reminder"}){
 const origin=new URL(input.origin);
 if(origin.protocol!=="https:"||origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash)throw Error("Origem inválida");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.projectId))throw Error("Projeto inválido");
 const a=availability(input.completedAt,input.nowMs);
 if(!a.available||(input.event==="reminder"&&!a.reminderDue))return null;
 const expires=new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Araguaina"}).format(new Date(a.expiresAt));
 const url=new URL("/apps/geomap/projetos/"+input.projectId,origin).href;
 return {subject:input.event==="completed"?"GeoMap | Processamento concluído":"GeoMap | Prazo de download próximo do fim",text:["Projeto: "+input.projectName,"Disponível até "+expires+" (horário de Brasília).","Baixe e guarde seus arquivos antes da exclusão definitiva.","Acesse com sua conta: "+url].join("\n"),eventKey:input.projectId+":"+input.completedAt+":"+input.event};
}
