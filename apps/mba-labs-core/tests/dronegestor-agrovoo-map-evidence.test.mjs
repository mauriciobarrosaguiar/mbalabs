import test from "node:test";
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
