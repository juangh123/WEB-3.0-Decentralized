import { test, expect } from "@playwright/test";

test.describe("ZK-CID E2E Flow", () => {
  test("landing page loads and navigates to Main Demo", async ({ page }) => {
    await page.goto("/");

    // Verify landing page loaded
    await expect(page.locator("h1")).toContainText("ZK-CID");

    // Navigate to the Main Demo
    await page.getByRole("link", { name: /Main Demo/i }).click();
    await expect(page).toHaveURL(/\/zk-cid/);
  });

  test("main demo page renders the full flow", async ({ page }) => {
    await page.goto("/zk-cid");

    // The demo page should render the ZK-CID header
    await expect(page.locator("h1, h2").first()).toBeVisible();

    // Verify the page is interactive (no crash)
    await page.waitForLoadState("networkidle");
  });

  test("privacy comparison page loads", async ({ page }) => {
    await page.goto("/demo");

    await expect(page.locator("h1, h2").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("debug contracts page loads", async ({ page }) => {
    await page.goto("/debug");

    await expect(page.locator("h1, h2").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("header navigation contains only active pages", async ({ page }) => {
    await page.goto("/");

    // The header should NOT contain legacy links
    const navLinks = page.locator("nav a, header a, .navbar a");
    const linkTexts = await navLinks.allTextContents();

    // Legacy pages should be absent
    expect(linkTexts.join(" ")).not.toContain("Issuer");
    expect(linkTexts.join(" ")).not.toContain("User Identity");
    expect(linkTexts.join(" ")).not.toContain("Verify (DeFi)");

    // Active pages should be present
    expect(linkTexts.join(" ")).toContain("ZK-CID Demo");
    expect(linkTexts.join(" ")).toContain("Privacy Demo");
  });
});