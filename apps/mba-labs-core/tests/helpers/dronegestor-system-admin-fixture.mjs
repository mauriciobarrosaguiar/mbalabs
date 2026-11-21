export const state={};
export async function getSessionProfile(){return state.session??{user:null,profile:null};}
export class PilotAccountError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export async function createOrLinkPilotAccount(admin,current,appId,input,role,requireNewPermission){state.accounts.push({current,appId,input,role,requireNewPermission});return{usuarioId:'employee-new',createdAccount:true,async rollback(){state.rollback++;}};}
export function createSupabaseAdminClient(){state.factories++;return{from(table){
  const q={table,operation:'select',filters:[],payload:null,select(){return q;},order(){return q;},limit(){return q;},eq(k,v){q.filters.push([k,v]);return q;},in(k,v){q.filters.push([k,v]);return q;},
    insert(payload){q.operation='insert';q.payload=payload;return q;},update(payload){q.operation='update';q.payload=payload;return q;},delete(){q.operation='delete';return q;},upsert(payload){q.operation='upsert';q.payload=payload;return q;},
    rows(){const rows=state.rows[table]??[];return rows.filter(row=>q.filters.every(([key,value])=>Array.isArray(value)?value.includes(row[key]):row[key]===value));},
    async result(single=false){state.events.push(q);const error=state.fail?.table===table&&state.fail?.operation===q.operation?new Error('falha simulada'):null;if(q.operation==='select')return{data:single?q.rows()[0]??null:q.rows(),error};return{data:single?{id:state.companyId}:null,error};},
    maybeSingle(){return q.result(true);},single(){return q.result(true);},then(resolve,reject){return q.result(false).then(resolve,reject);}
  };return q;
}};}
