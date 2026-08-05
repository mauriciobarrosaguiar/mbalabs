import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MBA Labs",
    short_name: "MBA Labs",
    description: "Acesse todos os sistemas MBA Labs em um único aplicativo.",
    start_url: "/login?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0f172a",
    orientation: "any",
    lang: "pt-BR",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/pwa/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/pwa/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ],
    shortcuts: [
      {
        name: "Entrar na MBA Labs",
        short_name: "Entrar",
        description: "Abrir a área de acesso da MBA Labs",
        url: "/login?source=pwa",
        icons: [{ src: "/pwa/icon-192", sizes: "192x192", type: "image/png" }]
      }
    ]
  };
}
