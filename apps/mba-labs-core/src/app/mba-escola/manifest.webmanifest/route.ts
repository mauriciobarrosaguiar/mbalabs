import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      id: "/mba-escola/",
      name: "MBA Escola",
      short_name: "MBA Escola",
      description: "Comunicação simples entre escola, professores e famílias.",
      start_url: "/mba-escola",
      scope: "/mba-escola/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#f5f8fb",
      theme_color: "#176b5b",
      categories: ["education", "productivity"],
      icons: [
        {
          src: "/mba-escola/icon",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ]
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600"
      }
    }
  );
}
