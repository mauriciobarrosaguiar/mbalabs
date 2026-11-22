import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const hook=registerHooks({resolve(s,c,n){if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};return n(s,c);},load(u,c,n){if(u.endsWith('/dronegestor-sarpas-provider.ts'))return {format:'module',source:ts.transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return n(u,c);}});
const {sarpasProviderStatus,sarpasProviderCall,sarpasConsentBody}=await import('../src/lib/dronegestor-sarpas-provider.ts');hook.deregister();
test('disabled provider, missing delegation and official submission never send requests',async()=>{
 const original=globalThis.fetch,key=process.env.DRONEGESTOR_SARPAS_PROVIDER_KEY,enabled=process.env.DRONEGESTOR_SARPAS_PROVIDER_ENABLED;
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected');};
 try {
 delete process.env.DRONEGESTOR_SARPAS_PROVIDER_KEY;delete process.env.DRONEGESTOR_SARPAS_PROVIDER_ENABLED;
 assert.equal(sarpasProviderStatus().enabled,false);assert.equal(sarpasProviderStatus().verified,false);
 await assert.rejects(sarpasProviderCall('context'),/não habilitado/);
 process.env.DRONEGESTOR_SARPAS_PROVIDER_KEY='TEST-ONLY-NOT-A-CREDENTIAL';process.env.DRONEGESTOR_SARPAS_PROVIDER_ENABLED='true';
 await assert.rejects(sarpasProviderCall('submit'),/não homologado/);
 await assert.rejects(sarpasProviderCall('context'),/delegada/);assert.equal(calls,0);
 for(const value of ['', 'not-a-uuid'])assert.throws(()=>sarpasConsentBody(value));
 }finally{globalThis.fetch=original;if(key===undefined)delete process.env.DRONEGESTOR_SARPAS_PROVIDER_KEY;else process.env.DRONEGESTOR_SARPAS_PROVIDER_KEY=key;if(enabled===undefined)delete process.env.DRONEGESTOR_SARPAS_PROVIDER_ENABLED;else process.env.DRONEGESTOR_SARPAS_PROVIDER_ENABLED=enabled;}
});
