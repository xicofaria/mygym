import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, partner = false) {
  await page.goto("/login");
  await page
    .getByLabel("Email")
    .fill(partner ? "e2e-partner@example.com" : "e2e@example.com");
  await page
    .getByLabel("Palavra-passe")
    .fill(partner ? "e2e-partner-password-123" : "e2e-password-123");
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("catalogue aliases, editable metadata and favorites persist, isolated per account", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/exercises");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Pesquisar exercícios").fill("prensa maquina");
  const leg = page.getByRole("article", { name: "Leg Press", exact: true });
  await expect(leg).toBeVisible();
  await leg
    .getByRole("button", { name: "Adicionar Leg Press aos favoritos" })
    .click();
  await expect(
    leg.getByRole("button", { name: "Remover Leg Press dos favoritos" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Favoritos", exact: true }).click();
  await expect(leg).toBeVisible();

  const partnerContext = await browser.newContext();
  const partner = await partnerContext.newPage();
  await login(partner, true);
  await partner.goto("/exercises");
  await partner.waitForLoadState("networkidle");
  await partner.getByRole("button", { name: "Favoritos", exact: true }).click();
  await expect(
    partner.getByRole("article", { name: "Leg Press", exact: true }),
  ).toHaveCount(0);
  await partnerContext.close();

  await leg.getByRole("button", { name: "Editar Leg Press" }).click();
  await leg
    .getByLabel("Nomes alternativos")
    .fill("Prensa de pernas, Prensa, Teste catálogo");
  await leg.getByRole("button", { name: "Guardar detalhes" }).click();
  await expect(
    leg.getByText("Prensa de pernas, Prensa, Teste catálogo"),
  ).toBeVisible();
  await page.getByLabel("Pesquisar exercícios").fill("teste catalogo");
  await expect(leg).toBeVisible();
  await page.goto("/workouts/new");
  await page.waitForLoadState("networkidle");
  await expect(
    page
      .getByLabel("Exercício da série 1", { exact: true })
      .locator('optgroup[label="Favoritos"] option'),
  ).toHaveText(["Leg Press"]);

  // Restore shared fixture metadata and preference.
  await page.goto("/exercises");
  await page.waitForLoadState("networkidle");
  await leg.getByRole("button", { name: "Editar Leg Press" }).click();
  await leg.getByLabel("Nomes alternativos").fill("Prensa de pernas, Prensa");
  await leg.getByRole("button", { name: "Guardar detalhes" }).click();
  await leg
    .getByRole("button", { name: "Remover Leg Press dos favoritos" })
    .click();
  await expect(
    leg.getByRole("button", { name: "Adicionar Leg Press aos favoritos" }),
  ).toBeVisible();
});

test("grouped sets preserve values and rest timer survives navigation on mobile", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/workouts/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Repetições da série 1").fill("12");
  await page.getByLabel("Peso (kg) da série 1").fill("2,8");
  await page.getByRole("button", { name: "+ Série neste exercício" }).click();
  await expect(
    page.getByLabel("Grupo de séries 1", { exact: true }).getByRole("combobox"),
  ).toHaveCount(1);
  await expect(page.getByLabel("Peso (kg) da série 2")).toHaveValue("2,8");
  await page.getByRole("button", { name: "+ Outro exercício" }).click();
  await expect(
    page.getByLabel("Exercício da série 3", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Peso (kg) da série 3")).toHaveValue("");
  await expect(page.getByLabel("Repetições da série 3")).toHaveValue("");
  await page.getByRole("button", { name: "60s", exact: true }).click();
  await page.getByRole("button", { name: "Iniciar descanso" }).click();
  await expect(
    page.getByRole("button", { name: "Pausar descanso" }),
  ).toBeVisible();
  await page.goto("/exercises");
  await page.goto("/workouts/new");
  await expect(
    page.getByRole("button", { name: "Pausar descanso" }),
  ).toBeVisible();
  await expect(page.getByLabel("Peso (kg) da série 2")).toHaveValue("2,8");
  await expect(page.getByLabel("Peso (kg) da série 3")).toHaveValue("");
  await page.getByRole("button", { name: "Pausar descanso" }).click();
  const paused = await page.getByLabel("Tempo de descanso").textContent();
  await page.reload();
  await expect(page.getByLabel("Tempo de descanso")).toHaveText(paused!);
  await page.getByRole("button", { name: "Repor", exact: true }).click();
  await expect(page.getByLabel("Tempo de descanso")).toHaveText("1:30");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("workout-mobile.png"),
    fullPage: true,
  });
});
