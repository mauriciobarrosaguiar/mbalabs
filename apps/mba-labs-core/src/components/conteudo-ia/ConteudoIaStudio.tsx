"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
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
  Tiktok,
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

const defaultIntegrations = {
  openaiConfigured: false,
  tiktokConfigured: false
};

export function ConteudoIaStudio({ userName }: { userName: string }) {
  const [profile, setProfile] = useState<ConteudoIaProfileInput>(emptyProfile);
  const [pillarsText, setPillarsText] = useState(emptyProfile.pilares.join(", "));
  const [integrations, setIntegrations] = useState(defaultIntegrations);
  const [plan, setPlan] = useState<ConteudoIaGeneratedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/conteudo-ia/perfil", { cache: "no-store" });
        const data = (await response.json()) as ConteudoIaProfileResponse & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Não foi possível carregar o perfil.");
        }

        if (!active) return;
        if (data.profile) {
          setProfile(data.profile);
          setPillarsText(data.profile.pilares.join(", "));
        }
        setIntegrations(data.integrations ?? defaultIntegrations);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Erro ao carregar o módulo.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const completion = useMemo(() => {
    const fields = [
      profile.marcaNome,
      profile.tiktokUsername,
      profile.nicho,
      profile.publicoAlvo,
      profile.objetivo,
      profile.tomVoz,
      pillarsText
    ];
    return Math.round((fields.filter((field) => field.trim().length > 0).length / fields.length) * 100);
  }, [pillarsText, profile]);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setProfile((current) => ({
      ...current,
      [name]: name === "postsPorPeriodo" ? Number(value) : value
    }));
  }

  function normalizedPayload(): ConteudoIaProfileInput {
    return {
      ...profile,
      tiktokUsername: profile.tiktokUsername.trim().replace(/^@/, ""),
      postsPorPeriodo: Math.min(14, Math.max(1, Number(profile.postsPorPeriodo) || 1)),
      pilares: pillarsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8)
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
        body: JSON.stringify(normalizedPayload())
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível salvar o DNA do perfil.");
      }

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
      const savedProfile = await saveProfile(false);
      if (!savedProfile?.marcaId) return;

      const response = await fetch("/api/conteudo-ia/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savedProfile)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível gerar o conteúdo.");
      }

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

    const text = [
      item.title,
      "",
      `Gancho: ${item.hook}`,
      "",
      `Roteiro:\n${item.script}`,
      "",
      item.caption,
      "",
      item.hashtags.join(" ")
    ].join("\n");

    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 1800);
  }

  if (loading) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-3xl border border-white/10 bg-white/[0.04]">
        <div className="flex items-center gap-3 text-slate-300">
          <LoaderCircle className="animate-spin" size={22} />
          Carregando MBA Conteúdo IA...
        </div>
      </div>
    );
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
              <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white md:text-5xl">
                Transforme o perfil em uma máquina organizada de conteúdo.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 md:text-lg">
                Olá, {userName}. Cadastre o DNA da página, defina o público e gere o planejamento já no formato vertical do TikTok.
              </p>
            </div>
          </div>

          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-fuchsia-500 px-5 py-3 font-black text-white shadow-lg shadow-fuchsia-950/30 transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={generatePlan}
            disabled={generating || saving}
          >
            {generating ? <LoaderCircle className="animate-spin" size={19} /> : <Sparkles size={19} />}
            {generating ? "Gerando..." : "Gerar conteúdo"}
          </button>
        </div>
      </section>

      {message ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          <Check className="mt-0.5 shrink-0" size={18} />
          <span>{message}</span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm leading-6 text-red-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard
          icon={<Tiktok size={20} />}
          title="TikTok"
          status={integrations.tiktokConfigured ? "Pronto para OAuth" : "Cadastro manual"}
          description={
            integrations.tiktokConfigured
              ? "As credenciais foram encontradas. A autorização oficial será conectada na próxima etapa."
              : "Nesta fase, usamos o usuário e o link do perfil. A API oficial será ativada depois."
          }
        />
        <StatusCard
          icon={<Sparkles size={20} />}
          title="Inteligência artificial"
          status={integrations.openaiConfigured ? "Ativa" : "Aguardando chave"}
          description={
            integrations.openaiConfigured
              ? "A geração de estratégia, roteiros, legendas e hashtags está liberada."
              : "Adicione OPENAI_API_KEY na Vercel para liberar o botão de geração."
          }
        />
        <StatusCard
          icon={<Target size={20} />}
          title="DNA do perfil"
          status={`${completion}% preenchido`}
          description="Quanto mais completo, mais específico e consistente fica o planejamento."
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <section className="h-fit rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">Configuração</p>
              <h2 className="mt-2 text-2xl font-black text-white">DNA do perfil</h2>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">TikTok</span>
          </div>

          <div className="grid gap-4">
            <Field label="Nome da marca ou página" name="marcaNome" value={profile.marcaNome} onChange={updateField} placeholder="Ex.: Chácara Flor da Dona Mariquinha" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Field label="Usuário do TikTok" name="tiktokUsername" value={profile.tiktokUsername} onChange={updateField} placeholder="@seuperfil" />
              <Field label="Cidade ou região" name="cidadeRegiao" value={profile.cidadeRegiao} onChange={updateField} placeholder="Palmas e região" />
            </div>
            <Field label="Link do perfil" name="profileUrl" value={profile.profileUrl} onChange={updateField} placeholder="https://www.tiktok.com/@..." />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Field label="Nicho" name="nicho" value={profile.nicho} onChange={updateField} placeholder="Agro, saúde, vendas..." />
              <Field label="Subnicho" name="subnicho" value={profile.subnicho} onChange={updateField} placeholder="Galinhas, ovos caipiras..." />
            </div>
            <TextArea label="Público-alvo" name="publicoAlvo" value={profile.publicoAlvo} onChange={updateField} placeholder="Quem deve assistir, quais dores e interesses esse público possui?" />
            <TextArea label="Objetivo do perfil" name="objetivo" value={profile.objetivo} onChange={updateField} />
            <TextArea label="Tom de voz" name="tomVoz" value={profile.tomVoz} onChange={updateField} />
            <TextArea label="Pilares de conteúdo" value={pillarsText} onChange={(event) => setPillarsText(event.target.value)} placeholder="Separe por vírgulas" />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-200">
                Frequência
                <select className="min-h-12 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none transition focus:border-fuchsia-400" name="frequencia" value={profile.frequencia} onChange={updateField}>
                  <option value="semanal">Semanal</option>
                  <option value="diaria">Diária</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-200">
                Quantidade de conteúdos
                <input className="min-h-12 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none transition focus:border-fuchsia-400" min={1} max={14} name="postsPorPeriodo" type="number" value={profile.postsPorPeriodo} onChange={updateField} />
              </label>
            </div>

            <button
              className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => saveProfile(true)}
              disabled={saving || generating}
            >
              {saving ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar DNA do perfil
            </button>
          </div>
        </section>

        <section className="grid min-w-0 gap-5">
          {!plan ? (
            <div className="grid min-h-[520px] place-items-center rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
              <div className="max-w-xl">
                <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-fuchsia-400/10 text-fuchsia-200">
                  <CalendarDays size={30} />
                </span>
                <h2 className="mt-5 text-2xl font-black text-white">Seu calendário aparecerá aqui</h2>
                <p className="mt-3 leading-7 text-slate-300">
                  Preencha o DNA do perfil e clique em “Gerar conteúdo”. A IA entregará temas, ganchos, roteiros, legendas, hashtags e orientação visual em 1080 × 1920.
                </p>
                <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                  <MiniFeature icon={<BarChart3 size={17} />} text="Estratégia" />
                  <MiniFeature icon={<Tiktok size={17} />} text="TikTok 9:16" />
                  <MiniFeature icon={<WandSparkles size={17} />} text="Conteúdo pronto" />
                </div>
              </div>
            </div>
          ) : (
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
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                          <span>{item.day}</span>
                          <span>•</span>
                          <span>{formatDate(item.date)}</span>
                          <span>•</span>
                          <span>{formatName(item.format)}</span>
                          <span>•</span>
                          <span>{item.durationSeconds}s</span>
                        </div>
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
                      {item.hashtags.map((hashtag) => (
                        <span className="rounded-full border border-fuchsia-300/15 bg-fuchsia-400/10 px-3 py-1 text-xs font-bold text-fuchsia-100" key={hashtag}>
                          {hashtag.startsWith("#") ? hashtag : `#${hashtag}`}
                        </span>
                      ))}
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

function StatusCard({ icon, title, status, description }: { icon: React.ReactNode; title: string; status: string; description: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-fuchsia-200">{icon}</span>
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          <p className="text-xs font-bold text-fuchsia-200">{status}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">{description}</p>
    </article>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      {label}
      <input className="min-h-12 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none transition placeholder:text-slate-600 focus:border-fuchsia-400" {...props} />
    </label>
  );
}

function TextArea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      {label}
      <textarea className="min-h-24 resize-y rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-fuchsia-400" {...props} />
    </label>
  );
}

function MiniFeature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-slate-200">
      <span className="text-fuchsia-200">{icon}</span>
      {text}
    </div>
  );
}

function ContentBlock({ label, content, large = false }: { label: string; content: string; large?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-950/35 p-4 ${large ? "lg:col-span-2" : ""}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-200">{content}</p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatName(value: string) {
  const labels: Record<string, string> = {
    video_curto: "Vídeo curto",
    carrossel: "Carrossel",
    imagem: "Imagem"
  };
  return labels[value] ?? value;
}
