"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

type Company = { id: string; categoria_id: string; nome: string; nome_fantasia: string; razao_social: string; cnpj: string; telefone: string; whatsapp: string; email: string; cidade: string; estado: string; responsavel: string; observacoes: string; status: string };
type Contract = { empresa_id: string; status: string; data_inicio: string | null; data_vencimento: string | null };
type Administrator = { id: string; empresa_id: string; nome: string; email: string; status: string; acessoStatus: string };
type Data = { companies: Company[]; categories: {id: string; nome: string}[]; contracts: Contract[]; administrators: Administrator[] };
const empty: Data = { companies: [], categories: [], contracts: [], administrators: [] };
const endpoint = "/api/dronegestor/administracao";
const button = "inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const input = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm";
const statusLabel = (status: string) => ({ativo:"Liberado",teste:"Em teste",bloqueado:"Bloqueado",cancelado:"Cancelado"} as Record<string,string>)[status] || "Não liberado";

export function DroneSystemAdministration() {
  const [data, setData] = useState<Data>(empty), [selectedId, setSelectedId] = useState(""), [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true), [ready, setReady] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const busy = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setReady(false); setError("");
    try {
      const response = await fetch(endpoint, {cache:"no-store"}); const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível consultar as empresas.");
      setData(payload); setReady(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar as empresas."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const selected = data.companies.find(company => company.id === selectedId);
  const contract = data.contracts.find(item => item.empresa_id === selectedId);
  const administrators = data.administrators.filter(item => item.empresa_id === selectedId);
  const activeContract = Boolean(selected && ["ativa","ativo","teste"].includes(selected.status) && contract && ["ativo","teste"].includes(contract.status) && (!contract.data_vencimento || contract.data_vencimento >= new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo"}).format(new Date())));

  async function save(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); if (!ready || busy.current) return;
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries()) as Record<string, unknown>;
    payload.action = action;
    if (action === "empresa") payload.id = selectedId;
    else payload.empresaId = selectedId;
    busy.current = true; setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch(endpoint, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      if (action === "administrador") form.reset();
      setMessage(result.message || "Dados salvos."); await load();
      if (result.empresaId) setSelectedId(result.empresaId);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally {
      const password = form.elements.namedItem("senhaAcesso");
      if (password instanceof HTMLInputElement) password.value = "";
      payload.senhaAcesso = ""; busy.current = false; setSaving(false);
    }
  }
  function select(id: string) { setSelectedId(id); setMessage(""); setError(""); }
  const disabled = saving || loading || !ready;
  const filtered = data.companies.filter(company => `${company.nome_fantasia || company.nome} ${company.cnpj || ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  return <main className="px-3 py-5 sm:px-6"><div className="mx-auto grid max-w-6xl gap-5">
    <header><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Gestor do sistema</p><h1 className="mt-2 text-2xl font-black">Administração do DroneGestor</h1><p className="mt-2 text-sm text-slate-600">Cadastre empresas, libere o acesso e crie o administrador de cada uma, tudo aqui no DroneGestor.</p><Link className="mt-2 inline-flex min-h-11 items-center font-bold text-emerald-800" href="/apps/dronegestor">Voltar ao DroneGestor</Link></header>
    {message && <p role="status" className="rounded-xl bg-emerald-100 p-4 text-sm font-bold text-emerald-950">{message}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black">Empresas</h2><div className="flex flex-wrap gap-2"><button className={button} type="button" disabled={disabled} onClick={() => select("")}>Nova empresa</button><button className="min-h-12 rounded-xl border px-4 text-sm font-bold" type="button" disabled={saving || loading} onClick={() => void load()}>Atualizar lista</button></div></div>
      <label className="mt-4 grid gap-1 text-sm font-bold">Buscar empresa<input type="search" className={input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou CNPJ"/></label>
      {loading ? <p className="mt-4 text-sm">Consultando empresas...</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{filtered.map(company => { const access = data.contracts.find(c => c.empresa_id === company.id); return <button type="button" disabled={saving} key={company.id} aria-pressed={selectedId === company.id} onClick={() => select(company.id)} className={`min-h-24 rounded-xl border p-4 text-left ${selectedId === company.id ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white"}`}><strong className="block">{company.nome_fantasia || company.nome}</strong><span className="mt-1 block text-sm text-slate-600">DroneGestor: {statusLabel(access?.status || "")}</span>{access?.data_vencimento && <span className="mt-1 block text-xs text-slate-500">Validade: {access.data_vencimento}</span>}</button>; })}</div>}
      {!loading && ready && !filtered.length && <p className="mt-4 text-sm text-slate-500">Nenhuma empresa encontrada.</p>}
      <p className="mt-4 text-xs text-slate-500">Até 500 empresas consultadas. Selecione uma empresa existente para editar ou liberar o acesso, evitando duplicidade.</p>
    </section>

    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-black">1. {selected ? `Editar empresa: ${selected.nome_fantasia || selected.nome}` : "Cadastrar empresa"}</h2>
      <form key={`company-${selectedId}`} onSubmit={e => void save(e,"empresa")} className="mt-4"><fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
        <Field label="Nome da empresa"><input className={input} name="nome_fantasia" required maxLength={180} defaultValue={selected?.nome_fantasia || selected?.nome || ""}/></Field>
        <Field label="Categoria"><select className={input} name="categoria_id" required defaultValue={selected?.categoria_id || ""}><option value="" disabled>Selecione...</option>{data.categories.map(category => <option key={category.id} value={category.id}>{category.nome}</option>)}</select></Field>
        <Field label="Razão social (opcional)"><input className={input} name="razao_social" maxLength={180} defaultValue={selected?.razao_social || ""}/></Field>
        <Field label="CNPJ (opcional)"><input className={input} name="cnpj" inputMode="numeric" maxLength={18} defaultValue={selected?.cnpj || ""}/></Field>
        <Field label="Responsável"><input className={input} name="responsavel" maxLength={180} defaultValue={selected?.responsavel || ""}/></Field>
        <Field label="E-mail da empresa"><input className={input} name="email" type="email" maxLength={180} defaultValue={selected?.email || ""}/></Field>
        <Field label="Telefone"><input className={input} name="telefone" type="tel" maxLength={40} defaultValue={selected?.telefone || ""}/></Field>
        <Field label="WhatsApp"><input className={input} name="whatsapp" type="tel" maxLength={40} defaultValue={selected?.whatsapp || ""}/></Field>
        <Field label="Cidade"><input className={input} name="cidade" maxLength={100} defaultValue={selected?.cidade || ""}/></Field>
        <Field label="UF"><input className={input} name="estado" maxLength={2} defaultValue={selected?.estado || ""}/></Field>
        <label className="grid gap-1 text-sm font-bold sm:col-span-2">Observações<textarea name="observacoes" rows={3} maxLength={1000} className="rounded-xl border p-3" defaultValue={selected?.observacoes || ""}/></label>
        <button className={`${button} sm:col-span-2`} type="submit">{saving ? "Salvando..." : selected ? "Salvar dados da empresa" : "Cadastrar empresa no DroneGestor"}</button>
      </fieldset></form>
    </section>

    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-black">2. Acesso ao DroneGestor</h2>{!selected ? <p className="mt-3 text-sm text-slate-600">Cadastre ou selecione uma empresa acima.</p> : <form key={`contract-${selectedId}-${contract?.status}-${contract?.data_vencimento}`} onSubmit={e => void save(e,"acesso")} className="mt-4"><fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
      <Field label="Situação do acesso"><select name="status" className={input} defaultValue={contract?.status || "ativo"}><option value="ativo">Liberado</option><option value="teste">Em teste</option><option value="bloqueado">Bloqueado</option><option value="cancelado">Cancelado</option></select></Field>
      <Field label="Início"><input type="date" name="data_inicio" className={input} defaultValue={contract?.data_inicio || new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo"}).format(new Date())}/></Field>
      <Field label="Vencimento (opcional)"><input type="date" name="data_vencimento" className={input} defaultValue={contract?.data_vencimento || ""}/></Field>
      <button type="submit" className={`${button} self-end`}>{saving ? "Salvando..." : "Salvar acesso ao DroneGestor"}</button>
      <p className="text-xs text-slate-500 sm:col-span-2">Esta configuração altera apenas o vínculo com o DroneGestor. Os demais aplicativos e o plano atual são preservados.</p>
    </fieldset></form>}</section>

    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-black">3. Administradores da empresa</h2>{!selected ? <p className="mt-3 text-sm text-slate-600">Selecione a empresa acima.</p> : <>
      <div className="mt-4 grid gap-3">{administrators.map(user => <article key={user.id} className="rounded-xl border bg-emerald-50 p-4"><strong className="block">{user.nome}</strong><span className="mt-1 block break-all text-sm">{user.email}</span><span className="mt-1 block text-xs">Administrador da empresa · {user.acessoStatus === "ativo" && user.status === "ativo" ? "Ativo" : "Inativo"}</span></article>)}</div>
      {!administrators.length && <p className="mt-3 text-sm text-slate-600">Nenhum administrador do DroneGestor cadastrado nesta empresa.</p>}
      {!activeContract && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Libere o acesso ao DroneGestor na etapa 2 antes de cadastrar o administrador.</p>}
      <p className="mt-4 text-sm text-slate-600">O administrador cadastra os funcionários pelo próprio DroneGestor. Se a conta já aparece acima, ela já está cadastrada e pode ser utilizada.</p>
      <form key={`admin-${selectedId}`} onSubmit={e => void save(e,"administrador")} className="mt-4"><fieldset disabled={disabled || !activeContract} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
        <Field label="Nome completo"><input className={input} name="nome" required maxLength={180}/></Field>
        <Field label="E-mail de acesso"><input className={input} name="email" type="email" required maxLength={180}/></Field>
        <Field label="Telefone (opcional)"><input className={input} name="telefone" type="tel" maxLength={40}/></Field>
        <Field label="Senha inicial"><input className={input} name="senhaAcesso" type="password" minLength={8} maxLength={200} autoComplete="new-password"/></Field>
        <p className="text-xs text-slate-500 sm:col-span-2">Senha de ao menos oito caracteres para novas contas. Contas existentes da mesma empresa preservam sua senha. Este cadastro não concede administração geral da plataforma.</p>
        <button className={`${button} sm:col-span-2`} type="submit">{saving ? "Cadastrando..." : "Cadastrar administrador no DroneGestor"}</button>
      </fieldset></form>
    </>}</section>
  </div></main>;
}
function Field({label,children}:{label:string;children:ReactNode}) { return <label className="grid gap-1 text-sm font-bold">{label}{children}</label>; }
