import { expect, test, type Page } from "@playwright/test";

const SEM_LIGACAO = "Sem ligação ao servidor. Tenta novamente.";

/**
 * Um `redirect()` numa server action chega ao cliente como um erro de controlo.
 * Quando o `catch` do formulário o engolia, o utilizador via «sem ligação ao
 * servidor» a piscar por cima de uma operação bem-sucedida. Estes testes vigiam
 * o formulário enquanto a ação corre, porque a mensagem desaparece com a
 * navegação e uma asserção no fim não a apanha.
 */
async function semErroDeLigacao(
  page: Page,
  accao: () => Promise<void>,
  esperado: RegExp,
) {
  const aparicoes: string[] = [];
  const alvo = page.getByText(SEM_LIGACAO);
  const vigia = setInterval(async () => {
    if (await alvo.count().catch(() => 0)) aparicoes.push("visível");
  }, 50);
  try {
    await accao();
    await expect(page).toHaveURL(esperado);
  } finally {
    clearInterval(vigia);
  }
  expect(aparicoes, `«${SEM_LIGACAO}» apareceu num fluxo bem-sucedido`).toEqual(
    [],
  );
}

function emailUnico() {
  return `flash-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

test("o login não pisca erro de ligação antes de entrar", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Palavra-passe").fill("e2e-password-123");
  await semErroDeLigacao(
    page,
    () => page.getByRole("button", { name: "Iniciar sessão" }).click(),
    /\/dashboard$/,
  );
});

test("o registo não pisca erro de ligação antes de entrar", async ({ page }) => {
  await page.goto("/registo");
  await page.getByLabel("Nome").fill("Flash E2E");
  await page.getByLabel("Email").fill(emailUnico());
  await page.getByLabel("Palavra-passe").fill("palavra-flash-123");
  await semErroDeLigacao(
    page,
    () => page.getByRole("button", { name: "Criar conta" }).click(),
    /\/dashboard$/,
  );
});

test("eliminar conta não pisca erro de ligação antes de sair", async ({
  page,
}) => {
  const email = emailUnico();
  const password = "palavra-flash-456";
  await page.goto("/registo");
  await page.getByLabel("Nome").fill("Flash Eliminar E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/conta");
  await page.getByRole("button", { name: "Quero eliminar a minha conta" }).click();
  await page.locator("#confirm-delete").fill("ELIMINAR");
  await page.locator("#delete-password").fill(password);
  await semErroDeLigacao(
    page,
    () =>
      page.getByRole("button", { name: "Eliminar definitivamente" }).click(),
    /\/login/,
  );
});
