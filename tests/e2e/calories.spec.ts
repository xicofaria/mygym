import { readFileSync } from "node:fs";
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
async function upload(page: Page, via: "camera" | "library" = "library") {
  const base64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#aaa";
    ctx.fillRect(0, 0, 64, 64);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel(
      via === "camera"
        ? "Fotografar alimento"
        : "Escolher fotografia do alimento",
    )
    .setInputFiles({
      name: "label.png",
      mimeType: "image/png",
      buffer: Buffer.from(base64, "base64"),
    });
  await expect(page.getByAltText("Fotografia do produto")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Tirar( outra)? fotografia/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Escolher( outra)? imagem/ }),
  ).toBeVisible();
}
test("280 g package suggestion is visible, persists and converts whole and half bottles", async ({
  page,
}, testInfo) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page
    .getByRole("button", { name: "+ Criar produto / fotografia" })
    .click();
  let packageQuantity: number | null = null;
  await page.route("**/api/calories/recognize", (route) =>
    route.fulfill({
      json: {
        product: {
          name: "Garrafa 280 E2E",
          brand: "Teste",
          unit: "g",
          nutrients: {
            kcal: 50.4,
            protein: 7.1,
            carbs: null,
            fat: 0.4,
            saturated: 0.3,
            sugars: 4,
            fiber: null,
            salt: 0.104,
          },
          details: {
            packageQuantity,
            packageEstimated: packageQuantity !== null,
            pieceQuantity: null,
            pieceEstimated: false,
            nutrientEstimates: [],
          },
        },
        explanation: "Porção de 280 g; confirma o conteúdo total.",
      },
    }),
  );
  await upload(page);
  await page.getByRole("button", { name: "Analisar alimento" }).click();
  await expect(
    page.getByText("Peso da embalagem não identificado.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Peso da embalagem identificado")).toHaveCount(
    0,
  );
  packageQuantity = 280;
  await page
    .getByText("Fotografia e análise · ver ou alterar", { exact: true })
    .click();
  await page.getByRole("button", { name: "Analisar alimento" }).click();
  await expect(page.getByLabel("Peso da embalagem identificado")).toContainText(
    "Embalagem: 280 g — estimativa, confirmar",
  );
  await expect(page.getByLabel("Valores por", { exact: true })).toHaveValue(
    "g",
  );
  await expect(page.getByLabel("Energia (kcal) por 100")).toHaveValue("50.4");
  await page.screenshot({
    path: testInfo.outputPath("package-product.png"),
    fullPage: true,
  });
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Guardar produto", exact: true })
    .click();
  await expect(page.getByLabel("Modo de quantidade")).toHaveValue("package");
  await expect(page.getByLabel("Alimento", { exact: true })).not.toHaveValue(
    "",
  );
  const id = await page.getByLabel("Alimento", { exact: true }).inputValue();
  await expect(page.getByLabel("Quantidade consumida")).toHaveValue("1");
  await expect(
    page.getByRole("article", { name: "Garrafa 280 E2E", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByLabel("Alimento", { exact: true }).selectOption(id);
  await expect(page.getByLabel("Modo de quantidade")).toHaveValue("package");
  await expect(page.getByLabel("Quantidade consumida")).toHaveValue("1");
  await expect(page.getByLabel("Conversão no diário")).toContainText(
    "1 embalagem = 280 g (estimativa)",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "141,1 kcal para 280 g" }),
  ).toBeVisible();
  await page
    .getByText("1 embalagem = 280 g (estimativa) · ajustar", { exact: true })
    .click();
  await page.getByLabel("Conteúdo da embalagem", { exact: true }).fill("300");
  await expect(
    page.getByRole("status").filter({ hasText: "151,2 kcal para 300 g" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("package-diary-300g.png"),
    fullPage: true,
  });
  await page.getByLabel("Conteúdo da embalagem", { exact: true }).fill("280");
  await page.getByRole("button", { name: "½ embalagem", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "70,6 kcal para 140 g" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registar consumo", exact: true })
    .click();
  const entry = page.getByRole("article", {
    name: "Garrafa 280 E2E",
    exact: true,
  });
  await expect(entry).toContainText("70,6 kcal");
  await page.reload();
  await expect(entry).toContainText("70,6 kcal");
  page.once("dialog", (d) => d.accept());
  await entry
    .getByRole("button", { name: "Eliminar consumo", exact: true })
    .click();
  await expect(entry).toHaveCount(0);
});

test("missing unit weights are resolved inside diary and remembered only on consumption", async ({
  page,
  browser,
  request,
}, testInfo) => {
  expect((await request.post("/api/calories/products/1/unit")).status()).toBe(
    401,
  );
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "+ Criar produto / fotografia" })
    .click();
  await expect(
    page.getByText("Embalagem e unidades", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Nome do alimento", { exact: true })
    .fill("Produto de diário E2E");
  await page.getByLabel("Energia (kcal) por 100").fill("600");
  await page
    .getByRole("button", { name: "Guardar produto", exact: true })
    .click();
  const selectedProduct = page.getByLabel("Alimento", { exact: true });
  // Saving returns before refreshed product options necessarily reach the DOM.
  // Wait for a real ID before constructing security-test URLs.
  await expect(selectedProduct).toHaveValue(/^[1-9]\d*$/);
  const id = await selectedProduct.inputValue();
  const cookie = (await page.context().cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const headers = { Cookie: cookie, Origin: new URL(page.url()).origin };
  expect(
    (
      await page.request.post(`/api/calories/products/${id}/unit`, {
        headers: { ...headers, Origin: "https://evil.test" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(`/api/calories/products/${id}/unit`, { headers })
    ).status(),
  ).toBe(503);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, true);
  const partnerCookie = (await other.cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  expect(
    (
      await otherPage.request.post(`/api/calories/products/${id}/unit`, {
        headers: { ...headers, Cookie: partnerCookie },
      })
    ).status(),
  ).toBe(404);
  await other.close();
  await page.getByLabel("Modo de quantidade").selectOption("pieces");
  await page.getByLabel("Quantidade consumida").fill("20");
  await expect(
    page.getByRole("button", { name: "Registar consumo", exact: true }),
  ).toBeDisabled();
  let calls = 0;
  await page.route("**/api/calories/products/*/unit", (route) => {
    calls++;
    return route.fulfill({
      json: {
        quantity: 1.2,
        unit: "g",
        estimated: true,
        explanation: "Peso médio estimado.",
      },
    });
  });
  await page
    .getByRole("button", { name: "Estimar peso por unidade com IA" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "144 kcal para 24 g" }),
  ).toBeVisible();
  await page.getByLabel("Peso de uma unidade", { exact: true }).fill("2");
  await expect(
    page.getByRole("status").filter({ hasText: "240 kcal para 40 g" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("diary-unit-conversion.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Registar consumo", exact: true })
    .click();
  const entry = page.getByRole("article", {
    name: "Produto de diário E2E",
    exact: true,
  });
  await expect(entry).toContainText("240 kcal");
  await expect(entry).toContainText("20 unidades");
  await page.unroute("**/api/calories/products/*/unit");
  const cached = await page.request.post(`/api/calories/products/${id}/unit`, {
    headers,
  });
  expect(cached.status()).toBe(200);
  expect((await cached.json()).quantity).toBe(2);
  await page.reload();
  await page.getByLabel("Alimento", { exact: true }).selectOption(id);
  await page.getByLabel("Modo de quantidade").selectOption("pieces");
  await page.getByLabel("Quantidade consumida").fill("10");
  await expect(
    page.getByRole("status").filter({ hasText: "120 kcal para 20 g" }),
  ).toBeVisible();
  expect(calls).toBe(1);
  await page.getByLabel("Modo de quantidade").selectOption("package");
  await page.getByRole("button", { name: "½ embalagem", exact: true }).click();
  await page.getByLabel("Conteúdo da embalagem", { exact: true }).fill("200");
  await expect(
    page.getByRole("status").filter({ hasText: "600 kcal para 100 g" }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await entry
    .getByRole("button", { name: "Eliminar consumo", exact: true })
    .click();
  await expect(entry).toHaveCount(0);
});
test("thinking indicator shows elapsed time, supports reduced motion and cancels without clearing fields", async ({
  page,
}, testInfo) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page
    .getByRole("button", { name: "+ Criar produto / fotografia" })
    .click();
  await upload(page, "camera");
  await page
    .getByLabel("Nome do alimento", { exact: true })
    .fill("Manter estes dados");
  let finish!: () => void;
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/calories/recognize", async (route) => {
    await waiting;
    await route
      .fulfill({
        json: { product: null, explanation: "Resposta tardia a ignorar" },
      })
      .catch(() => {});
  });
  await page.getByRole("button", { name: "Analisar alimento" }).click();
  const thinking = page.getByLabel("Análise IA em curso");
  await expect(thinking).toContainText("A analisar a fotografia e a calcular");
  await expect(thinking).toContainText("1 s", { timeout: 5000 });
  await expect(thinking.locator('[aria-hidden="true"] span').first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.screenshot({
    path: testInfo.outputPath("nutrition-thinking-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Cancelar análise", exact: true })
    .click();
  finish();
  await expect(thinking).toHaveCount(0);
  await expect(
    page.getByLabel("Nome do alimento", { exact: true }),
  ).toHaveValue("Manter estes dados");
  await expect(page.getByAltText("Fotografia do produto")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Análise cancelada");
});

test("one photo picker fills nutrition and estimated portions; units and half packs persist", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await login(page);
  await page
    .getByRole("button", { name: "+ Criar produto / fotografia" })
    .click();
  await expect(page.locator('input[type="file"]')).toHaveCount(2);
  await expect(page.locator('input[capture="environment"]')).toHaveCount(1);
  const nutrients = {
    kcal: 600,
    protein: 25,
    carbs: 12,
    fat: 50,
    saturated: 7,
    sugars: 4,
    fiber: 8,
    salt: 0.2,
  };
  await page.route("**/api/calories/recognize", (route) =>
    route.fulfill({
      json: {
        product: {
          name: "Amendoins de teste",
          brand: "Teste",
          unit: "g",
          nutrients,
          details: {
            packageQuantity: 200,
            pieceQuantity: 1.2,
            packageEstimated: true,
            pieceEstimated: true,
            nutrientEstimates: ["protein", "carbs", "fiber"],
          },
        },
        explanation:
          "Composição típica estimada; confirma o peso da embalagem e de uma unidade.",
      },
    }),
  );
  await upload(page);
  await page.getByRole("button", { name: "Analisar alimento" }).click();
  await expect(page.getByLabel("Gorduras por 100")).toHaveValue("50");
  await expect(page.getByLabel("Proteína por 100")).toHaveValue("25");
  await expect(page.getByLabel("Fibra por 100")).toHaveValue("8");
  await expect(page.getByAltText("Fotografia do produto")).toBeHidden();
  await expect(
    page.getByLabel("Conteúdo da embalagem", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Peso de uma unidade")).toHaveCount(0);
  await expect(
    page.getByText("Estimativa — confirmar", { exact: true }),
  ).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("nutrition-product-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Guardar produto", exact: true })
    .click();
  await page.getByLabel("Modo de quantidade").selectOption("pieces");
  await page.getByLabel("Quantidade consumida").fill("20");
  await expect(
    page.getByRole("status").filter({ hasText: "144 kcal para 24 g" }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("nutrition-portions-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Registar consumo", exact: true })
    .click();
  const entries = page.getByRole("article", {
    name: "Amendoins de teste",
    exact: true,
  });
  await expect(entries).toContainText("20 unidades");
  await page.reload();
  await expect(entries).toContainText("144 kcal");
  await page
    .getByLabel("Alimento", { exact: true })
    .selectOption({ label: "Amendoins de teste · Teste" });
  await page.getByLabel("Modo de quantidade").selectOption("package");
  await page.getByRole("button", { name: "½ embalagem", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "600 kcal para 100 g" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registar consumo", exact: true })
    .click();
  await expect(entries).toHaveCount(2);
  page.once("dialog", (d) => d.accept());
  await entries
    .first()
    .getByRole("button", { name: "Eliminar consumo", exact: true })
    .click();
  await expect(entries).toHaveCount(1);
  page.once("dialog", (d) => d.accept());
  await entries
    .first()
    .getByRole("button", { name: "Eliminar consumo", exact: true })
    .click();
  await expect(entries).toHaveCount(0);
});
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
  await page.getByLabel("Gorduras por 100").fill("5");
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
test("photo analysis offers OFF matches that must be explicitly chosen or dismissed", async ({
  page,
}, testInfo) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "+ Criar produto / fotografia" })
    .click();
  const details = {
    packageQuantity: null,
    pieceQuantity: null,
    packageEstimated: false,
    pieceEstimated: false,
    nutrientEstimates: [],
  };
  await page.route("**/images.openfoodfacts.org/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    }),
  );
  await page.route("**/api/calories/recognize", (route) =>
    route.fulfill({
      json: {
        barcode: null,
        product: {
          name: "Análise IA E2E",
          brand: "Teste",
          unit: "g",
          nutrients: {
            kcal: 500,
            protein: 10,
            carbs: 40,
            fat: 20,
            saturated: 5,
            sugars: 3,
            fiber: null,
            salt: 0.1,
          },
          details: { ...details, nutrientEstimates: ["protein"] },
        },
        explanation: "Estimativa típica; confirma.",
        candidates: [          {
            name: "Amêndoas OFF E2E",
            brand: "Marca Off",
            unit: "g",
            nutrients: {
              kcal: 621,
              protein: 24.5,
              carbs: 4.8,
              fat: 53.3,
              saturated: 4,
              sugars: 4,
              fiber: 8,
              salt: 0,
            },
            details: { ...details, packageQuantity: 200 },
            source: "openfoodfacts",
            sourceUrl: "https://world.openfoodfacts.org/product/20724696",
            imageUrl: "https://images.openfoodfacts.org/images/products/e2e.jpg",
          },
          {
            name: "Cranberries OFF E2E",
            brand: "Marca Off",
            unit: "g",
            nutrients: {
              kcal: 330,
              protein: 0.5,
              carbs: 76,
              fat: 1,
              saturated: null,
              sugars: null,
              fiber: null,
              salt: null,
            },
            details,
            source: "openfoodfacts",
            sourceUrl: "https://world.openfoodfacts.org/product/20150907",
            imageUrl: "",
          },
        ],
      },
    }),
  );
  await upload(page);
  await page.getByRole("button", { name: "Analisar alimento" }).click();
  await expect(
    page.getByLabel("Nome do alimento", { exact: true }),
  ).toHaveValue("Análise IA E2E");
  const matches = page.getByRole("region", {
    name: "Correspondências no Open Food Facts",
  });
  await expect(matches).toBeVisible();
  await expect(matches).toContainText("Amêndoas OFF E2E");
  await expect(matches).toContainText("621 kcal/100 g");
  await expect(matches).toContainText("Embalagem: 200 g");
  await expect(
    matches.getByAltText("Fotografia de Amêndoas OFF E2E"),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("food-off-matches.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Nenhum destes — manter a análise IA" })
    .click();
  await expect(matches).toHaveCount(0);
  await expect(
    page.getByLabel("Nome do alimento", { exact: true }),
  ).toHaveValue("Análise IA E2E");
  await expect(page.getByLabel("Energia (kcal) por 100")).toHaveValue("500");
  await page
    .getByText("Fotografia e análise · ver ou alterar", { exact: true })
    .click();
  await page.getByRole("button", { name: "Analisar alimento" }).click();
  await expect(matches).toBeVisible();
  await matches.getByRole("button", { name: "Usar" }).first().click();
  await expect(
    page.getByLabel("Nome do alimento", { exact: true }),
  ).toHaveValue("Amêndoas OFF E2E");
  await expect(page.getByLabel("Energia (kcal) por 100")).toHaveValue("621");
  await expect(page.getByLabel("Proteína por 100")).toHaveValue("24.5");
  await expect(
    page.getByText("Estimativa — confirmar", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByText("Fotografia e análise · ver ou alterar", { exact: true })
    .click();
  await page.getByRole("button", { name: "Remover fotografia" }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Guardar produto", exact: true })
    .click();
  await expect(page.getByLabel("Alimento", { exact: true })).toContainText(
    "Amêndoas OFF E2E",
  );
  await expect(page.getByLabel("Modo de quantidade")).toHaveValue("package");
  await expect(
    page.getByRole("status").filter({ hasText: "kcal para 200 g" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Produtos", exact: true }).click();
  const offProduct = page.getByRole("article", {
    name: "Amêndoas OFF E2E",
    exact: true,
  });
  await expect(offProduct).toBeVisible();
  await expect(offProduct).toContainText("Open Food Facts");
});
test("fotografia HEIC fora do Safari mostra orientação clara", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "+ Criar produto / fotografia" })
    .click();
  await page
    .getByLabel("Escolher fotografia do alimento")
    .setInputFiles({
      name: "amostra.heic",
      mimeType: "image/heic",
      buffer: readFileSync("tests/e2e/fixtures/amostra.heic"),
    });
  await expect(
    page.getByText("O teu browser não abre fotos HEIC.", { exact: false }),
  ).toBeVisible();
});
