import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Palavra-passe").fill("e2e-password-123");
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("relatório semanal mostra a semana vazia e a semana com treino", async ({
  page,
}) => {
  await login(page);
  await page.goto("/relatorios");
  await expect(
    page.getByRole("heading", { name: "Relatório semanal" }),
  ).toBeVisible();

  // Semana passada não tem registos no e2e fresco.
  await expect(page.getByText("Sem registos nesta semana")).toBeVisible();

  // Cria um treino hoje e vê-o na semana atual.
  await page.goto("/workouts/new");
  await page.getByLabel("Repetições da série 1").fill("10");
  await page.getByLabel("Peso (kg) da série 1").fill("50");
  await page.getByRole("button", { name: "Guardar treino" }).click();
  await expect(page).toHaveURL(/\/workouts$/);

  await page.goto("/relatorios?semana=atual");
  await expect(page.getByText("Sem registos nesta semana")).toHaveCount(0);
  await expect(page.getByText("Volume", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Nenhum recorde esta semana. Continua!"),
  ).toBeVisible();
});

test("o endpoint do cron exige o segredo e funciona com ele", async ({
  request,
}) => {
  const unauthorized = await request.get("/api/cron/weekly-report");
  expect(unauthorized.status()).toBe(401);

  const wrongSecret = await request.get("/api/cron/weekly-report", {
    headers: { Authorization: "Bearer errado" },
  });
  expect(wrongSecret.status()).toBe(401);

  const ok = await request.get("/api/cron/weekly-report", {
    headers: { Authorization: "Bearer e2e-cron-secret" },
  });
  expect(ok.status()).toBe(200);
  const body = (await ok.json()) as { ok: boolean; skipped?: string };
  expect(body.ok).toBe(true);
  // Sem provider de email configurado, o cron é um no-op explícito.
  expect(body.skipped).toBeTruthy();
});
