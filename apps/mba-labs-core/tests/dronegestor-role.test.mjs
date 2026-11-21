import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageDroneGestor } from '../src/lib/dronegestor-role.ts';
test('permissão do app habilita gestor e RT',()=>{
 for(const perfil of ['gestor_operacional','responsavel_tecnico','rt']) assert.equal(canManageDroneGestor({tipo:'usuario',permissoes:[{appSlug:'dronegestor',perfil,podeAcessar:true}]}),true);
});
test('piloto e permissão negada não concedem gestão',()=>{
 assert.equal(canManageDroneGestor({tipo:'usuario',permissoes:[{appSlug:'dronegestor',perfil:'piloto'}]}),false);
 assert.equal(canManageDroneGestor({tipo:'usuario',permissoes:[{appSlug:'dronegestor',perfil:'gestor_operacional',podeAcessar:false}]}),false);
 assert.equal(canManageDroneGestor({tipo:'usuario',permissoes:[{appSlug:'outro',perfil:'gestor_operacional'}]}),false);
});
