import { NextResponse } from "next/server";
import { z } from "zod";
import { getConteudoIaApiContext } from "@/lib/conteudo-ia-auth";
import type { ConteudoIaProfileInput } from "@/lib/conteudo-ia-types";
import { getSupabaseServer } from "@/lib/supabase";

const profileSchema = z.object({
  marcaId: z.string().uuid().nullable().optional(),
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

export async function GET() {
  const auth = await getConteudoIaApiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = (await getSupabaseServer()) as any;
  const { data: marca, error: marcaError } = await supabase
    .from("conteudo_marcas")
    .select("id,nome,nicho,subnicho,publico_alvo,objetivo,tom_voz,cidade_regiao,frequencia,posts_por_periodo,pilares")
    .eq("empresa_id", auth.empresaId)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (marcaError) {
    return NextResponse.json({ error: marcaError.message }, { status: 500 });
  }

  let perfilSocial = null;
  if (marca?.id) {
    const result = await supabase
      .from("conteudo_perfis_sociais")
      .select("id,username,profile_url")
      .eq("empresa_id", auth.empresaId)
      .eq("marca_id", marca.id)
      .eq("rede", "tiktok")
      .maybeSingle();

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    perfilSocial = result.data;
  }

  const profile: ConteudoIaProfileInput | null = marca
    ? {
        marcaId: marca.id,
        perfilId: perfilSocial?.id ?? null,
        marcaNome: marca.nome,
        tiktokUsername: perfilSocial?.username ?? "",
        profileUrl: perfilSocial?.profile_url ?? "",
        nicho: marca.nicho,
        subnicho: marca.subnicho ?? "",
        publicoAlvo: marca.publico_alvo,
        objetivo: marca.objetivo,
        tomVoz: marca.tom_voz,
        cidadeRegiao: marca.cidade_regiao ?? "",
        frequencia: marca.frequencia,
        postsPorPeriodo: marca.posts_por_periodo,
        pilares: marca.pilares ?? []
      }
    : null;

  return NextResponse.json({
    profile,
    integrations: {
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      tiktokConfigured: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET)
    }
  });
}

export async function PUT(request: Request) {
  const auth = await getConteudoIaApiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revise os campos do DNA do perfil.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const supabase = (await getSupabaseServer()) as any;

  let marcaId = input.marcaId ?? null;
  if (!marcaId) {
    const existing = await supabase
      .from("conteudo_marcas")
      .select("id")
      .eq("empresa_id", auth.empresaId)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing.error) {
      return NextResponse.json({ error: existing.error.message }, { status: 500 });
    }
    marcaId = existing.data?.id ?? null;
  }

  const marcaPayload = {
    empresa_id: auth.empresaId,
    criado_por: auth.profile.id,
    nome: input.marcaNome,
    nicho: input.nicho,
    subnicho: input.subnicho || null,
    publico_alvo: input.publicoAlvo,
    objetivo: input.objetivo,
    tom_voz: input.tomVoz,
    cidade_regiao: input.cidadeRegiao || null,
    frequencia: input.frequencia,
    posts_por_periodo: input.postsPorPeriodo,
    pilares: input.pilares,
    ativo: true
  };

  if (marcaId) {
    const updated = await supabase
      .from("conteudo_marcas")
      .update(marcaPayload)
      .eq("id", marcaId)
      .eq("empresa_id", auth.empresaId)
      .select("id")
      .single();

    if (updated.error) {
      return NextResponse.json({ error: updated.error.message }, { status: 500 });
    }
  } else {
    const inserted = await supabase.from("conteudo_marcas").insert(marcaPayload).select("id").single();
    if (inserted.error) {
      return NextResponse.json({ error: inserted.error.message }, { status: 500 });
    }
    marcaId = inserted.data.id;
  }

  const socialPayload = {
    empresa_id: auth.empresaId,
    marca_id: marcaId,
    rede: "tiktok",
    username: normalizeUsername(input.tiktokUsername),
    profile_url: input.profileUrl || buildTikTokUrl(input.tiktokUsername),
    status_integracao: process.env.TIKTOK_CLIENT_KEY ? "aguardando_autorizacao" : "manual"
  };

  const social = await supabase
    .from("conteudo_perfis_sociais")
    .upsert(socialPayload, { onConflict: "marca_id,rede" })
    .select("id")
    .single();

  if (social.error) {
    return NextResponse.json({ error: social.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      ...input,
      marcaId,
      perfilId: social.data.id,
      tiktokUsername: normalizeUsername(input.tiktokUsername),
      profileUrl: socialPayload.profile_url
    }
  });
}

function normalizeUsername(value: string) {
  return value.trim().replace(/^@/, "");
}

function buildTikTokUrl(username: string) {
  return `https://www.tiktok.com/@${normalizeUsername(username)}`;
}
