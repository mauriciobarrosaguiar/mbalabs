import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const FINALIZED_ACTION = "operacao_finalizada";
const PROFILE_ACTION = "perfil_operacional_v1";
const TEMPLATE_ACTION = "modelo_relatorio_mapa_2026_v1";
const DOC_BUCKET = "dronegestor-documentos";

type Context = { userId:string; userName:string; userType:string; empresaId:string|null; companyHistory:boolean };
type ReportRow = { municipioUf:string; arp:string; area:number; horas:number; atividade:string; produto:string; volume:number; dose:string };

function normalize(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replaceAll(" ","_");}
function normalizedWords(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();}
function text(value:unknown){return typeof value === "string" ? value.trim() : "";}
function num(value:unknown){const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
function obj(value:unknown):Record<string,any>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,any>:{};}
function monthRange(month:string){
  const match=/^(\d{4})-(\d{2})$/.exec(month);
  if(!match)throw new Error("Competência inválida.");
  const year=Number(match[1]),m=Number(match[2]);
  if(m<1||m>12)throw new Error("Competência inválida.");
  return {start:new Date(Date.UTC(year,m-1,1)).toISOString(),end:new Date(Date.UTC(year,m,1)).toISOString()};
}
function durationHours(start:unknown,end:unknown){const a=Date.parse(text(start)),b=Date.parse(text(end));return Number.isFinite(a)&&Number.isFinite(b)&&b>=a?(b-a)/3600000:0;}

async function context():Promise<{current:Context|null;response:NextResponse|null}>{
  const session=await getSessionProfile();
  if(!session.user||!session.profile)return{current:null,response:NextResponse.json({ok:false,error:"Autenticação necessária."},{status:401})};
  const type=normalize(session.profile.tipo||"");
  const master=["super_admin","admin_master"].includes(type);
  const allowed=(session.appsLiberados??[]).some(app=>app.slug==="dronegestor"&&app.canAccess);
  if(!master&&!allowed)return{current:null,response:NextResponse.json({ok:false,error:"Acesso ao DroneGestor não liberado."},{status:403})};
  return{current:{userId:session.profile.id,userName:session.profile.nome||"Piloto",userType:session.profile.tipo,empresaId:session.profile.empresa_id,companyHistory:canManageDroneGestor({tipo:session.profile.tipo,isAdminMaster:master,permissoes:session.permissoes})},response:null};
}
function scope(query:any,current:Context){return current.companyHistory&&current.empresaId?query.eq("empresa_id",current.empresaId):query.eq("usuario_id",current.userId);}
function ownerScope(query:any,current:Context){return current.empresaId?query.eq("empresa_id",current.empresaId):query.eq("usuario_id",current.userId);}

async function profile(admin:any,current:Context){
  let query=admin.from("core_logs").select("detalhes").eq("app_slug","dronegestor").eq("acao",PROFILE_ACTION).order("created_at",{ascending:false}).limit(1);
  query=ownerScope(query,current);
  const {data}=await query.maybeSingle();
  return obj(data?.detalhes?.profile);
}
async function officialTemplate(admin:any,current:Context){
  let query=admin.from("core_logs").select("detalhes,created_at").eq("app_slug","dronegestor").eq("acao",TEMPLATE_ACTION).order("created_at",{ascending:false}).limit(1);
  query=ownerScope(query,current);
  const {data,error}=await query.maybeSingle();
  if(error||!data?.detalhes?.storagePath)return null;
  const download=await admin.storage.from(DOC_BUCKET).download(String(data.detalhes.storagePath));
  if(download.error||!download.data)return null;
  return {bytes:Buffer.from(await download.data.arrayBuffer()),fileName:text(data.detalhes.fileName)||"modelo-oficial.xlsx",version:text(data.detalhes.version)||"01-01-2026"};
}

function cellString(value:unknown):string{
  if(typeof value==="string")return value;
  if(typeof value==="number")return String(value);
  if(value&&typeof value==="object"){
    const v=value as any;
    if(typeof v.text==="string")return v.text;
    if(Array.isArray(v.richText))return v.richText.map((item:any)=>item?.text||"").join("");
    if(typeof v.result==="string"||typeof v.result==="number")return String(v.result);
  }
  return "";
}
function headerMap(ws:ExcelJS.Worksheet){
  let best:{row:number;map:Record<string,number>;score:number}|null=null;
  const maxRows=Math.min(Math.max(ws.rowCount,40),100),maxCols=Math.min(Math.max(ws.columnCount,12),60);
  for(let row=1;row<=maxRows;row++){
    const map:Record<string,number>={};
    for(let col=1;col<=maxCols;col++){
      const t=normalizedWords(cellString(ws.getCell(row,col).value));
      if(!t)continue;
      if((t.includes("municipio")&&t.includes("uf"))||t==="municipio uf")map.municipioUf=col;
      else if(t.includes("aeronave")||t.includes("identificacao da arp")||t==="arp")map.arp=col;
      else if(t.includes("area")&&t.includes("ha"))map.area=col;
      else if(t.includes("hora")&&t.includes("exec"))map.horas=col;
      else if(t.includes("tipo")&&t.includes("atividade"))map.atividade=col;
      else if(t.includes("marca")&&t.includes("comercial"))map.produto=col;
      else if(t.includes("volume")&&t.includes("aplic"))map.volume=col;
      else if(t.includes("dosagem")||t.includes("dose aplicada"))map.dose=col;
    }
    const score=Object.keys(map).length;
    if(!best||score>best.score)best={row,map,score};
  }
  return best&&best.score>=6?best:null;
}
function setAdjacent(ws:ExcelJS.Worksheet,labels:string[],value:string){
  if(!value)return;
  const maxRows=Math.min(Math.max(ws.rowCount,40),100),maxCols=Math.min(Math.max(ws.columnCount,12),50);
  for(let row=1;row<=maxRows;row++)for(let col=1;col<=maxCols;col++){
    const t=normalizedWords(cellString(ws.getCell(row,col).value));
    if(labels.some(label=>t.includes(label))){const target=ws.getCell(row,col+1);if(!cellString(target.value).trim())target.value=value;return;}
  }
}
type OfficialRow = {
 uf:string;municipio:string;tipoAeronave:string;prefixo:string;horasAplicacao:number;
 cultura:string;tipoServico:string;classeAgro:string;classeBio:string;area:number;
 agrotoxico:string;bioinsumo:string;outros:string;semeadura:string;
 horasIncendio:number|null;volumeLHa:number|null;dosagem:number;unidade:string;
};
const MONTH_SHEETS=["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"] as const;
const OFFICIAL_COLUMNS=["UF","MUNICÍPIO","TIPO AERONAVE","PREFIXO AERONAVE","HORAS APLICAÇÃO","CULTURA","TIPO DE SERVIÇO",
 "CLASSE AGROTÓXICOS","CLASSE BIOINSUMO","ÁREA (ha)","AGROTÓXICO","BIOINSUMO","FERTILIZANTES/ADJUVANTES/OUTROS",
 "SEMEADURA","COMBATE A INCÊNDIO (HORAS)","VOLUME (l/ha)","DOSAGEM","Unidade"];
function reportMonth(date:string){
 const t=Date.parse(date);if(!Number.isFinite(t))return "";
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Araguaina",year:"numeric",month:"2-digit"}).formatToParts(new Date(t));
 return `${parts.find(p=>p.type==="year")?.value}-${parts.find(p=>p.type==="month")?.value}`;
}
function hhmm(value:string){
 const m=/^(\d{1,3}):([0-5]\d)$/.exec(value);
 if(!m||Number(m[1])===0&&Number(m[2])===0)throw new Error("Informe o tempo efetivo HH:MM para cada operação (sem intervalos).");
 return Number(m[1])*100+Number(m[2]);
}
function populateOfficialTemplate(workbook:ExcelJS.Workbook,rows:OfficialRow[],p:Record<string,any>,month:string){
 const match=/^2026-(0[1-9]|1[0-2])$/.exec(month);
 if(!match)throw new Error("Este modelo é exclusivo de 2026. Para outro ano, cadastre o modelo atualizado do MAPA.");
 const jan=workbook.getWorksheet("JAN"),total=workbook.getWorksheet("TOTAL");
 const ws=workbook.getWorksheet(MONTH_SHEETS[Number(match[1])-1]);
 if(!jan||!total||!ws||!workbook.getWorksheet("UF_MUN")||!workbook.getWorksheet("Outras Listas")||!workbook.getWorksheet("Plan2"))
   throw new Error("O arquivo carregado não corresponde à estrutura oficial de 2026.");
 for(let col=1;col<=18;col++){
   if(normalizedWords(cellString(ws.getCell(5,col).value))!==normalizedWords(OFFICIAL_COLUMNS[col-1]))
     throw new Error(`Modelo MAPA incompatível: cabeçalho ${ws.name}!${col}5 divergente.`);
 }
 if(rows.length>995)throw new Error("Mais de 995 lançamentos no mês. Não é possível preencher a planilha sem alterar o modelo.");
 // Nunca misturar dados preexistentes ou de outra empresa. O arquivo base deve estar vazio.
 for(const sheetName of MONTH_SHEETS){
   const sheet=workbook.getWorksheet(sheetName)!;
   for(let row=6;row<=1000;row++)for(let col=1;col<=18;col++){
     const v=sheet.getCell(row,col).value;
     if(v!==null&&v!==undefined&&v!=="")
       throw new Error(`O modelo contém um lançamento prévio em ${sheetName} linha ${row}. Cadastre um modelo limpo.`);
   }
 }
 // Dados de exemplo no arquivo não podem ser propagados: substituí-los sempre.
 jan.getCell("C1").value=text(p.operadorNome);
 jan.getCell("I1").value=text(p.email);
 jan.getCell("C3").value=text(p.registroMapa);
 jan.getCell("I3").value=text(p.telefone);
 if(!text(p.operadorNome)||!text(p.registroMapa))throw new Error("Cadastre nome do operador e registro MAPA no Perfil operacional antes de gerar a planilha.");
 ws.getCell("A4").value=rows.length?"OPERAÇÕES NO MÊS":"NENHUMA ATIVIDADE REALIZADA";
 const entries=(row:OfficialRow)=>[
   row.uf,row.municipio,row.tipoAeronave,row.prefixo,row.horasAplicacao,row.cultura,row.tipoServico,
   row.classeAgro||null,row.classeBio||null,row.area,row.agrotoxico||null,row.bioinsumo||null,row.outros||null,
   row.semeadura||null,row.horasIncendio,row.volumeLHa,row.dosagem,row.unidade
 ];
 rows.forEach((item,i)=>{
   const values=entries(item);const target=ws.getRow(i+6);
   for(let col=1;col<=18;col++)target.getCell(col).value=values[col-1];
 });
 workbook.calcProperties.fullCalcOnLoad=true;
 return workbook;
}

function buildFallback(rows:ReportRow[],p:Record<string,any>,month:string){
  const workbook=new ExcelJS.Workbook();
  workbook.creator="DroneGestor — MBA Labs";
  workbook.created=new Date();
  const ws=workbook.addWorksheet("RELATORIO MENSAL",{pageSetup:{orientation:"landscape",paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:0.25,right:0.25,top:0.35,bottom:0.35,header:0.15,footer:0.15}}});
  ws.mergeCells("A1:H1");
  ws.getCell("A1").value="RELATÓRIO MENSAL DE ATIVIDADES — ARP (DRONE)";
  ws.getCell("A1").font={bold:true,size:16};
  ws.getCell("A1").alignment={horizontal:"center"};
  ws.mergeCells("A2:H2");
  ws.getCell("A2").value=`Competência: ${month} | Campos da Portaria MAPA nº 298/2021, art. 11`;
  ws.getCell("A2").alignment={horizontal:"center"};
  const info=[["Operador aeroagrícola",text(p.operadorNome)],["CPF/CNPJ",text(p.cpfCnpj)],["Registro MAPA / SIPEAGRO",text(p.registroMapa)],["Processo SEI",text(p.processoSei)],["Responsável técnico",text(p.rtNome)],["Conselho / registro",[text(p.rtConselho),text(p.rtRegistro)].filter(Boolean).join(" ")]];
  let row=4;
  for(let i=0;i<info.length;i+=2){
    const a=info[i],b=info[i+1];
    ws.getCell(row,1).value=a[0];ws.getCell(row,2).value=a[1]||"";ws.mergeCells(row,2,row,4);
    if(b){ws.getCell(row,5).value=b[0];ws.getCell(row,6).value=b[1]||"";ws.mergeCells(row,6,row,8);}
    ws.getCell(row,1).font={bold:true};ws.getCell(row,5).font={bold:true};row++;
  }
  row++;
  const headers=["Município/UF","ARP / identificação ANAC","Área aplicada (ha)","Horas de execução (h)","Tipo de atividade","Marca comercial","Volume aplicado (L)","Dosagem aplicada"];
  headers.forEach((header,index)=>{const cell=ws.getCell(row,index+1);cell.value=header;cell.font={bold:true,color:{argb:"FFFFFFFF"},size:9};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF07553B"}};cell.alignment={wrapText:true,horizontal:"center"};cell.border={top:{style:"thin"},left:{style:"thin"},bottom:{style:"thin"},right:{style:"thin"}};});
  const headerRow=row;row++;
  if(!rows.length){ws.mergeCells(row,1,row,8);ws.getCell(row,1).value="NENHUMA ATIVIDADE REALIZADA";ws.getCell(row,1).font={bold:true};ws.getCell(row,1).alignment={horizontal:"center"};row++;}
  else for(const item of rows){[item.municipioUf,item.arp,item.area||"",item.horas||"",item.atividade,item.produto,item.volume||"",item.dose].forEach((value,index)=>{const cell=ws.getCell(row,index+1);cell.value=value;cell.alignment={wrapText:true};cell.border={top:{style:"thin"},left:{style:"thin"},bottom:{style:"thin"},right:{style:"thin"}};});row++;}
  ws.columns=[{width:18},{width:28},{width:15},{width:18},{width:18},{width:28},{width:18},{width:20}];
  ws.autoFilter={from:{row:headerRow,column:1},to:{row:headerRow,column:8}};
  row+=2;
  ws.mergeCells(row,1,row,8);
  ws.getCell(row,1).value="ATENÇÃO: modelo gerado pelo DroneGestor. Para remessa de 2026, cadastre o arquivo oficial vigente na tela do relatório para que o DroneGestor preencha o próprio modelo.";
  ws.getCell(row,1).alignment={wrapText:true};
  ws.getCell(row,1).font={color:{argb:"FF92400E"},size:9};
  return workbook;
}

export async function GET(request:NextRequest){
 try{
   const access=await context();if(access.response)return access.response;
   const current=access.current!,admin=createSupabaseAdminClient() as any;
   if(!current.companyHistory)return NextResponse.json({error:"Somente gestor/RT autorizado pode exportar a planilha MAPA."},{status:403});
   const month=text(request.nextUrl.searchParams.get("month"))||new Date().toISOString().slice(0,7);
   monthRange(month);
   if(!/^2026-(0[1-9]|1[0-2])$/.test(month))
     return NextResponse.json({error:"Para esta exportação utilize o modelo MAPA 2026 e selecione um mês de 2026."},{status:422});
   let events=admin.from("core_logs").select("id,detalhes,created_at").eq("app_slug","dronegestor")
     .eq("acao",FINALIZED_ACTION).order("created_at",{ascending:true}).limit(3000);
   let approvals=admin.from("core_logs").select("detalhes,created_at").eq("app_slug","dronegestor")
     .eq("acao","operacao_revisao_mapa_2026_v1").order("created_at",{ascending:true}).limit(5000);
   const [{data,error},revisions,p,template]=await Promise.all([
     scope(events,current),scope(approvals,current),profile(admin,current),officialTemplate(admin,current)]);
   if(error)throw error;if(revisions.error)throw revisions.error;
   if(!template)return NextResponse.json({error:"Cadastre uma única vez o XLSX oficial de 2026 em Relatório mensal MAPA."},{status:422});
   if((data??[]).length===3000)return NextResponse.json({error:"Histórico excedeu o limite seguro de extração. Solicite paginação."},{status:422});
   if((revisions.data??[]).length===5000)return NextResponse.json({error:"Revisões excederam o limite seguro de extração. Solicite paginação."},{status:422});
   const reviewById=new Map<string,Record<string,any>>();
   for(const event of revisions.data??[]){
     const r=obj(event.detalhes),id=text(r.operationEventId);
     if(id)reviewById.set(id,r);
   }
   const selected=(data??[]).filter((event:any)=>{
     const summary=obj(event.detalhes?.summary);
     const timestamp=text(summary.finalizadaEm)||text(event.detalhes?.finalizedAt)||text(event.created_at);
     return reportMonth(timestamp)===month;
   });
   const pending=selected.filter((event:any)=>reviewById.get(String(event.id))?.status!=="aprovado");
   if(pending.length)return NextResponse.json({error:`Existem ${pending.length} operações sem aprovação válida. Revise-as na Central de conferência antes de exportar.`,pending:pending.length},{status:422});
   const rows:OfficialRow[]=[];
   for(const event of selected){
     const s=obj(event.detalhes?.summary),review=reviewById.get(String(event.id))??{};
     const products=Array.isArray(s.produtos)?s.produtos:[];
     if(products.length!==1)throw new Error("Operação com vários produtos ou sem produto: conferência manual obrigatória antes de exportar.");
     const product=obj(products[0]),category=text(review.category),service=text(review.tipoServico).toUpperCase();
     if(!["agrotoxico","bioinsumo","outros","semeadura"].includes(category))throw new Error("Categoria de produto ausente na revisão.");
     if(!["APLICAÇÃO DE AGROTÓXICO","APLICAÇÃO DE BIOINSUMO","APLICAÇÃO DE FERTILIZANTE","APLICAÇÃO ADJUVANTE","SEMEADURA","OUTROS"].includes(service))
       throw new Error("Tipo de serviço fora das opções suportadas do modelo MAPA.");
     const area=num(s.areaConcluidaHa??s.areaHa),dose=num(product.dose),volume=num(s.volumeLHa),unit=text(product.unidade);
     const duration=hhmm(text(review.horasAplicacao));
     if(area<=0||dose<=0||!text(s.municipio)||!text(s.uf)||!text(s.registroAnac)||!unit)
       throw new Error(`Dados incompletos na OS ${text(s.ordemServicoNumero)||event.id}. Corrija antes de exportar.`);
     const expected=category==="agrotoxico"?"APLICAÇÃO DE AGROTÓXICO":category==="bioinsumo"?"APLICAÇÃO DE BIOINSUMO":category==="semeadura"?"SEMEADURA":null;
     if(expected&&service!==expected)throw new Error(`Tipo de serviço incompatível com a categoria na OS ${text(s.ordemServicoNumero)||event.id}.`);
     rows.push({
       uf:text(s.uf).toUpperCase(),municipio:text(s.municipio).toUpperCase(),
       tipoAeronave:text(review.tipoAeronave)||"Drone",prefixo:text(s.registroAnac),horasAplicacao:duration,
       cultura:text(s.cultura).toUpperCase(),tipoServico:service,
       classeAgro:category==="agrotoxico"?text(review.classe):"",
       classeBio:category==="bioinsumo"?text(review.classe):"",
       area,agrotoxico:category==="agrotoxico"?text(product.nome):"",
       bioinsumo:category==="bioinsumo"?text(product.nome):"",
       outros:category==="outros"?text(product.nome):"",
       semeadura:category==="semeadura"?text(product.nome):"",
       horasIncendio:null,volumeLHa:category==="semeadura"?null:volume||null,
       dosagem:dose,unidade:unit
     });
   }
   const book=new ExcelJS.Workbook();
   await book.xlsx.load(template.bytes as any);
   populateOfficialTemplate(book,rows,p,month);
   const buffer=await book.xlsx.writeBuffer();
   return new NextResponse(Buffer.from(buffer),{headers:{
      "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":`attachment; filename="relatorio-MAPA-oficial-2026-${month}.xlsx"`,
      "Cache-Control":"private, no-store","X-DroneGestor-Modelo":"oficial-2026-validado"
   }});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Não foi possível exportar a planilha oficial."},{status:422})}
}
