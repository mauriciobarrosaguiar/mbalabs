import { NextResponse } from "next/server";
import {
  hasElshadayRole,
  requireElshadayContext
} from "@/lib/elshaday";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const context = await requireElshadayContext("/elshaday/biblia");
    if (!hasElshadayRole(context.papel, ["admin", "pastor", "tesouraria", "secretaria", "lider", "membro"])) {
      return NextResponse.json({ error: "Perfil sem acesso." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const referencia = String(body?.referencia ?? "").trim();
    const texto = String(body?.texto ?? "").trim();
    const favorito = Boolean(body?.favorito);

    if (!referencia) {
      return NextResponse.json({ error: "Referência inválida." }, { status: 400 });
    }

    if (favorito) {
      const { error } = await context.admin.from("igreja_biblia_favoritos").upsert({
        igreja_id: context.igreja.id,
        user_id: context.current.authUser.id,
        referencia,
        texto: texto || null,
        traducao: "almeida"
      }, {
        onConflict: "igreja_id,user_id,referencia,traducao"
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await context.admin
        .from("igreja_biblia_favoritos")
        .delete()
        .eq("igreja_id", context.igreja.id)
        .eq("user_id", context.current.authUser.id)
        .eq("referencia", referencia)
        .eq("traducao", "almeida");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, referencia, favorito });
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar o favorito." }, { status: 401 });
  }
}
