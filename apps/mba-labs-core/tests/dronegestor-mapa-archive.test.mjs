import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {populateMapaArchive} from '../src/lib/dronegestor-mapa-archive.ts';
async function source(){
 const z=new JSZip();
 z.file('xl/workbook.xml','<workbook><sheets><sheet name="JAN" r:id="rId1"/></sheets></workbook>');
 z.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
 z.file('xl/styles.xml','PRESERVE-STYLES');
 z.file('xl/worksheets/sheet1.xml','<worksheet><sheetData><row r="1"><c r="A1" s="7" t="s"><v>0</v></c><c r="B1"><f>SUM(A2:A9)</f><v>0</v></c><c r="C1" s="4"/><c r="D1"><f>INT(E1/100)</f><v>0</v></c></row><row r="5"><c r="A5"><v>5</v></c></row></sheetData><mergeCells><mergeCell ref="C1:D1"/></mergeCells><dataValidations><dataValidation type="list" sqref="B6:B1000"><formula1>INDIRECT($A6)</formula1></dataValidation></dataValidations></worksheet>');
 return z.generateAsync({type:'nodebuffer'});
}
test('preserva partes, fórmula, validação relativa e estilo ao escrever texto escapado',async()=>{
 const bytes=await populateMapaArchive(await source(),{JAN:{A1:'HOMOLOGAÇÃO $& <A> "teste"',A2:1.5}});
 const z=await JSZip.loadAsync(bytes),s=await z.file('xl/worksheets/sheet1.xml').async('string');
 assert.equal(await z.file('xl/styles.xml').async('string'),'PRESERVE-STYLES');
 assert.match(s,/<c r="A1" s="7" t="inlineStr">/);
 assert.ok(s.includes('HOMOLOGAÇÃO $&amp; &lt;A&gt; &quot;teste&quot;'));
 assert.ok(s.includes('<f>SUM(A2:A9)</f>'));
 assert.ok(s.includes('<c r="C1" s="4"/>'));
 assert.ok(s.includes('<f>INT(E1/100)</f>'));
 assert.equal((s.match(/sqref="B6:B1000"/g)||[]).length,1);
 assert.ok(s.includes('<formula1>INDIRECT($A6)</formula1>'));
 assert.ok(s.indexOf('<row r="2">')<s.indexOf('<row r="5">'));
 assert.match(await z.file('xl/workbook.xml').async('string'),/fullCalcOnLoad="1"/);
});
test('texto com sinal igual continua texto e limpeza mantém estilo',async()=>{
 const z=await JSZip.loadAsync(await populateMapaArchive(await source(),{JAN:{A1:null,C1:'=WEBSERVICE("https://example.invalid")'}}));
 const s=await z.file('xl/worksheets/sheet1.xml').async('string');
 assert.ok(s.includes('<c r="A1" s="7"/>'));
 assert.ok(s.includes('t="inlineStr"><is><t xml:space="preserve">=WEBSERVICE'));
});
test('recusa referência de célula inválida ou aba ausente',async()=>{
 await assert.rejects(populateMapaArchive(await source(),{JAN:{'A0':1}}),/Célula inválida/);
 await assert.rejects(populateMapaArchive(await source(),{NOV:{A1:1}}),/Aba MAPA/);
});
