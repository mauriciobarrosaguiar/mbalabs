// A seleção auxilia o preenchimento do nome; não certifica identidade ou habilitação.
export const assistantRoles=["gestor_operacional","responsavel_tecnico","piloto","aplicador_caar","visualizador"] as const;
export function assistantNames(rows:unknown,owner:string):string[]{
 if(!Array.isArray(rows))return [];
 const names=new Set<string>();
 for(const row of rows){
  if(!row||typeof row.id!=="string"||row.id===owner||row.status!=="ativo"||typeof row.nome!=="string")continue;
  const name=row.nome.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,120);
  if(name)names.add(name);
 }
 return [...names].sort((a,b)=>a.localeCompare(b,"pt-BR"));
}
