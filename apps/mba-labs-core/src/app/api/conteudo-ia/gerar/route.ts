import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getConteudoIaApiContext } from "@/lib/conteudo-ia-auth";
import type { ConteudoIaGeneratedPlan } from "@/lib/conteudo-ia-types";
import { getSupabaseServer } from "@/lib/supabase";

type VideoMode = "narrado" | "gravacao" | "visual";
type VoiceStyle = "feminina" | "masculina" | "neutra";
type DurationStyle = "curto" | "medio" | "longo";

type ProductionPreferences = {
  mode: VideoMode;
  voice: VoiceStyle;
  duration: DurationStyle;
  useRealMedia: boolean;
};

const generationSchema = z.object({
  marcaId: z.string().uuid(),
  perfilId: z.string().uuid().nullable().optional(),
  marcaNome: z.string().trim().min(2).max(120),
  tiktokUsername: z.string().trim().min(1).max(80),
  profileUrl: z.string().trim().max(300).default(""),
  nicho: z.string().trim().min(2).max(120),
  subnicho: z.string().trim().max(120).default(""),
  publicoAlvo: z.string().trim().min(5).max(800),
  objetivo: z.string().trim().min(3).max(300),
  tomVoz: z.string().trim().min(2).max(200),
  cidadeRegiao: z.string().trim().max(120).default(""),
  frequencia: z.enum(["diaria", "semanal"]),
  postsPorPeriodo: z.coerce.number().int().min(1).max(14),
  pilares: z.array(z.string().trim().min(2).max(120)).min(1).max(8)
});

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    strategySummary: { type: "string" },
    audienceInsight: { type: "string" },
    postingFrequency: { type: "string" },
    contents: {
      type: "array",
      minItems: 1,
      maxItems: 14,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          day: { type: "string" },
          date: { type: "string" },
          objective: { type: "string" },
          format: {
            type: "string",
            enum: ["video_curto", "carrossel", "imagem"]
          },
          theme: { type: "string" },
          title: { type: "string" },
          hook: { type: "string" },
          script: { type: "string" },
          caption: { type: "string" },
          callToAction: { type: "string" },
          hashtags: {
            type: "array",
            minItems: 3,
            maxItems: 8,
            items: { type: "string" }
          },
          visualBrief: { type: "string" },
          durationSeconds: { type: "integer", minimum: 8, maximum: 180 },
          width: { type: "integer", enum: [1080] },
          height: { type: "integer", enum: [1920] }
        },
        required: [
          "day",
          "date",
          "objective",
          "format",
          "theme",
          "title",
          "hook",
          "script",
          "caption",
          "callToAction",
          "hashtags",
          "visualBrief",
          "durationSeconds",
          "width",
          "height"
        ]
      }
    }
  },
  required: ["strategySummary", "audienceInsight", "postingFrequency", "contents"]
} as const;

export async function POST(request: Request) {
  const auth = await getConteudoIaApiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "A geração por IA está pronta, mas a chave OPENAI_API_KEY ainda não foi configurada na Vercel.",
        code: "OPENAI_NOT_CONFIGURED"
      },
      { status: 503 }
    );
  }

  const parsed = generationSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Salve e revise o DNA do perfil antes de gerar.",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const productionPreferences = getProductionPreferences(cookieStore);
  const input = parsed.data;
  const startDate = nextPlanningDate();
  const prompt = buildPrompt(input, startDate, productionPreferences);

  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CONTENT_MODEL || "gpt-5.6-luna",
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Você é um estrategista e diretor de vídeos curtos brasileiro. Gere conteúdo original, responsável, prático, em português do Brasil, sem prometer resultados e sem copiar criadores. Priorize retenção, clareza, utilidade, autenticidade e instruções de produção que possam ser executadas com celular."
            }
          ]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }]
        }
      ],
      text: {
        verbosity: "medium",
        format: {
          type: "json_schema",
          name: "conteudo_tiktok_semanal",
          strict: true,
          schema: responseSchema
        }
      },
      max_output_tokens: 9000,
      safety_identifier: createHash("sha256")
        .update(`mba-conteudo-ia:${auth.profile.id}`)
        .digest("hex")
    })
  });

  const raw = await apiResponse.json().catch(() => null);
  if (!apiResponse.ok) {
    const message =
      raw?.error?.message ||
      "A OpenAI não conseguiu gerar o planejamento agora.";
    return NextResponse.json({ error: message }, { status: apiResponse.status });
  }

  const outputText = extractOutputText(raw);
  if (!outputText) {
    return NextResponse.json(
      { error: "A IA retornou uma resposta sem conteúdo utilizável." },
      { status: 502 }
    );
  }

  let plan: ConteudoIaGeneratedPlan;
  try {
    plan = JSON.parse(outputText) as ConteudoIaGeneratedPlan;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível interpretar o planejamento gerado." },
      { status: 502 }
    );
  }

  if (!Array.isArray(plan.contents) || plan.contents.length === 0) {
    return NextResponse.json(
      { error: "O planejamento gerado não contém publicações." },
      { status: 502 }
    );
  }

  const supabase = (await getSupabaseServer()) as any;
  const storedPlan = {
    ...plan,
    productionPreferences
  };

  const planningInsert = await supabase
    .from("conteudo_planejamentos")
    .insert({
      empresa_id: auth.empresaId,
      marca_id: input.marcaId,
      perfil_social_id: input.perfilId ?? null,
      periodo_inicio: startDate,
      frequencia: input.frequencia,
      quantidade_conteudos: plan.contents.length,
      objetivo: input.objetivo,
      resumo_estrategico: plan.strategySummary,
      insight_publico: plan.audienceInsight,
      conteudo_json: storedPlan,
      status: "gerado",
      criado_por: auth.profile.id
    })
    .select("id")
    .single();

  if (planningInsert.error) {
    return NextResponse.json(
      { error: planningInsert.error.message },
      { status: 500 }
    );
  }

  const publications = plan.contents.map((item, index) => ({
    empresa_id: auth.empresaId,
    planejamento_id: planningInsert.data.id,
    marca_id: input.marcaId,
    perfil_social_id: input.perfilId ?? null,
    rede: "tiktok",
    ordem: index + 1,
    data_sugerida: item.date || null,
    objetivo: item.objective,
    formato: item.format,
    tema: item.theme,
    titulo: item.title,
    gancho: item.hook,
    roteiro: item.script,
    legenda: item.caption,
    chamada_acao: item.callToAction,
    hashtags: item.hashtags,
    briefing_visual: item.visualBrief,
    duracao_segundos: item.durationSeconds,
    largura: item.width,
    altura: item.height,
    status: "rascunho"
  }));

  const publicationsInsert = await supabase
    .from("conteudo_publicacoes")
    .insert(publications);

  if (publicationsInsert.error) {
    await supabase
      .from("conteudo_planejamentos")
      .update({ status: "erro" })
      .eq("id", planningInsert.data.id)
      .eq("empresa_id", auth.empresaId);

    return NextResponse.json(
      { error: publicationsInsert.error.message },
      { status: 500 }
    );
  }

  const usage = raw?.usage ?? {};
  await supabase.from("conteudo_consumo_ia").insert({
    empresa_id: auth.empresaId,
    usuario_id: auth.profile.id,
    planejamento_id: planningInsert.data.id,
    provedor: "openai",
    modelo: process.env.OPENAI_CONTENT_MODEL || "gpt-5.6-luna",
    tokens_entrada: usage.input_tokens ?? 0,
    tokens_saida: usage.output_tokens ?? 0,
    requisicao_id: raw?.id ?? null,
    finalidade: `planejamento_tiktok_${productionPreferences.mode}`
  });

  return NextResponse.json({
    ok: true,
    planningId: planningInsert.data.id,
    plan,
    productionPreferences
  });
}

function extractOutputText(response: any) {
  const output = Array.isArray(response?.output) ? response.output : [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }

  return typeof response?.output_text === "string"
    ? response.output_text
    : null;
}

function nextPlanningDate() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function getProductionPreferences(cookieStore: {
  get: (name: string) => { value: string } | undefined;
}): ProductionPreferences {
  const mode = readAllowedValue<VideoMode>(
    cookieStore.get("mba_conteudo_modo")?.value,
    ["narrado", "gravacao", "visual"],
    "gravacao"
  );
  const voice = readAllowedValue<VoiceStyle>(
    cookieStore.get("mba_conteudo_voz")?.value,
    ["feminina", "masculina", "neutra"],
    "neutra"
  );
  const duration = readAllowedValue<DurationStyle>(
    cookieStore.get("mba_conteudo_duracao")?.value,
    ["curto", "medio", "longo"],
    "medio"
  );

  return {
    mode,
    voice,
    duration,
    useRealMedia:
      cookieStore.get("mba_conteudo_midia_real")?.value !== "nao"
  };
}

function readAllowedValue<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T
) {
  return value && allowed.includes(value as T) ? (value as T) : fallback;
}

function buildPrompt(
  input: z.infer<typeof generationSchema>,
  startDate: string,
  preferences: ProductionPreferences
) {
  const durationInstruction = getDurationInstruction(preferences.duration);
  const modeInstruction = getModeInstruction(preferences);

  return [
    `Crie exatamente ${input.postsPorPeriodo} conteúdos para TikTok.`,
    `Data inicial do planejamento: ${startDate}.`,
    `Marca: ${input.marcaNome}.`,
    `Perfil: @${input.tiktokUsername.replace(/^@/, "")}.`,
    `Nicho: ${input.nicho}.`,
    `Subnicho: ${input.subnicho || "não informado"}.`,
    `Público-alvo: ${input.publicoAlvo}.`,
    `Objetivo: ${input.objetivo}.`,
    `Tom de voz: ${input.tomVoz}.`,
    `Cidade ou região: ${input.cidadeRegiao || "não informada"}.`,
    `Pilares: ${input.pilares.join(", ")}.`,
    `Frequência escolhida: ${input.frequencia}.`,
    `Duração escolhida: ${durationInstruction}.`,
    `Uso de fotos e vídeos reais do usuário: ${
      preferences.useRealMedia ? "sim, priorize mídia real" : "não, planeje visuais que possam ser criados ou obtidos posteriormente"
    }.`,
    modeInstruction,
    "Defina format como video_curto em todos os conteúdos e use sempre 1080x1920.",
    "Para cada conteúdo, crie gancho forte para os primeiros 2 segundos, roteiro executável, legenda, CTA, hashtags específicas e briefing visual detalhado.",
    "No campo script, separe claramente as cenas com marcações como CENA 1, CENA 2 e CENA 3. Inclua falas, narração ou textos na tela conforme o modo escolhido.",
    "No campo visualBrief, informe enquadramento, imagens ou clipes necessários, texto na tela, ritmo dos cortes, legendas, transições e sugestão de música ou efeitos.",
    "Distribua os temas sem repetição, misturando educação, autoridade, relacionamento, bastidores e oferta quando fizer sentido para o objetivo.",
    "As datas devem estar no formato YYYY-MM-DD e em ordem cronológica."
  ].join("\n");
}

function getDurationInstruction(duration: DurationStyle) {
  if (duration === "curto") return "entre 15 e 30 segundos";
  if (duration === "longo") return "entre 60 e 90 segundos";
  return "entre 30 e 60 segundos";
}

function getModeInstruction(preferences: ProductionPreferences) {
  if (preferences.mode === "narrado") {
    const voiceLabel = {
      feminina: "voz feminina",
      masculina: "voz masculina",
      neutra: "voz natural e neutra"
    }[preferences.voice];

    return [
      "Modo escolhido: VÍDEO NARRADO.",
      `Planeje a narração para ${voiceLabel}, com frases naturais, fáceis de ouvir e sincronizadas com as cenas.`,
      "O apresentador não precisa aparecer. O campo script deve indicar a narração exata de cada cena e o campo visualBrief deve orientar quais fotos ou vídeos aparecem enquanto a voz fala.",
      "Inclua legendas completas na tela e música de fundo discreta, sem competir com a voz."
    ].join(" ");
  }

  if (preferences.mode === "visual") {
    return [
      "Modo escolhido: VÍDEO VISUAL AUTOMÁTICO.",
      "Não dependa de uma pessoa aparecendo nem de narração contínua.",
      "Construa a história com imagens ou clipes interessantes, textos curtos na tela, cortes dinâmicos, música e efeitos sonoros.",
      "O campo script deve descrever a sequência visual e os textos de cada cena. Use uma frase de voz opcional somente quando for realmente necessária."
    ].join(" ");
  }

  return [
    "Modo escolhido: ROTEIRO PARA O USUÁRIO GRAVAR.",
    "O usuário pode aparecer falando ou mostrar o ambiente enquanto fala.",
    "O campo script deve trazer a fala exata, a ordem das cenas, o que filmar, o enquadramento e o texto que aparece na tela.",
    "Use linguagem espontânea, simples e natural, como uma conversa real gravada pelo celular."
  ].join(" ");
}
