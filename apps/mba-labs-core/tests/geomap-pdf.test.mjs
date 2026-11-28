import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { generateReportPdf } from "../src/app/apps/geomap/report-pdf.ts";
const input={project:"Chácara de São João",client:"",operator:"Operador teste",location:"Palmas - TO",flightDate:"2026-11-28",equipment:"DJI Mini 2",purpose:"Mapeamento descritivo",crs:"",photos:"29",gsd:"Não informado",methodology:"",limitations:"",products:["Ortomosaico (GeoTIFF)"]};
test("PDF valid and metadata authored by operator",async()=>{const bytes=await generateReportPdf(input);assert.equal(Buffer.from(bytes.subarray(0,5)).toString(),"%PDF-");const doc=await PDFDocument.load(bytes);assert.equal(doc.getAuthor(),input.operator);assert.ok(doc.getPageCount()>=1);});
test("long paragraphs, long words, non-Latin symbols and pagination",async()=>{const doc=await PDFDocument.load(await generateReportPdf({...input,methodology:"A".repeat(3000)+"\n"+"Descrição completa 🌍 ".repeat(150)}));assert.ok(doc.getPageCount()>2);});
test("required fields enforced",async()=>{await assert.rejects(generateReportPdf({...input,purpose:" "}),/Informe projeto/);});
