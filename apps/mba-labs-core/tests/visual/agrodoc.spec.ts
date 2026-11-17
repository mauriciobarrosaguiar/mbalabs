import { test, expect } from "@playwright/test";

const routes = [
  ["01-visao-geral", "", "MBA AgroDoc"],
  ["02-diagnostico", "/diagnostico", "Diagnóstico e regularização"],
  ["03-operacoes", "/gestao", "Operações"],
  ["04-conferencia", "/conferencia", "Conferência AgroDoc"],
  ["05-relatorios", "/relatorio-mensal", "Relatórios MAPA"],
  ["06-documentos", "/documentos", "MBA AgroDoc · Documentos"],
  ["07-cadastros", "/cadastros", "Cadastros"],
  ["08-configuracoes", "/configuracoes", "Configurações"],
] as const;

// Use a real, authorized homologation account. Never bypass MBA Labs authentication.
test.skip(
  !process.env.AGRODOC_BASE_URL || !process.env.AGRODOC_STORAGE_STATE,
  "Informe AGRODOC_BASE_URL e AGRODOC_STORAGE_STATE da conta de homologação autorizada.",
);

for (const [name, route, heading] of routes) {
  test(`desktop 1448 × 1086: ${name}`, async ({ page }, info) => {
    await page.goto(`/apps/dronegestor${route}`);
    await expect(
      page.getByRole("heading", { level: 1, name: heading, exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".agro-sidebar a[aria-current=page]"),
    ).toHaveCount(1);
    await expect(page.getByText("Carregando", { exact: true })).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`${name}.png`),
      fullPage: false,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  test(`layout ${viewport.width} × ${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/apps/dronegestor");
    const mobile = viewport.width < 768;
    await expect(
      page.locator(mobile ? ".agro-pilot-mobile" : ".agro-home-desktop"),
    ).toBeVisible();
    if (mobile) {
      await expect(
        page.getByRole("link", { name: "Registrar operação", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Navegação do piloto" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Abrir menu", exact: true })
        .click();
      await expect(
        page.getByRole("navigation", { name: "MBA AgroDoc" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Fechar menu", exact: true })
        .click();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`piloto-${viewport.width}.png`),
    });
  });
}

test("exportação permanece bloqueada sem modelo ou sem aprovação", async ({
  page,
}) => {
  await page.goto("/apps/dronegestor/relatorio-mensal");
  await expect(
    page.getByRole("heading", { name: "Relatórios MAPA", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  // This test only asserts the blocked scenario if the homologation account has missing prerequisites.
  const absent = page.getByText(
    "Cadastre o XLSX oficial para liberar a exportação.",
    { exact: true },
  );
  if (await absent.isVisible())
    await expect(
      page.getByRole("button", { name: "Baixar XLSX oficial", exact: true }),
    ).toBeDisabled();
});


/** Mobile regression checks for issues reported from real Samsung browser screenshots. */
for (const mobileWidth of [360, 390, 412]) {
  for (const [name, route] of routes) {
    test(`mobile layout: ${name} at ${mobileWidth}px`, async ({ page }) => {
      await page.setViewportSize({width: mobileWidth, height: 800});
      await page.goto(`/apps/dronegestor${route}`);
      await expect(page.locator(".agro-hero h1")).toBeVisible();
      const result = await page.evaluate(() => {
        const hero = document.querySelector(".agro-hero");
        const heading = hero?.querySelector("h1");
        const title = hero?.querySelector(".agro-hero-title");
        if (!hero || !heading || !title) return {ok: false, reason: "missing hero"};
        const h = hero.getBoundingClientRect(), t = title.getBoundingClientRect();
        return {
          ok: t.width > 50 && t.left >= h.left - 2 && t.right <= h.right + 2
            && t.bottom <= h.bottom + 2
            && document.documentElement.scrollWidth <= innerWidth + 2,
          reason: JSON.stringify({viewport: innerWidth, hero: h.toJSON(), title: t.toJSON(), documentWidth: document.documentElement.scrollWidth})
        };
      });
      expect(result.ok, result.reason).toBe(true);
      await page.screenshot({path: test.info().outputPath(`mobile-${name}-${mobileWidth}.png`), fullPage: false});
    });
  }
}
test("mobile report model manager is not duplicated", async ({ page }) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto("/apps/dronegestor/relatorio-mensal");
  await expect(page.getByRole("heading", {name: "Relatórios MAPA", exact: true})).toBeVisible();
  await expect(page.getByText("Planilha oficial MAPA 2026", {exact: true})).toHaveCount(1);
});
