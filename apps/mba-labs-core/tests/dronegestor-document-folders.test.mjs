import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {agroDocFolders,attachmentsInFolder} from '../src/lib/dronegestor-document-folders.ts';

const docs=[
 {tipo:'outro',nome:'HOMOLOGACAO-PR206-ANEXO-SEM-VALIDADE.pdf'},
 {tipo:'foto',nome:'registro-foto.jpg'},
 {tipo:'video',nome:'video.mp4'},
 {tipo:'avaliacao_risco',nome:'risco.pdf'},
 {tipo:'receituario',nome:'receita.pdf'},
];
const folder=label=>{const result=agroDocFolders.find(x=>x.label===label);assert.ok(result,label);return result;};

test('anexo outro pertence a Outros documentos, não Fotos e evidências',()=>{
 assert.deepEqual(attachmentsInFolder(docs,folder('Outros documentos')).map(x=>x.nome),[docs[0].nome]);
 assert.deepEqual(attachmentsInFolder(docs,folder('Fotos e evidências')).map(x=>x.nome),[docs[1].nome,docs[2].nome]);
 assert.deepEqual(attachmentsInFolder(docs,folder('Avaliações de risco')).map(x=>x.nome),[docs[3].nome]);
 assert.equal(attachmentsInFolder(docs,folder('Todos')).length,docs.length);
});

test('categorias exibidas em no máximo uma pasta temática',()=>{
 const categoryTypes=agroDocFolders.slice(1).flatMap(x=>x.types);
 assert.equal(categoryTypes.length,new Set(categoryTypes).size);
 for(const d of docs)assert.ok(categoryTypes.includes(d.tipo),d.tipo);
});

test('central mobile apresenta cartões acessíveis em vez da tabela horizontal',()=>{
 const file=readFileSync(new URL('../src/app/apps/dronegestor/documentos/AgroDocDocuments.tsx',import.meta.url),'utf8');
 assert.match(file,/className="hidden sm:block"/);
 assert.match(file,/className="grid gap-3 sm:hidden"/);
 assert.match(file,/setSelected\(x\)/);
 assert.match(file,/openDocument\(x, true\)/);
 assert.match(file,/attachmentsInFolder\(docs, f\)/);
});
