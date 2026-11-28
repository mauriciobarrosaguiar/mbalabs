import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {projectInputSchema,emptyProject} from "../src/app/apps/geomap/project-model.ts";
test("draft input accepts real data only and rejects injected ownership/status",()=>{
 const valid={...emptyProject,name:"Chácara",city:"Palmas"};
 assert.equal(projectInputSchema.safeParse(valid).success,true);
 for(const extra of [{owner_id:"someone"},{status:"completed"},{name:" "},{uf:"XX"},{date:"2026-02-30"}]){
 assert.equal(projectInputSchema.safeParse({...valid,...extra}).success,false);
 }
});
test("isolated database: only active admins can insert and read own drafts",async()=>{
 const db=new PGlite();
 const a="00000000-0000-4000-8000-000000000001",b="00000000-0000-4000-8000-000000000002",c="00000000-0000-4000-8000-000000000003",d="00000000-0000-4000-8000-000000000004";
 try{
 await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; create table public.core_usuarios(auth_user_id uuid,tipo_global text,tipo text,status text); grant select on public.core_usuarios to authenticated;");
 await db.query("insert into auth.users values ($1),($2),($3),($4)",[a,b,c,d]);
 await db.query("insert into public.core_usuarios values ($1,'admin_master',null,'ativo'),($2,'super_admin',null,'ativo'),($3,'usuario',null,'ativo'),($4,'admin_master',null,'inativo')",[a,b,c,d]);
 await db.exec(await readFile(new URL("../../../infra/geomap/db/projects-schema.sql",import.meta.url),"utf8"));
 async function identity(id){await db.exec("reset role; set role authenticated");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
 const insert=(id)=>db.query("insert into public.geomap_projects(owner_id,name,city,uf) values ($1,'Teste','Palmas','TO') returning id",[id]);
 await identity(a);await insert(a);await assert.rejects(insert(b));
 assert.equal((await db.query("select * from public.geomap_projects")).rows.length,1);
 await assert.rejects(db.query("update public.geomap_projects set name='X'"));await assert.rejects(db.query("delete from public.geomap_projects"));
 await identity(b);assert.equal((await db.query("select * from public.geomap_projects")).rows.length,0);await insert(b);
 await identity(c);assert.equal((await db.query("select * from public.geomap_projects")).rows.length,0);await assert.rejects(insert(c));
 await identity(d);assert.equal((await db.query("select * from public.geomap_projects")).rows.length,0);await assert.rejects(insert(d));
 await db.exec("reset role; set role anon");await assert.rejects(db.query("select * from public.geomap_projects"));
 }finally{await db.close()}
});
