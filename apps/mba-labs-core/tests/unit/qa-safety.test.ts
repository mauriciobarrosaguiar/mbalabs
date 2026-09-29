import { describe, expect, it } from "vitest";
import { requireQaEnvironment } from "../../scripts/qa/qa-safety.mjs";

describe("proteção da massa QA", () => {
  it("bloqueia execução sem flag explícita", () => {
    expect(() => requireQaEnvironment({})).toThrow("MBA_COTACOES_QA=true");
  });

  it("bloqueia explicitamente o projeto de produção", () => {
    expect(() => requireQaEnvironment({
      MBA_COTACOES_QA: "true",
      SUPABASE_QA_URL: "https://jrbkojhnltqfqwpczwuw.supabase.co",
      SUPABASE_QA_SERVICE_ROLE_KEY: "segredo-nao-real",
      SUPABASE_QA_PROJECT_REF: "jrbkojhnltqfqwpczwuw",
    })).toThrow("projeto informado é o Supabase de produção");
  });

  it("aceita somente URL e referência QA coincidentes", () => {
    expect(requireQaEnvironment({
      MBA_COTACOES_QA: "true",
      SUPABASE_QA_URL: "https://projetoqa123.supabase.co",
      SUPABASE_QA_SERVICE_ROLE_KEY: "segredo-nao-real",
      SUPABASE_QA_PROJECT_REF: "projetoqa123",
    }).projectRef).toBe("projetoqa123");
  });
});
