import Link from "next/link";
import { redirect } from "next/navigation";
import { saveAdminResource } from "@/lib/actions/admin-actions";
import { getCurrentUserProfile } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function DroneSystemAdministration() {
  const current = await getCurrentUserProfile("/apps/dronegestor/administracao");
  if (!current.isAdminMaster || current.usuario.status !== "ativo") redirect("/apps/dronegestor");
  const client = await getSupabaseServer() as any;
  const app = await client.from("core_apps").select("id").eq("slug", "dronegestor").maybeSingle();
  const companies = await client.from("core_empresas").select("id,nome,nome_fantasia,status").order("created_at", { ascending: false }).limit(500);
  const contracts = app.data ? await client.from("core_empresa_apps").select("empresa_id,status,data_vencimento").eq("app_id", app.data.id).limit(500) : { data: [], error: app.error };
  const byCompany = new Map((contracts.data ?? []).map((row: any) => [row.empresa_id, row]));
  const failed = app.error || companies.error || contracts.error;
  const action = "inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-900";
  return <main className="px-3 py-5 sm:px-6"><div className="mx-auto grid max-w-6xl gap-5">
    <header><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Gestor do sistema</p><h1 className="mt-2 text-2xl font-black">Administração do DroneGestor</h1><p className="mt-2 text-sm text-slate-600">Cadastre as empresas e libere o acesso. Cada empresa cadastra seus próprios funcionários.</p></header>
    <section className="grid gap-3 md:grid-cols-3" aria-label="Etapas do cadastro de empresas">
      <article className="rounded-2xl border bg-white p-5"><h2 className="font-black">1. Cadastrar empresa</h2><p className="my-3 text-sm text-slate-600">Use o cadastro central da MBA Labs para evitar empresas duplicadas.</p><Link className={action} href="/admin/empresas#cadastro-admin">Cadastrar empresa</Link></article>
      <article className="rounded-2xl border bg-white p-5"><h2 className="font-black">2. Liberar o DroneGestor</h2><p className="my-3 text-sm text-slate-600">Na empresa abaixo, abra os aplicativos e defina o vínculo e a validade.</p><Link className={action} href="/admin/empresas">Gerenciar empresas</Link></article>
      <article className="rounded-2xl border bg-white p-5"><h2 className="font-black">3. Criar o administrador da empresa</h2><p className="my-3 text-sm text-slate-600">Vincule o primeiro usuário à empresa, com perfil Admin da empresa no DroneGestor. Ele cadastrará a equipe.</p><Link className={action} href="#administrador-empresa">Cadastrar administrador</Link></article>
    </section>
    {failed && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">Não foi possível consultar todas as empresas e liberações. Atualize a página antes de tomar decisões.</p>}
    {app.data && <section id="administrador-empresa" className="scroll-mt-4 rounded-2xl border bg-white p-5"><h2 className="text-lg font-black">Administrador da empresa</h2><p className="mt-2 text-sm text-slate-600">Crie o primeiro acesso da empresa. Esta conta administra a equipe no DroneGestor e não recebe acesso à administração geral da MBA Labs.</p><form action={saveAdminResource} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input name="resource" type="hidden" value="usuarios"/><input name="tipo" type="hidden" value="usuario"/><input name="status" type="hidden" value="ativo"/><input name="app_id" type="hidden" value={app.data.id}/><input name="perfil_app" type="hidden" value="admin_empresa"/>
      <label className="grid gap-1 text-sm font-bold sm:col-span-2">Empresa<select required name="empresa_id" defaultValue="" className="min-h-12 rounded-xl border px-3"><option value="" disabled>Selecione uma empresa com o DroneGestor liberado</option>{(companies.data ?? []).filter((company: any) => { const contract = byCompany.get(company.id) as any; return ["ativo", "teste"].includes(contract?.status); }).map((company: any) => <option key={company.id} value={company.id}>{company.nome_fantasia || company.nome}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-bold">Nome completo<input required name="nome" maxLength={180} className="min-h-12 rounded-xl border px-3"/></label>
      <label className="grid gap-1 text-sm font-bold">E-mail de acesso<input required name="email" type="email" maxLength={180} className="min-h-12 rounded-xl border px-3"/></label>
      <label className="grid gap-1 text-sm font-bold">Telefone (opcional)<input name="telefone" type="tel" className="min-h-12 rounded-xl border px-3"/></label>
      <label className="grid gap-1 text-sm font-bold">Senha inicial<input required name="senha_provisoria" type="password" minLength={8} maxLength={200} autoComplete="new-password" className="min-h-12 rounded-xl border px-3"/></label>
      <button className="min-h-12 rounded-xl bg-emerald-800 px-4 font-bold text-white sm:col-span-2" type="submit">Cadastrar administrador desta empresa</button>
    </form></section>}
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-black">Empresas cadastradas na MBA Labs</h2><p className="mt-1 text-sm text-slate-500">Até 500 empresas. A situação abaixo mostra o vínculo cadastrado; validade e situação da empresa também são verificadas no acesso.</p><div className="mt-4 grid gap-3">{(companies.data ?? []).map((company: any) => { const contract = byCompany.get(company.id) as any; return <article key={company.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><h3 className="font-bold">{company.nome_fantasia || company.nome}</h3><p className="mt-1 text-sm text-slate-600">Empresa: {company.status} · DroneGestor: {contract?.status || "Sem vínculo"}{contract?.data_vencimento ? ` · Validade: ${contract.data_vencimento}` : ""}</p></div><div className="flex flex-wrap gap-2"><Link className={action} href={`/admin/empresas?edit=${encodeURIComponent(company.id)}`}>Editar empresa</Link><Link className={action} href={`/admin/empresas/${encodeURIComponent(company.id)}/apps`}>Liberar / configurar aplicativos</Link></div></article>; })}</div>{!failed && !companies.data?.length && <p className="mt-4 text-sm text-slate-500">Nenhuma empresa cadastrada.</p>}</section>
  </div></main>;
}
