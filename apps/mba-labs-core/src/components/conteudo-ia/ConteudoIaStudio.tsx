"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes
} from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  Clipboard,
  LoaderCircle,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  Video,
  WandSparkles
} from "lucide-react";
import type {
  ConteudoIaGeneratedPlan,
  ConteudoIaProfileInput,
  ConteudoIaProfileResponse
} from "@/lib/conteudo-ia-types";

const emptyProfile: ConteudoIaProfileInput = {
  marcaId: null,
  perfilId: null,
  marcaNome: "",
  tiktokUsername: "",
  profileUrl: "",
  nicho: "",
  subnicho: "",
  publicoAlvo: "",
  objetivo: "Aumentar alcance, relacionamento e oportunidades de venda",
  tomVoz: "Prático, próximo, confiável e fácil de entender",
  cidadeRegiao: "",
  frequencia: "semanal",
  postsPorPeriodo: 5,
  pilares: ["Educação", "Dicas práticas", "Bastidores", "Autoridade", "Oferta"]
};

export function ConteudoIaStudio({ userName }: { userName: string }) {
  const [profile, setProfile] = useState<ConteudoIaProfileInput>(emptyProfile);
  const [pillarsText, setPillarsText] = useState(emptyProfile.pilares.join(", "));
  const [integrations, setIntegrations] = useState({ openaiConfigured: false, tiktokConfigured: false });
  const [plan, setPlan] = useState<ConteudoIaGeneratedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/conteudo-ia/perfil", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as ConteudoIaProfileResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar o perfil.");
        return data;
      })
      .then((data) => {
        if (!active) return;
        if (data.profile) {
          setProfile(data.profile);
          setPillarsText(data.profile.pilares.join(", "));
        }
        setIntegrations(data.integrations);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Erro ao carregar o módulo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const completion = useMemo(() => {
    const values = [profile.marcaNome, profile.tiktokUsername, profile.nicho, profile.publicoAlvo, profile.objetivo, profile.tomVoz, pillarsText];
    return Math.round((values.filter((value) => value.trim()).length / values.length) * 100);
  }, [pillarsText, profile]);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setProfile((current) => ({
      ...current,
      [name]: name === "postsPorPeriodo" ? Number(value) : value
    }));
  }

  function payload(): ConteudoIaProfileInput {
    return {
      ...profile,
      tiktokUsername: profile.tiktokUsername.trim().replace(/^@/, ""),
      postsPorPeriodo: Math.min(14, Math.max(1, Number(profile.postsPorPeriodo) || 1)),
      pilares: pillarsText.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8)
    };
  }

  async function saveProfile(showSuccess = true) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/conteudo-ia/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload())
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o DNA do perfil.");

      setProfile(data.profile);
      setPillarsText(data.profile.pilares.join(", "));
      if (showSuccess) setMessage("DNA do perfil salvo com sucesso.");
      return data.profile as ConteudoIaProfileInput;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar o perfil.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function generatePlan() {
    setGenerating(true);
    setError(null);
    setMessage(null);

    try {
      const saved = await saveProfile(false);
      if (!saved?.marcaId) return;

      const response = await fetch("/api/conteudo-ia/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saved)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível gerar o conteúdo.");

      setPlan(data.plan);
      setMessage(`${data.plan.contents.length} conteúdos foram criados para o TikTok.`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Erro ao gerar conteúdos.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyContent(index: number) {
    const item = plan?.contents[index];
    if (!item) return;

    await navigator.clipboard.writeText([
      item.title,
      "",
      `Gancho: ${item.hook}`,
      "",
      `Roteiro:\n${item.script}`,
      "",
      item.caption,
      "",
      item.hashtags.join(" ")
    ].join("\n"));

    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 1800);
  }

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="grid gap-6 pb-12">
      <section className="overflow-hidden rounded-3xl border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,27,75,0.96))] p-6 shadow-2xl shadow-fuchsia-950/20 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-100">
              <WandSparkles size={14} /> Fase 1 · TikTok
            </div>
            <div>
              <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white md:text-5xl">Conteúdo digital organizado, estratégico e pronto para gravar.</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 md:text-lg">Olá, {userName}. Cadastre o DNA da página e gere o planejamento vertical do TikTok.</p>
            </div>
          </div>
          <PrimaryButton loading={generating} disabled={generating || saving} onClick={generatePlan} />
        </div>
      </section>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard icon={<Video size={20} />} title="TikTok" status={integrations.tiktokConfigured ? "Pronto para OAuth" : "Cadastro manual"} description={integrations.tiktokConfigured ? "Credenciais localizadas. A autorização oficial entra na próxima etapa." : "Nesta fase usamos o usuário e o link do perfil."} />
        <StatusCard icon={<Sparkles size={20} />} title="Inteligência artificial" status={integrations.openaiConfigured ? "Ativa" : "Aguardando chave"} description={integrations.openaiConfigured ? "Estratégia, roteiros, legendas e hashtags liberados." : "Configure OPENAI_API_KEY na Vercel para gerar os conteúdos."} />
        <StatusCard icon={<Target size={20} />} title="DNA do perfil" status={`${completion}% preenchido`} description="Quanto mais completo, mais específico fica o planejamento." />
      </section>

      <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <ProfilePanel
          profile={profile}
          pillarsText={pillarsText}
          saving={saving}
          generating={generating}
          onChange={updateField}
          onPillarsChange={setPillarsText}
          onSave={() => saveProfile(true)}
        />

        <section className="grid min-w-0 gap-5">
          {!plan ? <EmptyCalendar /> : (
            <>
              <div className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/[0.07] p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">Estratégia gerada</p>
                    <h2 className="mt-2 text-2xl font-black text-white">Plano de conteúdo TikTok</h2>
                  </div>
                  <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10" type="button" onClick={generatePlan} disabled={generating}>
                    <RefreshCw className={generating ? "animate-spin" : ""} size={16} /> Nova versão
                  </button>
                </div>
                <p className="mt-4 leading-7 text-slate-200">{plan.strategySummary}</p>
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Leitura do público</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{plan.audienceInsight}</p>
                </div>
              </div>

              <div className="grid gap-4">
                {plan.contents.map((item, index) => (
                  <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-6" key={`${item.date}-${item.title}-${index}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{item.day} · {formatDate(item.date)} · {formatName(item.format)} · {item.durationSeconds}s</p>
                        <h3 className="mt-3 text-xl font-black text-white md:text-2xl">{item.title}</h3>
                        <p className="mt-2 text-sm font-bold text-fuchsia-200">{item.theme}</p>
                      </div>
                      <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10" type="button" onClick={() => copyContent(index)}>
                        {copiedIndex === index ? <Check size={16} /> : <Clipboard size={16} />}
                        {copiedIndex === index ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <ContentBlock label="Gancho inicial" content={item.hook} />
                      <ContentBlock label="Objetivo" content={item.objective} />
                      <ContentBlock label="Roteiro" content={item.script} large />
                      <ContentBlock label="Legenda" content={item.caption} large />
                      <ContentBlock label="Briefing visual" content={`${item.visualBrief}\n\nFormato: ${item.width} × ${item.height}`} />
                      <ContentBlock label="Chamada para ação" content={item.callToAction} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.hashtags.map((hashtag) => <span className="rounded-full border border-fuchsia-300/15 bg-fuchsia-400/10 px-3 py-1 text-xs font-bold text-fuchsia-100" key={hashtag}>{hashtag.startsWith("#") ? hashtag : `#${hashtag}`}</span>)}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ProfilePanel({ profile, pillarsText, saving, generating, onChange, onPillarsChange, onSave }: {
  profile: ConteudoIaProfileInput;
  pillarsText: string;
  saving: boolean;
  generating: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onPillarsChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="h-fit rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">Configuração</p><h2 className="mt-2 text-2xl font-black text-white">DNA do perfil</h2></div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">TikTok</span>
      </div>
      <div className="grid gap-4">
        <Field label="Nome da marca ou página" name="marcaNome" value={profile.marcaNome} onChange={onChange} placeholder="Ex.: Chácara Flor da Dona Mariquinha" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Field label="Usuário do TikTok" name="tiktokUsername" value={profile.tiktokUsername} onChange={onChange} placeholder="@seuperfil" />
          <Field label="Cidade ou região" name="cidadeRegiao" value={profile.cidadeRegiao} onChange={onChange} placeholder="Palmas e região" />
        </div>
        <Field label="Link do perfil" name="profileUrl" value={profile.profileUrl} onChange={onChange} placeholder="https://www.tiktok.com/@..." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Field label="Nicho" name="nicho" value={profile.nicho} onChange={onChange} placeholder="Agro, saúde, vendas..." />
          <Field label="Subnicho" name="subnicho" value={profile.subnicho} onChange={onChange} placeholder="Galinhas, ovos caipiras..." />
        </div>
        <TextArea label="Público-alvo" name="publicoAlvo" value={profile.publicoAlvo} onChange={onChange} placeholder="Quem deve assistir e quais dores esse público possui?" />
        <TextArea label="Objetivo do perfil" name="objetivo" value={profile.objetivo} onChange={onChange} />
        <TextArea label="Tom de voz" name="tomVoz" value={profile.tomVoz} onChange={onChange} />
        <TextArea label="Pilares de conteúdo" value={pillarsText} onChange={(event) => onPillarsChange(event.target.value)} placeholder="Separe por vírgulas" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-slate-200">Frequência<select className={controlClass} name="frequencia" value={profile.frequencia} onChange={onChange}><option value="semanal">Semanal</option><option value="diaria">Diária</option></select></label>
          <label className="grid gap-2 text-sm font-bold text-slate-200">Quantidade de conteúdos<input className={controlClass} min={1} max={14} name="postsPorPeriodo" type="number" value={profile.postsPorPeriodo} onChange={onChange} /></label>
        </div>
        <button className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={onSave} disabled={saving || generating}>
          {saving ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />} Salvar DNA do perfil
        </button>
      </div>
    </section>
  );
}

const controlClass = "min-h-12 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none transition placeholder:text-slate-600 focus:border-fuchsia-400";

function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="grid gap-2 text-sm font-bold text-slate-200">{label}<input className={controlClass} {...props} /></label>; }
function TextArea({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) { return <label className="grid gap-2 text-sm font-bold text-slate-200">{label}<textarea className={`${controlClass} min-h-24 resize-y py-3`} {...props} /></label>; }
function StatusCard({ icon, title, status, description }: { icon: ReactNode; title: string; status: string; description: string }) { return <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white/10 text-fuchsia-200">{icon}</span><div><p className="text-sm font-black text-white">{title}</p><p className="text-xs font-bold text-fuchsia-200">{status}</p></div></div><p className="mt-4 text-sm leading-6 text-slate-300">{description}</p></article>; }
function ContentBlock({ label, content, large = false }: { label: string; content: string; large?: boolean }) { return <div className={`rounded-2xl border border-white/10 bg-slate-950/35 p-4 ${large ? "lg:col-span-2" : ""}`}><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-200">{content}</p></div>; }
function PrimaryButton({ loading, disabled, onClick }: { loading: boolean; disabled: boolean; onClick: () => void }) { return <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-fuchsia-500 px-5 py-3 font-black text-white shadow-lg shadow-fuchsia-950/30 transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={onClick} disabled={disabled}>{loading ? <LoaderCircle className="animate-spin" size={19} /> : <Sparkles size={19} />}{loading ? "Gerando..." : "Gerar conteúdo"}</button>; }
function LoadingState() { return <div className="grid min-h-[420px] place-items-center rounded-3xl border border-white/10 bg-white/[0.04]"><div className="flex items-center gap-3 text-slate-300"><LoaderCircle className="animate-spin" size={22} />Carregando MBA Conteúdo IA...</div></div>; }
function EmptyCalendar() { return <div className="grid min-h-[520px] place-items-center rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center"><div className="max-w-xl"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-fuchsia-400/10 text-fuchsia-200"><CalendarDays size={30} /></span><h2 className="mt-5 text-2xl font-black text-white">Seu calendário aparecerá aqui</h2><p className="mt-3 leading-7 text-slate-300">Preencha o DNA e gere temas, ganchos, roteiros, legendas, hashtags e briefing visual em 1080 × 1920.</p><div className="mt-6 grid gap-3 text-left sm:grid-cols-3"><MiniFeature icon={<BarChart3 size={17} />} text="Estratégia" /><MiniFeature icon={<Video size={17} />} text="TikTok 9:16" /><MiniFeature icon={<WandSparkles size={17} />} text="Conteúdo pronto" /></div></div></div>; }
function MiniFeature({ icon, text }: { icon: ReactNode; text: string }) { return <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-slate-200"><span className="text-fuchsia-200">{icon}</span>{text}</div>; }
function Notice({ tone, children }: { tone: "success" | "error"; children: ReactNode }) { return <div className={`rounded-2xl border p-4 text-sm leading-6 ${tone === "success" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-red-400/25 bg-red-400/10 text-red-100"}`}>{children}</div>; }
function formatDate(value: string) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR").format(date); }
function formatName(value: string) { return ({ video_curto: "Vídeo curto", carrossel: "Carrossel", imagem: "Imagem" } as Record<string, string>)[value] ?? value; }
