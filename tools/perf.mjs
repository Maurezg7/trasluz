import { chromium } from "playwright";
const URL = process.env.APP_URL || "http://localhost:4173";
const b = await chromium.launch();
const out = {};
for (const path of ["/", "/publico", "/auditor"]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }); // laptop modesta
  let js = 0, total = 0, reqs = 0;
  page.on("response", async (r) => {
    try { const len = Number(r.headers()["content-length"] || (await r.body()).length); total += len; reqs++; if (r.url().endsWith(".js")) js += len; } catch {}
  });
  await page.addInitScript(() => {
    window.__lt = 0; window.__lcp = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lt += Math.max(0, e.duration - 50)))).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto(URL + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const m = await page.evaluate(() => ({ fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime, lcp: window.__lcp, tbt: window.__lt }));
  // fluidez: frames durante 3 s de scroll + movimiento de mouse
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0, worst = 0, last = performance.now(); const t0 = last;
    const f = (t) => { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < 3000) { window.scrollBy(0, 6); requestAnimationFrame(f); } else res({ fps: Math.round(n / ((t - t0) / 1000)), worstFrameMs: Math.round(worst) }); };
    requestAnimationFrame(f);
  }));
  out[path] = { jsKB: Math.round(js / 1024), totalKB: Math.round(total / 1024), reqs, fcp: Math.round(m.fcp), lcp: Math.round(m.lcp), tbtMs: Math.round(m.tbt), ...fps };
  await ctx.close();
}
console.table(out);
await b.close();
