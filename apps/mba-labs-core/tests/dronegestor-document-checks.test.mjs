import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hasNonPlaceholderAnacId,isExplicitHomologationPlaceholder} from '../src/lib/dronegestor-document-checks.ts';

test('identificadores fictícios não atendem ao requisito documental ANAC',()=>{
 for(const id of ['', ' ', null, undefined, 'HOMOLOGACAO-SEM-REGISTRO-REAL', 'HOMOLOGAÇÃO PR206', 'DJI MODELO FICTÍCIO', 'FICTICIO PR206', 'SEM REGISTRO REAL', 'NÃO UTILIZAR EM CAMPO', 'DEMONSTRAÇÃO SEM VOO']){
   assert.equal(hasNonPlaceholderAnacId(id),false,String(id));
 }
});
test('identificador preenchido que não é placeholder continua apenas como declarado',()=>{
 for(const id of ['ID-INFORMADO-123','ABC123','UAS-012345']){
   assert.equal(hasNonPlaceholderAnacId(id),true,id);
 }
});
test('checklist documental usa a identificação não fictícia sem certificar autorização oficial',()=>{
 const content=readFileSync(new URL('../src/app/apps/dronegestor/documentos/DroneDocumentsCenter.tsx',import.meta.url),'utf8');
 assert.match(content,/ok:hasNonPlaceholderAnacId\(mission\.registroAnac\)/);
 assert.match(content,/Identificação fictícia de homologação/);
 assert.match(content,/confira a certidão SISANT/);
 assert.doesNotMatch(content,/ok:Boolean\(mission\.registroAnac\)/);
});

test('pré-voo servidor deve recusar modelo e identificação fictícios, sem presumir certificação',()=>{
 for(const name of ['DJI MODELO FICTÍCIO - SEM VOO','HOMOLOGAÇÃO PR206','SEM REGISTRO REAL']){
  assert.equal(isExplicitHomologationPlaceholder(name),true,name);
 }
 assert.equal(isExplicitHomologationPlaceholder('DJI Agras informado'),false);
 const route=readFileSync(new URL('../src/app/api/dronegestor/preflight/route.ts',import.meta.url),'utf8');
 assert.match(route,/!isExplicitHomologationPlaceholder\(mission\.drone\)/);
 assert.match(route,/hasNonPlaceholderAnacId\(mission\.registroAnac \|\| mission\.identificacaoAnac\)/);
 assert.match(route,/Dados fictícios de homologação não liberam o pré-voo/);
});
