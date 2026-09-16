import { expect, type Page } from "@playwright/test";

/** Exercise selection is now an explicit user action, including in fixtures. */
export async function chooseExercise(page: Page) {
  await page.waitForLoadState("networkidle");
  const picker = page.getByLabel("Exercício da série 1", { exact: true });
  if (await picker.inputValue() === "0") {
    await picker.selectOption({ label: "Barbell Row" });
    await expect(picker).not.toHaveValue("0");
  }
}
