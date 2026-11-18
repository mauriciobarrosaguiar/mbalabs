export const state={session:null,operation:null,insertions:[],filters:[],reads:0};
export async function getSessionProfile(){return state.session||{user:null,profile:null}}
export function createSupabaseAdminClient(){state.reads++;return{from(){return new Query()}}}
class Query{select(){return this}eq(k,v){state.filters.push([k,v]);return this}order(){return this}limit(){return this}async maybeSingle(){return{data:state.operation,error:null}}async insert(v){state.insertions.push(v);return{error:null}}then(resolve){resolve({data:[],error:null})}}
