import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL policy execution in WASM; fixture schema, no network/database URL.
// This tests SQL/RLS, not PostgREST/JWT or the production catalog.
test('migration RLS: pilot isolation, direct forgery, restrictive composition and other modules', async () => {
 const db = new PGlite();
 try {
 await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create table core_logs(id serial primary key, empresa_id text, usuario_id text, app_slug text, acao text, detalhes jsonb);
 create table core_apps(id text, slug text);
 create table core_usuario_app_permissoes(usuario_id text, empresa_id text, app_id text, status text, perfil_app text);
 create function current_usuario_id() returns text language sql stable as $$select current_setting('test.user',true)$$;
 create function current_empresa_id() returns text language sql stable as $$select current_setting('test.company',true)$$;
 create function current_usuario_tipo() returns text language sql stable as $$select current_setting('test.role',true)$$;
 create function is_admin_master() returns boolean language sql stable as $$select coalesce(current_usuario_tipo()='admin_master',false)$$;
 alter table core_logs enable row level security;
 grant usage on schema public to anon,authenticated,service_role;
 grant select,insert,update,delete on core_logs to anon,authenticated,service_role;
 grant usage on sequence core_logs_id_seq to anon,authenticated,service_role;
 grant select on core_apps,core_usuario_app_permissoes to authenticated;
 insert into core_logs(empresa_id,usuario_id,app_slug,acao,detalhes) values
 ('A','pedro','dronegestor','estado_campo_v2','{}'),
 ('A','joao','dronegestor','estado_campo_v2','{}'),
 ('B','outro','dronegestor','estado_campo_v2','{}'),
 ('A','rt','dronegestor','ordem_servico','{"data":{"pilotoResponsavelId":"pedro"}}'),
 ('A','pedro','cotacoes','audit','{}'), ('B','outro','cotacoes','audit','{}');
 `);
 // Mirror the two permissive policies currently installed in production.
 await db.exec(`
 create policy core_logs_select on core_logs for select to authenticated
   using (is_admin_master() or empresa_id=current_empresa_id());
 create policy core_logs_insert on core_logs for insert to authenticated
   with check (is_admin_master() or empresa_id=current_empresa_id());
 `);
 await db.exec(await readFile(new URL('../../../supabase/migrations/20260815140001_restrict_dronegestor_logs_by_role.sql',import.meta.url),'utf8'));
 // The migration may only ADD restrictive guards; shared policies must survive.
 const basePolicies=(await db.query(`
 select policyname,cmd,permissive from pg_policies
 where tablename='core_logs' and policyname in ('core_logs_select','core_logs_insert')
 order by policyname
 `)).rows;
 assert.deepEqual(basePolicies.map(x=>[x.policyname,x.cmd,x.permissive]),[
   ['core_logs_insert','INSERT','PERMISSIVE'],
   ['core_logs_select','SELECT','PERMISSIVE'],
 ]);
 // A second application is safe: old policies and four restrictive guards remain.
 await db.exec(await readFile(new URL('../../../supabase/migrations/20260815140001_restrict_dronegestor_logs_by_role.sql',import.meta.url),'utf8'));
 assert.equal((await db.query(`select count(*)::int as n from pg_policies
 where tablename='core_logs' and policyname like 'dronegestor_logs_api_%'`)).rows[0].n,4);

 // Worst-case permissive policy must not reopen DroneGestor, including UPDATE promotion.
 await db.exec(`create policy legacy_broad on core_logs for all to authenticated using (empresa_id=current_empresa_id()) with check (empresa_id=current_empresa_id());`);
 for (const [user,role,company] of [['pedro','piloto','A'],['joao','piloto','A'],['gestor','gestor_operacional','A'],['rt','responsavel_tecnico','A'],['admin','admin_empresa','A'],['master','admin_master','A'],['outro','piloto','B'],['sem','usuario','A'],['invalid','','']]) {
 await db.query(`select set_config('test.user',$1,false),set_config('test.role',$2,false),set_config('test.company',$3,false)`,[user,role,company]);
 await db.exec('set role authenticated');
 assert.equal((await db.query("select * from core_logs where app_slug='dronegestor'")).rows.length,0,user);
 assert.equal((await db.query("update core_logs set detalhes='{}' where app_slug='dronegestor' returning id")).rows.length,0);
 assert.equal((await db.query("delete from core_logs where app_slug='dronegestor' returning id")).rows.length,0);
 await assert.rejects(db.exec("insert into core_logs(empresa_id,usuario_id,app_slug) values(current_empresa_id(),current_usuario_id(),'dronegestor')"),/row-level security/);
 if(company==='A') {
 assert.equal((await db.query("select * from core_logs where app_slug='cotacoes' and empresa_id='A'")).rows.length,1);
 if(user==='pedro'){
   // Other MBA Labs applications keep their preexisting INSERT and SELECT semantics.
   await db.exec('begin');
   await db.exec("insert into core_logs(empresa_id,usuario_id,app_slug,acao,detalhes) values('A','pedro','cotacoes','audit','{}')");
   assert.equal((await db.query("select * from core_logs where app_slug='cotacoes' and empresa_id='A'")).rows.length,2);
   await db.exec('rollback');
 }

 await assert.rejects(db.exec("update core_logs set app_slug='dronegestor' where app_slug='cotacoes' and empresa_id='A'"),/row-level security/);
 }
 await db.exec('reset role');
 }
 await db.exec('set role anon');
 assert.equal((await db.query('select * from core_logs')).rows.length,0);
 await assert.rejects(db.exec("insert into core_logs(app_slug) values('dronegestor')"),/row-level security/);
 await db.exec('reset role; set role service_role');
 assert.equal((await db.query("select * from core_logs where app_slug='dronegestor'")).rows.length,4);
 await db.exec("insert into core_logs(empresa_id,usuario_id,app_slug) values('A','pedro','dronegestor')");
 await db.exec('reset role');
 // Transactional recovery retains RLS and restrictive protection (no unsafe rollback).
 await db.exec('begin; drop policy dronegestor_logs_api_select on core_logs; rollback; set role authenticated');
 assert.equal((await db.query("select * from core_logs where app_slug='dronegestor'")).rows.length,0);
 } finally {await db.close();}
});
