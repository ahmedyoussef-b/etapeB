import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@nexaflow.local";
const ADMIN_PASSWORD = "Admin123!";

async function loginAsAdmin(page: any) {
  await page.goto("/login");
  await page.waitForSelector("#email", { timeout: 15000 });
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 20000 });
}

test.describe("Routes protégées", () => {
  test("redirige vers /login si non authentifié sur /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 20000 });
    await expect(page).toHaveURL("/login");
  });

  test("redirige vers /admin après login admin", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL("/admin");
  });

  test("redirige vers /login après déconnexion", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard");

    const logoutButton = page.getByRole("button", { name: /Déconnexion/i });
    await logoutButton.waitFor({ timeout: 15000 });
    await logoutButton.click();
    await page.waitForURL("**/login", { timeout: 15000 });
    await expect(page).toHaveURL("/login");
  });
});
