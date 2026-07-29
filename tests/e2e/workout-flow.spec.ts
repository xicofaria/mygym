import { expect, test } from "@playwright/test";

test("login, create, edit and repeat a workout", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Palavra-passe").fill("e2e-password-123");
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page.getByRole("heading", { name: "O teu progresso" })).toBeVisible();

  await page.goto("/workouts/new");
  await page.getByLabel("Repetições da série 1").fill("10");
  await page.getByLabel("Peso (kg) da série 1").fill("20");
  await page.getByRole("button", { name: "Guardar treino" }).click();

  await expect(page).toHaveURL(/\/workouts$/);
  await expect(page.getByText("10×20kg")).toBeVisible();

  await page.getByRole("link", { name: "Editar" }).first().click();
  await page.getByLabel("Repetições da série 1").fill("12");
  await page.getByRole("button", { name: "Guardar alterações" }).click();
  await expect(page.getByText("12×20kg")).toBeVisible();

  await page.getByRole("link", { name: "Repetir último" }).click();
  await expect(page.getByLabel("Repetições da série 1")).toHaveValue("12");
  await expect(page.getByLabel("Peso (kg) da série 1")).toHaveValue("20");
  await expect(page.getByText(/Última: 20kg × 12/)).toBeVisible();
});
