const contains=(actual,wanted)=>Object.entries(wanted).every(([key,value])=>value&&typeof value==='object'?contains(actual?.[key],value):actual?.[key]===value);
export const state={};
export async function getSessionProfile(){return state.session??{user:null,profile:null};}
export function createSupabaseAdminClient(){state.factories++;return {from(table){
 if(table!=='core_logs')throw Error('Unexpected table '+table);
 const q={filters:[],payload:null,select(){return q;},eq(k,v){q.filters.push([k,v]);return q;},is(k,v){return q.eq(k,v);},contains(k,v){q.filters.push([k,v,'contains']);return q;},order(){return q;},limit(){return q;},update(p){q.payload=p;return q;},
 async insert(p){state.audit.push(p);return {error:state.auditError?Error('audit failed'):null};},
 async maybeSingle(){const r=await execute();return {...r,data:r.data?.[0]??null};},then(a,b){return execute().then(a,b);}};
 async function execute(){state.queries.push(q);let rows=state.rows.filter(row=>q.filters.every(([k,v,op])=>{const raw=k.startsWith('detalhes->>')?row.detalhes?.[k.slice(11)]:row[k];const actual=k.startsWith('detalhes->>')?(raw==null?null:String(raw)):raw;return op==='contains'?contains(actual,v):actual===v;}));if(q.payload){if(state.race)return {data:[],error:null};for(const row of rows)Object.assign(row,structuredClone(q.payload));state.writes++;}return {data:structuredClone(rows),error:null};}
 return q;
}};}
