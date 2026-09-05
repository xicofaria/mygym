import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Palavra-passe").fill("e2e-password-123");
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/workouts/new");
  await page.waitForLoadState("networkidle");
}
async function upload(page: Page) {
  // Real browser decode/re-encode; the provider is mocked, never billable.
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, 32, 32);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("Escolher fotografia da máquina")
    .setInputFiles({
      name: "machine.png",
      mimeType: "image/png",
      buffer: Buffer.from(base64, "base64"),
    });
  await expect(
    page.getByAltText("Fotografia da máquina a identificar"),
  ).toBeVisible();
}

test("decimal weights survive save, edit and repeat; incomplete sets are not dropped", async ({
  page,
}) => {
  await login(page);
  const notes = `Peso decimal ${Date.now()}`;
  await page.getByPlaceholder("Como correu?").fill(notes);
  await page.getByLabel("Repetições da série 1").fill("10");
  await page.getByLabel("Peso (kg) da série 1").fill("2,8");
  await page.getByRole("button", { name: "+ Adicionar série" }).click();
  await page.getByLabel("Peso (kg) da série 2").fill("");
  await page.getByRole("button", { name: "Guardar treino" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Verifica a série 2" }),
  ).toBeVisible();
  await page.getByLabel("Peso (kg) da série 2").fill("2.75");
  await page.getByRole("button", { name: "Guardar treino" }).click();
  await expect(page).toHaveURL(/\/workouts$/);
  let workout = page.locator(".card").filter({ hasText: notes });
  await workout.getByRole("link", { name: "Editar" }).click();
  await expect(page.getByLabel("Peso (kg) da série 1")).toHaveValue("2.8");
  await expect(page.getByLabel("Peso (kg) da série 2")).toHaveValue("2.75");
  await page.getByLabel("Peso (kg) da série 1").fill("3.8");
  await page.getByRole("button", { name: "Guardar alterações" }).click();
  await expect(page).toHaveURL(/\/workouts$/);
  await page.getByRole("link", { name: "Repetir último" }).click();
  await expect(page.getByLabel("Peso (kg) da série 1")).toHaveValue("3.8");
  await page.goto("/workouts");
  workout = page.locator(".card").filter({ hasText: notes });
  page.once("dialog", (d) => d.accept());
  await workout.getByRole("button", { name: "Eliminar" }).click();
  await expect(workout).toHaveCount(0);
});

test("photo suggests catalog exercise, requires confirmation and preserves filled sets", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Repetições da série 1").fill("12");
  await page.getByLabel("Peso (kg) da série 1").fill("2,8");
  const id = Number(
    await page
      .getByLabel("Exercício da série 1")
      .locator("option")
      .filter({ hasText: /^Leg Press$/ })
      .getAttribute("value"),
  );
  let calls = 0;
  await page.route("**/api/exercises/recognize", async (route) => {
    calls++;
    expect(route.request().headers()["content-type"]).toBe("image/jpeg");
    await route.fulfill({
      json: {
        candidates: [{ exerciseId: id, confidence: "medium" }],
        explanation: "Parece uma prensa de pernas. Confirma a máquina.",
      },
    });
  });
  await upload(page);
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Analisar fotografia" }).click();
  await expect(
    page.getByText("Confirma o exercício", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Exercício da série 2")).toHaveCount(0);
  await page.getByRole("button", { name: /Usar Leg Press/ }).click();
  await expect(page.getByLabel("Exercício da série 2")).toHaveValue(String(id));
  await expect(page.getByLabel("Peso (kg) da série 1")).toHaveValue("2,8");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("photo no match, service error and cancel leave manual selection available", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/exercises/recognize", (route) =>
    route.fulfill({
      json: { candidates: [], explanation: "Sem correspondência." },
    }),
  );
  await upload(page);
  await page.getByRole("button", { name: "Analisar fotografia" }).click();
  await expect(
    page.getByText("Sem correspondência no catálogo", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/exercises/recognize");
  await page.route("**/api/exercises/recognize", (route) =>
    route.fulfill({ status: 503, json: { error: "IA indisponível." } }),
  );
  await page.getByRole("button", { name: "Analisar fotografia" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "IA indisponível" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remover fotografia" }).click();
  await expect(
    page.getByAltText("Fotografia da máquina a identificar"),
  ).toHaveCount(0);
  await expect(page.getByLabel("Exercício da série 1")).toBeEnabled();
});

test("recognition endpoint requires session and same origin; no key yields useful error", async ({
  page,
  request,
  baseURL,
}) => {
  expect((await request.post("/api/exercises/recognize")).status()).toBe(401);
  await login(page);
  // APIRequestContext doesn't send Secure cookies over HTTP loopback, unlike Chromium.
  const cookie = (await page.context().cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const foreign = await page.request.post("/api/exercises/recognize", {
    headers: { Origin: "https://foreign.test", Cookie: cookie },
  });
  expect(foreign.status()).toBe(403);
  const missing = await page.request.post("/api/exercises/recognize", {
    headers: { Origin: baseURL!, Cookie: cookie },
  });
  expect(missing.status()).toBe(503);
  expect(missing.headers()["cache-control"]).toBe("no-store");
  expect((await missing.json()).error).toContain("não está configurada");
});
