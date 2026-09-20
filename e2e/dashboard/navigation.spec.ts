import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@nexaflow.local";
const ADMIN_PASSWORD = "Admin123!";

async function loginAsAdmin(page: any) {
  await page.goto("/login");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await expect(page).toHaveURL("/dashboard");
}

test.describe("Navigation et RBAC", () => {
  test("affiche la sidebar sur le dashboard", async ({ page }) => {
    await loginAsAdmin(page);

    await page.waitForSelector("aside", { timeout: 10000 });
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();
  });

  test("redirige /dashboard vers le bon workspace admin", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard");
    await page.waitForURL("**/admin", { timeout: 15000 });

    await expect(page).toHaveURL("/admin");
  });

  test("page admin charge les composants principaux", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await page.waitForTimeout(2000);

    await expect(page.locator("text=/NexaFlow|Dashboard/i").first()).toBeVisible();
  });

  test("page profil est accessible", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/profile");

    const heading = page.locator("text=/Mon profil/i").first();
    await expect(heading).toBeVisible();
  });
});
