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
type Employee = { id: string; nome: string; email: string; telefone?: string; perfil: string; status: string };
const endpoint = "/api/dronegestor/empresa/usuarios";
const roleLabel = (role: string) => role === "admin_empresa" ? "Administrador da empresa" : roles.find(([value]) => value === role)?.[1] || role;

export function DroneCompanyEmployees() {
  const [items, setItems] = useState<Employee[]>([]), [company, setCompany] = useState("");
  const [loading, setLoading] = useState(true), [ready, setReady] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const savingRef = useRef(false), formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  function edit(item: Employee) {
    if (savingRef.current) return;
    setEditing(item); setError(""); setMessage("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const protectedRole = editing && !roles.some(([value]) => value === editing.perfil);
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
    const createBody = { nome: String(fields.get("nome") || ""), email: String(fields.get("email") || ""), telefone: String(fields.get("telefone") || ""), perfil: String(fields.get("perfil") || ""), senhaAcesso: String(fields.get("senhaAcesso") || "") };
    const body = editing ? { id: editing.id, nome: createBody.nome, telefone: createBody.telefone, perfil: protectedRole ? editing.perfil : createBody.perfil } : createBody;
    savingRef.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(endpoint, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível cadastrar o funcionário.");
      form.reset(); setEditing(null); setMessage(editing ? "Funcionário atualizado. O e-mail, a senha e os acessos aos demais aplicativos foram preservados." : data.createdAccount ? "Funcionário cadastrado. Ele já pode entrar no DroneGestor com o e-mail e a senha inicial informados. Nenhum e-mail foi enviado." : "Acesso ao DroneGestor vinculado ao funcionário. A senha do acesso existente foi preservada.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao cadastrar funcionário."); }
    finally { const password = form.elements.namedItem("senhaAcesso"); if (password instanceof HTMLInputElement) password.value = ""; createBody.senhaAcesso = ""; savingRef.current = false; setSaving(false); }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing || !ready || savingRef.current) return;
    const form = event.currentTarget, fields = new FormData(form);
    const body = { action: "senha", id: editing.id, novaSenha: String(fields.get("novaSenha") || ""), confirmarSenha: String(fields.get("confirmarSenha") || "") };
    setError(""); setMessage("");
    if (!body.novaSenha && !body.confirmarSenha) { setMessage("Nenhuma nova senha informada. A senha atual foi mantida."); return; }
    if (body.novaSenha !== body.confirmarSenha) { setError("A confirmação da senha não confere."); form.reset(); body.novaSenha = ""; body.confirmarSenha = ""; return; }
    savingRef.current = true; setSaving(true);
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível alterar a senha.");
      setMessage(data.auditoriaPendente ? "Senha alterada. O registro final de auditoria está pendente de conferência pelo suporte." : "Senha alterada com sucesso. Use a nova senha no próximo login.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao alterar a senha."); }
    finally { form.reset(); body.novaSenha = ""; body.confirmarSenha = ""; savingRef.current = false; setSaving(false); }
  }
  const input = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3";
  return <main className="px-3 py-5 sm:px-6"><div className="mx-auto grid max-w-5xl gap-5">
    <header><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Administração da empresa</p><h1 className="mt-2 text-2xl font-black">Funcionários e acessos</h1><p className="mt-2 text-sm text-slate-600">{company || "Minha empresa"} · Cadastre sua equipe e defina o trabalho de cada pessoa no DroneGestor.</p><Link className="mt-3 inline-flex min-h-11 items-center font-bold text-emerald-800" href="/apps/dronegestor/equipe">Voltar à minha equipe</Link></header>
    <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">Os funcionários ficam vinculados à sua empresa. O administrador geral cadastra as empresas e libera o sistema; você cadastra a equipe. Novos administradores da empresa são definidos pelo gestor do sistema.</p>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-100 p-4 text-sm text-emerald-950">{message}</p>}
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-black">{editing ? `Editar funcionário: ${editing.nome}` : "Cadastrar funcionário"}</h2><p className="mt-2 text-sm text-slate-600">{editing ? "Corrija o nome, telefone e perfil. O e-mail é preservado. Para mudar a senha, use o formulário Nova senha abaixo. Perfis administrativos não podem ser trocados nesta tela." : "Use um e-mail exclusivo. Se já existir uma conta ativa nesta empresa, o vínculo preserva a senha atual."}</p>
      <form key={editing?.id || "new"} ref={formRef} onSubmit={save} className="mt-4"><fieldset disabled={!ready || loading || saving} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
        <label className="grid gap-1 text-sm font-bold">Nome completo<input className={input} name="nome" defaultValue={editing?.nome || ""} required maxLength={180} autoComplete="name"/></label>
        <label className="grid gap-1 text-sm font-bold">E-mail de acesso<input className={input} name="email" defaultValue={editing?.email || ""} readOnly={!!editing} type="email" required maxLength={180} autoComplete="off"/></label>
        <label className="grid gap-1 text-sm font-bold">Telefone (opcional)<input className={input} name="telefone" defaultValue={editing?.telefone || ""} type="tel" maxLength={40}/></label>
        <label className="grid gap-1 text-sm font-bold">Perfil no DroneGestor<select className={input} name="perfil" disabled={!!protectedRole} defaultValue={editing?.perfil || "piloto"}>{protectedRole && <option value={editing!.perfil}>{roleLabel(editing!.perfil)}</option>}{roles.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {!editing && <label className="grid gap-1 text-sm font-bold sm:col-span-2">Senha inicial (obrigatória para nova conta)<input className={input} name="senhaAcesso" type="password" minLength={8} maxLength={200} autoComplete="new-password"/><span className="text-xs font-normal text-slate-500">Mínimo de oito caracteres. A senha não aparece na lista de funcionários.</span></label>}
        <button className="min-h-12 rounded-xl bg-emerald-800 px-4 font-bold text-white disabled:opacity-50 sm:col-span-2" type="submit">{saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar funcionário"}</button>
      {editing && <button type="button" className="min-h-12 rounded-xl border px-4 font-bold sm:col-span-2" onClick={() => { setEditing(null); setError(""); setMessage(""); }}>Cancelar edição / Novo funcionário</button>}
      </fieldset></form>
    </section>
    {editing && <section className="rounded-2xl border bg-white p-5" aria-labelledby="employee-password-title">
      <h2 id="employee-password-title" className="text-lg font-black">Nova senha — {editing.nome}</h2>
      <p className="mt-2 text-sm text-slate-600">Preencha somente para alterar a senha. Deixar vazio mantém a senha atual. A senha é do login MBA Labs; acessos compartilhados com outros aplicativos ou administradores de outras pessoas exigem alteração pelo próprio titular.</p>
      <form key={editing.id} onSubmit={changePassword} className="mt-4"><fieldset disabled={!ready || loading || saving} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
        <label className="grid gap-1 text-sm font-bold">Nova senha<input className={input} name="novaSenha" type="password" minLength={8} maxLength={200} autoComplete="new-password"/><span className="text-xs font-normal text-slate-500">Mínimo de oito caracteres.</span></label>
        <label className="grid gap-1 text-sm font-bold">Confirmar nova senha<input className={input} name="confirmarSenha" type="password" minLength={8} maxLength={200} autoComplete="new-password"/></label>
        <button type="submit" className="min-h-12 rounded-xl bg-emerald-800 px-4 font-bold text-white disabled:opacity-50 sm:col-span-2">{saving ? "Salvando..." : "Alterar senha"}</button>
      </fieldset></form>
    </section>}
    <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black">Equipe da empresa</h2><button className="min-h-11 rounded-xl border px-4 font-bold" type="button" onClick={() => void load()} disabled={loading || saving}>Atualizar lista</button></div>{loading ? <p className="mt-4 text-sm">Consultando equipe...</p> : ready && !items.length ? <p className="mt-4 text-sm text-slate-500">Nenhum funcionário com acesso ao DroneGestor.</p> : <div className="mt-4 grid gap-3">{items.map(item => <button key={item.id} type="button" disabled={saving} onClick={() => edit(item)} aria-label={`Editar funcionário ${item.nome}`} className={`w-full rounded-xl border p-4 text-left hover:border-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-700 ${editing?.id === item.id ? "border-emerald-700 bg-emerald-50" : ""}`}><span className="block font-bold">{item.nome}</span><span className="mt-1 block break-all text-sm text-slate-600">{item.email}</span><span className="mt-2 block text-sm">{roleLabel(item.perfil)} · {item.status}</span><span className="mt-2 block text-sm font-bold text-emerald-800">Editar dados e perfil →</span></button>)}</div>}<p className="mt-4 text-xs text-slate-500">Até 500 vínculos consultados. A administração de acessos globais continua exclusiva do gestor do sistema.</p></section>
  </div></main>;
}
