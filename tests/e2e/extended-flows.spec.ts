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
}, testInfo) => {
  const day = 15 + testInfo.retry;
  const date = `2026-01-${String(day).padStart(2, "0")}`;
  const formattedDate = `${String(day).padStart(2, "0")}/01/2026`;
  const notes = `Medição E2E isolada — tentativa ${testInfo.retry}`;
  await login(page, OWNER);
  await page.goto("/body");
  await page.getByRole("button", { name: "+ Adicionar medição" }).click();

  const form = page.locator("form").filter({ hasText: "Gordura corporal (%)" });
  await form.getByLabel("Data").fill(date);
  await form.getByLabel("Peso (kg)").fill("81.4");
  await form.getByLabel("Cintura (cm)").fill("88.5");
  await form.getByLabel("Notas (opcional)").fill(notes);
  await form.getByRole("button", { name: "Guardar", exact: true }).click();

  // The fixture is backdated, so the full range is where its row shows up.
  await page.goto("/body?range=all");
  const row = page.locator("tr").filter({ hasText: formattedDate });
  await expect(row).toContainText("81.4");
  await expect(row).toContainText("88.5");
  await expect(page.getByText(notes)).toBeVisible();

  await page.getByRole("button", { name: "E2E Partner" }).click();
  await expect(page.getByRole("heading", { name: "Corpo" })).toBeVisible();
  await expect(page.getByText("Evolução de E2E Partner")).toBeVisible();
  await expect(page.getByText(notes)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "+ Adicionar medição" }),
  ).toHaveCount(0);

  await page.goto("/body?range=all");
  await expect(page.getByText(notes)).toBeVisible();
  const ownedRow = page.locator("tr").filter({ hasText: formattedDate });
  await confirmDeletion(
    page,
    ownedRow.getByRole("button", { name: "Eliminar" }),
  );
  await expect(page.getByText(notes)).toHaveCount(0);
});

test("um modelo de treino pode ser criado, usado e eliminado", async ({
  page,
}) => {
  const runId = Date.now().toString(36);
  const name = `Modelo E2E peito e pernas ${runId}`;
  const planNotes = `Plano que mantém dados ${runId}`;
  const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
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

  // A plan can keep using the model while switching prefills without losing
  // either its date or its identity in the URL.
  await page.goto(`/workouts?date=${futureDate}`);
  const planForm = page
    .locator("form")
    .filter({ hasText: "O que vais treinar" });
  await planForm.getByRole("button", { name: "Peito", exact: true }).click();
  await planForm.getByLabel("Começar de um modelo (opcional)").selectOption({
    label: name,
  });
  await planForm.getByLabel("Notas do plano").fill(planNotes);
  await planForm.getByRole("button", { name: "Planear treino" }).click();
  const plan = page.locator("[data-plan-id]").filter({ hasText: planNotes });
  await expect(plan).toContainText(name);

  await plan.getByRole("link", { name: "Registar", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/workouts/new\\?date=${futureDate}&plan=\\d+&template=\\d+$`,
    ),
  );
  await page.getByRole("link", { name: "Do zero", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/workouts/new\\?date=${futureDate}&plan=\\d+$`),
  );
  await expect(page.getByLabel("Data")).toHaveValue(futureDate);
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/workouts/new\\?date=${futureDate}&plan=\\d+&template=\\d+$`,
    ),
  );

  await page.goto("/workouts/templates");
  const ownedTemplate = page.locator(".card").filter({ hasText: name });
  await confirmDeletion(
    page,
    ownedTemplate.getByRole("button", { name: "Eliminar" }),
  );
  await expect(page.getByText(name)).toHaveCount(0);

  // Removing the template clears only the optional FK: the plan, its notes
  // and its muscle groups survive.
  await page.goto(`/workouts?date=${futureDate}`);
  const preservedPlan = page
    .locator("[data-plan-id]")
    .filter({ hasText: planNotes });
  await expect(preservedPlan).toContainText("Peito");
  await expect(preservedPlan).toContainText(planNotes);
  await expect(preservedPlan).not.toContainText(name);

  await confirmDeletion(
    page,
    preservedPlan.getByRole("button", { name: "Eliminar" }),
  );
  await expect(page.getByText(planNotes)).toHaveCount(0);
});

test("treinos ficam isolados e só o proprietário os pode editar ou eliminar", async ({
  page,
}, testInfo) => {
  const notes = `Treino E2E para testar propriedade — tentativa ${testInfo.retry}`;
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
  await login(page, OWNER);
  await page.goto("/workouts/new");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (
        key === "gym-tracker:workout-draft:new" ||
        /^gym-tracker:workout-draft:user-\d+:new$/.test(key)
      ) {
        localStorage.removeItem(key);
      }
    }
  });
  await page.reload();
  await expect(page.getByRole("status")).toHaveCount(0);

  await page.getByLabel("Repetições da série 1").fill("9");
  await page.getByLabel("Peso (kg) da série 1").fill("35");
  await page.getByPlaceholder("Como correu?").fill(notes);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((candidate) =>
          /^gym-tracker:workout-draft:user-\d+:new$/.test(candidate),
        );
        return key ? localStorage.getItem(key) : null;
      }),
    )
    .not.toBeNull();

  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("Sem ligação");
  await page.getByLabel("Repetições da série 1").fill("11");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((candidate) =>
          /^gym-tracker:workout-draft:user-\d+:new$/.test(candidate),
        );
        return key ? localStorage.getItem(key) : null;
      }),
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
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (/^gym-tracker:workout-draft:user-\d+:new$/.test(key)) {
        localStorage.removeItem(key);
      }
    }
  });
});

test("um rascunho do formulário em branco não substitui uma data pedida no URL", async ({
  page,
}) => {
  const planned = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const wipe = () =>
    page.evaluate(() =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith("gym-tracker:"))
        .forEach((key) => localStorage.removeItem(key)),
    );

  await login(page, OWNER);
  await page.goto("/workouts/new");
  await wipe();
  await page.reload();
  await page.waitForLoadState("networkidle");

  // Typing here saves a draft for the blank form.
  await page.getByLabel("Repetições da série 1").fill("5");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((candidate) =>
          /^gym-tracker:workout-draft:user-\d+:new$/.test(candidate),
        );
        return key ? localStorage.getItem(key) : null;
      }),
    )
    .not.toBeNull();

  // Registering a planned session must keep the planned date, or the workout
  // would silently be logged on the wrong day.
  await page.goto(`/workouts/new?date=${planned}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Data")).toHaveValue(planned);
  await expect(page.getByLabel("Repetições da série 1")).toHaveValue("");

  // That form keeps its own draft, so offline recovery still works per URL.
  await page.getByLabel("Repetições da série 1").fill("9");
  await page.goto(`/workouts/new?date=${planned}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Data")).toHaveValue(planned);
  await expect(page.getByLabel("Repetições da série 1")).toHaveValue("9");

  await wipe();
});

test("um recorde pessoal é marcado só quando supera o anterior", async ({
  page,
}) => {
  const run = Date.now().toString(36).slice(-5);
  const exercise = `Supino E2E ${run}`;
  const first = `Primeira sessão ${run}`;
  const better = `Sessão melhor ${run}`;
  await login(page, OWNER);

  // A fresh exercise, so no earlier history can influence the comparison.
  await page.goto("/exercises");
  await page.getByRole("button", { name: "+ Novo exercício" }).click();
  await page.getByLabel("Nome do exercício").fill(exercise);
  await page.getByLabel("Grupo muscular").fill("Peito");
  await page.getByRole("button", { name: "Adicionar exercício" }).click();
  await expect(page.getByText(exercise)).toBeVisible();

  const logSession = async (weight: string, notes: string) => {
    await page.goto("/workouts/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Exercício da série 1").selectOption({ label: exercise });
    await page.getByLabel("Repetições da série 1").fill("8");
    await page.getByLabel("Peso (kg) da série 1").fill(weight);
    await page.getByPlaceholder("Como correu?").fill(notes);
    await page.getByRole("button", { name: "Guardar treino" }).click();
    await expect(page).toHaveURL(/\/workouts$/);
  };

  await logSession("50", first);
  const firstCard = page.locator(".card").filter({ hasText: first });
  await expect(firstCard).toBeVisible();
  await expect(firstCard.locator("[data-record]")).toHaveCount(0);

  await logSession("55", better);
  const betterCard = page.locator(".card").filter({ hasText: better });
  await expect(betterCard.locator("[data-record]")).toBeVisible();
  // The earlier session must not gain a badge retroactively.
  await expect(
    page.locator(".card").filter({ hasText: first }).locator("[data-record]"),
  ).toHaveCount(0);

  // Renaming keeps every logged set attached to the exercise.
  await page.goto("/exercises");
  await page.getByRole("link", { name: new RegExp(exercise) }).click();
  await page.waitForURL(/\/exercises\/\d+/);
  await expect(page.getByText("Recordes")).toBeVisible();
  await page.getByRole("button", { name: "Editar exercício" }).click();
  await page.getByLabel("Nome do exercício").fill(`${exercise} renomeado`);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("heading", { name: `${exercise} renomeado` })).toBeVisible();
  // The sets stayed attached to the exercise through the rename.
  await expect(page.getByText("55kg × 8")).toBeVisible();
  await expect(page.getByText("Sessões")).toBeVisible();

  // Deleting is refused while sets still point at it.
  await page.getByRole("button", { name: "Editar exercício" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Eliminar do catálogo" }).click();
  await expect(page.getByText(/não pode ser eliminado/)).toBeVisible();

  // Remove the sessions, and only then may the exercise go.
  for (const notes of [first, better]) {
    await page.goto("/workouts");
    await confirmDeletion(
      page,
      page.locator(".card").filter({ hasText: notes }).getByRole("button", { name: "Eliminar" }),
    );
    await expect(page.getByText(notes)).toHaveCount(0);
  }
  await page.goto("/exercises");
  await page.getByRole("link", { name: new RegExp(exercise) }).click();
  await page.waitForURL(/\/exercises\/\d+/);
  await page.getByRole("button", { name: "Editar exercício" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Eliminar do catálogo" }).click();
  await expect(page).toHaveURL(/\/exercises$/);
  await expect(page.getByText(exercise)).toHaveCount(0);
});

test("um dia planeado por grupos sugere o modelo que os treina", async ({
  page,
}) => {
  const run = Date.now().toString(36).slice(-5);
  const templateName = `Modelo peito ${run}`;
  const planned = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  await login(page, OWNER);

  await page.goto("/workouts/templates");
  await page.getByRole("button", { name: "+ Novo modelo" }).click();
  const form = page.locator("form").filter({ hasText: "Nome do modelo" });
  await form.getByLabel("Nome do modelo").fill(templateName);
  await form.getByRole("button", { name: "Bench Press", exact: true }).click();
  await page.getByRole("button", { name: "Guardar modelo" }).click();
  await page.waitForTimeout(1500);
  await page.goto("/workouts/templates");
  await expect(page.locator(".card").filter({ hasText: templateName })).toBeVisible();

  // Plan the day by muscle group only — no template attached.
  await page.goto(`/workouts?date=${planned}`);
  await page.waitForLoadState("networkidle");
  const planForm = page.locator("form").filter({ hasText: "O que vais treinar" });
  await planForm.getByRole("button", { name: "Peito", exact: true }).click();
  await planForm.getByRole("button", { name: "Planear treino" }).click();
  await page.waitForTimeout(2000);

  const suggestion = page.locator("[data-template-suggestion]").filter({
    hasText: templateName,
  });
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await page.waitForURL(/\/workouts\/new\?/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Data")).toHaveValue(planned);
  await expect(
    page.getByLabel("Exercício da série 1").locator("option:checked"),
  ).toHaveText("Bench Press");

  await page.goto(`/workouts?date=${planned}`);
  await confirmDeletion(
    page,
    page.locator("[data-plan-id]").getByRole("button", { name: "Eliminar" }).first(),
  );
  await page.goto("/workouts/templates");
  await confirmDeletion(
    page,
    page.locator(".card").filter({ hasText: templateName }).getByRole("button", { name: "Eliminar" }),
  );
  await expect(page.getByText(templateName)).toHaveCount(0);
});
