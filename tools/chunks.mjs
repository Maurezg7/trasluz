import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage();
const rows = [];
p.on("response", async (r) => { if (r.url().includes("/assets/")) { const len = (await r.body().catch(() => Buffer.alloc(0))).length; rows.push([Math.round(len / 1024), r.url().split("/assets/")[1]]); } });
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
rows.sort((a, b) => b[0] - a[0]).forEach((r) => console.log(String(r[0]).padStart(6) + "K", r[1]));
await b.close();
