/** Reactivate only an existing inactive pilot link, without modifying Auth or the role. */
export function canReactivatePilot(pilot:any,user:any,permission:any,company:string|null){
 return Boolean(company&&pilot?.ativo===false&&pilot.usuarioId&&user?.id===pilot.usuarioId&&user.empresa_id===company&&user.status==="ativo"&&String(user.email||"").trim().toLowerCase()===String(pilot.email||"").trim().toLowerCase()&&String(pilot.email||"").trim()&&!["super_admin","admin_master","admin_empresa"].some(role=>role===user.tipo||role===user.tipo_global)&&permission?.id&&permission.usuario_id===user.id&&permission.empresa_id===company&&["piloto","aplicador_caar"].includes(permission.perfil_app)&&permission.status==="inativo");
}
export function explicitPilotPermissions<T extends Record<string,boolean>>(keys:T,input:unknown):T{
 const source=input&&typeof input==="object"&&!Array.isArray(input)?input as Record<string,unknown>:{};
 return Object.fromEntries(Object.keys(keys).map(k=>[k,source[k]===true])) as T;
}
