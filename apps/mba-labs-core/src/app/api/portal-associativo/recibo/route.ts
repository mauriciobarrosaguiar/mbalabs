import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Informe o id da cobrança." }, { status: 400 });
  }
  return NextResponse.redirect(new URL(`/api/portal-associativo/recibos/${encodeURIComponent(id)}`, request.url));
}
