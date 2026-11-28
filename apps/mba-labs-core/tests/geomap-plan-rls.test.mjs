import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";

test("plan metadata RLS: owner only, drafts only, no anonymous access",async()=>{
 const db=new PGlite();
 const a="00000000-0000-4000-8000-000000000001",b="00000000-0000-4000-8000-000000000002",c="00000000-0000-4000-8000-000000000003";
 try{
 await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; create table public.core_usuarios(auth_user_id uuid,tipo_global text,tipo text,status text); grant select on public.core_usuarios to authenticated;");
 await db.query("insert into auth.users values ($1),($2),($3)",[a,b,c]);
 await db.query("insert into public.core_usuarios values ($1,'admin_master',null,'ativo'),($2,'super_admin',null,'ativo'),($3,'usuario',null,'ativo')",[a,b,c]);
 await db.exec(await readFile(new URL("../../../infra/geomap/db/projects-schema.sql",import.meta.url),"utf8"));
 await db.exec(await readFile(new URL("../../../infra/geomap/db/plans-schema.sql",import.meta.url),"utf8"));
 async function identity(id){await db.exec("reset role; set role authenticated");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
 const project=async id=>(await db.query("insert into public.geomap_projects(owner_id,name,city,uf) values ($1,'Teste','Palmas','TO') returning id",[id])).rows[0].id;
 const insert=(p,o,plan)=>db.query("insert into public.geomap_plans(project_id,owner_id,plan) values ($1,$2,$3)",[p,o,JSON.stringify(plan)]);
 const draft=p=>({projectId:p,status:"draft",uploaded:false,submitted:false});
 await identity(a);const pa=await project(a);await assert.rejects(insert(pa,a,{}));await assert.rejects(insert(pa,a,{...draft(pa),status:"completed"}));await insert(pa,a,draft(pa));
 await identity(b);const pb=await project(b);await assert.rejects(insert(pa,b,draft(pa)));await assert.rejects(insert(pb,a,draft(pb)));await insert(pb,b,draft(pb));
 assert.equal((await db.query("select * from public.geomap_plans")).rows.length,1);
 assert.equal((await db.query("update public.geomap_plans set plan=$1 where project_id=$2 returning project_id",[JSON.stringify(draft(pa)),pa])).rows.length,0);
 await assert.rejects(db.query("update public.geomap_plans set owner_id=$1",[a]));await assert.rejects(db.query("update public.geomap_plans set plan='{}'::jsonb"));
 await identity(c);assert.equal((await db.query("select * from public.geomap_plans")).rows.length,0);
 await db.exec("reset role; set role anon");await assert.rejects(db.query("select * from public.geomap_plans"));
 }finally{await db.close()}
});
