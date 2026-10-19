import assert from 'node:assert/strict';
import test from 'node:test';
import {Workbook} from 'exceljs';
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
