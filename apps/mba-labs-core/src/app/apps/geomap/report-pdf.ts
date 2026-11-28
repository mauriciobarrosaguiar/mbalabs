import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ReportInput } from "./report";

const A4: [number,number] = [595.28,841.89];
const margin = 48;
const ink = rgb(0.09,0.17,0.23);
const accent = rgb(0.035,0.36,0.44);
const muted = rgb(0.30,0.36,0.42);

function supported(value: string, font: PDFFont): string {
  // Standard Helvetica supports Portuguese Latin characters. Substitute explicitly
  // for unsupported glyphs rather than silently dropping text or crashing.
  return Array.from(value.normalize("NFC")).map(c=>{
    if(c==="\n") return c;
    if(c==="\t") return " ";
    try {font.encodeText(c);return c;} catch {return "[?]";}
  }).join("");
}
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[]=[];
  for(const paragraph of supported(text,font).split(/\r?\n/)){
    let line="";
    for(const word of paragraph.trim().split(/\s+/)){
      const candidate=line?line+" "+word:word;
      if(font.widthOfTextAtSize(candidate,size)<=width){line=candidate;continue;}
      if(line) lines.push(line);
      line="";
      for(const char of word){
        if(line && font.widthOfTextAtSize(line+char,size)>width){lines.push(line);line="";}
        line+=char;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function generateReportPdf(input: ReportInput): Promise<Uint8Array> {
  if(!input.project.trim()||!input.operator.trim()||!input.purpose.trim()) throw new Error("Informe projeto, operador e finalidade.");
  const doc=await PDFDocument.create();
  doc.setTitle("Relatório descritivo de mapeamento");
  doc.setAuthor(input.operator);
  doc.setSubject("Rascunho para revisão do operador");
  doc.setCreator("MBA GeoMap");
  const regular=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage=doc.addPage(A4);
  let y=0;
  function startPage(p: PDFPage) {
    page=p;
    p.drawRectangle({x:0,y:A4[1]-70,width:A4[0],height:70,color:accent});
    p.drawText("MBA GeoMap",{x:margin,y:A4[1]-30,size:18,font:bold,color:rgb(1,1,1)});
    p.drawText("DOCUMENTAÇÃO GEOESPACIAL  /  RASCUNHO PARA REVISÃO",{x:margin,y:A4[1]-48,size:9,font:regular,color:rgb(0.9,0.96,0.97)});
    y=A4[1]-102;
  }
  startPage(page);
  function ensure(height:number){if(y-height<64) startPage(doc.addPage(A4));}
  function paragraph(value:string,size=11,font=regular,color=ink){
    for(const line of wrap(value||"Não informado",font,size,A4[0]-2*margin)){
      ensure(size+6);
      page.drawText(line,{x:margin,y,size,font,color}); y-=size+6;
    }
    y-=5;
  }
  function section(title:string){
    ensure(55);y-=12;
    page.drawLine({start:{x:margin,y:y+7},end:{x:A4[0]-margin,y:y+7},thickness:.7,color:rgb(.75,.81,.84)});
    paragraph(title,14,bold,accent);
  }
  function field(label:string,value:string){
    ensure(42);
    paragraph(label,10,bold,muted);
    paragraph(value.trim()||"Não informado");
  }
  paragraph("Relatório descritivo de mapeamento",22,bold);
  paragraph(input.project.trim(),16,bold,accent);
  paragraph("Rascunho baseado em informações declaradas pelo operador. Não constitui certificação, laudo de acurácia ou responsabilidade técnica do GeoMap. Revisar antes de entregar.",10,regular,muted);
  section("01  Identificação");
  for(const [label,value] of [["Projeto",input.project],["Contratante",input.client],["Operador / autor",input.operator],["Local",input.location],["Data do voo",input.flightDate],["Equipamento",input.equipment],["Sistema de coordenadas",input.crs],["Fotografias",input.photos],["GSD e unidade",input.gsd]]) field(label,value);
  section("02  Finalidade");paragraph(input.purpose.trim());
  section("03  Metodologia");paragraph(input.methodology.trim());
  section("04  Produtos declarados pelo operador");
  const products=[...new Set(input.products.map(p=>p.trim()).filter(Boolean))];
  if(products.length) for(const p of products) paragraph("- "+p); else paragraph("Nenhum produto declarado.");
  section("05  Qualidade e limitações");
  paragraph("Acurácia horizontal e vertical absoluta: não verificada neste gerador. GSD não equivale à acurácia. Nenhuma classificação PEC-PCD é atribuída automaticamente.");
  paragraph(input.limitations.trim());
  section("06  Guarda e responsabilidade");
  paragraph("O operador deve verificar, baixar e guardar os arquivos conforme suas obrigações. O GeoMap não substitui profissional habilitado nem acervo obrigatório.");
  field("Autor / responsável pela revisão",input.operator);
  const pages=doc.getPages();
  pages.forEach((p,i)=>{
    p.drawLine({start:{x:margin,y:49},end:{x:A4[0]-margin,y:49},color:rgb(.75,.81,.84),thickness:.7});
    p.drawText("MBA GeoMap | Rascunho descritivo",{x:margin,y:32,size:9,font:regular,color:muted});
    const num="Página "+(i+1)+" / "+pages.length;
    p.drawText(num,{x:A4[0]-margin-regular.widthOfTextAtSize(num,9),y:32,size:9,font:regular,color:muted});
  });
  return doc.save();
}
