import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

test("debug HEIC com consola", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`PAGEERROR: ${e.message}`));
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
  await page.waitForTimeout(8000);
  console.log("HEIC LOGS:", logs.filter((l) => l.includes("HEIC") || l.includes("ERROR") || l.includes("PAGEERROR")).join(" || ") || "nada");
  console.log("TODAS:", logs.slice(0, 12).join(" || "));
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Palavra-passe").fill("e2e-password-123");
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/calories");
}
