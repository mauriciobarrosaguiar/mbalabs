import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const hook=registerHooks({resolve(s,c,n){return s==='./dronegestor-role'?{url:new URL('../src/lib/dronegestor-role.ts',import.meta.url).href,shortCircuit:true}:n(s,c);}});
const {isDroneSystemAdministrator,canAdministerDroneCompany,isDroneEmployeeRole}=await import('../src/lib/dronegestor-company-access.ts');hook.deregister();
test('admin da empresa não vira administrador geral',()=>{
  assert.equal(canAdministerDroneCompany({tipo:'admin_empresa'}),true);assert.equal(isDroneSystemAdministrator({tipo:'admin_empresa'}),false);
  assert.equal(isDroneSystemAdministrator({tipo:'super_admin'}),true);assert.equal(isDroneSystemAdministrator({tipo:'admin_master'}),true);
});
test('gestor operacional, RT, piloto e permissão negada não delegam acessos',()=>{
  for(const role of ['gestor_operacional','responsavel_tecnico','piloto','visualizador'])assert.equal(canAdministerDroneCompany({tipo:'usuario',permissoes:[{appSlug:'dronegestor',perfil:role,podeAcessar:true}]}),false);
  assert.equal(canAdministerDroneCompany({tipo:'usuario',permissoes:[{appSlug:'dronegestor',perfil:'admin_empresa',podeAcessar:false}]}),false);
  assert.equal(canAdministerDroneCompany({tipo:'usuario',permissoes:[{appSlug:'dronegestor',perfil:'admin_empresa',podeAcessar:true}]}),true);
});
test('formulário de funcionário não concede administração geral nem empresarial',()=>{
  for(const role of ['super_admin','admin_master','admin_empresa',null,{}])assert.equal(isDroneEmployeeRole(role),false);
  assert.equal(isDroneEmployeeRole('responsavel_tecnico'),true);
});
