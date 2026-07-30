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

async function logout(page: Page) {
  await page.getByRole("button", { name: "Terminar sessão" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function findLocalStorageKey(page: Page, prefix: string) {
  let result: string | null = null;
  await expect
    .poll(async () => {
      result = await page.evaluate(
        (keyPrefix) =>
          Object.keys(localStorage).find((key) =>
            key.startsWith(keyPrefix),
          ) ?? null,
        prefix,
      );
      return result;
    })
    .not.toBeNull();
  return result!;
}

test("rascunhos locais pertencem apenas à conta autenticada", async ({
  page,
}) => {
  const workoutNotes = "Rascunho privado do primeiro utilizador";
  const bodyNotes = "Medição privada do primeiro utilizador";

  await login(page, OWNER);
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.includes("draft")) localStorage.removeItem(key);
    }
    localStorage.setItem(
      "gym-tracker:body-metric-draft",
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        data: {
          date: "2026-02-01",
          notes: "rascunho corporal legacy",
          values: {
            weightKg: "81",
            bodyFatPct: "",
            waistCm: "",
            chestCm: "",
            armCm: "",
            thighCm: "",
            hipCm: "",
            heightCm: "",
          },
        },
      }),
    );
  });

  await page.goto("/body");
  await expect(
    page.getByRole("button", { name: "+ Adicionar medição" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("gym-tracker:body-metric-draft"),
      ),
    )
    .toBeNull();

  await page.getByRole("button", { name: "+ Adicionar medição" }).click();
  const bodyForm = page
    .locator("form")
    .filter({ hasText: "Gordura corporal (%)" });
  await bodyForm.getByLabel("Peso (kg)").fill("81.5");
  await bodyForm.getByLabel("Notas (opcional)").fill(bodyNotes);
  const ownerBodyKey = await findLocalStorageKey(
    page,
    "gym-tracker:body-metric-draft:user-",
  );

  await page.evaluate(() => {
    const legacyDraft = JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      data: {
        date: "2026-02-01",
        notes: "rascunho de treino legacy",
        rows: [{ exerciseId: 1, reps: "12", weight: "40" }],
      },
    });
    localStorage.setItem("gym-tracker:workout-draft:new", legacyDraft);
    localStorage.setItem(
      "gym-tracker:workout-draft:new:date:2026-02-01",
      legacyDraft,
    );
  });
  await page.goto("/workouts/new");
  await expect(page.getByPlaceholder("Como correu?")).toHaveValue("");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.keys(localStorage).filter(
            (key) =>
              key.startsWith("gym-tracker:workout-draft:") &&
              !/^gym-tracker:workout-draft:user-\d+:/.test(key),
          ).length,
      ),
    )
    .toBe(0);

  await page.getByLabel("Repetições da série 1").fill("8");
  await page.getByLabel("Peso (kg) da série 1").fill("42.5");
  await page.getByPlaceholder("Como correu?").fill(workoutNotes);
  const ownerWorkoutKey = await findLocalStorageKey(
    page,
    "gym-tracker:workout-draft:user-",
  );

  await logout(page);
  await login(page, PARTNER);

  await page.goto("/body");
  await expect(
    page.getByRole("button", { name: "+ Adicionar medição" }),
  ).toBeVisible();
  await expect(
    page.getByText("Recuperámos o rascunho guardado neste dispositivo."),
  ).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), ownerBodyKey),
  ).not.toBeNull();

  await page.goto("/workouts/new");
  await expect(page.getByPlaceholder("Como correu?")).toHaveValue("");
  await expect(
    page.getByText("Recuperámos o rascunho guardado neste dispositivo."),
  ).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), ownerWorkoutKey),
  ).not.toBeNull();

  await logout(page);
  await login(page, OWNER);
  await page.goto("/workouts/new");
  await expect(
    page.getByText("Recuperámos o rascunho guardado neste dispositivo."),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Como correu?")).toHaveValue(
    workoutNotes,
  );

  await page.goto("/body");
  await expect(
    page.getByText("Recuperámos o rascunho guardado neste dispositivo."),
  ).toBeVisible();
  await expect(bodyForm.getByLabel("Notas (opcional)")).toHaveValue(bodyNotes);

  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.includes("draft")) localStorage.removeItem(key);
    }
  });
});

test("o seletor só aparece em vistas de leitura e o documento é acessível", async ({
  page,
}) => {
  await login(page, OWNER);

  for (const pathname of ["/dashboard", "/workouts", "/body", "/exercises"]) {
    await page.goto(pathname);
    await expect(page.getByRole("button", { name: "E2E Partner" })).toBeVisible();
  }

  for (const pathname of [
    "/workouts/new",
    "/workouts/routine",
    "/workouts/templates",
    "/workouts/999999/edit",
  ]) {
    await page.goto(pathname);
    await expect(page.getByRole("button", { name: "E2E Partner" })).toHaveCount(0);
  }

  await page.goto("/workouts/new?user=2");
  await expect(page).toHaveURL(/\/workouts\/new$/);

  await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT");
  const viewport = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(viewport).not.toContain("maximum-scale");

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "E2E Partner" }).click();
  await expect(
    page.getByRole("button", { name: "E2E Partner" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await page.content()).not.toContain(PARTNER.email);
});
