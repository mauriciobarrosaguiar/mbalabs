"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

const roles = [
  ["gestor_operacional", "Gestor operacional"],
  ["responsavel_tecnico", "Responsável técnico"],
  ["piloto", "Piloto"],
  ["aplicador_caar", "Aplicador CAAR"],
  ["visualizador", "Visualizador"],
] as const;
type Employee = { id: string; nome: string; email: string; perfil: string; status: string };
const endpoint = "/api/dronegestor/empresa/usuarios";
const roleLabel = (role: string) => role === "admin_empresa" ? "Administrador da empresa" : roles.find(([value]) => value === role)?.[1] || role;

export function DroneCompanyEmployees() {
  const [items, setItems] = useState<Employee[]>([]), [company, setCompany] = useState("");
  const [loading, setLoading] = useState(true), [ready, setReady] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const savingRef = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setReady(false); setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível consultar a equipe.");
      setItems(data.items ?? []); setCompany(data.empresaNome || "Minha empresa"); setReady(true);
    } catch (e) { setItems([]); setError(e instanceof Error ? e.message : "Falha ao consultar a equipe."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!ready || savingRef.current) return;
    const form = event.currentTarget, fields = new FormData(form);
    // The initial password is sent only to the authenticated endpoint; never put it in storage, logs, or URLs.
    const body = { nome: String(fields.get("nome") || ""), email: String(fields.get("email") || ""), telefone: String(fields.get("telefone") || ""), perfil: String(fields.get("perfil") || ""), senhaAcesso: String(fields.get("senhaAcesso") || "") };
    savingRef.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível cadastrar o funcionário.");
      form.reset(); setMessage(data.createdAccount ? "Funcionário cadastrado. Ele já pode entrar no DroneGestor com o e-mail e a senha inicial informados. Nenhum e-mail foi enviado." : "Acesso ao DroneGestor vinculado ao funcionário. A senha do acesso existente foi preservada.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao cadastrar funcionário."); }
    finally { const password = form.elements.namedItem("senhaAcesso"); if (password instanceof HTMLInputElement) password.value = ""; body.senhaAcesso = ""; savingRef.current = false; setSaving(false); }
  }
  const input = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3";
  return <main className="px-3 py-5 sm:px-6"><div className="mx-auto grid max-w-5xl gap-5">
    <header><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Administração da empresa</p><h1 className="mt-2 text-2xl font-black">Funcionários e acessos</h1><p className="mt-2 text-sm text-slate-600">{company || "Minha empresa"} · Cadastre sua equipe e defina o trabalho de cada pessoa no DroneGestor.</p><Link className="mt-3 inline-flex min-h-11 items-center font-bold text-emerald-800" href="/apps/dronegestor/equipe">Voltar à minha equipe</Link></header>
    <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">Os funcionários ficam vinculados à sua empresa. O administrador geral cadastra as empresas e libera o sistema; você cadastra a equipe. Novos administradores da empresa são definidos pelo gestor do sistema.</p>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-100 p-4 text-sm text-emerald-950">{message}</p>}
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-black">Cadastrar funcionário</h2><p className="mt-2 text-sm text-slate-600">Use um e-mail exclusivo. Se já existir uma conta ativa nesta empresa, o vínculo preserva a senha atual.</p>
      <form onSubmit={save} className="mt-4"><fieldset disabled={!ready || loading || saving} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
        <label className="grid gap-1 text-sm font-bold">Nome completo<input className={input} name="nome" required maxLength={180} autoComplete="name"/></label>
        <label className="grid gap-1 text-sm font-bold">E-mail de acesso<input className={input} name="email" type="email" required maxLength={180} autoComplete="off"/></label>
        <label className="grid gap-1 text-sm font-bold">Telefone (opcional)<input className={input} name="telefone" type="tel" maxLength={40}/></label>
        <label className="grid gap-1 text-sm font-bold">Perfil no DroneGestor<select className={input} name="perfil" defaultValue="piloto">{roles.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold sm:col-span-2">Senha inicial (obrigatória para nova conta)<input className={input} name="senhaAcesso" type="password" minLength={8} maxLength={200} autoComplete="new-password"/><span className="text-xs font-normal text-slate-500">Mínimo de oito caracteres. A senha não aparece na lista de funcionários.</span></label>
        <button className="min-h-12 rounded-xl bg-emerald-800 px-4 font-bold text-white disabled:opacity-50 sm:col-span-2" type="submit">{saving ? "Cadastrando..." : "Cadastrar funcionário"}</button>
      </fieldset></form>
    </section>
    <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black">Equipe da empresa</h2><button className="min-h-11 rounded-xl border px-4 font-bold" type="button" onClick={() => void load()} disabled={loading || saving}>Atualizar lista</button></div>{loading ? <p className="mt-4 text-sm">Consultando equipe...</p> : ready && !items.length ? <p className="mt-4 text-sm text-slate-500">Nenhum funcionário com acesso ao DroneGestor.</p> : <div className="mt-4 grid gap-3">{items.map(item => <article key={item.id} className="rounded-xl border p-4"><h3 className="font-bold">{item.nome}</h3><p className="mt-1 break-all text-sm text-slate-600">{item.email}</p><p className="mt-2 text-sm">{roleLabel(item.perfil)} · {item.status}</p></article>)}</div>}<p className="mt-4 text-xs text-slate-500">Até 500 vínculos consultados. A administração de acessos globais continua exclusiva do gestor do sistema.</p></section>
  </div></main>;
}
