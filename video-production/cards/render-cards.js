const fs = require("fs");
const path = require("path");

const PLAYWRIGHT = "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const CHROME = "C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const OUT_DIR = "E:/AI WORK/WEB 3.0 Decentralized/video-production/cards";

const { chromium } = require(PLAYWRIGHT);

(async () => {
  const html = fs.readFileSync(path.join(OUT_DIR, "cards.html"), "utf8");
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const count = await page.evaluate(() => document.querySelectorAll(".slide").length);
  for (let i = 1; i <= count; i++) {
    await page.evaluate((n) => {
      document.querySelectorAll(".slide").forEach((s, idx) => s.classList.toggle("active", idx === n - 1));
    }, i);
    await page.waitForTimeout(120);
    const out = path.join(OUT_DIR, `card-0${i}.png`);
    await page.screenshot({ path: out });
    console.log("rendered", out);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
