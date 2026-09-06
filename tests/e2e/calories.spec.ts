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
  await page.goto("/calories");
  await page.waitForLoadState("networkidle");
}
async function upload(page: Page) {
  const base64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#aaa";
    ctx.fillRect(0, 0, 64, 64);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Escolher fotografia do alimento").setInputFiles({
    name: "label.png",
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  });
  await expect(page.getByAltText("Fotografia do produto")).toBeVisible();
}
test("calorie diary persists decimal quantities, private photos, immutable nutrition and period goals", async ({
  page,
  browser,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByText("Definir meta diária", { exact: true }).click();
  await page.getByLabel("Meta (kcal)", { exact: true }).fill("250");
  await page.getByRole("button", { name: "Guardar meta", exact: true }).click();
  await expect(
    page.getByText("Meta atual: 250 kcal.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "+ Criar produto / fotografia" })
    .click();
  await upload(page);
  await page
    .getByLabel("Nome do alimento", { exact: true })
    .fill("Produto calorias E2E");
  await page.getByLabel("Marca / loja").fill("Teste");
  await page.getByLabel("Energia (kcal) por 100").fill("200");
  await page.getByLabel("Proteína por 100").fill("10");
  await page.getByLabel("Hidratos por 100").fill("20");
  await page.getByLabel("Lípidos por 100").fill("5");
  await page
    .getByRole("button", { name: "Guardar produto", exact: true })
    .click();
  await expect(
    page.getByRole("form", { name: "Adicionar ao diário" }),
  ).toBeVisible();
  await page.getByLabel("Quantidade consumida").fill("125,5");
  await expect(
    page.getByRole("status").filter({ hasText: "251 kcal" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registar consumo", exact: true })
    .click();
  const entry = page.getByRole("article", {
    name: "Produto calorias E2E",
    exact: true,
  });
  await expect(entry).toContainText("251 kcal");
  await page.getByRole("button", { name: "Concluir registo do dia" }).click();
  await expect(page.getByLabel("Resumo do dia")).toContainText(
    "Dentro da meta",
  );
  await page.getByRole("button", { name: "Produtos", exact: true }).click();
  const product = page.getByRole("article", {
    name: "Produto calorias E2E",
    exact: true,
  });
  const photo = await product.getByRole("img").getAttribute("src");
  expect(photo).toMatch(/^\/api\/calories\/photos\/\d+$/);
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await login(other, true);
  await expect(other.getByLabel("Resumo do dia")).toContainText("Sem registos");
  await other.getByRole("button", { name: "Produtos", exact: true }).click();
  await expect(
    other.getByRole("article", { name: "Produto calorias E2E", exact: true }),
  ).toHaveCount(0);
  const cookie = (await otherContext.cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  expect(
    (await other.request.get(photo!, { headers: { Cookie: cookie } })).status(),
  ).toBe(404);
  await otherContext.close();
  await product
    .getByRole("button", { name: "Editar produto", exact: true })
    .click();
  await page.getByLabel("Energia (kcal) por 100").fill("400");
  await page
    .getByRole("button", { name: "Guardar produto", exact: true })
    .click();
  await expect(entry).toContainText("251 kcal");
  await entry
    .getByRole("button", { name: "Editar consumo", exact: true })
    .click();
  await page.getByLabel("Quantidade consumida").fill("100");
  await page
    .getByRole("button", { name: "Guardar consumo", exact: true })
    .click();
  await expect(entry).toContainText("200 kcal");
  await expect(page.getByLabel("Resumo do dia")).toContainText("Por completar");
  await page.getByRole("button", { name: "Evolução", exact: true }).click();
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect(page.getByLabel("Resumo do período")).toContainText(
    "0 dias dentro da meta",
  );
  await page.getByRole("button", { name: "Mês", exact: true }).click();
  await expect(page.getByLabel("Resumo do período")).toContainText(
    "1 com registos",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("calories-month-mobile.png"),
    animations: "disabled",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Diário", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("calories-diary-mobile.png"),
    animations: "disabled",
    fullPage: true,
  });
  page.once("dialog", (d) => d.accept());
  await entry
    .getByRole("button", { name: "Eliminar consumo", exact: true })
    .click();
  await expect(entry).toHaveCount(0);
});
test("food AI is opt-in, suggestions require review and unreadable labels keep manual entry", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "+ Criar produto / fotografia" })
    .click();
  let requests = 0;
  await page.route("**/api/calories/recognize", async (route) => {
    requests++;
    await route.fulfill({
      json: { product: null, explanation: "Fotografa a tabela nutricional." },
    });
  });
  await upload(page);
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Analisar alimento" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Fotografa a tabela" }),
  ).toBeVisible();
  await page.unroute("**/api/calories/recognize");
  await page.route("**/api/calories/recognize", (route) =>
    route.fulfill({
      json: {
        product: {
          name: "Sugestão alimentar",
          brand: "Teste",
          unit: "g",
          nutrients: {
            kcal: 80,
            protein: 5,
            carbs: 4,
            fat: 2,
            saturated: null,
            sugars: null,
            fiber: null,
            salt: null,
          },
        },
        explanation: "Confirma os valores do rótulo.",
      },
    }),
  );
  await page.getByRole("button", { name: "Analisar alimento" }).click();
  await expect(
    page.getByLabel("Nome do alimento", { exact: true }),
  ).toHaveValue("Sugestão alimentar");
  await page
    .getByRole("button", { name: "Guardar produto", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Confirma os valores" }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Guardar produto", exact: true })
    .click();
  await expect(page.getByLabel("Alimento", { exact: true })).toContainText(
    "Sugestão alimentar",
  );
});
test("external product lookup is explicitly reviewed and missing AI key is handled", async ({
  page,
  request,
}) => {
  expect((await request.post("/api/calories/recognize")).status()).toBe(401);
  await login(page);
  const cookies = (await page.context().cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const origin = new URL(page.url()).origin;
  expect(
    (
      await page.request.post("/api/calories/recognize", {
        headers: { Cookie: cookies, Origin: "https://evil.test" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/calories/recognize", {
        headers: { Cookie: cookies, Origin: origin, "x-food-mode": "label" },
      })
    ).status(),
  ).toBe(503);
  await page.route("**/api/calories/products?*", (route) =>
    route.fulfill({
      json: {
        products: [
          {
            name: "Produto OFF de teste",
            brand: "Continente",
            unit: "ml",
            nutrients: {
              kcal: 40,
              protein: null,
              carbs: 10,
              fat: 0,
              saturated: null,
              sugars: null,
              fiber: null,
              salt: null,
            },
            source: "openfoodfacts",
            sourceUrl: "https://world.openfoodfacts.org/product/5601234567890",
            imageUrl: "",
          },
        ],
      },
    }),
  );
  await page.getByRole("button", { name: "Produtos", exact: true }).click();
  await page.getByRole("button", { name: "Continente", exact: true }).click();
  await page.getByRole("button", { name: "Rever", exact: true }).click();
  await expect(
    page.getByLabel("Nome do alimento", { exact: true }),
  ).toHaveValue("Produto OFF de teste");
  await expect(page.getByLabel("Valores por", { exact: true })).toHaveValue(
    "ml",
  );
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Guardar produto", exact: true })
    .click();
  await page.getByLabel("Quantidade consumida").fill("250");
  await expect(
    page.getByRole("status").filter({ hasText: "100 kcal para 250 ml" }),
  ).toBeVisible();
});
