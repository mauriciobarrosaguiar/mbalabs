"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, Save, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel";
type Props = { supabase: SupabaseClient; profile: { nome: string; papel: Role; escola_id: string } };
type Student = { id: string; nome: string; turma_id: string | null; turma?: { nome: string } | null };
type Occurrence = { id: string; aluno_id: string; categoria: string; prioridade: string; titulo: string; descricao: string; acao_tomada: string | null; visivel_responsavel: boolean; exige_ciencia: boolean; status: string; criado_em: string; aluno?: { nome: string } | null };
type Awareness = { ocorrencia_id: string; responsavel_id: string; ciente_em: string };
type AuthorizedPerson = { id: string; aluno_id: string; nome: string; parentesco: string | null; telefone: string | null; documento: string | null; observacao: string | null; ativo: boolean; aluno?: { nome: string } | null };
type Pickup = { id: string; aluno_id: string; tipo_saida: string; nome_pessoa: string; parentesco: string | null; motivo: string | null; observacao: string | null; retirado_em: string; aluno?: { nome: string } | null };
type PickupOption = { tipo_pessoa: "responsavel" | "pessoa_autorizada"; pessoa_id: string; nome: string; parentesco: string | null; telefone: string | null; documento: string | null };
type Tab = "ocorrencias" | "retiradas" | "autorizados";

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const area = `${field} min-h-24 resize-y`;
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 font-black text-white disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-50";

export default function StudentSafetyPanel({ supabase, profile }: Props) {
  const manager = ["admin_escola", "direcao", "coordenacao"].includes(profile.papel);
  const teacher = profile.papel === "professor";
  const guardian = profile.papel === "responsavel";
  const [tab, setTab] = useState<Tab>("ocorrencias");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [awareness, setAwareness] = useState<Awareness[]>([]);
  const [authorized, setAuthorized] = useState<AuthorizedPerson[]>([]);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [pickupOptions, setPickupOptions] = useState<PickupOption[]>([]);

  const [occForm, setOccForm] = useState({ aluno_id: "", categoria: "geral", prioridade: "normal", titulo: "", descricao: "", acao: "", visivel: true, ciencia: false });
  const [personForm, setPersonForm] = useState({ aluno_id: "", nome: "", parentesco: "", telefone: "", documento: "", observacao: "" });
  const [pickupForm, setPickupForm] = useState({ aluno_id: "", pessoa: "", tipo_saida: "antecipada", motivo: "", observacao: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data: auth } = await supabase.auth.getUser();
    setUserId(auth.user?.id || "");
    const requests = await Promise.all([
      supabase.from("escola_alunos").select("id,nome,turma_id,turma:escola_turmas(nome)").eq("ativo", true).order("nome"),
      supabase.from("escola_ocorrencias_aluno").select("id,aluno_id,categoria,prioridade,titulo,descricao,acao_tomada,visivel_responsavel,exige_ciencia,status,criado_em,aluno:escola_alunos(nome)").order("criado_em", { ascending: false }).limit(200),
      supabase.from("escola_ocorrencia_ciencias").select("ocorrencia_id,responsavel_id,ciente_em").order("ciente_em", { ascending: false }).limit(300),
      supabase.from("escola_pessoas_autorizadas").select("id,aluno_id,nome,parentesco,telefone,documento,observacao,ativo,aluno:escola_alunos(nome)").order("nome"),
      supabase.from("escola_retiradas_aluno").select("id,aluno_id,tipo_saida,nome_pessoa,parentesco,motivo,observacao,retirado_em,aluno:escola_alunos(nome)").order("retirado_em", { ascending: false }).limit(200)
    ]);
    const firstError = requests.find((r) => r.error)?.error;
    if (firstError) setError(firstError.message);
    setStudents((requests[0].data ?? []) as unknown as Student[]);
    setOccurrences((requests[1].data ?? []) as unknown as Occurrence[]);
    setAwareness((requests[2].data ?? []) as Awareness[]);
    setAuthorized((requests[3].data ?? []) as unknown as AuthorizedPerson[]);
    setPickups((requests[4].data ?? []) as unknown as Pickup[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const first = students[0]?.id || "";
    if (first && !occForm.aluno_id) setOccForm((v) => ({ ...v, aluno_id: first }));
    if (first && !personForm.aluno_id) setPersonForm((v) => ({ ...v, aluno_id: first }));
    if (first && !pickupForm.aluno_id) setPickupForm((v) => ({ ...v, aluno_id: first }));
  }, [students, occForm.aluno_id, personForm.aluno_id, pickupForm.aluno_id]);

  const loadPickupOptions = useCallback(async (studentId: string) => {
    if (!studentId || teacher) { setPickupOptions([]); return; }
    const { data, error: rpcError } = await supabase.rpc("escola_student_pickup_options", { p_aluno_id: studentId });
    if (rpcError) { setPickupOptions([]); return; }
    setPickupOptions((data ?? []) as PickupOption[]);
  }, [supabase, teacher]);

  useEffect(() => { void loadPickupOptions(pickupForm.aluno_id); }, [pickupForm.aluno_id, loadPickupOptions]);

  const awareIds = useMemo(() => new Set(awareness.filter((x) => x.responsavel_id === userId).map((x) => x.ocorrencia_id)), [awareness, userId]);
  const pendingAwareness = guardian ? occurrences.filter((x) => x.exige_ciencia && !awareIds.has(x.id)).length : 0;

  async function runRpc(name: string, args: Record<string, unknown>, success: string) {
    setWorking(true); setError(""); setMessage("");
    const { error: rpcError } = await supabase.rpc(name, args);
    if (rpcError) setError(rpcError.message);
    else { setMessage(success); await load(); }
    setWorking(false);
  }

  async function saveOccurrence(event: React.FormEvent) {
    event.preventDefault();
    await runRpc("escola_create_student_occurrence", {
      p_aluno_id: occForm.aluno_id, p_categoria: occForm.categoria, p_prioridade: occForm.prioridade,
      p_titulo: occForm.titulo, p_descricao: occForm.descricao, p_acao_tomada: occForm.acao || null,
      p_visivel_responsavel: occForm.visivel, p_exige_ciencia: occForm.ciencia
    }, occForm.ciencia ? "Ocorrência registrada e enviada ao responsável para ciência." : "Ocorrência registrada com sucesso.");
    setOccForm((v) => ({ ...v, titulo: "", descricao: "", acao: "" }));
  }

  async function acknowledge(id: string) {
    await runRpc("escola_ack_student_occurrence", { p_ocorrencia_id: id }, "Ciência registrada com data e horário.");
  }

  async function savePerson(event: React.FormEvent) {
    event.preventDefault();
    await runRpc("escola_manage_authorized_pickup_person", {
      p_id: null, p_aluno_id: personForm.aluno_id, p_nome: personForm.nome, p_parentesco: personForm.parentesco || null,
      p_telefone: personForm.telefone || null, p_documento: personForm.documento || null, p_observacao: personForm.observacao || null, p_ativo: true
    }, "Pessoa autorizada cadastrada para retirada do aluno.");
    setPersonForm((v) => ({ ...v, nome: "", parentesco: "", telefone: "", documento: "", observacao: "" }));
    await loadPickupOptions(personForm.aluno_id);
  }

  async function deactivatePerson(person: AuthorizedPerson) {
    await runRpc("escola_manage_authorized_pickup_person", {
      p_id: person.id, p_aluno_id: person.aluno_id, p_nome: person.nome, p_parentesco: person.parentesco,
      p_telefone: person.telefone, p_documento: person.documento, p_observacao: person.observacao, p_ativo: false
    }, "Autorização para retirada desativada.");
    await loadPickupOptions(pickupForm.aluno_id);
  }

  async function savePickup(event: React.FormEvent) {
    event.preventDefault();
    const [tipo, id] = pickupForm.pessoa.split(":");
    if (!tipo || !id) { setError("Selecione uma pessoa autorizada para buscar o aluno."); return; }
    await runRpc("escola_register_student_pickup", {
      p_aluno_id: pickupForm.aluno_id, p_tipo_saida: pickupForm.tipo_saida, p_tipo_pessoa: tipo,
      p_pessoa_id: id, p_motivo: pickupForm.motivo || null, p_observacao: pickupForm.observacao || null
    }, "Retirada registrada com segurança e adicionada à linha do tempo do aluno.");
    setPickupForm((v) => ({ ...v, pessoa: "", motivo: "", observacao: "" }));
  }

  if (loading) return <section className="grid min-h-48 place-items-center rounded-3xl border border-slate-200 bg-white"><LoaderCircle className="animate-spin text-[#176b5b]" size={30}/></section>;

  const tabs: Array<{ id: Tab; label: string }> = teacher
    ? [{ id: "ocorrencias", label: "Ocorrências" }]
    : [{ id: "ocorrencias", label: guardian && pendingAwareness ? `Ocorrências (${pendingAwareness})` : "Ocorrências" }, { id: "retiradas", label: "Retiradas" }, { id: "autorizados", label: "Pessoas autorizadas" }];

  return <section className="grid gap-5">
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.14em] text-[#176b5b]">Segurança do aluno</p>
      <h2 className="mt-1 text-2xl font-black">Ocorrências, saídas e pessoas autorizadas</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Registros protegidos por escola, turma, aluno e perfil de acesso.</p>
    </div>

    <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">{tabs.map((x) => <button type="button" key={x.id} onClick={() => setTab(x.id)} className={`rounded-xl px-4 py-2.5 text-sm font-black ${tab===x.id ? "bg-[#176b5b] text-white" : "text-slate-600 hover:bg-slate-50"}`}>{x.label}</button>)}</nav>
    {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div> : null}
    {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div> : null}

    {tab === "ocorrencias" ? <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
      {(manager || teacher) ? <Card title="Registrar ocorrência" icon={AlertTriangle}><form className="grid gap-3" onSubmit={saveOccurrence}>
        <select className={field} value={occForm.aluno_id} onChange={(e)=>setOccForm(v=>({...v,aluno_id:e.target.value}))}>{students.map(s=><option key={s.id} value={s.id}>{s.nome}{s.turma?.nome ? ` · ${s.turma.nome}` : ""}</option>)}</select>
        <div className="grid gap-3 sm:grid-cols-2"><select className={field} value={occForm.categoria} onChange={(e)=>setOccForm(v=>({...v,categoria:e.target.value}))}><option value="geral">Geral</option><option value="comportamento">Comportamento</option><option value="acidente">Acidente</option><option value="conflito">Conflito</option><option value="atendimento_coordenacao">Atendimento na coordenação</option><option value="disciplinar">Disciplinar</option><option value="outro">Outro</option></select><select className={field} value={occForm.prioridade} onChange={(e)=>setOccForm(v=>({...v,prioridade:e.target.value}))}><option value="normal">Normal</option><option value="importante">Importante</option><option value="urgente">Urgente</option></select></div>
        <input className={field} placeholder="Título da ocorrência" required value={occForm.titulo} onChange={(e)=>setOccForm(v=>({...v,titulo:e.target.value}))}/>
        <textarea className={area} placeholder="Descreva o que aconteceu" required value={occForm.descricao} onChange={(e)=>setOccForm(v=>({...v,descricao:e.target.value}))}/>
        <textarea className={area} placeholder="Ação tomada pela escola/professor (opcional)" value={occForm.acao} onChange={(e)=>setOccForm(v=>({...v,acao:e.target.value}))}/>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={occForm.visivel} onChange={(e)=>setOccForm(v=>({...v,visivel:e.target.checked,ciencia:e.target.checked ? v.ciencia : false}))}/> Visível para o responsável</label>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" disabled={!occForm.visivel} checked={occForm.ciencia} onChange={(e)=>setOccForm(v=>({...v,ciencia:e.target.checked}))}/> Exigir “Li e estou ciente”</label>
        <button className={primary} disabled={working || !occForm.aluno_id}><Save size={17}/> Registrar ocorrência</button>
      </form></Card> : <Card title={pendingAwareness ? `${pendingAwareness} ciência(s) pendente(s)` : "Ocorrências dos seus filhos"} icon={ShieldCheck}><p className="text-sm leading-6 text-slate-600">Ocorrências importantes aparecem aqui diretamente para o responsável.</p></Card>}

      <Card title="Histórico de ocorrências" icon={AlertTriangle}>{!occurrences.length ? <Empty text="Nenhuma ocorrência disponível."/> : <div className="grid gap-3">{occurrences.map(o=>{ const aware=awareIds.has(o.id); return <article key={o.id} className={`rounded-2xl border p-4 ${o.prioridade==='urgente'?'border-rose-300 bg-rose-50':o.prioridade==='importante'?'border-amber-200 bg-amber-50':'border-slate-200 bg-white'}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black">{o.titulo}</p><p className="mt-1 text-xs font-bold uppercase text-slate-500">{o.aluno?.nome} · {categoryLabel(o.categoria)}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black">{priorityLabel(o.prioridade)}</span></div><p className="mt-3 text-sm leading-6 text-slate-700">{o.descricao}</p>{o.acao_tomada?<p className="mt-2 rounded-xl bg-white/80 p-3 text-sm"><b>Ação tomada:</b> {o.acao_tomada}</p>:null}<p className="mt-3 text-xs font-bold text-slate-500">{formatDateTime(o.criado_em)}</p>{guardian && o.exige_ciencia ? aware ? <p className="mt-3 flex items-center gap-2 text-sm font-black text-emerald-700"><CheckCircle2 size={17}/> Ciência confirmada</p> : <button type="button" className={`${primary} mt-3`} disabled={working} onClick={()=>void acknowledge(o.id)}><CheckCircle2 size={17}/> Li e estou ciente</button> : null}</article>})}</div>}</Card>
    </div> : null}

    {tab === "retiradas" && !teacher ? <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
      {manager ? <Card title="Registrar retirada" icon={UserCheck}><form className="grid gap-3" onSubmit={savePickup}>
        <select className={field} value={pickupForm.aluno_id} onChange={(e)=>{setPickupForm(v=>({...v,aluno_id:e.target.value,pessoa:""})); void loadPickupOptions(e.target.value);}}>{students.map(s=><option key={s.id} value={s.id}>{s.nome}{s.turma?.nome?` · ${s.turma.nome}`:""}</option>)}</select>
        <select className={field} required value={pickupForm.pessoa} onChange={(e)=>setPickupForm(v=>({...v,pessoa:e.target.value}))}><option value="">Selecione quem está buscando</option>{pickupOptions.map(p=><option key={`${p.tipo_pessoa}:${p.pessoa_id}`} value={`${p.tipo_pessoa}:${p.pessoa_id}`}>{p.nome}{p.parentesco?` · ${p.parentesco}`:""}{p.documento?` · Doc. ${p.documento}`:""}</option>)}</select>
        {!pickupOptions.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Nenhuma pessoa autorizada disponível para este aluno. Cadastre/libere antes da retirada.</div>:null}
        <select className={field} value={pickupForm.tipo_saida} onChange={(e)=>setPickupForm(v=>({...v,tipo_saida:e.target.value}))}><option value="antecipada">Saída antecipada</option><option value="fim_periodo">Retirada no fim do período</option></select>
        <input className={field} placeholder="Motivo da saída (opcional)" value={pickupForm.motivo} onChange={(e)=>setPickupForm(v=>({...v,motivo:e.target.value}))}/>
        <textarea className={area} placeholder="Observação (opcional)" value={pickupForm.observacao} onChange={(e)=>setPickupForm(v=>({...v,observacao:e.target.value}))}/>
        <button className={primary} disabled={working || !pickupForm.pessoa}><UserCheck size={17}/> Confirmar retirada</button>
      </form></Card> : <Card title="Retiradas dos seus filhos" icon={UserCheck}><p className="text-sm leading-6 text-slate-600">Aqui ficam registradas as saídas antecipadas e quem buscou o aluno.</p></Card>}
      <Card title="Histórico de retiradas" icon={Clock3}>{!pickups.length?<Empty text="Nenhuma retirada registrada."/>:<div className="grid gap-3">{pickups.map(p=><article key={p.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-black">{p.aluno?.nome}</p><p className="mt-1 text-sm font-bold text-[#176b5b]">{p.tipo_saida==='antecipada'?'Saída antecipada':'Fim do período'}</p><p className="mt-2 text-sm text-slate-700">Retirado por <b>{p.nome_pessoa}</b>{p.parentesco?` (${p.parentesco})`:""}</p>{p.motivo?<p className="mt-1 text-sm text-slate-600">Motivo: {p.motivo}</p>:null}<p className="mt-2 text-xs font-bold text-slate-500">{formatDateTime(p.retirado_em)}</p></article>)}</div>}</Card>
    </div>:null}

    {tab === "autorizados" && !teacher ? <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
      {manager ? <Card title="Cadastrar pessoa autorizada" icon={UsersRound}><form className="grid gap-3" onSubmit={savePerson}><select className={field} value={personForm.aluno_id} onChange={(e)=>setPersonForm(v=>({...v,aluno_id:e.target.value}))}>{students.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select><input className={field} required placeholder="Nome completo" value={personForm.nome} onChange={(e)=>setPersonForm(v=>({...v,nome:e.target.value}))}/><div className="grid gap-3 sm:grid-cols-2"><input className={field} placeholder="Parentesco/vínculo" value={personForm.parentesco} onChange={(e)=>setPersonForm(v=>({...v,parentesco:e.target.value}))}/><input className={field} placeholder="Telefone" value={personForm.telefone} onChange={(e)=>setPersonForm(v=>({...v,telefone:e.target.value}))}/></div><input className={field} placeholder="Documento de identificação" value={personForm.documento} onChange={(e)=>setPersonForm(v=>({...v,documento:e.target.value}))}/><textarea className={area} placeholder="Observação (opcional)" value={personForm.observacao} onChange={(e)=>setPersonForm(v=>({...v,observacao:e.target.value}))}/><button className={primary} disabled={working}><Save size={17}/> Salvar autorização</button></form></Card> : <Card title="Quem pode buscar" icon={UsersRound}><p className="text-sm leading-6 text-slate-600">A escola mantém a relação das pessoas liberadas para retirar cada aluno.</p></Card>}
      <Card title="Pessoas cadastradas" icon={ShieldCheck}>{!authorized.filter(p=>p.ativo).length?<Empty text="Nenhuma pessoa adicional autorizada cadastrada."/>:<div className="grid gap-3">{authorized.filter(p=>p.ativo).map(p=><article key={p.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-black">{p.nome}</p><p className="mt-1 text-sm text-slate-500">{p.aluno?.nome}{p.parentesco?` · ${p.parentesco}`:""}</p>{p.telefone?<p className="mt-1 text-xs font-bold text-slate-500">{p.telefone}</p>:null}{p.documento?<p className="mt-1 text-xs text-slate-500">Documento: {p.documento}</p>:null}</div>{manager?<button type="button" className={secondary} disabled={working} onClick={()=>void deactivatePerson(p)}>Desativar</button>:null}</div></article>)}</div>}</Card>
    </div>:null}
  </section>;
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof ShieldCheck; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 flex items-center gap-2 text-lg font-black"><Icon className="text-[#176b5b]" size={21}/> {title}</h3>{children}</section>; }
function Empty({ text }: { text: string }) { return <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">{text}</p>; }
function categoryLabel(v:string){return ({geral:"Geral",comportamento:"Comportamento",acidente:"Acidente",conflito:"Conflito",atendimento_coordenacao:"Atendimento na coordenação",disciplinar:"Disciplinar",outro:"Outro"} as Record<string,string>)[v]||v;}
function priorityLabel(v:string){return ({normal:"Normal",importante:"Importante",urgente:"Urgente"} as Record<string,string>)[v]||v;}
function formatDateTime(value:string){try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Araguaina"}).format(new Date(value));}catch{return value;}}
