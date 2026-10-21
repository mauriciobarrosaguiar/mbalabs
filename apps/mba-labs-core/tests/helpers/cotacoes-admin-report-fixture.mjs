// Banco simulado: nunca realiza chamadas de rede ou gravações reais.
export const state={authenticated:true,admin:true,tables:{},writes:[]};
export function reset(){
 state.authenticated=true;state.admin=true;state.writes=[];
 state.tables={
  cot_product_catalog:[
    {id:'11111111-1111-4111-8111-111111111111',ean:'12345678',produto:'CATALOGO A',created_at:'2026-10-01'},
    {id:'22222222-2222-4222-8222-222222222222',ean:'87654321',produto:'CATALOGO B',created_at:'2026-10-01'}
  ],
  products:[{id:'original-farmacia',ean:'12345678'}],
  tenants:[{id:'tenant-a',nome_fantasia:'FARMACIA A',cnpj:'1234'},{id:'tenant-b',nome_fantasia:'FARMACIA B',cnpj:'5678'}],
  quotations:[{id:'quote-a',tenant_id:'tenant-a',name:'COT A',module_type:'pharmacy',status:'finished',created_at:'2026-10-20T00:00:00Z',deadline_at:'2026-10-22'}],
  supplier_quote_sessions:[{id:'session-a',tenant_id:'tenant-a',quotation_id:'quote-a',supplier_id:'supplier-a',seller_name:'Vendedor A',seller_company:'Fornecedor A',status:'submitted',submitted_at:'2026-10-20'}],
  supplier_quote_responses:[{id:'response-a',tenant_id:'tenant-a',quotation_id:'quote-a',session_id:'session-a',supplier_id:'supplier-a',seller_name:'Vendedor A',seller_company:'Fornecedor A',billing_company:'Distribuidora A',status:'submitted',submitted_at:'2026-10-20'}],
  supplier_quote_response_items:[{id:'offer-a',quotation_id:'quote-a',quotation_item_id:'item-a',response_id:'response-a',supplier_id:'supplier-a',distributor_id:'dist-a',offered_product_name:'PRODUTO A',available_quantity:10,net_price:12.3}],
  quotation_items:[{id:'item-a',product_name:'PRODUTO A',requested_quantity:20}],
  distributors:[{id:'dist-a',tenant_id:'tenant-a',nome:'Distribuidora A'}]
 };
}
reset();
export class NextResponse {
 constructor(body,options={}){this.body=body;this.status=options.status??200;this.headers=options.headers??{};}
 static json(body,options={}){return new NextResponse(body,options);}
}
export class NextRequest{}
export const getCurrentAuthContext=async()=>({
 isAuthenticated:state.authenticated,isActive:true,isSuperAdmin:state.admin,
 user:{id:'admin'},tenantAccess:null,profile:{}
});
export const isTenantSuspended=()=>false;
export function createSupabaseAdminClient(){
 return {from(table){
  let filters=[],range=null,mode='select';
  const q={
   select(){return q;},eq(k,v){filters.push(x=>x[k]===v);return q;},
   gte(k,v){filters.push(x=>String(x[k]??'')>=v);return q;},
   in(k,ids){filters.push(x=>ids.includes(x[k]));return q;},
   or(){return q;},order(){return q;},
   range(a,b){range=[a,b];return q;},delete(){mode='delete';return q;},
   then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}
  };
  function execute(){
   const all=state.tables[table]??[];
   const selected=all.filter(x=>filters.every(fn=>fn(x)));
   if(mode==='delete'){
    state.tables[table]=all.filter(x=>!selected.includes(x));
    state.writes.push(table);
   }
   return {data:range?selected.slice(range[0],range[1]+1):selected,error:null,count:selected.length};
  }
  return q;
 }};
}
