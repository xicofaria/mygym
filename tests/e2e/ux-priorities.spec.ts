import { expect, test, type Page } from "@playwright/test";
import { chooseExercise } from "./exercise-selection";

async function register(page: Page) {
  const email = `ux-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await page.goto("/registo");
  await page.getByLabel("Nome", { exact: true }).fill("UX E2E");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Palavra-passe", { exact: true }).fill("ux-e2e-password-123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "O teu ponto de partida" })).toBeVisible();
  return email;
}

async function newWorkout(page: Page, date: string, weight: string) {
  await page.goto("/workouts/new");
  await chooseExercise(page);
  await page.getByLabel("Data", { exact: true }).fill(date);
  await page.getByLabel("Repetições da série 1", { exact: true }).fill("8");
  await page.getByLabel("Peso (kg) da série 1", { exact: true }).fill(weight);
}

test("onboarding guarda peso, abre a meta e não reaparece no próximo login", async ({ page }) => {
  const email = await register(page);
  await expect(page.getByLabel("Cintura (cm)")).not.toBeVisible();
  await page.getByLabel("Peso (kg)", { exact: true }).fill("72,5");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Peso inicial registado.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Configurar alimentação", exact: true }).click();
  await expect(page).toHaveURL(/\/calories\?setup=goal$/);
  await expect(page.getByRole("textbox", { name: "Meta (kcal)", exact: true })).toBeFocused();
  await page.getByRole("textbox", { name: "Meta (kcal)", exact: true }).fill("2000");
  await page.getByRole("button", { name: "Guardar meta", exact: true }).click();
  await expect(page.getByText(/2000 kcal até à meta/)).toBeVisible();
  await page.getByRole("button", { name: "Terminar sessão" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill("ux-e2e-password-123");
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "O teu ponto de partida" })).toHaveCount(0);
  await expect(page.getByText("72.5 kg", { exact: true })).toBeVisible();
});

test("adiar onboarding é privado e não exige peso; meta vazia tem acesso direto", async ({ page }) => {
  await register(page);
  await page.getByRole("button", { name: "Agora não", exact: true }).click();
  await expect(page.getByRole("heading", { name: "O teu ponto de partida" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("link", { name: "Registar peso inicial", exact: true })).toBeVisible();
  await page.goto("/calories");
  await page.getByRole("button", { name: "Definir a minha meta", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Meta (kcal)", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Terminar sessão" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await register(page);
  await expect(page.getByRole("heading", { name: "O teu ponto de partida" })).toBeVisible();
});

test("treino exige exercício e conserva rascunho durante envio e falha", async ({ page }) => {
  await register(page);
  await page.goto("/workouts/new");
  await page.getByLabel("Repetições da série 1").fill("8");
  await page.getByLabel("Peso (kg) da série 1").fill("40");
  await expect(page.getByLabel("Exercício da série 1", { exact: true })).toHaveValue("0");
  await page.getByRole("button", { name: "Guardar treino", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Escolhe o exercício" })).toBeVisible();
  await chooseExercise(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/workouts/new", async route => {
    if (route.request().headers()["next-action"]) { await held; await route.abort(); }
    else await route.continue();
  });
  await page.getByRole("button", { name: "Guardar treino", exact: true }).click();
  await expect(page.getByRole("button", { name: "A guardar…", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Peso (kg) da série 1")).toBeDisabled();
  await expect(page.getByLabel("Exercício da série 1", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "+ Outro exercício", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => Object.entries(localStorage).find(([k]) => k.startsWith("gym-tracker:workout-draft:user-"))?.[1])).toContain('"40"');
  release();
  await expect(page.getByRole("alert").filter({ hasText: "Sem ligação" })).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
  await page.reload();
  await expect(page.getByLabel("Peso (kg) da série 1")).toHaveValue("40");
  await page.getByRole("button", { name: "Guardar treino", exact: true }).click();
  await expect(page).toHaveURL(/\/workouts$/);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("gym-tracker:workout-draft:user-")))).toEqual([]);
  await expect(page.getByRole("link", { name: "Barbell Row — ver evolução" })).toBeVisible();
});

test("catálogo separa a última sessão do máximo e novo bloco não escolhe exercício", async ({ page }) => {
  await register(page);
  await newWorkout(page, "2026-01-05", "40");
  await page.getByRole("button", { name: "Guardar treino", exact: true }).click();
  await expect(page).toHaveURL(/\/workouts$/);
  await newWorkout(page, "2026-01-12", "30");
  await page.getByRole("button", { name: "+ Outro exercício", exact: true }).click();
  await expect(page.getByLabel("Exercício da série 2", { exact: true })).toHaveValue("0");
  await expect(page.getByLabel("Exercício da série 1", { exact: true })).not.toHaveValue("0");
  await page.getByRole("button", { name: "Remover série", exact: true }).last().click();
  await page.getByRole("button", { name: "Guardar treino", exact: true }).click();
  await expect(page).toHaveURL(/\/workouts$/);
  await page.goto("/exercises");
  const exercise = page.getByRole("article", { name: "Barbell Row", exact: true });
  await expect(exercise).toContainText("Última sessão: 12/01 · 30kg × 8");
  await expect(exercise).toContainText("Carga máxima registada: 40 kg");
});

test("produto preserva campos entre separadores e pede confirmação ao sair", async ({ page }) => {
  await register(page);
  await page.goto("/calories");
  await page.getByRole("button", { name: "Produtos", exact: true }).click();
  await page.getByRole("button", { name: "+ Novo produto", exact: true }).click();
  await page.getByLabel("Nome do alimento", { exact: true }).fill("Produto por guardar");
  await page.getByRole("textbox", { name: "Energia (kcal) por 100", exact: true }).fill("65");
  await page.getByRole("button", { name: "Produtos", exact: true }).click();
  await expect(page.getByLabel("Nome do alimento", { exact: true })).toHaveValue("Produto por guardar");
  await page.getByRole("button", { name: "Diário", exact: true }).click();
  await expect(page.getByLabel("Nome do alimento", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Produtos", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Energia (kcal) por 100", exact: true })).toHaveValue("65");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("link", { name: "Corpo", exact: true }).click();
  await expect(page).toHaveURL(/\/calories$/);
  await page.getByRole("button", { name: "Guardar produto", exact: true }).click();
  await expect(page.getByRole("article", { name: "Produto por guardar", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Corpo", exact: true }).click();
  await expect(page).toHaveURL(/\/body$/);
});

test("eliminação aguarda o servidor, apresenta falha e permite repetir", async ({ page }) => {
  await register(page);
  await newWorkout(page, "2026-01-05", "20");
  await page.getByRole("button", { name: "Guardar treino", exact: true }).click();
  await expect(page).toHaveURL(/\/workouts$/);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/workouts", async route => {
    if (route.request().headers()["next-action"]) { await held; await route.abort(); }
    else await route.continue();
  });
  const remove = page.getByRole("button", { name: "Eliminar", exact: true });
  page.once("dialog", dialog => dialog.accept());
  await remove.click();
  await expect(remove).toBeDisabled();
  release();
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível eliminar" })).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
  page.once("dialog", dialog => dialog.accept());
  await remove.click();
  await expect(page.getByRole("link", { name: "Barbell Row — ver evolução" })).toHaveCount(0);
});

test("retoma encontra o contexto e distingue continuar de começar hoje sem perder o anterior", async ({ page }) => {
  await register(page);
  await page.goto("/workouts/new?date=2026-01-05");
  await chooseExercise(page);
  await page.getByLabel("Repetições da série 1").fill("8");
  await page.getByLabel("Peso (kg) da série 1").fill("32,5");
  await page.getByRole("button", { name: "Voltar — manter rascunho", exact: true }).click();
  await page.goto("/dashboard");
  const resume = page.getByRole("link", { name: "Continuar treino de 05/01/2026", exact: true });
  await expect(resume).toHaveAttribute("href", "/workouts/new?date=2026-01-05");
  await resume.click();
  await expect(page.getByLabel("Peso (kg) da série 1")).toHaveValue("32,5");
  await expect(page.getByLabel("Peso (kg) da série 1")).toBeDisabled();
  await page.getByRole("button", { name: "Começar um treino hoje", exact: true }).click();
  await expect(page).toHaveURL(/session=/);
  await expect(page.getByLabel("Peso (kg) da série 1")).toHaveValue("");
  await chooseExercise(page);
  await page.getByLabel("Repetições da série 1").fill("10");
  await page.getByRole("link", { name: "Início", exact: true }).click();
  await expect(page.getByRole("link", { name: /Continuar treino de/ })).toHaveCount(2);
  await resume.click();
  await page.getByRole("button", { name: "Continuar este treino", exact: true }).click();
  await expect(page.getByLabel("Data", { exact: true })).toHaveValue("2026-01-05");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Descartar alterações", exact: true }).click();
  await expect(page.getByLabel("Peso (kg) da série 1")).toHaveValue("32,5");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Descartar alterações", exact: true }).click();
  await expect(page).toHaveURL(/\/workouts$/);
  await page.goto("/dashboard");
  await expect(resume).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Continuar treino de/ })).toHaveCount(1);
  await page.getByRole("button", { name: "Terminar sessão" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await register(page);
  await expect(page.getByRole("link", { name: /Continuar treino de/ })).toHaveCount(0);
});

test("medição distingue manter rascunho de descarte confirmado", async ({ page }) => {
  await register(page);
  await page.goto("/body");
  await page.getByRole("button", { name: "+ Adicionar medição", exact: true }).click();
  await page.getByLabel("Peso (kg)", { exact: true }).fill("75,2");
  await page.getByRole("button", { name: "Voltar — manter rascunho", exact: true }).click();
  await page.getByRole("button", { name: "Continuar medição", exact: true }).click();
  await expect(page.getByLabel("Peso (kg)", { exact: true })).toHaveValue("75,2");
  await page.reload();
  await expect(page.getByLabel("Peso (kg)", { exact: true })).toHaveValue("75,2");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Descartar alterações", exact: true }).click();
  await expect(page.getByLabel("Peso (kg)", { exact: true })).toHaveValue("75,2");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Descartar alterações", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "+ Adicionar medição", exact: true })).toBeVisible();
});

test("validação alimentar identifica campos e editar consumo conserva o percurso de foco", async ({ page }) => {
  await register(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calories");
  await page.getByRole("button", { name: "+ Criar produto / fotografia", exact: true }).click();
  await page.getByLabel("Nome do alimento", { exact: true }).fill("Produto UX validação");
  const protein = page.getByRole("textbox", { name: "Proteína por 100", exact: true });
  const kcal = page.getByRole("textbox", { name: "Energia (kcal) por 100", exact: true });
  await kcal.fill("65");
  await protein.fill("150");
  await page.getByRole("button", { name: "Guardar produto", exact: true }).click();
  await expect(protein).toBeFocused();
  await expect(protein).toHaveAttribute("aria-invalid", "true");
  await expect(protein).toHaveAttribute("aria-describedby", "food-error-protein");
  await expect(page.locator("#food-error-protein")).toContainText("entre 0 e 100 g por 100 g");
  await expect(kcal).toHaveValue("65");
  await protein.fill("7,5");
  await page.getByRole("button", { name: "Guardar produto", exact: true }).click();
  await page.getByLabel("Quantidade consumida", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Registar consumo", exact: true }).click();
  const entry = page.getByRole("article", { name: "Produto UX validação", exact: true });
  const edit = entry.getByRole("button", { name: "Editar consumo", exact: true });
  await edit.click();
  await expect(page.getByRole("heading", { name: "Editar consumo: Produto UX validação", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Cancelar edição", exact: true }).click();
  await expect(edit).toBeFocused();
  await edit.click();
  await page.getByLabel("Quantidade consumida", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Guardar consumo", exact: true }).click();
  await expect(entry).toContainText("130 kcal");
  await expect(edit).toBeFocused();
});

test("worker real aguarda decisão e uma atualização noutra janela não recarrega o formulário", async ({ page, context }) => {
  await register(page);
  await page.goto("/workouts/new");
  await chooseExercise(page);
  await page.getByLabel("Repetições da série 1").fill("8");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const other = await context.newPage();
  await other.goto("/dashboard");
  const marker = await page.evaluate(() => {
    const value = crypto.randomUUID();
    Object.assign(window, { uxDocumentMarker: value });
    return value;
  });
  // Different script URL triggers a real browser install/update, no SW mock.
  await page.evaluate(async () => {
    await navigator.serviceWorker.register(`/sw.js?ux-test=${Date.now()}`, { scope: "/", updateViaCache: "none" });
  });
  const banner = page.getByRole("region", { name: "Atualização da aplicação", exact: true });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Mais tarde", exact: true }).click();
  await expect(page.getByLabel("Repetições da série 1")).toHaveValue("8");
  expect(await page.evaluate(() => Reflect.get(window, "uxDocumentMarker"))).toBe(marker);
  page.once("dialog", dialog => dialog.dismiss());
  await banner.getByRole("button", { name: "Atualizar agora", exact: true }).click();
  expect(await page.evaluate(() => Reflect.get(window, "uxDocumentMarker"))).toBe(marker);
  other.once("dialog", dialog => dialog.accept());
  await Promise.all([
    other.waitForEvent("domcontentloaded"),
    other.getByRole("button", { name: "Atualizar agora", exact: true }).click(),
  ]);
  expect(await other.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "")).toContain("ux-test=");
  expect(await page.evaluate(() => Reflect.get(window, "uxDocumentMarker"))).toBe(marker);
  await expect(page.getByLabel("Repetições da série 1")).toHaveValue("8");
  page.once("dialog", dialog => dialog.accept());
  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    banner.getByRole("button", { name: "Atualizar agora", exact: true }).click(),
  ]);
  expect(await page.evaluate(() => Reflect.get(window, "uxDocumentMarker"))).toBeUndefined();
  await expect(page.getByLabel("Repetições da série 1")).toHaveValue("8");
  await other.close();
});
