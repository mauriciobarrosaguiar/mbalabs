const PRODUCTION_PROJECT_REFS = new Set(["jrbkojhnltqfqwpczwuw"]);

export const QA_TENANTS = [
  { name: "Drogaria QA Palmas", legalName: "Drogaria QA Palmas LTDA - TESTE", cnpj: "11222333000181", city: "Palmas", state: "TO" },
  { name: "Farmácia Sandbox Norte", legalName: "Farmácia Sandbox Norte LTDA - TESTE", cnpj: "11444777000161", city: "Araguaína", state: "TO" },
  { name: "Drogaria Teste MBA", legalName: "Drogaria Teste MBA LTDA - TESTE", cnpj: "11999888000134", city: "Gurupi", state: "TO" },
];

export function requireQaEnvironment(environment = process.env) {
  if (environment.MBA_COTACOES_QA !== "true") {
    throw new Error("Execução bloqueada: defina MBA_COTACOES_QA=true somente no ambiente QA.");
  }

  const url = String(environment.SUPABASE_QA_URL ?? "").trim();
  const serviceRoleKey = String(environment.SUPABASE_QA_SERVICE_ROLE_KEY ?? "").trim();
  const expectedRef = String(environment.SUPABASE_QA_PROJECT_REF ?? "").trim();
  const actualRef = extractProjectRef(url);

  if (!url || !serviceRoleKey || !expectedRef || !actualRef) {
    throw new Error("SUPABASE_QA_URL, SUPABASE_QA_SERVICE_ROLE_KEY e SUPABASE_QA_PROJECT_REF são obrigatórios.");
  }
  if (PRODUCTION_PROJECT_REFS.has(actualRef)) {
    throw new Error("Execução bloqueada: o projeto informado é o Supabase de produção.");
  }
  if (actualRef !== expectedRef) {
    throw new Error("Execução bloqueada: SUPABASE_QA_PROJECT_REF não corresponde à URL informada.");
  }

  return { url, serviceRoleKey, projectRef: actualRef };
}

function extractProjectRef(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith(".supabase.co") ? hostname.split(".")[0] : null;
  } catch {
    return null;
  }
}
