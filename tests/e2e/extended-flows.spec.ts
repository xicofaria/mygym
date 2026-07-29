import { expect, test, type Page } from "@playwright/test";

const OWNER = {
  email: "e2e@example.com",
  password: "e2e-password-123",
};
const PARTNER = {
  email: "e2e-partner@example.com",
  password: "e2e-partner-password-123",
};

async function login(
  page: Page,
  credentials: { email: string; password: string },
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Palavra-passe").fill(credentials.password);
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function createWorkout(page: Page, notes: string) {
  await page.goto("/workouts/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Repetições da série 1").fill("8");
  await page.getByLabel("Peso (kg) da série 1").fill("42.5");
  await page.getByPlaceholder("Como correu?").fill(notes);
  await page.getByRole("button", { name: "Guardar treino" }).click();
  await expect(page).toHaveURL(/\/workouts$/);
  return page.locator(".card").filter({ hasText: notes });
}

async function confirmDeletion(page: Page, button: ReturnType<Page["locator"]>) {
  page.once("dialog", (dialog) => dialog.accept());
  await button.click();
}

test("login inválido é recusado sem criar uma sessão", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("login-invalido@example.test");
  await page.getByLabel("Palavra-passe").fill("palavra-passe-errada");
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page.getByText("Email ou palavra-passe inválidos.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("uma medição corporal pode ser criada, isolada e eliminada", async ({
  page,
}) => {
  const notes = "Medição E2E isolada";
  await login(page, OWNER);
  await page.goto("/body");
  await page.getByRole("button", { name: "+ Adicionar medição" }).click();

  const form = page.locator("form").filter({ hasText: "Gordura corporal (%)" });
  await form.getByLabel("Data").fill("2026-01-15");
  await form.getByLabel("Peso (kg)").fill("81.4");
  await form.getByLabel("Cintura (cm)").fill("88.5");
  await form.getByLabel("Notas (opcional)").fill(notes);
  await form.getByRole("button", { name: "Guardar", exact: true }).click();

  const metric = page.locator(".card").filter({ hasText: notes });
  await expect(metric).toContainText("81.4 kg");
  await expect(metric).toContainText("cintura 88.5");

  await page.getByRole("button", { name: "E2E Partner" }).click();
  await expect(page.getByRole("heading", { name: "Corpo" })).toBeVisible();
  await expect(page.getByText("Medidas de E2E Partner")).toBeVisible();
  await expect(page.getByText(notes)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "+ Adicionar medição" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Eu" }).click();
  await expect(page.getByText(notes)).toBeVisible();
  const ownedMetric = page.locator(".card").filter({ hasText: notes });
  await confirmDeletion(
    page,
    ownedMetric.getByRole("button", { name: "Eliminar" }),
  );
  await expect(page.getByText(notes)).toHaveCount(0);
});

test("um modelo de treino pode ser criado, usado e eliminado", async ({
  page,
}) => {
  const name = "Modelo E2E peito e pernas";
  await login(page, OWNER);
  await page.goto("/workouts/templates");
  await page.getByRole("button", { name: "+ Novo modelo" }).click();

  const form = page.locator("form").filter({ hasText: "Nome do modelo" });
  await form.locator("input").fill(name);
  await form.getByRole("button", { name: "Bench Press", exact: true }).click();
  await form.getByRole("button", { name: "Squat", exact: true }).click();
  await form.getByRole("button", { name: "Guardar modelo" }).click();
  await expect(page).toHaveURL(/\/workouts\/templates$/);

  const template = page.locator(".card").filter({ hasText: name });
  await expect(template).toContainText("Bench Press, Squat");
  await template.getByRole("link", { name: "Usar" }).click();
  await expect(page).toHaveURL(/\/workouts\/new\?template=\d+$/);
  await expect(page.getByLabel("Exercício da série 1")).toHaveValue(/\d+/);
  await expect(
    page.getByLabel("Exercício da série 1").locator("option:checked"),
  ).toHaveText("Bench Press");
  await expect(
    page.getByLabel("Exercício da série 2").locator("option:checked"),
  ).toHaveText("Squat");

  await page.goto("/workouts/templates");
  const ownedTemplate = page.locator(".card").filter({ hasText: name });
  await confirmDeletion(
    page,
    ownedTemplate.getByRole("button", { name: "Eliminar" }),
  );
  await expect(page.getByText(name)).toHaveCount(0);
});

test("treinos ficam isolados e só o proprietário os pode editar ou eliminar", async ({
  page,
}) => {
  const notes = "Treino E2E para testar propriedade";
  await login(page, OWNER);
  const workout = await createWorkout(page, notes);
  await expect(workout).toBeVisible();
  const editPath = await workout
    .getByRole("link", { name: "Editar" })
    .getAttribute("href");
  expect(editPath).toMatch(/^\/workouts\/\d+\/edit$/);

  // Viewing the partner's data never exposes the owner's workout or write UI.
  await page.getByRole("button", { name: "E2E Partner" }).click();
  await expect(
    page.getByText("Registo de treinos de E2E Partner"),
  ).toBeVisible();
  await expect(page.getByText(notes)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "+ Registar" })).toHaveCount(0);

  // Authenticating as the second user also prevents a direct edit URL from
  // revealing or modifying the first user's workout.
  await page.getByRole("button", { name: "Terminar sessão" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, PARTNER);
  await page.goto(editPath!);
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();

  // Return as the owner and remove the fixture through the normal UI.
  await page.context().clearCookies();
  await login(page, OWNER);
  await page.goto("/workouts");
  const ownedWorkout = page.locator(".card").filter({ hasText: notes });
  await expect(ownedWorkout).toBeVisible();
  await confirmDeletion(
    page,
    ownedWorkout.getByRole("button", { name: "Eliminar" }),
  );
  await expect(page.getByText(notes)).toHaveCount(0);
});

test("o rascunho de treino sobrevive a uma perda de ligação", async ({
  context,
  page,
}) => {
  const notes = "Rascunho E2E guardado localmente";
  const draftKey = "gym-tracker:workout-draft:new";
  await login(page, OWNER);
  await page.goto("/workouts/new");
  await page.evaluate((key) => localStorage.removeItem(key), draftKey);
  await page.reload();
  await expect(page.getByRole("status")).toHaveCount(0);

  await page.getByLabel("Repetições da série 1").fill("9");
  await page.getByLabel("Peso (kg) da série 1").fill("35");
  await page.getByPlaceholder("Como correu?").fill(notes);
  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key), draftKey),
    )
    .not.toBeNull();

  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("Sem ligação");
  await page.getByLabel("Repetições da série 1").fill("11");
  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key), draftKey),
    )
    .toContain('"reps":"11"');

  await context.setOffline(false);
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.goto("/workouts");
  await page.goto("/workouts/new");
  await expect(
    page.getByText("Recuperámos o rascunho guardado neste dispositivo."),
  ).toBeVisible();
  await expect(page.getByLabel("Repetições da série 1")).toHaveValue("11");
  await expect(page.getByLabel("Peso (kg) da série 1")).toHaveValue("35");
  await expect(page.getByPlaceholder("Como correu?")).toHaveValue(notes);
  await page.evaluate((key) => localStorage.removeItem(key), draftKey);
});
