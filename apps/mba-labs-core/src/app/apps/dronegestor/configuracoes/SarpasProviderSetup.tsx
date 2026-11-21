"use client";
import { useAgroData,AgroDocCard,AgroDocStatus } from "../AgroDocUi";
import { ShieldCheck } from "lucide-react";
type Status={configured:boolean;enabled:boolean;verified:boolean;submissionEnabled:boolean};
const links=[
 ["Portal SARPAS","https://sarpas.decea.mil.br/"],
 ["Documentação Eco UTM","https://ajuda.decea.mil.br/assuntos/sarpas-api"],
 ["Credenciar empresa","https://ajuda.decea.mil.br/artigos/como-solicitar-e-credenciar-minha-empresa-para-obter-a-api-do-sarpas"],
 ["Matrícula DECEA","https://privacidade.decea.mil.br/contas"],
 ["Autorizar sistema externo","https://ajuda.decea.mil.br/artigos/como-o-operador-autoriza-um-sistema-externo-a-acessar-seu-sarpas"],
] as const;
export function SarpasProviderSetup(){
 const status=useAgroData<Status>("/api/dronegestor/sarpas/provider/status");
 return <AgroDocCard title="SARPAS — integração oficial Eco UTM" icon={ShieldCheck}>
  <div className="grid gap-3 text-sm leading-6">
   <AgroDocStatus tone="warn">{status.error?"Não foi possível consultar":!status.data?"Consultando configuração…":status.data.configured?"Chave configurada — integração não homologada":"Credenciamento pendente"}</AgroDocStatus>
   <p>A integração depende de credenciamento como Provider no DECEA. Nenhuma autorização é emitida pelo DroneGestor nesta etapa; continue registrando a autorização obtida no portal oficial na OS.</p>
   <ol className="ml-5 list-decimal space-y-1"><li>Obtenha a Matrícula DECEA da empresa.</li><li>Solicite credenciamento informando aplicação, domínio, responsável técnico e finalidade.</li><li>Configure a chave do Provider na Vercel pelo administrador da plataforma. Nunca informe senha gov.br.</li><li>Após homologação, cada operador aprovará o vínculo na tela Tokens do SARPAS.</li></ol>
   <div className="flex flex-wrap gap-2">{links.map(([label,url])=><a key={url} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-900" href={url} target="_blank" rel="noreferrer">{label}</a>)}</div>
   <button type="button" className="agro-button" onClick={status.refresh}>Atualizar situação da configuração</button>
  </div>
 </AgroDocCard>;
}
