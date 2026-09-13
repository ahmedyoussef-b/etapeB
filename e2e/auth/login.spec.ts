import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@nexaflow.local";
const ADMIN_PASSWORD = "Admin123!";

test.describe("Authentification", () => {
  test("admin se connecte et est redirigé vers /dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await expect(page).toHaveURL("/dashboard");
  });

  test("identifiants invalides restent sur login", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "wrong@nexaflow.local");
    await page.fill("#password", "WrongPass123!");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/login");
    await expect(page.locator("#email")).toBeVisible();
  });

  test("champs vides soumettent le formulaire sans erreur immédiate", async ({ page }) => {
    await page.goto("/login");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/login");
  });
});
