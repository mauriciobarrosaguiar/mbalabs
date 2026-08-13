import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSessionProfile } from "@/lib/core-data";
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
  return{current:{userId:session.profile.id,userName:session.profile.nome||"Piloto",userType:session.profile.tipo,empresaId:session.profile.empresa_id,companyHistory:master||["admin_empresa","responsavel_tecnico","rt"].includes(type)},response:null};
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
function populateOfficialTemplate(workbook:ExcelJS.Workbook,rows:ReportRow[],p:Record<string,any>,month:string){
  let found:{ws:ExcelJS.Worksheet;row:number;map:Record<string,number>}|null=null;
  for(const ws of workbook.worksheets){const h=headerMap(ws);if(h){found={ws,row:h.row,map:h.map};break;}}
  if(!found)return false;
  const {ws,row:headerRow,map}=found;
  setAdjacent(ws,["operador aeroagricola","razao social","operador"],text(p.operadorNome));
  setAdjacent(ws,["registro mapa","sipeagro"],text(p.registroMapa));
  setAdjacent(ws,["processo sei"],text(p.processoSei));
  setAdjacent(ws,["responsavel tecnico"],text(p.rtNome));
  setAdjacent(ws,["competencia","mes referencia"],month);
  const keys:[keyof ReportRow,string][]=[["municipioUf","municipioUf"],["arp","arp"],["area","area"],["horas","horas"],["atividade","atividade"],["produto","produto"],["volume","volume"],["dose","dose"]];
  const templateRow=ws.getRow(headerRow+1);
  const dataRows=rows.length?rows:[{municipioUf:"NENHUMA ATIVIDADE REALIZADA",arp:"",area:0,horas:0,atividade:"",produto:"",volume:0,dose:""}];
  dataRows.forEach((item,index)=>{
    const row=headerRow+1+index;
    for(const [key,mapKey] of keys){
      const col=map[mapKey];
      if(!col)continue;
      const cell=ws.getCell(row,col);
      if(row!==headerRow+1&&templateRow.getCell(col).style)cell.style={...templateRow.getCell(col).style};
      const value=item[key];
      cell.value=typeof value==="number"?(value||null):value;
      if(typeof value==="number")cell.numFmt="0.00";
    }
  });
  ws.pageSetup.orientation="landscape";
  ws.pageSetup.fitToPage=true;
  ws.pageSetup.fitToWidth=1;
  return true;
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
    const access=await context();
    if(access.response)return access.response;
    const current=access.current!,admin=createSupabaseAdminClient() as any;
    const month=text(request.nextUrl.searchParams.get("month"))||new Date().toISOString().slice(0,7);
    const range=monthRange(month);

    // O mês de competência é definido por summary.finalizadaEm (término real da aplicação),
    // e não por core_logs.created_at (momento da sincronização/insert no servidor).
    let query=admin.from("core_logs")
      .select("id,detalhes,created_at")
      .eq("app_slug","dronegestor")
      .eq("acao",FINALIZED_ACTION)
      .gte("detalhes->summary->>finalizadaEm",range.start)
      .lt("detalhes->summary->>finalizadaEm",range.end)
      .order("created_at",{ascending:true})
      .limit(500);
    query=scope(query,current);

    const [{data,error},p,template]=await Promise.all([query,profile(admin,current),officialTemplate(admin,current)]);
    if(error)throw error;

    const rows:ReportRow[]=[];
    for(const item of data??[]){
      const summary=obj(item?.detalhes?.summary);
      const products=Array.isArray(summary.produtos)&&summary.produtos.length?summary.produtos:[{}];
      const area=num(summary.areaConcluidaHa??summary.areaHa);
      const hours=durationHours(summary.iniciadaEm,summary.finalizadaEm);
      const volume=num(summary.totalCaldaRealL??summary.totalCaldaL);
      products.forEach((raw:any,index:number)=>{
        const product=obj(raw);
        rows.push({
          municipioUf:[text(summary.municipio),text(summary.uf)].filter(Boolean).join("/")||"—",
          arp:[text(summary.drone),text(summary.registroAnac)].filter(Boolean).join(" • ")||"—",
          area:index===0?area:0,
          horas:index===0?hours:0,
          atividade:text(summary.tipoAtividade)||"—",
          produto:text(product.nome)||"—",
          volume:index===0?volume:0,
          dose:`${num(product.dose).toFixed(2)} ${text(product.unidade)}`.trim()
        });
      });
    }

    let workbook:ExcelJS.Workbook;
    let model="padrao-campos";
    if(template){
      const official=new ExcelJS.Workbook();
      try{
        await official.xlsx.load(template.bytes as any);
        if(populateOfficialTemplate(official,rows,p,month)){workbook=official;model="oficial-uploadado";}
        else workbook=buildFallback(rows,p,month);
      }catch{workbook=buildFallback(rows,p,month);}
    }else workbook=buildFallback(rows,p,month);

    const buffer=await workbook.xlsx.writeBuffer();
    const filename=model==="oficial-uploadado"?`relatorio-mensal-MAPA-oficial-${month}.xlsx`:`dronegestor-relatorio-mapa-${month}.xlsx`;
    return new NextResponse(Buffer.from(buffer),{status:200,headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":"attachment; filename=\""+filename+"\"","Cache-Control":"private, no-store","X-DroneGestor-Modelo":model}});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Falha ao gerar XLSX."},{status:500});
  }
}
