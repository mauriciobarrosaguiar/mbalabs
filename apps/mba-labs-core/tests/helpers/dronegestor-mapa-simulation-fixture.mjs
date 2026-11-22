// Test-only in-memory adapter. No Supabase credentials or network access.
export const qa={rows:[],template:null,session:null};
export async function getSessionProfile(){return qa.session??{user:null,profile:null};}
class Query{
 constructor(){this.filters=[];this.take=Infinity;this.sort=null;this.single=false;}
 select(){return this;}eq(k,v){this.filters.push(r=>r[k]===v);return this;}
 order(k,o={}){this.sort=[k,o.ascending!==false];return this;}limit(n){this.take=n;return this;}maybeSingle(){this.single=true;return this;}
 then(resolve,reject){try{let rows=qa.rows.filter(r=>this.filters.every(f=>f(r)));if(this.sort){const[k,asc]=this.sort;rows=[...rows].sort((a,b)=>String(a[k]).localeCompare(String(b[k]))*(asc?1:-1));}rows=rows.slice(0,this.take);return Promise.resolve({data:this.single?rows[0]??null:rows,error:null}).then(resolve,reject);}catch(e){return Promise.reject(e).then(resolve,reject);}}
}
export function createSupabaseAdminClient(){return{from(table){if(table!=='core_logs')throw Error('Unexpected table');return new Query();},storage:{from(){return{async download(path){if(path!=='TEST-ONLY.xlsx'||!qa.template)return{data:null,error:Error('No fixture')};return{data:new Blob([qa.template]),error:null};}}}}};}
export function scopeDroneOsQuery(query,current){return query.eq('empresa_id',current.empresaId);}
export async function requireDroneOsAccess(admin,current,osId){if(osId!=='OS-QA')throw Error('Unknown test OS');return{data:{numero:'HOMOLOGACAO-OS-QA',pilotoResponsavelNome:'HOMOLOGAÇÃO - Pedro',status:'campo_concluido'}};}
export function droneOsErrorResponse(){return null;}
