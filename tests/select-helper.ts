import { expect, type Locator } from "@playwright/test";
export async function selectAppOption(control: Locator, value: string) {
  await control.click();
  const id = await control.getAttribute("aria-controls");
  await control.page().locator(`[id="${id}"] [role="option"][data-value="${value}"]`).click();
  await expect(control).toHaveAttribute("data-value", value);
}
