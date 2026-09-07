import { expect, test, type Page } from "@playwright/test";

const OWNER = {
  email: "e2e@example.com",
  password: "e2e-password-123",
};

async function login(page: Page, credentials: { email: string; password: string }) {
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

function uniqueEmail() {
  return `novo-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@example.test`;
}

test("registo público cria conta, entra e volta a entrar", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/registo");
  await page.getByLabel("Nome").fill("Utilizador Novo E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill("palavra-nova-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "O teu progresso" })).toBeVisible();

  await logout(page);
  await login(page, { email, password: "palavra-nova-123" });
  await page.goto("/conta");
  await expect(page.getByText(email, { exact: true })).toBeVisible();
});

test("email duplicado e palavra-passe curta são recusados", async ({ page }) => {
  await page.goto("/registo");
  await page.getByLabel("Nome").fill("Duplicado E2E");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Palavra-passe").fill("palavra-nova-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByText("Já existe uma conta com este email."),
  ).toBeVisible();

  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Palavra-passe").fill("curta");
  await page.getByRole("button", { name: "Criar conta" }).click();
  // A validação nativa (minLength) bloqueia a submissão antes do servidor.
  expect(
    await page
      .getByLabel("Palavra-passe")
      .evaluate((el) => (el as HTMLInputElement).validationMessage),
  ).not.toBe("");
  await expect(page).toHaveURL(/\/registo$/);
});

test("recuperar sem email configurado indica indisponibilidade", async ({
  page,
}) => {
  await page.goto("/recuperar");
  const button = page.getByRole("button", { name: /Indisponível/ });
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  await expect(page.getByLabel("Email")).toBeDisabled();
  await page.getByRole("link", { name: "Voltar ao início de sessão" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("alterar palavra-passe termina outras sessões e a antiga deixa de funcionar", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail();
  const original = "palavra-original-123";
  const updated = "palavra-atualizada-456";
  await page.goto("/registo");
  await page.getByLabel("Nome").fill("Troca Senha E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(original);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await login(second, { email, password: original });

  await page.goto("/conta");
  await page.locator("#current-password").fill(original);
  await page.locator("#new-password").fill(updated);
  await page.getByRole("button", { name: "Alterar palavra-passe" }).click();
  await expect(
    page.getByText("Palavra-passe alterada. As outras sessões foram terminadas."),
  ).toBeVisible();

  // A outra sessão aberta antes da troca fica inválida.
  await second.goto("/dashboard");
  await expect(second).toHaveURL(/\/login$/);
  await secondContext.close();

  await logout(page);
  await login(page, { email, password: original }).catch(() => {});
  await expect(page).toHaveURL(/\/login$/);
  await login(page, { email, password: updated });
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("eliminar conta apaga dados e impede novo login", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/registo");
  await page.getByLabel("Nome").fill("Eliminado E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill("palavra-efemera-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/workouts/new");
  await page.getByLabel("Repetições da série 1").fill("10");
  await page.getByLabel("Peso (kg) da série 1").fill("50");
  await page.getByRole("button", { name: "Guardar treino" }).click();
  await expect(page).toHaveURL(/\/workouts$/);
  await expect(page.locator(".card").first()).toContainText("10");

  await page.goto("/conta");
  await page.getByRole("button", { name: "Quero eliminar a minha conta" }).click();
  await page.locator("#confirm-delete").fill("ERRADO");
  await page.locator("#delete-password").fill("palavra-efemera-123");
  await page
    .getByRole("button", { name: "Eliminar definitivamente" })
    .click();
  await expect(page.getByText("Escreve ELIMINAR para confirmar.")).toBeVisible();

  await page.getByLabel("Escreve ELIMINAR para confirmar").fill("ELIMINAR");
  await page
    .getByRole("button", { name: "Eliminar definitivamente" })
    .click();
  await expect(page).toHaveURL(/\/login\?eliminada=1$/);
  await expect(
    page.getByText("A tua conta foi eliminada, incluindo todos os dados."),
  ).toBeVisible();

  await login(page, { email, password: "palavra-efemera-123" }).catch(() => {});
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByText("Email ou palavra-passe inválidos."),
  ).toBeVisible();
});
