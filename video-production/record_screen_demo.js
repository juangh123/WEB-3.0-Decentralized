const fs = require("fs");
const path = require("path");
const { chromium } = require("C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const CHROME = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const OUT_DIR = path.join(__dirname, "recordings");
fs.mkdirSync(OUT_DIR, { recursive: true });

async function record(name, run) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"], headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: { width: 1920, height: 1080 } }
  });
  const page = await context.newPage();
  const video = page.video();
  await run(page);
  await context.close();
  const recordedPath = await video.path();
  const dest = path.join(OUT_DIR, `${name}.webm`);
  fs.copyFileSync(recordedPath, dest);
  await browser.close();
  console.log("recorded", dest, Math.round(fs.statSync(dest).size / 1024) + " KB");
}

(async () => {
  await record("zk-cid-ui", async page => {
    await page.goto("https://web-3-0-decentralized.vercel.app/zk-cid", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "生成随机匿名身份" }).click();
    await page.waitForTimeout(7000);
    await page.getByRole("button", { name: "2. Issuer (KYC发证入群)" }).click();
    await page.waitForTimeout(7500);
    await page.getByRole("button", { name: "3. Verifier (链上验证与DeFi)" }).click();
    await page.waitForTimeout(8500);
  });

  await record("demo-page", async page => {
    await page.goto("https://web-3-0-decentralized.vercel.app/demo", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(3000);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(3000);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(6500);
  });

  await record("zk-test", async page => {
    await page.goto("https://web-3-0-decentralized.vercel.app/zk-test", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /一键跑通 ZK 流程/ }).click();
    await page.waitForFunction(() => document.body.innerText.includes("🎉 验证通过！证明有效，用户合规且未暴露隐私！"), null, { timeout: 180000 });
    await page.waitForTimeout(3500);
  });
})().catch(e => { console.error(e); process.exit(1); });