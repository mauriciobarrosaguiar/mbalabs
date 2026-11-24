export type PilotOrder={
 entityId:string;
 data?:{numero?:string;status?:string;pilotoResponsavelId?:string;clienteNome?:string;fazendaNome?:string;talhaoNome?:string;areaHa?:number;dataPrevista?:string;municipio?:string;uf?:string;missaoPlanejada?:unknown;};
};
export const pilotActiveStatuses=["aberta","preparacao","em_preparacao","em_execucao","suspensa"] as const;
export function ownPilotOrders(orders:PilotOrder[],userId:string){
 if(!userId)return [];
 const seen=new Set<string>();
 return orders.filter(o=>{if(!o.entityId||seen.has(o.entityId)||o.data?.pilotoResponsavelId!==userId)return false;seen.add(o.entityId);return true;});
}
export function pilotOrderState(status:unknown){
 switch(status){
 case "aberta":return {label:"Aguardando preparação",tone:"new",active:true,priority:3};
 case "preparacao":case "em_preparacao":return {label:"Em preparação",tone:"new",active:true,priority:2};
 case "em_execucao":return {label:"Em execução",tone:"green",active:true,priority:0};
 case "suspensa":return {label:"Suspensa",tone:"amber",active:true,priority:1};
 case "campo_concluido":return {label:"Campo concluído",tone:"neutral",active:false,priority:4};
 case "concluida":return {label:"Encerrada",tone:"neutral",active:false,priority:5};
 case "cancelada":return {label:"Cancelada",tone:"neutral",active:false,priority:6};
 default:return {label:"Situação não informada",tone:"neutral",active:false,priority:7};
 }
}
export function sortPilotOrders(orders:PilotOrder[]){
 return [...orders].sort((a,b)=>pilotOrderState(a.data?.status).priority-pilotOrderState(b.data?.status).priority||String(a.data?.dataPrevista||"9999").localeCompare(String(b.data?.dataPrevista||"9999"))||a.entityId.localeCompare(b.entityId));
}
// Consultar a OS pela tela que já protege seleção, sincronização e preparação.
// Não iniciar voo, alterar estado ou gerar localStorage nesta área.
export function pilotOrderHref(osId:string){return "/apps/dronegestor/gestao?osId="+encodeURIComponent(osId);}

/** Only inspect pending records of the authenticated owner; never modify the queue. */
export function pilotPendingSyncCount(storage:Pick<Storage,"getItem"|"key"|"length">,owner:string):number|null{
 try{
  if(!owner||storage.getItem("dronegestor:deviceOwner:v1")!==owner)return null;
  const queue=JSON.parse(storage.getItem("dronegestor:finalizationQueue:v4")||"[]");
  if(!Array.isArray(queue)||queue.some(x=>!x||typeof x.operationId!=="string"||!x.operationId))return null;
  const ids=new Set<string>(queue.map(x=>x.operationId));
  let count=ids.size;
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith("dronegestor:partialPayload:v1:")&&storage.getItem(key))count++;}
  return count;
 }catch{return null;}
}
