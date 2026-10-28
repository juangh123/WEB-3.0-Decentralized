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

    // English is the default for the international judging panel.
    await expect(page.getByRole("heading", { name: "ZK-CID Privacy Compliance Demo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "中文", exact: true })).toBeVisible();

    // Verify the page is interactive (no crash)
    await page.waitForLoadState("domcontentloaded");
  });

  test("generates a local Semaphore identity without a wallet", async ({ page }) => {
    await page.goto("/zk-cid");

    // The random-identity path is purely client-side and must work before any wallet connects.
    await page.getByRole("button", { name: "Generate random anonymous identity" }).click();

    await expect(page.getByText("Local identity ready")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Identity commitment (public hash):")).toBeVisible();
  });

  test("verifier tab offers a gas-free on-chain check before any wallet connects", async ({ page }) => {
    await page.goto("/zk-cid");

    await page.getByRole("button", { name: "3. Verifier · Verify & Mint" }).click();

    await expect(page.getByRole("heading", { name: "Check on Sepolia without gas (no wallet needed)" })).toBeVisible();
    // Without a proof both actions stay disabled and say why.
    const proofButtons = page.getByRole("button", { name: "Generate a zero-knowledge proof in Tab 1 first" });
    await expect(proofButtons).toHaveCount(2);
    await expect(proofButtons.first()).toBeDisabled();
    await expect(proofButtons.last()).toBeDisabled();
  });

  test("privacy comparison page loads", async ({ page }) => {
    await page.goto("/demo");

    await expect(page.locator("h1, h2").first()).toBeVisible();
    await page.waitForLoadState("domcontentloaded");
  });

  test("debug contracts page loads", async ({ page }) => {
    await page.goto("/debug");

    await expect(page.locator("h1, h2").first()).toBeVisible();
    await page.waitForLoadState("domcontentloaded");
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
