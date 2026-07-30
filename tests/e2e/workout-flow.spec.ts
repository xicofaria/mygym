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

test("login, create, edit and repeat a workout", async ({ page }, testInfo) => {
  const fixtureNotes = `Treino E2E principal — tentativa ${testInfo.retry}`;
  const workoutDate = new Date().toISOString().slice(0, 10);
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Palavra-passe").fill("e2e-password-123");
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page.getByRole("heading", { name: "O teu progresso" })).toBeVisible();

  await page.goto("/workouts/new");
  await fillSet(page, "10", "20");
  await page.getByLabel("Data").fill(workoutDate);
  await page.getByPlaceholder("Como correu?").fill(fixtureNotes);
  await page.getByRole("button", { name: "Guardar treino" }).click();

  await expect(page).toHaveURL(/\/workouts$/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("gym-tracker:workout-draft:new"),
      ),
    )
    .toBeNull();
  let workout = page.locator(".card").filter({ hasText: fixtureNotes });
  await expect(workout.getByText("10×20kg")).toBeVisible();

  await page.goto("/dashboard");
  const calendarDay = page.locator(
    `[data-workout-date="${workoutDate}"]`,
  );
  await expect(calendarDay).toBeVisible();
  await expect(calendarDay).toHaveAttribute("data-count", /^[1-9]\d*$/);
  await calendarDay.click();
  await expect(page).toHaveURL(
    new RegExp(`/workouts\\?date=${workoutDate}$`),
  );
  workout = page.locator(".card").filter({ hasText: fixtureNotes });
  await expect(workout).toBeVisible();

  await workout.getByRole("link", { name: "Editar" }).click();
  await fillSet(page, "12");
  await page.getByRole("button", { name: "Guardar alterações" }).click();
  workout = page.locator(".card").filter({ hasText: fixtureNotes });
  await expect(workout.getByText("12×20kg")).toBeVisible();

  await page.getByRole("link", { name: "Repetir último" }).click();
  await expect(reps(page)).toHaveValue("12");
  await expect(weight(page)).toHaveValue("20");
  await expect(page.getByText(/Última: 20kg × 12/)).toBeVisible();

  await page.goto("/workouts");
  workout = page.locator(".card").filter({ hasText: fixtureNotes });
  page.once("dialog", (dialog) => dialog.accept());
  await workout.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText(fixtureNotes)).toHaveCount(0);
});

test("planear um treino e registá-lo a partir do calendário mensal", async ({
  page,
}) => {
  // Unique per run: a failed attempt leaves fixtures behind on a reused
  // local database, and duplicated text would trip strict-mode locators.
  const runId = Date.now().toString(36);
  const planNotes = `Plano E2E ${runId}`;
  const workoutNotes = `Sessão E2E ${runId}`;
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Palavra-passe").fill("e2e-password-123");
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Selecting a future day shows the plan form; the month view follows the date.
  await page.goto(`/workouts?date=${futureDate}`);
  const dayCell = page.locator(`[data-month-date="${futureDate}"]`);
  await expect(dayCell).toBeVisible();

  // A controlled input only keeps its value after hydration; asserting it
  // stuck keeps a pre-hydration click from submitting the form natively.
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Notas (opcional)").fill(planNotes);
  await expect(page.getByPlaceholder("Notas (opcional)")).toHaveValue(planNotes);
  await page.getByRole("button", { name: "Planear treino" }).click();

  const planRow = page.locator("[data-plan-id]").filter({ hasText: planNotes });
  await expect(planRow).toBeVisible();
  await expect(dayCell).toHaveAttribute("data-planned", /^[1-9]\d*$/);
  await expect(planRow.getByText("Planeado", { exact: true })).toBeVisible();

  // Register the planned workout; the form comes prefilled with the date.
  await planRow.getByRole("link", { name: "Registar", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/workouts/new\\?date=${futureDate}$`),
  );
  await expect(page.getByLabel("Data")).toHaveValue(futureDate);
  await fillSet(page, "10", "30");
  await page.getByPlaceholder("Como correu?").fill(workoutNotes);
  await page.getByRole("button", { name: "Guardar treino" }).click();
  await expect(page).toHaveURL(/\/workouts$/);

  // The day now counts as done and the plan shows as concluded.
  await page.goto(`/workouts?date=${futureDate}`);
  await expect(dayCell).toHaveAttribute("data-workouts", /^[1-9]\d*$/);
  await expect(planRow.getByText("Concluído")).toBeVisible();

  // Clean up the fixtures: first the plan, then the workout.
  page.once("dialog", (dialog) => dialog.accept());
  await planRow.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText(planNotes)).toHaveCount(0);

  const doneWorkout = page.locator(".card").filter({ hasText: workoutNotes });
  page.once("dialog", (dialog) => dialog.accept());
  await doneWorkout.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText(workoutNotes)).toHaveCount(0);
});

test("escolher os grupos musculares de um treino planeado", async ({ page }) => {
  const futureDate = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  // A custom group keeps the run unique on a database that persists locally.
  const customGroup = `Grupo E2E ${Date.now().toString(36)}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Palavra-passe").fill("e2e-password-123");
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // The weekly split persists and survives a reload.
  await page.goto("/workouts/routine");
  await page.waitForLoadState("networkidle");
  const sunday = page.locator("section").filter({ hasText: "Domingo" });
  await sunday.getByRole("button", { name: /Domingo/ }).click();
  await sunday.getByRole("button", { name: "Mobilidade", exact: true }).click();
  await expect(sunday.getByText("Mobilidade").first()).toBeVisible();

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(
    page.locator("section").filter({ hasText: "Domingo" }).getByText("Mobilidade"),
  ).toBeVisible();

  // Planning a day records what it trains, suggestions plus anything typed.
  await page.goto(`/workouts?date=${futureDate}`);
  await page.waitForLoadState("networkidle");
  const planForm = page.locator("form").filter({ hasText: "O que vais treinar" });
  await planForm.getByRole("button", { name: "Peito", exact: true }).click();
  await planForm.getByRole("button", { name: "Tríceps", exact: true }).click();
  await planForm.getByLabel("Adicionar outro grupo").fill(customGroup);
  await planForm.getByRole("button", { name: "Adicionar" }).click();
  await planForm.getByRole("button", { name: "Planear treino" }).click();

  const planRow = page.locator("[data-plan-id]").filter({ hasText: customGroup });
  await expect(planRow).toContainText("Peito · Tríceps");
  await expect(page.locator(`[data-month-date="${futureDate}"]`)).toHaveAttribute(
    "data-planned",
    /^[1-9]\d*$/,
  );

  // Clean up both fixtures so a rerun starts from the same state.
  page.once("dialog", (dialog) => dialog.accept());
  await planRow.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText(customGroup)).toHaveCount(0);

  await page.goto("/workouts/routine");
  await page.waitForLoadState("networkidle");
  const sundayAgain = page.locator("section").filter({ hasText: "Domingo" });
  await sundayAgain.getByRole("button", { name: /Domingo/ }).click();
  await sundayAgain.getByRole("button", { name: "Mobilidade", exact: true }).click();
  await expect(sundayAgain.getByText("Descanso")).toBeVisible();
});
