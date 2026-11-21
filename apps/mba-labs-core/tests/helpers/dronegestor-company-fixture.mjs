export const state = {};
export async function getSessionProfile() { return state.session ?? {user:null,profile:null}; }
export function createSupabaseAdminClient() {
  state.factories++;
  return {from(table) {
    const q = {table, filters: [], select(){return q;}, eq(key,value){q.filters.push([key,value]);return q;}, in(key,value){q.filters.push([key,value]);return q;}, limit(){return q;}, order(){return q;}, contains(key,value){q.filters.push([key,value]);return q;}, update(payload){q.payload=payload;state.updates.push(q);return q;},
      async maybeSingle(){state.queries.push(q);if(table==='core_apps')return {data:{id:'app-drone'},error:null};if(table==='core_empresas')return {data:state.company,error:null};if(table==='core_empresa_apps')return {data:state.contract,error:null};if(table==='core_usuarios')return {data:state.editUser,error:null};if(table==='core_usuario_app_permissoes')return {data:state.editPermission,error:null};throw Error('Unexpected table');},
      async insert(payload){state.logs.push(...payload);return {error:state.logError??null};},
      then(resolve,reject){state.queries.push(q);return Promise.resolve({data:q.payload?null:table==='core_logs'?(state.pilotRows??[]):table==='core_usuario_app_permissoes'?state.permissions:state.users,error:q.payload&&state.updateErrorTable===table?Error('update failed'):null}).then(resolve,reject);}
    };return q;
  }};
}
export async function createOrLinkPilotAccount(admin, current, appId, input, role, requireNewPermission) {
  state.created.push({current,appId,input,role,requireNewPermission});
  return {usuarioId:'employee-1',createdAccount:true,async rollback(){state.rolledBack++;}};
}
export class PilotAccountError extends Error { constructor(message,status=400){super(message);this.status=status;} }
