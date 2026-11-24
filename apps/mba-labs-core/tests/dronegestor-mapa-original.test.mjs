import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import JSZip from 'jszip';
import {qa} from './helpers/dronegestor-mapa-simulation-fixture.mjs';

// Optional integration fixture supplied by the operator. Never contacts Supabase.
test('exportador real preenche o modelo original fornecido', {skip:!process.env.DRONE_QA_ORIGINAL_XLSX},async()=>{
  const fixture=new URL('./helpers/dronegestor-mapa-simulation-fixture.mjs',import.meta.url).href;
  const hooks=registerHooks({resolve(s,c,n){
    if(['@/lib/core-data','@mba-labs/shared/supabase/server'].includes(s))return{url:fixture,shortCircuit:true};
    if(s==='@/lib/dronegestor-role')return{url:new URL('../src/lib/dronegestor-role.ts',import.meta.url).href,shortCircuit:true};
    if(s==='@/lib/dronegestor-mapa-archive')return{url:new URL('../src/lib/dronegestor-mapa-archive.ts',import.meta.url).href,shortCircuit:true};if(s==='next/server')return n('next/server.js',c);
    return n(s,c);
  }});
  let GET;try{({GET}=await import('../src/app/api/dronegestor/relatorio-mensal/xlsx/route.ts'));}finally{hooks.deregister();}
  qa.template=await readFile(process.env.DRONE_QA_ORIGINAL_XLSX);
  qa.session={user:{id:'QA-AUTH'},profile:{id:'QA-RT',tipo:'usuario',status:'ativo',nome:'RT HOMOLOGAÇÃO',empresa_id:'QA'},appsLiberados:[{slug:'dronegestor',canAccess:true}],permissoes:[{appSlug:'dronegestor',perfil:'responsavel_tecnico'}]};
  const row=(acao,detalhes,id=acao)=>({id,acao,detalhes,empresa_id:'QA',usuario_id:'QA-RT',app_slug:'dronegestor',created_at:'2026-11-22T12:00:00Z'});
  qa.rows=[
    row('modelo_relatorio_mapa_2026_v1',{storagePath:'TEST-ONLY.xlsx'}),
    row('perfil_operacional_v1',{profile:{operadorNome:'HOMOLOGAÇÃO - SEM VALIDADE OFICIAL',registroMapa:'TESTE-SEM-REGISTRO',email:'qa@example.invalid',telefone:''}}),
    row('operacao_finalizada',{summary:{ordemServicoNumero:'OS-20261121-71DF6-HOMOLOGACAO',finalizadaEm:'2026-11-22T11:30:00Z',areaConcluidaHa:1.5,municipio:'Palmas',uf:'TO',registroAnac:'TESTE-SEM-ANAC',cultura:'Milho',volumeLHa:10,produtos:[{nome:'HOMOLOGAÇÃO - PRODUTO FICTÍCIO',dose:100,unidade:'mL/ha'}]}},'EVENT-QA'),
    row('operacao_revisao_mapa_2026_v1',{operationEventId:'EVENT-QA',status:'aprovado',category:'outros',tipoServico:'OUTROS',horasAplicacao:'00:24'})
  ];
  const response=await GET({nextUrl:new URL('https://example.invalid/api/dronegestor/relatorio-mensal/xlsx?month=2026-11')});
  assert.equal(response.status,200,response.status===200?'':JSON.stringify(await response.clone().json()));
  assert.match(response.headers.get('content-type'),/spreadsheetml/);
  assert.equal(qa.rows.length,4,'Nenhuma escrita ou finalização deve ocorrer');
  const outputDir=process.env.DRONE_QA_OUTPUT;
  assert.ok(outputDir,'Defina DRONE_QA_OUTPUT para a verificação estrutural posterior');
  await mkdir(outputDir,{recursive:true});
  const bytes=Buffer.from(await response.arrayBuffer());
  const original=await JSZip.loadAsync(qa.template),output=await JSZip.loadAsync(bytes);
  const sheets=['xl/worksheets/sheet1.xml','xl/worksheets/sheet14.xml'];
  for(const [name,entry] of Object.entries(original.files)){
    if(entry.dir)continue;
    assert.ok(output.file(name),`Parte perdida: ${name}`);
    if(name==='xl/workbook.xml')continue;
    const before=await entry.async('nodebuffer'),after=await output.file(name).async('nodebuffer');
    if(!sheets.includes(name)){assert.ok(before.equals(after),`Parte modificada: ${name}`);continue;}
    const a=before.toString(),b=after.toString();
    assert.deepEqual(a.match(/<f\b[^>]*(?:\/>|>[\s\S]*?<\/f>)/g),b.match(/<f\b[^>]*(?:\/>|>[\s\S]*?<\/f>)/g),'Fórmulas precisam permanecer intactas');
    assert.equal(a.split('<sheetData>')[0],b.split('<sheetData>')[0]);
    assert.equal(a.split('</sheetData>')[1],b.split('</sheetData>')[1],'Validações e demais recursos da aba precisam permanecer intactos');
  }
  await writeFile(outputDir+'/HOMOLOGACAO_MAPA_ORIGINAL_PREENCHIDO.xlsx',bytes);
});
