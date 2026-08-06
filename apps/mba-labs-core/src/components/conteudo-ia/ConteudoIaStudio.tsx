"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes
} from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Clipboard,
  Clock3,
  Crosshair,
  Fingerprint,
  Heart,
  Leaf,
  Link2,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Mic2,
  Music2,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
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
  const [integrations, setIntegrations] = useState({
    openaiConfigured: false,
    tiktokConfigured: false
  });
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
        const data = (await response.json()) as ConteudoIaProfileResponse & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Não foi possível carregar o perfil.");
        }
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
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Erro ao carregar o módulo."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const completion = useMemo(() => {
    const values = [
      profile.marcaNome,
      profile.tiktokUsername,
      profile.nicho,
      profile.publicoAlvo,
      profile.objetivo,
      profile.tomVoz,
      pillarsText
    ];

    return Math.round(
      (values.filter((value) => value.trim()).length / values.length) * 100
    );
  }, [pillarsText, profile]);

  function updateField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
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
      postsPorPeriodo: Math.min(
        14,
        Math.max(1, Number(profile.postsPorPeriodo) || 1)
      ),
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
        body: JSON.stringify(payload())
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
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Erro ao salvar o perfil."
      );
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

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível gerar o conteúdo.");
      }

      setPlan(data.plan);
      setMessage(
        `${data.plan.contents.length} conteúdos foram criados para o TikTok.`
      );
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Erro ao gerar conteúdos."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function copyContent(index: number) {
    const item = plan?.contents[index];
    if (!item) return;

    await navigator.clipboard.writeText(
      [
        item.title,
        "",
        `Gancho: ${item.hook}`,
        "",
        `Roteiro:\n${item.script}`,
        "",
        item.caption,
        "",
        item.hashtags.join(" ")
      ].join("\n")
    );

    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 1800);
  }

  function scrollToExample() {
    document
      .getElementById("conteudo-ia-exemplo")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="grid gap-6 pb-14">
      <Hero
        userName={userName}
        generating={generating}
        saving={saving}
        onGenerate={generatePlan}
        onExample={scrollToExample}
      />

      <Metrics posts={profile.postsPorPeriodo || 0} />

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <SamplePreview onGenerate={generatePlan} generating={generating} />

      <section className="grid gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">
            Status da implantação
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
            Tudo pronto para avançar
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
            Acompanhe a configuração do módulo TikTok e veja o próximo passo.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <StatusCard
            icon={<Music2 size={25} />}
            title="TikTok"
            status={
              integrations.tiktokConfigured ? "Pronto para OAuth" : "Cadastro manual"
            }
            description={
              integrations.tiktokConfigured
                ? "Credenciais localizadas. A autorização oficial entra na próxima etapa."
                : "Nesta fase usamos o usuário e o link do perfil."
            }
            complete
          />
          <StatusCard
            icon={<Sparkles size={25} />}
            title="Inteligência artificial"
            status={integrations.openaiConfigured ? "Ativa" : "Aguardando chave"}
            description={
              integrations.openaiConfigured
                ? "Estratégia, roteiros, legendas e hashtags estão liberados."
                : "Configure a chave da OpenAI na Vercel para gerar os conteúdos."
            }
            complete={integrations.openaiConfigured}
          />
          <StatusCard
            icon={<Fingerprint size={25} />}
            title="DNA do perfil"
            status={`${completion}% preenchido`}
            description="Quanto mais completo, mais específico e consistente fica o planejamento."
            complete={completion === 100}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.35fr)]">
        <ProfilePanel
          profile={profile}
          pillarsText={pillarsText}
          completion={completion}
          saving={saving}
          generating={generating}
          onChange={updateField}
          onPillarsChange={setPillarsText}
          onSave={() => saveProfile(true)}
        />

        <section className="grid min-w-0 gap-5">
          {!plan ? (
            <EmptyCalendar onGenerate={generatePlan} generating={generating} />
          ) : (
            <GeneratedPlan
              plan={plan}
              generating={generating}
              copiedIndex={copiedIndex}
              onGenerate={generatePlan}
              onCopy={copyContent}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Hero({
  userName,
  generating,
  saving,
  onGenerate,
  onExample
}: {
  userName: string;
  generating: boolean;
  saving: boolean;
  onGenerate: () => void;
  onExample: () => void;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-fuchsia-400/25 bg-[radial-gradient(circle_at_82%_18%,rgba(217,70,239,0.28),transparent_30%),radial-gradient(circle_at_10%_15%,rgba(124,58,237,0.24),transparent_30%),linear-gradient(145deg,rgba(8,12,35,0.98),rgba(27,12,66,0.96))] p-5 shadow-[0_28px_90px_rgba(76,29,149,0.24)] md:p-8 lg:p-10">
      <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-violet-500/15 blur-3xl" />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(290px,0.72fr)] lg:items-center">
        <div className="min-w-0">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-fuchsia-100">
            <WandSparkles size={15} />
            Fase 1 · TikTok
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
            Conteúdo digital{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-violet-400 bg-clip-text text-transparent">
              organizado
            </span>
            , estratégico e pronto para gravar.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
            Olá, {userName}. Transforme o DNA do perfil em temas, ganchos,
            roteiros, legendas e hashtags pensados para o TikTok.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <PrimaryButton
              loading={generating}
              disabled={generating || saving}
              onClick={onGenerate}
            />
            <button
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/25 bg-slate-950/35 px-5 py-3 font-black text-white transition hover:border-fuchsia-300/45 hover:bg-white/[0.07]"
              type="button"
              onClick={onExample}
            >
              <Play size={18} />
              Ver exemplo
            </button>
          </div>
        </div>

        <TikTokIllustration />
      </div>
    </section>
  );
}

function TikTokIllustration() {
  return (
    <div
      className="relative mx-auto grid min-h-[330px] w-full max-w-[390px] place-items-center lg:min-h-[420px]"
      aria-hidden="true"
    >
      <div className="absolute inset-x-12 bottom-8 h-20 rounded-[50%] border border-fuchsia-400/25 bg-violet-600/15 blur-sm" />
      <div className="absolute inset-x-20 bottom-12 h-12 rounded-[50%] bg-fuchsia-500/25 blur-xl" />

      <div className="relative rotate-[8deg]">
        <div className="absolute -inset-4 rounded-[3rem] border border-fuchsia-400/20 bg-fuchsia-400/5 blur-sm" />
        <div className="relative flex h-[265px] w-[158px] flex-col items-center justify-center rounded-[2.5rem] border border-fuchsia-300/60 bg-[linear-gradient(160deg,rgba(13,17,45,0.98),rgba(42,15,79,0.96))] shadow-[0_0_50px_rgba(217,70,239,0.35)] md:h-[310px] md:w-[184px]">
          <span className="absolute top-3 h-1.5 w-14 rounded-full bg-white/10" />
          <div className="grid size-24 place-items-center rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-[0_0_35px_rgba(168,85,247,0.22)] md:size-28">
            <Music2
              className="text-fuchsia-300 drop-shadow-[0_0_14px_rgba(232,121,249,0.9)]"
              size={58}
              strokeWidth={2.5}
            />
          </div>
          <p className="mt-5 text-sm font-black uppercase tracking-[0.22em] text-fuchsia-100">
            TikTok 9:16
          </p>
        </div>

        <FloatingIcon className="-left-14 top-20" icon={<Play size={22} />} />
        <FloatingIcon className="-right-14 top-36" icon={<Heart size={22} />} />
        <FloatingIcon
          className="-right-10 bottom-6"
          icon={<MessageCircle size={21} />}
        />
      </div>
    </div>
  );
}

function FloatingIcon({
  icon,
  className
}: {
  icon: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`absolute grid size-14 place-items-center rounded-2xl border border-fuchsia-300/35 bg-violet-950/90 text-fuchsia-200 shadow-[0_0_25px_rgba(217,70,239,0.28)] ${className}`}
    >
      {icon}
    </span>
  );
}

function Metrics({ posts }: { posts: number }) {
  return (
    <section className="grid grid-cols-3 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035]">
      <Metric
        icon={<CalendarDays size={22} />}
        value={posts || 5}
        label="Roteiros por período"
      />
      <Metric icon={<Video size={22} />} value="9:16" label="Formato vertical" />
      <Metric icon={<Target size={22} />} value={5} label="Pilares ativos" />
    </section>
  );
}

function Metric({
  icon,
  value,
  label
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="relative grid min-w-0 place-items-center gap-2 px-2 py-5 text-center md:px-5 md:py-7 [&:not(:last-child)]:border-r [&:not(:last-child)]:border-white/10">
      <span className="grid size-11 place-items-center rounded-2xl border border-fuchsia-300/15 bg-fuchsia-400/10 text-fuchsia-200">
        {icon}
      </span>
      <strong className="text-2xl font-black tracking-tight text-white md:text-3xl">
        {value}
      </strong>
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 md:text-xs">
        {label}
      </span>
    </div>
  );
}

function SamplePreview({
  onGenerate,
  generating
}: {
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <section
      id="conteudo-ia-exemplo"
      className="scroll-mt-24 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(13,17,45,0.94),rgba(28,16,58,0.9))] p-5 md:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">
            Exemplo de roteiro
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Veja como o conteúdo chega pronto
          </h2>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-2 text-sm font-black text-fuchsia-100 transition hover:bg-fuchsia-400/15"
          type="button"
          onClick={onGenerate}
          disabled={generating}
        >
          <Sparkles size={16} />
          Gerar o meu
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="relative min-h-[310px] overflow-hidden rounded-[1.5rem] border border-fuchsia-300/20 bg-[radial-gradient(circle_at_60%_15%,rgba(217,70,239,0.28),transparent_33%),linear-gradient(160deg,#17132d,#080b1d)] p-5">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="relative flex h-full flex-col justify-between">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-fuchsia-100">
              00:28 · TikTok
            </span>
            <div>
              <p className="text-2xl font-black uppercase leading-tight text-white">
                Pequenos cuidados
                <span className="block text-fuchsia-400">mudam o resultado.</span>
              </p>
              <span className="mt-5 grid size-14 place-items-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur">
                <Play fill="currentColor" size={22} />
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <ExampleRow
            icon={<Crosshair size={18} />}
            label="Tema"
            content="3 cuidados simples que melhoram a produção de ovos."
          />
          <ExampleRow
            icon={<Sparkles size={18} />}
            label="Gancho"
            content="Suas galinhas podem produzir melhor com mudanças que não custam caro."
          />
          <ExampleRow
            icon={<BarChart3 size={18} />}
            label="Legenda"
            content="Mostre um cuidado por cena, explique o benefício e termine convidando o público a salvar o vídeo."
          />
          <ExampleRow
            icon={<Target size={18} />}
            label="Hashtags"
            content="#Galinhas #OvosCaipiras #AgriculturaFamiliar #VidaNaChácara"
          />
        </div>
      </div>
    </section>
  );
}

function ExampleRow({
  icon,
  label,
  content
}: {
  icon: ReactNode;
  label: string;
  content: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-black/15 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-fuchsia-300/15 bg-fuchsia-400/10 text-fuchsia-200">
        {icon}
      </span>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-fuchsia-300">
          {label}
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-200">{content}</p>
      </div>
    </div>
  );
}

function ProfilePanel({
  profile,
  pillarsText,
  completion,
  saving,
  generating,
  onChange,
  onPillarsChange,
  onSave
}: {
  profile: ConteudoIaProfileInput;
  pillarsText: string;
  completion: number;
  saving: boolean;
  generating: boolean;
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => void;
  onPillarsChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="h-fit overflow-hidden rounded-[1.75rem] border border-fuchsia-400/20 bg-[linear-gradient(160deg,rgba(18,20,52,0.94),rgba(26,13,56,0.9))]">
      <div className="border-b border-white/10 p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">
              Configuração
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">
              DNA do perfil
            </h2>
          </div>
          <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-black text-fuchsia-100">
            TikTok
          </span>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-200">
                <Check size={20} />
              </span>
              <div>
                <p className="font-black text-white">{completion}% preenchido</p>
                <p className="text-xs text-slate-400">
                  Complete o perfil para melhorar a precisão.
                </p>
              </div>
            </div>
            <strong className="text-sm text-fuchsia-300">{completion}%</strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-violet-500 transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 md:p-6">
        <Field
          icon={<Leaf size={18} />}
          label="Nome da marca ou página"
          name="marcaNome"
          value={profile.marcaNome}
          onChange={onChange}
          placeholder="Ex.: Chácara Flor da Dona Mariquinha"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Field
            icon={<UserRound size={18} />}
            label="Usuário do TikTok"
            name="tiktokUsername"
            value={profile.tiktokUsername}
            onChange={onChange}
            placeholder="@seuperfil"
          />
          <Field
            icon={<MapPin size={18} />}
            label="Cidade ou região"
            name="cidadeRegiao"
            value={profile.cidadeRegiao}
            onChange={onChange}
            placeholder="Palmas e região"
          />
        </div>
        <Field
          icon={<Link2 size={18} />}
          label="Link do perfil"
          name="profileUrl"
          value={profile.profileUrl}
          onChange={onChange}
          placeholder="https://www.tiktok.com/@..."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Field
            icon={<Leaf size={18} />}
            label="Nicho"
            name="nicho"
            value={profile.nicho}
            onChange={onChange}
            placeholder="Agro, saúde, vendas..."
          />
          <Field
            icon={<Crosshair size={18} />}
            label="Subnicho"
            name="subnicho"
            value={profile.subnicho}
            onChange={onChange}
            placeholder="Galinhas, ovos caipiras..."
          />
        </div>
        <TextArea
          icon={<UserRound size={18} />}
          label="Público-alvo"
          name="publicoAlvo"
          value={profile.publicoAlvo}
          onChange={onChange}
          placeholder="Quem deve assistir e quais dores esse público possui?"
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <TextArea
            icon={<Target size={18} />}
            label="Objetivo do perfil"
            name="objetivo"
            value={profile.objetivo}
            onChange={onChange}
          />
          <TextArea
            icon={<Mic2 size={18} />}
            label="Tom de voz"
            name="tomVoz"
            value={profile.tomVoz}
            onChange={onChange}
          />
        </div>

        <TextArea
          icon={<Sparkles size={18} />}
          label="Pilares de conteúdo"
          value={pillarsText}
          onChange={(event) => onPillarsChange(event.target.value)}
          placeholder="Separe por vírgulas"
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-slate-200">
            <span className="flex items-center gap-2">
              <Clock3 className="text-fuchsia-300" size={17} />
              Frequência
            </span>
            <select
              className={controlClass}
              name="frequencia"
              value={profile.frequencia}
              onChange={onChange}
            >
              <option value="semanal">Semanal</option>
              <option value="diaria">Diária</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold text-slate-200">
            <span className="flex items-center gap-2">
              <CalendarDays className="text-fuchsia-300" size={17} />
              Quantidade
            </span>
            <input
              className={controlClass}
              min={1}
              max={14}
              name="postsPorPeriodo"
              type="number"
              value={profile.postsPorPeriodo}
              onChange={onChange}
            />
          </label>
        </div>

        <button
          className="mt-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-violet-500 px-5 py-3 font-black text-white shadow-[0_14px_40px_rgba(192,38,211,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={onSave}
          disabled={saving || generating}
        >
          {saving ? (
            <LoaderCircle className="animate-spin" size={19} />
          ) : (
            <Save size={19} />
          )}
          Salvar DNA do perfil
        </button>
      </div>
    </section>
  );
}

function GeneratedPlan({
  plan,
  generating,
  copiedIndex,
  onGenerate,
  onCopy
}: {
  plan: ConteudoIaGeneratedPlan;
  generating: boolean;
  copiedIndex: number | null;
  onGenerate: () => void;
  onCopy: (index: number) => void;
}) {
  return (
    <>
      <div className="rounded-[1.75rem] border border-fuchsia-400/20 bg-[linear-gradient(145deg,rgba(14,18,48,0.94),rgba(37,15,68,0.9))] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">
              Estratégia gerada
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">
              Plano de conteúdo TikTok
            </h2>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-2 text-sm font-black text-fuchsia-100 hover:bg-fuchsia-400/15"
            type="button"
            onClick={onGenerate}
            disabled={generating}
          >
            <RefreshCw
              className={generating ? "animate-spin" : ""}
              size={16}
            />
            Nova versão
          </button>
        </div>
        <p className="mt-4 leading-7 text-slate-200">{plan.strategySummary}</p>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-fuchsia-300">
            Leitura do público
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {plan.audienceInsight}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {plan.contents.map((item, index) => (
          <article
            className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(13,17,43,0.94),rgba(24,14,50,0.88))]"
            key={`${item.date}-${item.title}-${index}`}
          >
            <div className="border-b border-white/10 bg-fuchsia-400/[0.045] p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    {item.day} · {formatDate(item.date)} ·{" "}
                    {formatName(item.format)} · {item.durationSeconds}s
                  </p>
                  <h3 className="mt-3 text-xl font-black text-white md:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm font-bold text-fuchsia-300">
                    {item.theme}
                  </p>
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
                  type="button"
                  onClick={() => onCopy(index)}
                >
                  {copiedIndex === index ? (
                    <Check size={16} />
                  ) : (
                    <Clipboard size={16} />
                  )}
                  {copiedIndex === index ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-5 md:p-6 lg:grid-cols-2">
              <ContentBlock label="Gancho inicial" content={item.hook} />
              <ContentBlock label="Objetivo" content={item.objective} />
              <ContentBlock label="Roteiro" content={item.script} large />
              <ContentBlock label="Legenda" content={item.caption} large />
              <ContentBlock
                label="Briefing visual"
                content={`${item.visualBrief}\n\nFormato: ${item.width} × ${item.height}`}
              />
              <ContentBlock
                label="Chamada para ação"
                content={item.callToAction}
              />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-white/10 px-5 py-4 md:px-6">
              {item.hashtags.map((hashtag) => (
                <span
                  className="rounded-full border border-fuchsia-300/15 bg-fuchsia-400/10 px-3 py-1 text-xs font-bold text-fuchsia-100"
                  key={hashtag}
                >
                  {hashtag.startsWith("#") ? hashtag : `#${hashtag}`}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function EmptyCalendar({
  onGenerate,
  generating
}: {
  onGenerate: () => void;
  generating: boolean;
}) {
  const days = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-fuchsia-400/15 bg-[radial-gradient(circle_at_80%_18%,rgba(168,85,247,0.18),transparent_28%),linear-gradient(150deg,rgba(11,16,44,0.96),rgba(25,13,55,0.9))] p-5 md:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">
            <CalendarDays size={15} />
            Planejamento
          </div>
          <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">
            Seu calendário{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
              aparecerá aqui.
            </span>
          </h2>
          <p className="mt-4 max-w-xl leading-7 text-slate-300">
            Preencha o DNA e gere temas, ganchos, roteiros, legendas, hashtags
            e briefing visual em 1080 × 1920.
          </p>
        </div>

        <div className="relative mx-auto grid size-44 place-items-center rounded-[2.5rem] border border-fuchsia-300/20 bg-fuchsia-400/10 text-fuchsia-200 shadow-[0_0_45px_rgba(168,85,247,0.2)]">
          <CalendarDays size={72} strokeWidth={1.6} />
          <span className="absolute -right-2 -top-2 grid size-11 place-items-center rounded-2xl border border-fuchsia-300/30 bg-violet-950 text-fuchsia-200">
            <Sparkles size={20} />
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <MiniFeature
          icon={<BarChart3 size={18} />}
          title="Estratégia"
          description="Dados e insights para decidir melhor."
        />
        <MiniFeature
          icon={<Video size={18} />}
          title="TikTok 9:16"
          description="Formato vertical otimizado."
        />
        <MiniFeature
          icon={<WandSparkles size={18} />}
          title="Conteúdo pronto"
          description="Do tema ao briefing em minutos."
        />
      </div>

      <div className="mt-7">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-black text-white">
            Sua semana <span className="font-normal text-slate-500">(prévia)</span>
          </h3>
          <span className="text-xs font-bold text-slate-500">
            7 dias organizados
          </span>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5 md:gap-2">
          {days.map((day) => (
            <div className="min-w-0" key={day}>
              <p className="mb-2 text-center text-[9px] font-black tracking-[0.08em] text-slate-500 md:text-[11px]">
                {day}
              </p>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-1.5 md:rounded-2xl md:p-2">
                <div className="aspect-[3/4] rounded-lg bg-white/[0.055] md:rounded-xl" />
                <div className="mt-2 h-1.5 rounded-full bg-white/[0.055]" />
                <div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-violet-500 px-5 py-3 font-black text-white shadow-[0_14px_40px_rgba(192,38,211,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        onClick={onGenerate}
        disabled={generating}
      >
        {generating ? (
          <LoaderCircle className="animate-spin" size={19} />
        ) : (
          <Sparkles size={19} />
        )}
        {generating ? "Gerando calendário..." : "Gerar meu calendário"}
        {!generating ? <ArrowRight size={19} /> : null}
      </button>

      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
        <ShieldCheck size={15} />
        Seguro e privado. Seus dados são protegidos.
      </p>
    </section>
  );
}

function StatusCard({
  icon,
  title,
  status,
  description,
  complete
}: {
  icon: ReactNode;
  title: string;
  status: string;
  description: string;
  complete: boolean;
}) {
  return (
    <article className="group flex min-h-[170px] flex-col justify-between rounded-[1.5rem] border border-white/10 bg-[linear-gradient(145deg,rgba(13,17,43,0.92),rgba(28,14,57,0.82))] p-5 transition hover:border-fuchsia-300/25">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-12 place-items-center rounded-2xl border border-fuchsia-300/20 bg-fuchsia-400/10 text-fuchsia-200">
          {icon}
        </span>
        <span
          className={`grid size-10 place-items-center rounded-full border ${
            complete
              ? "border-fuchsia-300/30 bg-fuchsia-400/15 text-fuchsia-200"
              : "border-amber-300/20 bg-amber-400/10 text-amber-200"
          }`}
        >
          {complete ? <Check size={19} /> : <Clock3 size={18} />}
        </span>
      </div>

      <div className="mt-5">
        <h3 className="text-lg font-black text-white">{title}</h3>
        <p className="mt-1 text-sm font-black text-fuchsia-300">{status}</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </article>
  );
}

const controlClass =
  "min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-white outline-none transition placeholder:text-slate-600 focus:border-fuchsia-400/70 focus:ring-2 focus:ring-fuchsia-400/10";

function Field({
  label,
  icon,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      <span className="flex items-center gap-2">
        <span className="text-fuchsia-300">{icon}</span>
        {label}
      </span>
      <input className={controlClass} {...props} />
    </label>
  );
}

function TextArea({
  label,
  icon,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  icon: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      <span className="flex items-center gap-2">
        <span className="text-fuchsia-300">{icon}</span>
        {label}
      </span>
      <textarea
        className={`${controlClass} min-h-24 resize-y py-3`}
        {...props}
      />
    </label>
  );
}

function ContentBlock({
  label,
  content,
  large = false
}: {
  label: string;
  content: string;
  large?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-black/15 p-4 ${
        large ? "lg:col-span-2" : ""
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] text-fuchsia-300">
        {label}
      </p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-200">
        {content}
      </p>
    </div>
  );
}

function PrimaryButton({
  loading,
  disabled,
  onClick
}: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-violet-500 px-6 py-3 font-black text-white shadow-[0_14px_45px_rgba(192,38,211,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      {loading ? (
        <LoaderCircle className="animate-spin" size={20} />
      ) : (
        <Sparkles size={20} />
      )}
      {loading ? "Gerando..." : "Gerar conteúdo"}
      {!loading ? <ArrowRight size={20} /> : null}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[440px] place-items-center rounded-[2rem] border border-fuchsia-400/15 bg-[linear-gradient(145deg,rgba(13,17,43,0.94),rgba(28,14,57,0.86))]">
      <div className="flex items-center gap-3 text-slate-300">
        <LoaderCircle className="animate-spin text-fuchsia-300" size={24} />
        Carregando MBA Conteúdo IA...
      </div>
    </div>
  );
}

function MiniFeature({
  icon,
  title,
  description
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <span className="grid size-10 place-items-center rounded-xl border border-fuchsia-300/15 bg-fuchsia-400/10 text-fuchsia-200">
        {icon}
      </span>
      <p className="mt-3 font-black text-white">{title}</p>
      <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
    </div>
  );
}

function Notice({
  tone,
  children
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 text-sm leading-6 ${
        tone === "success"
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
          : "border-red-400/25 bg-red-400/10 text-red-100"
      }`}
    >
      {children}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatName(value: string) {
  return (
    {
      video_curto: "Vídeo curto",
      carrossel: "Carrossel",
      imagem: "Imagem"
    } as Record<string, string>
  )[value] ?? value;
}
