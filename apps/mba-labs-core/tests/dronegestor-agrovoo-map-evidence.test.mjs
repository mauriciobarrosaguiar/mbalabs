import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { validateMapEvidenceFile } from "../src/lib/agrovoo-map-evidence.ts";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark>
<Point><coordinates>-48.35,-10.18,0</coordinates></Point>
</Placemark></Document></kml>`;

test("AgroVoo: KML estruturalmente válido é aceito apenas como evidência", async () => {
  const result = await validateMapEvidenceFile("voo.kml", Buffer.from(xml, "utf8"));
  assert.deepEqual(result, { ext: "kml", mime: "application/vnd.google-earth.kml+xml" });
});

test("AgroVoo: rejeita XML genérico, KML malformado e entidades externas", async () => {
  for (const value of [
    "<root><Point><coordinates>0,0</coordinates></Point></root>",
    "<kml><Document></Document></kml>",
    '<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]><kml><Point><coordinates>0,0</coordinates></Point></kml>',
  ]) {
    assert.equal(await validateMapEvidenceFile("voo.kml", Buffer.from(value)), null);
  }
});

test("AgroVoo: KMZ contendo um KML válido é aceito", async () => {
  const zip = new JSZip();
  zip.file("doc.kml", xml);
  const content = await zip.generateAsync({ type: "nodebuffer" });
  assert.deepEqual(await validateMapEvidenceFile("voo.kmz", content),
    { ext: "kmz", mime: "application/vnd.google-earth.kmz" });
});

test("AgroVoo: rejeita KMZ sem KML ou com arquivo inválido", async () => {
  const zip = new JSZip();
  zip.file("doc.txt", "Texto longo que não é um KML válido");
  const badZip = await zip.generateAsync({ type: "nodebuffer" });
  assert.equal(await validateMapEvidenceFile("voo.kmz", badZip), null);
  assert.equal(await validateMapEvidenceFile("voo.kmz", Buffer.from("not a zip not a zip not a zip")), null);
});

test("AgroVoo: extensão genérica não é aceita como KML/KMZ", async () => {
  assert.equal(await validateMapEvidenceFile("voo.pdf", Buffer.from(xml)), null);
});


test("AgroVoo: foto selecionada em outra OS não é enviada à missão atual", () => {
  const source = readFileSync(new URL("../src/app/apps/dronegestor/campo/DroneMapEvidence.tsx", import.meta.url), "utf8");
  assert.match(source, /pendingOsRef\.current=mission\.ordemServicoId;setPendingFile/);
  const upload = source.slice(source.indexOf("async function uploadSelected()"));
  const guard = upload.indexOf("pendingOsRef.current!==mission.ordemServicoId");
  assert.ok(guard >= 0 && guard < upload.indexOf('fetch("/api/dronegestor/mapa"'));
  assert.match(upload, /stillCurrent=getMission\(\)\.ordemServicoId===mission\.ordemServicoId/);
  assert.match(source, /hasOs&&finalidade==="pos_voo"&&<Link/);
});

test("AgroVoo: consulta de mapa descarta respostas de outra OS ou finalidade",()=>{
 const source=readFileSync(new URL("../src/app/apps/dronegestor/campo/DroneMapEvidence.tsx",import.meta.url),"utf8");
 assert.ok(source.includes("sequence===loadSequence.current&&getMission().ordemServicoId===osId"));
 assert.ok(source.includes('next.ordemServicoId!==osId||(next.finalidade||"pos_voo")!==mode'));
 assert.ok(source.includes("if(!current())return;"));
 assert.ok(source.includes("busyRef.current=true"));
});
test("AgroVoo: pacote aceita foto pós-voo ou documento de mapa da OS, sem alterar regra de fechamento",()=>{
 const read=path=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
 const pkg=read("app/apps/dronegestor/pacote-operacao/DroneOperationPackage.tsx");
 assert.ok(pkg.includes('doc.tipo==="mapa_aplicacao"&&doc.ordemServicoId===osId'));
 assert.ok(pkg.includes("||mapDocs.length>0"));
 assert.ok(pkg.includes('action!=="status"&&!canManage'));
 const summary=read("app/apps/dronegestor/pacote-operacao/DroneFinalOsSummary.tsx");
 assert.ok(summary.includes("const mapReceived = mapOk || hasMapDocument"));
 const server=read("app/api/dronegestor/fechamento/route.ts");
 assert.ok(server.includes('Boolean(mapRow) || types.has("mapa_aplicacao")'));
});
test("AgroVoo: campo abre anexo pós-voo diretamente e mapa não depende do Drive",()=>{
 const read=path=>readFileSync(new URL("../src/app/apps/dronegestor/"+path,import.meta.url),"utf8");
 const field=read("campo/DroneGuidedFieldMode.tsx");
 assert.ok(field.includes('<DroneMapEvidence fixedPurpose="pos_voo"/>'));
 assert.ok(field.includes('pacote-operacao?osId="+encodeURIComponent(payload.ordemServicoId||"")'));
 assert.ok(field.includes('if(hasPartialPending())return flash("Confirme o encerramento parcial pendente antes de concluir.")'));
 const docs=read("documentos/AgroDocDocuments.tsx");
 assert.match(docs,/if\(type!=="mapa_aplicacao"\)\{\s*const statusResponse=await fetch\("\/api\/dronegestor\/cloud"/);
});

test("AgroVoo: extensão do arquivo no formulário admite mapas reais e restringe KML/KMZ à categoria correta",()=>{
 const source=readFileSync(new URL("../src/app/apps/dronegestor/documentos/AgroDocDocuments.tsx",import.meta.url),"utf8");
 const allowLine=source.split("\n").find(l=>l.includes('type==="mapa_aplicacao" && !/'));
 const restrictLine=source.split("\n").find(l=>l.includes('type!=="mapa_aplicacao" && /'));
 function rule(line){const m=line?.match(/\/([^/]+)\/i\.test\(file\.name\)/);assert.ok(m);return new RegExp(m[1],"i");}
 const allow=rule(allowLine),restrict=rule(restrictLine);
 for(const name of ["voo.kml","controle.JPG","mapa.KMZ","foto.png","foto.webp"])assert.ok(allow.test(name),name);
 for(const name of ["voo.exe","mapa.kml.exe","mapakml"])assert.equal(allow.test(name),false,name);
 assert.ok(restrict.test("mapa.kmz"));assert.equal(restrict.test("mapa.jpg"),false);
});
test("AgroVoo: KML em UTF-8 inválido é recusado sem exceção",async()=>{
 const bytes=Buffer.concat([Buffer.from(xml),Buffer.from([0xff,0xfe])]);
 assert.equal(await validateMapEvidenceFile("mapa.kml",bytes),null);
});
