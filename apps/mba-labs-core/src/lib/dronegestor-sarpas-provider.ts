import "server-only";

// Official DECEA Eco UTM documentation, checked 2026-11-21.
// This adapter is intentionally not exposed as a flight-submission API.
// Enable only after Provider accreditation and isolated authorization tests.
const BASE = "https://api.decea.mil.br/eco-utm/v1/providers";
const routes = {
  assign: {method:"PUT", path:"/user_token/assign"},
  auth: {method:"POST", path:"/auth"},
  context: {method:"GET", path:"/flight-request/context"},
  profiles: {method:"POST", path:"/flight-request/profiles"},
  preliminary: {method:"POST", path:"/flight-request/preliminary-analysis"},
  submit: {method:"POST", path:"/flight-request"},
} as const;
type Action=keyof typeof routes;
export function sarpasProviderStatus(){
  const configured=Boolean(process.env.DRONEGESTOR_SARPAS_PROVIDER_KEY?.trim());
  return { configured, enabled:configured&&process.env.DRONEGESTOR_SARPAS_PROVIDER_ENABLED==="true", verified:false };
}
export class SarpasProviderError extends Error { constructor(readonly status:number,message:string){super(message);} }
export async function sarpasProviderCall(action:Action,input?:{token?:string;body?:Record<string,unknown>}):Promise<unknown>{
  const state=sarpasProviderStatus();
  if(!state.enabled)throw new SarpasProviderError(503,"Provider SARPAS não habilitado.");
  // Submission remains deliberately blocked until OS authorization, consent,
  // geometry validation, explicit confirmation and idempotency are homologated.
  if(action==="submit")throw new SarpasProviderError(503,"Envio oficial ainda não homologado.");
  if(!Object.prototype.hasOwnProperty.call(routes,action))throw new SarpasProviderError(400,"Ação inválida.");
  const route=routes[action],headers:Record<string,string>={apikey:process.env.DRONEGESTOR_SARPAS_PROVIDER_KEY!.trim(),"Content-Type":"application/json",Accept:"application/json"};
  if(action!=="assign"&&action!=="auth"){
    if(!input?.token)throw new SarpasProviderError(401,"Sessão delegada necessária.");
    headers.Authorization="Bearer "+input.token;
  }
  // Do not log UUIDs, secrets, JWTs or raw upstream errors.
  let response:Response;
  try {response=await fetch(BASE+route.path,{method:route.method,headers,body:route.method==="GET"?undefined:JSON.stringify(input?.body??{}),redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)});}
  catch {throw new SarpasProviderError(502,"DECEA indisponível ou sem resposta.");}
  if(!response.ok){
    const errors:Record<number,string>={401:"Credencial inválida ou sessão expirada.",403:"Vínculo não aprovado, revogado ou sem permissão.",404:"Registro não localizado.",422:"Dados rejeitados pelo DECEA. Confira os campos e anexos.",429:"Limite de requisições atingido.",502:"Motor de análise indisponível."};
    throw new SarpasProviderError(response.status,errors[response.status]||"O DECEA não concluiu a solicitação.");
  }
  if(response.status===204)return null;
  try{return await response.json();}catch{throw new SarpasProviderError(502,"Resposta oficial não reconhecida.");}
}
export function sarpasConsentBody(userToken:string){
  const value=userToken.trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new SarpasProviderError(400,"Informe o UUID criado no SARPAS.");
  return {data:{attributes:{user_token:value}}};
}
