import { getPublicElshadayContext } from "@/lib/elshaday";

export type ElshadayLoginIdentity = {
  churchName: string;
  location: string;
};

export async function getElshadayLoginIdentity(): Promise<ElshadayLoginIdentity> {
  const fallback = {
    churchName: "Assembleia de Deus Elshaday",
    location: "Palmas - TO"
  };

  try {
    const { igreja } = await getPublicElshadayContext();
    const storedName = String(igreja.nome ?? "").trim();
    const citySuffix = igreja.cidade
      ? new RegExp(`\\s*-\\s*${escapeRegExp(igreja.cidade)}$`, "i")
      : null;
    const churchName = storedName
      .replace(/^Igreja\s+/i, "")
      .replace(citySuffix ?? /$^/, "")
      .trim();

    return {
      churchName: churchName || fallback.churchName,
      location: [igreja.cidade, igreja.estado].filter(Boolean).join(" - ") || fallback.location
    };
  } catch {
    return fallback;
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
