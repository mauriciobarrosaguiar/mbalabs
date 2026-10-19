import assert from 'node:assert/strict';
import test from 'node:test';
import { detectProductImportDelimiter as detect } from '../src/modules/cotacoes/lib/csv-delimiter.ts';

test('CSV real em ponto e vírgula com muitas vírgulas em produtos sem aspas', () => {
 const csv = 'EAN;Produto;Laboratorio;Tipo de produto\n'
 + '2001000099001;TESTE_QA PRODUTO SIMULADO, 50 MG, CX, 30 COMP, EMB, LOTE, CONTROLE, NAO VENDER;LABORATORIO TESTE_QA;GENERICO\n'
 + '2001000099002;TESTE_QA PRODUTO SIMULADO, 20 MG, CX, 28 CAPS, EMB, LOTE, CONTROLE, NAO VENDER;LABORATORIO TESTE_QA;GENERICO';
 assert.equal(detect(csv), ';');
});
test('CSV semicolon with quoted comma in medicine names', () => {
 assert.equal(detect('EAN;Produto;Laboratorio;Tipo de produto\n2000000000012;"LOSARTANA, 50MG, C/30";QA;GENERICO'),';');
});
test('CSV comma with semicolons in quoted names', () => {
 assert.equal(detect('EAN,Produto,Laboratorio\n2000000000012,"LOSARTANA; 50MG; C/30",QA'),',');
});
test('TSV keeps TAB separator', () => {
 assert.equal(detect('EAN\tProduto\tLaboratorio\n2000000000012\t"LOSARTANA, 50MG"\tQA'),'\t');
});
test('double quoted escapes inside quoted fields', () => {
 assert.equal(detect('EAN;Produto;Laboratorio\n2000000000012;"Nome ""especial, 50MG"", extra";QA'),';');
});
test('preamble before the real header', () => {
 assert.equal(detect('EXPORTADO EM 19/10/2026\nPRODUTOS DISPONIVEIS\nEAN;Produto;Laboratorio;Tipo de produto\n1234567890123;LOSARTANA, 50MG;QA;GENERICO'),';');
});
test('unknown headings fall back to delimiter in first line', () => {
 assert.equal(detect('Campo 1;Campo 2;Campo 3\nA;B, C;D, E, F'),';');
});
