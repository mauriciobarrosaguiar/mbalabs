import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const QA_TENANT_A = "Drogaria QA Palmas";
const QA_TENANT_B = "Farmácia Sandbox Norte";
const PRODUCTION_HOSTS = new Set(["mbalabs.com.br", "www.mbalabs.com.br", "mbalabs.vercel.app"]);
const PRODUCTION_PROJECT_REF = "jrbkojhnltqfqwpczwuw";
const qaEnabled = process.env.MBA_COTACOES_E2E_QA === "true";

test.describe("MBA Cotações — golden path no sandbox", () => {
  test.skip(!qaEnabled, "Executado somente com MBA_COTACOES_E2E_QA=true em um sandbox sem dados reais.");

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop-1366", "Golden path mutável roda uma única vez no projeto desktop.");
    requireSafeQaConfig();
  });

  test("login → lista → resposta pública → ranking → finalização → pedido → link vencedor", async ({ page, request }) => {
    const qa = requireSafeQaConfig();
    const supabase = qaClient(qa);
    const fixture = await loadFixture(supabase, QA_TENANT_A);

    await login(page, qa.adminEmail, qa.password);
    await expect(page).toHaveURL(/\/cotacoes(?:\/|$)/);
    await expect(page.getByText(QA_TENANT_A).first()).toBeVisible();

    await page.goto("/cotacoes/lista-faltas");
    await expect(page.getByRole("heading", { name: "Lista de faltas" })).toBeVisible();
    await expect(page.getByText("Produtos aguardando cotação (12)")).toBeVisible();

    await page.goto(`/cotacoes/cotacoes-farmacia/${fixture.quotation.id}`);
    await expect(page.getByText(fixture.quotation.name).first()).toBeVisible();

    await page.goto(`/cotacao/responder/${fixture.pendingSession.public_token}`);
    await expect(page.getByText("Link público seguro")).toBeVisible();
    await expect(page.getByText(QA_TENANT_A).first()).toBeVisible();
    await expect(page.getByText(`CNPJ: ${formatCnpj(fixture.tenant.cnpj)}`)).toBeVisible();

    const firstVisiblePrice = page.locator('input[placeholder="0,00"]:visible').first();
    await firstVisiblePrice.fill("9,75");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Enviar cotação" }).click();
    await expect(page.getByText("Cotação enviada com sucesso. O comprador analisará os preços informados.")).toBeVisible();

    const submitted = await supabase
      .from("supplier_quote_responses")
      .select("id,status")
      .eq("session_id", fixture.pendingSession.id)
      .single();
    expect(submitted.error).toBeNull();
    expect(submitted.data?.status).toBe("submitted");

    await page.route("**/api/whatsapp-envios", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ whatsapp: { enviado: 1, falhou: 0, results: [] } }),
      });
    });

    await page.goto(`/cotacoes/cotacoes-farmacia/${fixture.quotation.id}/analise`);
    await expect(page.getByRole("heading", { name: "Análise da cotação farmácia" })).toBeVisible();
    await expect(page.getByText("Representante QA Nazaria").first()).toBeVisible();

    await page.goto(`/cotacoes/cotacoes-farmacia/${fixture.quotation.id}`);
    await page.getByRole("button", { name: "Finalizar", exact: true }).click();
    await page.getByRole("button", { name: "Finalizar", exact: true }).last().click();
    await expect(page).toHaveURL(new RegExp(`/cotacoes/cotacoes-farmacia/${fixture.quotation.id}/analise`));

    await page.goto(`/cotacoes/cotacoes-farmacia/${fixture.quotation.id}/pedidos`);
    await expect(page.getByRole("heading", { name: "Pedidos vencedores" })).toBeVisible();
    await page.getByRole("button", { name: "Gerar pedido" }).click();
    await expect(page.getByText("Pedidos gerados com sucesso.")).toBeVisible();
    await page.getByRole("button", { name: "Gerar pedido" }).click();
    await expect(page.getByText("Pedidos gerados com sucesso.")).toBeVisible();

    const orders = await supabase
      .from("purchase_orders")
      .select("id,supplier_id,public_token,total_amount")
      .eq("quotation_id", fixture.quotation.id);
    expect(orders.error).toBeNull();
    expect(orders.data?.length).toBeGreaterThan(0);
    expect(new Set((orders.data ?? []).map((order) => order.supplier_id)).size).toBe(orders.data?.length);

    const winner = orders.data?.[0];
    expect(winner?.public_token).toMatch(/^pedido-pharmacy-[a-f0-9]{64}$/);
    const winnerPage = await page.context().newPage();
    await winnerPage.goto(`/cotacao/pedido/${winner?.public_token}`);
    await expect(winnerPage.getByText("Pedido vencedor")).toBeVisible();
    await expect(winnerPage.getByText(QA_TENANT_A).first()).toBeVisible();
    await expect(winnerPage.getByText(QA_TENANT_B)).toHaveCount(0);

    const healthProbe = await request.get("/api/cotacoes/health/supabase");
    expect([401, 403]).toContain(healthProbe.status());
  });

  test("duas farmácias simultâneas permanecem isoladas por URL e API", async ({ browser }) => {
    const qa = requireSafeQaConfig();
    const supabase = qaClient(qa);
    const [tenantA, tenantB] = await Promise.all([
      loadFixture(supabase, QA_TENANT_A),
      loadFixture(supabase, QA_TENANT_B),
    ]);

    const [contextA, contextB] = await Promise.all([browser.newContext(), browser.newContext()]);
    try {
      const [pageA, pageB] = await Promise.all([contextA.newPage(), contextB.newPage()]);
      await Promise.all([
        login(pageA, qa.adminEmail, qa.password),
        login(pageB, "admin.qa.2@example.invalid", qa.password),
      ]);

      await Promise.all([
        pageA.goto(`/cotacoes/cotacoes-farmacia/${tenantA.quotation.id}`),
        pageB.goto(`/cotacoes/cotacoes-farmacia/${tenantB.quotation.id}`),
      ]);
      await expect(pageA.getByText(tenantA.quotation.name).first()).toBeVisible();
      await expect(pageB.getByText(tenantB.quotation.name).first()).toBeVisible();

      const crossTenantPage = await pageA.goto(`/cotacoes/cotacoes-farmacia/${tenantB.quotation.id}`);
      expect(crossTenantPage?.status()).toBeGreaterThanOrEqual(400);
      await expect(pageA.getByText(tenantB.quotation.name)).toHaveCount(0);

      const probe = await contextA.request.patch("/api/cotacoes/quotations", {
        data: { id: tenantB.quotation.id, action: "qa_authorization_probe" },
      });
      expect([403, 404]).toContain(probe.status());
    } finally {
      await Promise.all([contextA.close(), contextB.close()]);
    }
  });
});

type QaConfig = {
  baseUrl: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  projectRef: string;
  adminEmail: string;
  password: string;
};

function requireSafeQaConfig(): QaConfig {
  const config = {
    baseUrl: String(process.env.QA_BASE_URL ?? "").trim(),
    supabaseUrl: String(process.env.SUPABASE_QA_URL ?? "").trim(),
    serviceRoleKey: String(process.env.SUPABASE_QA_SERVICE_ROLE_KEY ?? "").trim(),
    projectRef: String(process.env.SUPABASE_QA_PROJECT_REF ?? "").trim(),
    adminEmail: String(process.env.QA_ADMIN_EMAIL ?? "admin.qa.1@example.invalid").trim(),
    password: String(process.env.MBA_COTACOES_QA_PASSWORD ?? ""),
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) throw new Error(`Configuração QA incompleta: ${missing.join(", ")}.`);

  const appUrl = new URL(config.baseUrl);
  const supabaseRef = new URL(config.supabaseUrl).hostname.split(".")[0];
  if (PRODUCTION_HOSTS.has(appUrl.hostname) || supabaseRef === PRODUCTION_PROJECT_REF) {
    throw new Error("Execução E2E bloqueada: URL de aplicação ou Supabase pertence à produção.");
  }
  if (supabaseRef !== config.projectRef) {
    throw new Error("Execução E2E bloqueada: SUPABASE_QA_PROJECT_REF diverge da URL QA.");
  }
  if (config.password.length < 12) {
    throw new Error("MBA_COTACOES_QA_PASSWORD deve ter ao menos 12 caracteres.");
  }
  return config;
}

function qaClient(config: QaConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login?next=%2Fcotacoes");
  await page.getByPlaceholder("admin@empresa.com").fill(email);
  await page.getByPlaceholder("Sua senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/cotacoes(?:\/|$)/);
}

async function loadFixture(supabase: SupabaseClient, tenantName: string) {
  const tenantResult = await supabase
    .from("tenants")
    .select("id,nome_fantasia,cnpj,status")
    .eq("nome_fantasia", tenantName)
    .eq("status", "teste")
    .single();
  if (tenantResult.error) throw tenantResult.error;

  const quoteResult = await supabase
    .from("quotations")
    .select("id,name,status")
    .eq("tenant_id", tenantResult.data.id)
    .eq("name", `Cotação Golden Path QA - ${tenantName}`)
    .single();
  if (quoteResult.error) throw quoteResult.error;

  const sessionResult = await supabase
    .from("supplier_quote_sessions")
    .select("id,public_token,status,supplier_id")
    .eq("quotation_id", quoteResult.data.id)
    .eq("status", "opened")
    .single();
  if (sessionResult.error) throw sessionResult.error;

  return { tenant: tenantResult.data, quotation: quoteResult.data, pendingSession: sessionResult.data };
}

function formatCnpj(value: string) {
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
