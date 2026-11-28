"use client";
import {useState} from "react";
import {Database,CheckCircle2,AlertCircle} from "lucide-react";
import {PageHeader,Panel,Field} from "../components/geo/ui";
import {Button} from "../components/ui/button";
import {testGeoMapStorage} from "../../storage-actions";
import type {Diagnostic} from "../../r2-diagnostic";
export function StoragePage(){
 const [result,setResult]=useState<Diagnostic|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function run(){if(busy)return;setBusy(true);setError("");setResult(null);try{setResult(await testGeoMapStorage());}catch{setError("Falha ao executar diagnóstico. Nenhum resultado confirmado.");}finally{setBusy(false);}}
 return <div className="space-y-4"><PageHeader title="Armazenamento" subtitle="Diagnóstico da integração privada R2" demo={false} icon={Database}/>
 <Panel title="Cloudflare R2"><Field label="Bucket" value="mba-geomap"/><Field label="Classe" value="Standard"/><Field label="Ambiente" value="Homologação (Preview)"/><p className="mt-2 text-sm text-muted-foreground">Somente dados públicos ou sintéticos. Upload de fotografias privadas permanece bloqueado. O diagnóstico grava, lê e exclui um pequeno texto sintético, com até quatro operações S3 por tentativa.</p><Button className="mt-4" disabled={busy} onClick={()=>void run()}>{busy?"Testando conexão…":"Testar conexão R2"}</Button>{error&&<p role="alert" className="mt-3 text-sm text-warning">{error}</p>}</Panel>
 {result&&<Panel title="Resultado do diagnóstico"><div role="status" className="space-y-2">{([["Configuração",result.configured],["Gravação",result.write],["Leitura e conteúdo",result.read],["Exclusão",result.remove],["Ausência do objeto após exclusão",result.absent]] as const).map(([label,ok])=><div key={label} className="flex items-center gap-2 text-sm">{ok?<CheckCircle2 className="size-4 text-success"/>:<AlertCircle className="size-4 text-warning"/>}{label}: {ok?"Confirmado":"Não confirmado"}</div>)}<p className="mt-3 text-sm">{result.message}</p></div></Panel>}
 <Panel title="Retenção e limites"><Field label="Prazo após disponibilização" value="168 horas"/><Field label="Limite preventivo proposto" value="8 GB — ainda não aplicado"/><Field label="Exclusão automática" value="Ainda não integrada"/><Field label="Uso real do bucket" value="Consultar Cloudflare"/></Panel></div>;
}
