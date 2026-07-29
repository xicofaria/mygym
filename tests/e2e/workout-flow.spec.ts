import { expect, test, type Page } from "@playwright/test";

const reps = (page: Page) => page.getByLabel("Repetições da série 1");
const weight = (page: Page) => page.getByLabel("Peso (kg) da série 1");

// The set inputs are controlled, so a value only sticks once React has
// hydrated. Asserting it stuck keeps a pre-hydration click — which would
// submit the form natively and skip the server action — from surfacing
// later as a confusing URL mismatch.
async function fillSet(page: Page, repsValue: string, weightValue?: string) {
  await page.waitForLoadState("networkidle");
  await reps(page).fill(repsValue);
  await expect(reps(page)).toHaveValue(repsValue);
  if (weightValue !== undefined) {
    await weight(page).fill(weightValue);
    await expect(weight(page)).toHaveValue(weightValue);
  }
}

test("login, create, edit and repeat a workout", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Palavra-passe").fill("e2e-password-123");
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page.getByRole("heading", { name: "O teu progresso" })).toBeVisible();

  await page.goto("/workouts/new");
  await fillSet(page, "10", "20");
  await page.getByRole("button", { name: "Guardar treino" }).click();

  await expect(page).toHaveURL(/\/workouts$/);
  await expect(page.getByText("10×20kg")).toBeVisible();

  await page.getByRole("link", { name: "Editar" }).first().click();
  await fillSet(page, "12");
  await page.getByRole("button", { name: "Guardar alterações" }).click();
  await expect(page.getByText("12×20kg")).toBeVisible();

  await page.getByRole("link", { name: "Repetir último" }).click();
  await expect(reps(page)).toHaveValue("12");
  await expect(weight(page)).toHaveValue("20");
  await expect(page.getByText(/Última: 20kg × 12/)).toBeVisible();
});
