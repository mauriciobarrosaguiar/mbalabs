import { expect, test } from "@playwright/test";

test("link inválido não expõe cotação nem dashboard", async ({ page }) => {
  await page.goto("/cotacao/responder/token-manipulado-inexistente");

  await expect(page.getByRole("heading", { name: "Cotação não encontrada ou link inválido." })).toBeVisible();
  await expect(page.getByText("Área do fornecedor")).toBeVisible();
  await expect(page.getByText("Dashboard")).toHaveCount(0);
});

test("link de demonstração abre somente a área pública do fornecedor", async ({ page }) => {
  await page.goto("/cotacao/responder/farmacia-demo-token");

  await expect(page.getByText("Área do fornecedor")).toBeVisible();
  await expect(page.getByText("Sem login")).toBeVisible();
  await expect(page.getByText("Dashboard")).toHaveCount(0);
});

test("representante consegue informar disponibilidade de estoque", async ({ page }) => {
  await page.goto("/cotacao/responder/farmacia-demo-token");

  const stockControl = page.locator('button[aria-label="Possui estoque?"]:visible').first();
  await expect(stockControl).toBeVisible();
  await stockControl.click();
  await page.getByRole("option", { name: "Não" }).click();
  await expect(stockControl).toContainText("Não");
});

test("área pública não cria rolagem horizontal no viewport", async ({ page }) => {
  await page.goto("/cotacao/responder/token-manipulado-inexistente");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
