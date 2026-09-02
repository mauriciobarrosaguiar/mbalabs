import { NextResponse } from "next/server";
import { requireElshadayContext } from "@/lib/elshaday";

export const dynamic = "force-dynamic";

const BOOK_CHAPTERS: Record<string, number> = {
  GEN: 50, EXO: 40, LEV: 27, NUM: 36, DEU: 34, JOS: 24, JDG: 21, RUT: 4,
  "1SA": 31, "2SA": 24, "1KI": 22, "2KI": 25, "1CH": 29, "2CH": 36,
  EZR: 10, NEH: 13, EST: 10, JOB: 42, PSA: 150, PRO: 31, ECC: 12, SNG: 8,
  ISA: 66, JER: 52, LAM: 5, EZK: 48, DAN: 12, HOS: 14, JOL: 3, AMO: 9,
  OBA: 1, JON: 4, MIC: 7, NAM: 3, HAB: 3, ZEP: 3, HAG: 2, ZEC: 14, MAL: 4,
  MAT: 28, MRK: 16, LUK: 24, JHN: 21, ACT: 28, ROM: 16, "1CO": 16,
  "2CO": 13, GAL: 6, EPH: 6, PHP: 4, COL: 4, "1TH": 5, "2TH": 3, "1TI": 6,
  "2TI": 4, TIT: 3, PHM: 1, HEB: 13, JAS: 5, "1PE": 5, "2PE": 3,
  "1JN": 5, "2JN": 1, "3JN": 1, JUD: 1, REV: 22
};

export async function POST(request: Request) {
  try {
    const context = await requireElshadayContext("/elshaday/biblia");
    const body = await request.json().catch(() => null);

    const livroId = String(body?.livroId ?? "").toUpperCase().trim();
    const capitulo = Number(body?.capitulo ?? 0);
    const lido = Boolean(body?.lido);
    const totalCapitulos = BOOK_CHAPTERS[livroId];

    if (
      !totalCapitulos ||
      !Number.isInteger(capitulo) ||
      capitulo < 1 ||
      capitulo > totalCapitulos
    ) {
      return NextResponse.json({ error: "Livro ou capítulo inválido." }, { status: 400 });
    }

    if (lido) {
      const { error } = await context.admin
        .from("igreja_biblia_capitulos_lidos")
        .upsert(
          {
            igreja_id: context.igreja.id,
            user_id: context.current.authUser.id,
            livro_id: livroId,
            capitulo,
            lido_em: new Date().toISOString()
          },
          { onConflict: "igreja_id,user_id,livro_id,capitulo" }
        );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await context.admin
        .from("igreja_biblia_capitulos_lidos")
        .delete()
        .eq("igreja_id", context.igreja.id)
        .eq("user_id", context.current.authUser.id)
        .eq("livro_id", livroId)
        .eq("capitulo", capitulo);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const { count, error: countError } = await context.admin
      .from("igreja_biblia_capitulos_lidos")
      .select("id", { count: "exact", head: true })
      .eq("igreja_id", context.igreja.id)
      .eq("user_id", context.current.authUser.id)
      .eq("livro_id", livroId);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const lidos = count ?? 0;
    const percentual = Math.round((lidos / totalCapitulos) * 100);

    return NextResponse.json({
      ok: true,
      livroId,
      capitulo,
      lido,
      lidos,
      totalCapitulos,
      percentual
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível atualizar seu progresso de leitura." },
      { status: 401 }
    );
  }
}
