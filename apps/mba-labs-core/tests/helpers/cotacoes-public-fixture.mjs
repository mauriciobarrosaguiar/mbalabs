// In-memory Supabase boundary. Never connects to a service.
export const state={tables:{},writes:[],insertError:null};
export const hasSupabaseConfig=()=>true;
export const hasSupabaseAdminConfig=()=>true;
export function reset() {
 state.writes=[];state.insertError=null;
 state.tables={
 supplier_quote_sessions:[{id:'session-A',tenant_id:'tenant-A',quotation_id:'quote-A',supplier_id:'supplier-A',public_token:'test-link-A',status:'opened',expires_at:'2099-01-01T00:00:00Z'}],
 quotations:[{id:'quote-A',tenant_id:'tenant-A',module_type:'pharmacy',name:'TESTE',status:'open',allow_partial_supply:true}],
 quotation_items:[{id:'item-A',tenant_id:'tenant-A',quotation_id:'quote-A',module_type:'pharmacy',item_number:1,product_name:'TESTE',requested_quantity:100,allow_partial_supply:true}],
 tenants:[{id:'tenant-A',nome_fantasia:'FICTICIA',status:'teste'}],pharmacies:[],supplier_quote_responses:[],supplier_quote_response_items:[]};
}
export function createSupabaseAdminClient(){return {from(table){return new Query(table);}};}
class Query {
 constructor(table){this.table=table;this.filters=[];this.operation='select';}
 select(){return this;}eq(key,value){this.filters.push([key,value]);return this;}
 order(){return this;}limit(){return this;}
 insert(payload){this.operation='insert';this.payload=payload;return this;}
 update(payload){this.operation='update';this.payload=payload;return this;}
 delete(){this.operation='delete';return this;}
 matches(row){return this.filters.every(([k,v])=>row[k]===v);}
 async execute(single=false){
  let rows=state.tables[this.table]??[];
  if(this.operation!=='select')state.writes.push({table:this.table,operation:this.operation,payload:this.payload,filters:this.filters});
  if(this.operation==='insert'){
   if(state.insertError)return {data:null,error:state.insertError};
   const incoming=(Array.isArray(this.payload)?this.payload:[this.payload]).map((r,i)=>({id:`test-${this.table}-${rows.length+i}`,created_at:'2026-10-17T00:00:00Z',...r}));
   rows.push(...incoming);state.tables[this.table]=rows;
   return {data:single?incoming[0]:incoming,error:null};
  }
  const selected=rows.filter(r=>this.matches(r));
  if(this.operation==='update')selected.forEach(r=>Object.assign(r,this.payload));
  if(this.operation==='delete')state.tables[this.table]=rows.filter(r=>!this.matches(r));
  return {data:single?(selected[0]??null):selected,error:null};
 }
 maybeSingle(){return this.execute(true);}single(){return this.execute(true);}
 then(resolve,reject){return this.execute().then(resolve,reject);}
}
