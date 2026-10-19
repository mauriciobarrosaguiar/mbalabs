import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
const {Workbook}=ExcelJS;
import {readProductXlsxRows} from '../src/modules/cotacoes/lib/product-xlsx-reader.ts';

async function fakeFile(rows) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Produtos TESTE_QA');
  for(const row of rows) sheet.addRow(row);
  const bytes=await workbook.xlsx.writeBuffer();
  const array=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  return {arrayBuffer:async()=>array};
}

test('XLSX lê EAN, descrição, laboratório e tipo na ordem original das colunas',async()=>{
 const input=[
 ['Produto','Laboratório','EAN','TIPO DE PRODUTO (STATUS DO PRODUTO)'],
 ['TESTE_QA PRODUTO XLSX SIMULADO 10MG C30','LABORATORIO TESTE_QA','2001000099003','GENERICO'],
 ['TESTE_QA PRODUTO XLSX SIMULADO 20MG C30','LABORATORIO TESTE_QA','2001000099004','GENERICO'],
 ];
 assert.deepEqual(await readProductXlsxRows(await fakeFile(input)), input);
});
test('XLSX sem produtos produz erro explícito',async()=>{
 await assert.rejects(async()=>readProductXlsxRows(await fakeFile([])),/sem registros/);
});
test('XLSX em branco produz erro explícito',async()=>{
 await assert.rejects(()=>readProductXlsxRows({arrayBuffer:async()=>new ArrayBuffer(0)}),/vazio/);
});

import JSZip from 'jszip';

const MAIN_NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
async function simulatePrefixedExcelFile(rows) {
  const workbook=new Workbook();
  const sheet=workbook.addWorksheet('Produtos TESTE_QA');
  for(const row of rows) sheet.addRow(row);
  const zip=await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
  for (const path of Object.keys(zip.files)) {
    if(!/^xl\/(?:workbook\.xml|styles\.xml|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(path)) continue;
    const entry=zip.file(path);
    if(!entry) continue;
    const xml=await entry.async('string');
    if(!xml.includes(`xmlns="${MAIN_NS}"`)) continue;
    const prefixed=xml.replace(`xmlns="${MAIN_NS}"`,`xmlns:x="${MAIN_NS}"`)
      .replace(/<(\/?)([A-Za-z][\w-]*)(?=[\s/>])/g, '<$1x:$2');
    zip.file(path,prefixed);
  }
  const data=await zip.generateAsync({type:'uint8array'});
  return {arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
}

test('XLSX com prefixo x: do gerador de planilhas importa quatro colunas sem perder EAN',async()=>{
  const input=[
    ['Produto','Laboratório','EAN','TIPO DE PRODUTO (STATUS DO PRODUTO)'],
    ['TESTE_QA PRODUTO XLSX SIMULADO 10MG C30','LABORATORIO TESTE_QA','2001000099003','GENERICO'],
    ['TESTE_QA PRODUTO XLSX SIMULADO 20MG C30','LABORATORIO TESTE_QA','2001000099004','GENERICO']
  ];
  const file=await simulatePrefixedExcelFile(input);
  assert.deepEqual(await readProductXlsxRows(file),input);
});
