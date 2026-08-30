import { NextRequest, NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

const BOOK_IDS = new Set([
  "GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI","1CH","2CH",
  "EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER","LAM","EZK","DAN","HOS","JOL",
  "AMO","OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL","MAT","MRK","LUK","JHN","ACT",
  "ROM","1CO","2CO","GAL","EPH","PHP","COL","1TH","2TH","1TI","2TI","TIT","PHM","HEB","JAS",
  "1PE","2PE","1JN","2JN","3JN","JUD","REV"
]);

export async function GET(request: NextRequest) {
  await requireAppAccess("elshaday", "/elshaday/biblia");

  const book = String(request.nextUrl.searchParams.get("book") ?? "JHN").toUpperCase();
  const chapter = Number(request.nextUrl.searchParams.get("chapter") ?? "3");

  if (!BOOK_IDS.has(book) || !Number.isInteger(chapter) || chapter < 1 || chapter > 150) {
    return NextResponse.json({ error: "Livro ou capítulo inválido." }, { status: 400 });
  }

  try {
    const response = await fetch(\`https://bible-api.com/data/almeida/\${book}/\${chapter}\`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "A fonte bíblica está temporariamente indisponível." },
        { status: 502 }
      );
    }

    const payload = await response.json();
    const rawVerses = Array.isArray(payload?.verses) ? payload.verses : [];
    const verses = rawVerses
      .map((verse: any) => ({
        number: Number(verse.verse ?? verse.number),
        text: String(verse.text ?? "").trim()
      }))
      .filter((verse: { number: number; text: string }) => Number.isFinite(verse.number) && verse.text);

    return NextResponse.json({
      translation: payload?.translation?.name ?? payload?.translation_name ?? "João Ferreira de Almeida",
      book,
      chapter,
      verses
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"
      }
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível consultar a Bíblia agora." },
      { status: 502 }
    );
  }
}
