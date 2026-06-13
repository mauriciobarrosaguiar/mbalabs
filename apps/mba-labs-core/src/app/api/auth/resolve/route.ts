import { NextResponse } from "next/server";
import { getLoginDestination } from "@/lib/core-data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/dashboard";
  const destination = await getLoginDestination(next);
  return NextResponse.json({ destination });
}
