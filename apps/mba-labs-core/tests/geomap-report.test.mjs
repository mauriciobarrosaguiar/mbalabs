import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, expiryFromCompletion, canDownload } from "../src/app/apps/geomap/report.ts";
const input={project:"Teste <script>",client:"",operator:"Operador",location:"",flightDate:"",equipment:"",purpose:"Análise",crs:"",photos:"",gsd:"",methodology:"",limitations:"",products:["MDT (GeoTIFF)","Falso","MDT (GeoTIFF)"]};
test("report uses actual declared data, escapes markup and avoids invented precision",()=>{const html=buildReport(input);assert.ok(html.includes("Teste &lt;script&gt;"));assert.ok(!html.includes("<script>"));assert.ok(html.includes("Não informado"));assert.ok(html.includes("não verificada"));assert.equal(html.match(/MDT \(GeoTIFF\)/g).length,1);assert.ok(!html.includes("Falso"));});
test("required fields",()=>assert.throws(()=>buildReport({...input,operator:" "})));
test("retention is exactly 168 hours; expiry boundary blocks",()=>{const start="2026-11-28T10:33:38Z";const end=Date.parse("2026-12-05T10:33:38Z");assert.equal(expiryFromCompletion(start),"2026-12-05T10:33:38.000Z");assert.equal(canDownload(start,end-1),true);assert.equal(canDownload(start,end),false);assert.equal(canDownload(start,Date.parse(start)-1),false);assert.equal(canDownload("invalid",end),false);});
