import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apiRoutes = [
  "cadastros/route.ts", "documentos/route.ts", "state/route.ts",
  "operacao-os/route.ts", "mapa/route.ts", "mapa-geometria/route.ts",
  "sarpas/route.ts", "conferencia/route.ts",
  "config/route.ts", "produtos/route.ts", "preflight/route.ts",
  "fechamento/route.ts", "diagnostico/route.ts", "equipamentos/route.ts",
  "planejamento/route.ts", "painel-gestor/route.ts", "pilotos/route.ts",
  "execucao-parcial/route.ts", "piloto-documentos/route.ts",
  "perfil-operacional/route.ts", "administracao/route.ts",
  "relatorio-mensal/xlsx/route.ts", "pacote-operacao/pdf/route.ts",
  "relatorio-mensal/modelo-oficial/route.ts", "minhas-pendencias/route.ts",
  "empresa/usuarios/route.ts", "sarpas/provider/status/route.ts",
];

for (const route of apiRoutes) {
  test(`inactive session cannot pass the DroneGestor auth gate: ${route}`, () => {
    const src = readFileSync(new URL(`../src/app/api/dronegestor/${route}`, import.meta.url), "utf8");
    const index = src.indexOf("getSessionProfile()");
    assert.ok(index >= 0, "route should resolve authenticated session");
    const next = src.slice(index, index + 1300);
    const activeGuard = /\b(?:(?:session|s|data|context)\.profile|profile)\.status\s*!==?\s*["']ativo["']/;
    assert.match(next, activeGuard);
    const guardPos = next.search(activeGuard);
    const privilegedPos = next.indexOf("createSupabaseAdminClient()");
    assert.ok(privilegedPos === -1 || guardPos < privilegedPos, "inactive guard precedes privileged client");
  });
}

test("cloud storage checks active profile before using service role", () => {
  const src=readFileSync(new URL("../src/lib/agrodoc-cloud.ts",import.meta.url),"utf8");
  const section=src.slice(src.indexOf("export async function cloudContext()"));
  assert.match(section,/session\.profile\.status !== "ativo"/);
});
test("DroneGestor layout redirects inactive users",()=>{
  const src=readFileSync(new URL("../src/app/apps/dronegestor/layout.tsx",import.meta.url),"utf8");
  assert.match(src,/session\.profile\.status !== "ativo"\) redirect/);
});
