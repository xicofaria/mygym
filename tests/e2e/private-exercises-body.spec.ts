import { createClient } from "@libsql/client";
import { expect, test, type Page, type Request } from "@playwright/test";

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

async function createExercise(page: Page, name: string) {
  await page.goto("/exercises");
  await page.getByRole("button", { name: "+ Novo exercício" }).click();
  await page.getByLabel("Nome do exercício", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Adicionar exercício", exact: true })
    .click();
  const article = page.getByRole("article", { name, exact: true });
  await expect(article).toBeVisible();
  const href = await article.getByRole("link").getAttribute("href");
  return Number(href!.split("/").at(-1));
}

async function replay(page: Page, request: Request, args?: unknown[]) {
  const response = await page.request.post(request.url(), {
    headers: {
      "Next-Action": request.headers()["next-action"],
      "Content-Type": request.headers()["content-type"],
      Origin: new URL(request.url()).origin,
      Cookie: (await page.context().cookies())
        .map((c) => `${c.name}=${c.value}`)
        .join("; "),
    },
    data: args ? JSON.stringify(args) : request.postData()!,
  });
  return response.text();
}

const actionRequest = (request: Request) =>
  request.method() === "POST" && Boolean(request.headers()["next-action"]);

test("private catalogue isolates edits, direct IDs and equal names between accounts", async ({
  page,
  browser,
}) => {
  await login(page);
  const name = `Máquina privada ${Date.now()}`;
  const id = await createExercise(page, name);
  const article = page.getByRole("article", { name, exact: true });
  await article.getByRole("button", { name: `Editar ${name}` }).click();
  await article.getByLabel("Nomes alternativos").fill("Máquina só minha");
  const updatePromise = page.waitForRequest(actionRequest);
  await article.getByRole("button", { name: "Guardar detalhes" }).click();
  const update = await updatePromise;
  await expect(
    article.getByText("Máquina só minha", { exact: true }),
  ).toBeVisible();
  const base = page.getByRole("article", { name: "Leg Press", exact: true });
  await expect(
    base.getByRole("button", { name: "Editar Leg Press" }),
  ).toHaveCount(0);
  const baseId = Number(
    (await base.getByRole("link").getAttribute("href"))!.split("/").at(-1),
  );
  const updateArgs = JSON.parse(update.postData()!);
  expect(await replay(page, update, [baseId, updateArgs[1]])).toContain(
    "Só podes editar os teus exercícios privados",
  );

  const favoritePromise = page.waitForRequest(actionRequest);
  await article
    .getByRole("button", { name: `Adicionar ${name} aos favoritos` })
    .click();
  const favorite = await favoritePromise;
  await expect(
    article.getByRole("button", { name: `Remover ${name} dos favoritos` }),
  ).toBeVisible();

  const context = await browser.newContext();
  const partner = await context.newPage();
  await login(partner, true);
  await partner.goto("/exercises");
  await expect(partner.getByRole("article", { name, exact: true })).toHaveCount(
    0,
  );
  expect(await replay(partner, update)).toContain(
    "Só podes editar os teus exercícios privados",
  );
  expect(await replay(partner, favorite)).toContain("Exercício não encontrado");
  await partner.goto(`/exercises/${id}`);
  await expect(partner.getByRole("heading", { name })).toHaveCount(0);
  await partner.goto("/workouts/new");
  await expect(
    partner
      .getByLabel("Exercício da série 1", { exact: true })
      .locator(`option[value="${id}"]`),
  ).toHaveCount(0);
  const partnerId = await createExercise(partner, name);
  expect(partnerId).not.toBe(id);
  await page.goto("/workouts/new");
  await page
    .getByLabel("Exercício da série 1", { exact: true })
    .selectOption(String(id));
  await page.getByLabel("Repetições da série 1").fill("12");
  await page.getByLabel("Peso (kg) da série 1").fill("2,8");
  const workoutPromise = page.waitForRequest(actionRequest);
  await page
    .getByRole("button", { name: "Guardar treino", exact: true })
    .click();
  const workout = await workoutPromise;
  await expect(page).toHaveURL(/\/workouts$/);
  expect(await replay(partner, workout)).toContain(
    "Um dos exercícios selecionados já não está disponível",
  );

  await page.goto("/workouts/templates");
  await page.getByRole("button", { name: "+ Novo modelo" }).click();
  await page.getByLabel("Nome do modelo").fill(`Modelo ${name}`);
  await page.getByRole("button", { name, exact: true }).click();
  const templatePromise = page.waitForRequest(actionRequest);
  await page.getByRole("button", { name: "Guardar modelo" }).click();
  const template = await templatePromise;
  await expect(
    page.getByRole("button", { name: "+ Novo modelo" }),
  ).toBeVisible();
  expect(await replay(partner, template)).toContain(
    "Um dos exercícios selecionados já não está disponível",
  );
  await page.goto("/exercises");
  await page.reload();
  await expect(
    article.getByText("Máquina só minha", { exact: true }),
  ).toBeVisible();
  await context.close();
});

test("body decimals preserve precision, reject malformed optional fields and keep drafts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/body");
  await page.getByRole("button", { name: "+ Adicionar medição" }).click();
  const form = page
    .locator("form")
    .filter({ has: page.getByLabel("Gordura corporal (%)") });
  const note = `Medição decimal ${Date.now()}`;
  await form.getByLabel("Peso (kg)", { exact: true }).fill("72,55");
  await form.getByLabel("Cintura (cm)").fill("inválido");
  await form.getByLabel("Notas (opcional)").fill(note);
  await form.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("cintura");
  await page.reload();
  await expect(form.getByLabel("Cintura (cm)")).toHaveValue("inválido");
  await form.getByLabel("Cintura (cm)").fill("80.125");
  await form.getByLabel("Gordura corporal (%)").fill("0");
  // Hold the server action: the draft must survive until persistence is confirmed.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/body", async (route) => {
    if (route.request().headers()["next-action"]) await gate;
    await route.continue();
  });
  const requestPromise = page.waitForRequest(actionRequest);
  await form.getByRole("button", { name: "Guardar", exact: true }).click();
  const bodyRequest = await requestPromise;
  const draft = await page.evaluate(
    () =>
      Object.entries(localStorage).find(([key]) =>
        key.startsWith("gym-tracker:body-metric-draft:user-"),
      )?.[1],
  );
  expect(draft).toContain("72,55");
  release();
  await expect(form).toHaveCount(0);
  await page.unroute("**/body");
  await page.reload();
  await expect(page.getByText(note, { exact: true })).toBeVisible();
  const bodyArgs = JSON.parse(bodyRequest.postData()!);
  expect(
    await replay(page, bodyRequest, [{ ...bodyArgs[0], waistCm: "inválido" }]),
  ).toContain("Verifica os dados e tenta novamente");
  const database = createClient({ url: "file:./e2e.db" });
  try {
    const result = await database.execute({
      sql: "SELECT weight_kg, waist_cm, body_fat_pct, height_cm FROM body_metrics WHERE notes = ?",
      args: [note],
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].weight_kg).toBe(72.55);
    expect(result.rows[0].waist_cm).toBe(80.125);
    expect(result.rows[0].body_fat_pct).toBe(0);
    expect(result.rows[0].height_cm).toBeNull();
  } finally {
    database.close();
  }
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith("gym-tracker:body-metric-draft:user-"),
        ).length,
    ),
  ).toBe(0);
});
