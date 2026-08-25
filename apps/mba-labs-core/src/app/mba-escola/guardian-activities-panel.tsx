"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckCircle2, ClipboardList, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = { supabase: SupabaseClient; profile: { nome: string; papel: "responsavel"; escola_id: string } };
type Child = { id: string; nome: string; turma_id: string | null; turma?: { nome: string } | null };
type ChildLink = { aluno_id: string; aluno: Child | null };
type Activity = { id: string; turma_id: string; titulo: string; descricao: string; data_entrega: string | null; status: string; turma?: { nome: string } | null };
type Delivery = { atividade_id: string; aluno_id: string; situacao: string; entregue_em: string | null; comentario_professor: string | null };

export default function GuardianActivitiesPanel({ supabase }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id || "";
    if (!userId) { setLoading(false); return; }
    const [linkResult, activityResult, deliveryResult] = await Promise.all([
      supabase.from("escola_aluno_responsaveis").select("aluno_id,aluno:escola_alunos(id,nome,turma_id,turma:escola_turmas(nome))").eq("responsavel_id", userId),
      supabase.from("escola_atividades").select("id,turma_id,titulo,descricao,data_entrega,status,turma:escola_turmas(nome)").eq("status", "publicada").order("criado_em", { ascending: false }).limit(100),
      supabase.from("escola_atividade_entregas").select("atividade_id,aluno_id,situacao,entregue_em,comentario_professor")
    ]);
    const firstError = linkResult.error || activityResult.error || deliveryResult.error;
    if (firstError) setError(firstError.message);
    const links = (linkResult.data ?? []) as unknown as ChildLink[];
    setChildren(links.map(item => item.aluno).filter(Boolean) as Child[]);
    setActivities((activityResult.data ?? []) as unknown as Activity[]);
    setDeliveries((deliveryResult.data ?? []) as Delivery[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => children.flatMap(child => activities
    .filter(activity => activity.turma_id === child.turma_id)
    .map(activity => ({ child, activity, delivery: deliveries.find(item => item.atividade_id === activity.id && item.aluno_id === child.id) }))), [children, activities, deliveries]);

  if (loading) return <section className="grid min-h-40 place-items-center rounded-3xl border border-slate-200 bg-white"><LoaderCircle className="animate-spin text-[#176b5b]" size={28}/></section>;

  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#176b5b]"><ClipboardList size={20}/></div><div><h3 className="text-xl font-black">Atividades dos meus filhos</h3><p className="mt-1 text-sm text-slate-500">Atividades publicadas pela escola e situação de entrega de cada filho.</p></div></div>
    {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}
    {!rows.length ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhuma atividade publicada para as turmas dos seus filhos.</p> : <div className="mt-5 grid gap-3">{rows.map(({ child, activity, delivery }) => <article className="rounded-2xl border border-slate-200 p-4" key={`${activity.id}-${child.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{activity.titulo}</p><p className="mt-1 text-xs font-bold text-[#176b5b]">{child.nome} · {child.turma?.nome || "Turma"}{activity.data_entrega ? ` · até ${date(activity.data_entrega)}` : ""}</p></div><Status status={delivery?.situacao || "pendente"}/></div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{activity.descricao}</p>
      {delivery?.comentario_professor ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><b>Professor:</b> {delivery.comentario_professor}</p> : null}
    </article>)}</div>}
  </section>;
}

function Status({ status }: { status: string }) {
  const label = status === "entregue" ? "Entregue" : status === "atrasada" ? "Atrasada" : status === "nao_entregue" ? "Não entregue" : "Pendente";
  const tone = status === "entregue" ? "bg-emerald-100 text-emerald-800" : status === "pendente" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${tone}`}>{status === "entregue" ? <CheckCircle2 size={13}/> : null}{label}</span>;
}
function date(value: string) { const [year, month, day] = value.slice(0, 10).split("-"); return `${day}/${month}/${year}`; }
