/**
 * Graba la demo de Trasluz (≈4 min) contra la app local, con captions y cursor visible.
 *
 *   pnpm node                      # terminal 1 (cadena limpia)
 *   pnpm deploy:local && pnpm dev  # terminal 2
 *   pnpm dlx playwright@1 install chromium   # una vez
 *   node deck/record-demo.mjs      # → deck/.video/*.webm
 *   ffmpeg -i deck/.video/*.webm -vf "setpts=PTS/1.2,fps=30" -c:v libx264 -crf 21 -pix_fmt yuv420p -movflags +faststart deck/trasluz-demo.mp4
 *
 * Usa una wallet de prueba inyectada (EIP-1193/6963) que reenvía al nodo Hardhat: sólo para demo local.
 * Requiere `playwright` resoluble (p. ej. `pnpm add -D playwright -w`, o NODE_PATH a una instalación global).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "deck/.video");

const URL = "http://localhost:5173";
const RPC = "http://127.0.0.1:8545";
const EMP = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const PROV = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const VK = fs.readFileSync(path.join(ROOT, ".secrets/auditor-viewing-key-localhost.txt"), "utf8").trim();
const W = 1440, H = 900;
fs.rmSync(OUT, { recursive: true, force: true });

const rpc = async (method, params) => {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

let account = EMP;
let authorized = false;
await page.exposeFunction("__rpc", async (method, params) => {
  if (method === "eth_requestAccounts") { authorized = true; return [account]; }
  if (method === "eth_accounts") return authorized ? [account] : [];
  if (method.startsWith("wallet_")) return method.includes("Permissions") ? [{ parentCapability: "eth_accounts" }] : null;
  if (method === "eth_sendTransaction") params[0].from = account;
  return rpc(method, params);
});
await page.addInitScript(() => {
  const L = {};
  const provider = { isAvalanche: true, isMetaMask: false, request: async ({ method, params }) => window.__rpc(method, params || []), on: (e, f) => ((L[e] ||= []).push(f), provider), removeListener: (e, f) => ((L[e] = (L[e] || []).filter((x) => x !== f)), provider) };
  window.__emit = (e, v) => (L[e] || []).forEach((f) => f(v));
  window.ethereum = provider;
  window.avalanche = provider;
  const info = { uuid: "1f0e0e0e-0000-4000-8000-000000000001", name: "Core Wallet", icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23e84142'/></svg>", rdns: "app.core.demo" };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce); announce();
  // cursor visible + captions
  addEventListener("DOMContentLoaded", () => {
    const st = document.createElement("style");
    st.textContent = `#__cur{position:fixed;z-index:99999;left:0;top:0;width:22px;height:22px;pointer-events:none;transform:translate(-3px,-2px);transition:transform .05s}
#__cur svg{filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))} #__cur.down svg{transform:scale(.85)}
#__cap{position:fixed;z-index:99998;left:50%;bottom:34px;transform:translateX(-50%) translateY(20px);opacity:0;transition:all .45s cubic-bezier(.2,.8,.2,1);pointer-events:none;
 background:rgba(10,10,14,.86);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px 22px;color:#fff;font:600 19px/1.3 Inter,system-ui,sans-serif;box-shadow:0 20px 50px -10px rgba(0,0,0,.7);max-width:1000px;text-align:center}
#__cap.on{opacity:1;transform:translateX(-50%)} #__cap small{display:block;font-weight:500;font-size:14px;color:#a1a1b5;margin-top:4px} #__cap b{color:#ff5a5f}
#__title{position:fixed;inset:0;z-index:99997;display:grid;place-items:center;background:radial-gradient(800px 500px at 50% 40%,rgba(232,65,66,.25),#07070a 70%);transition:opacity .8s;font-family:Inter,system-ui,sans-serif}
#__title h1{font-size:76px;color:#fff;margin:18px 0 0;letter-spacing:-2px;text-align:center} #__title p{color:#c9c9d6;font-size:22px;margin:10px 0 0;text-align:center}`;
    document.head.appendChild(st);
    const c = document.createElement("div"); c.id = "__cur";
    c.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.5 4 7.5-3 1.5-4-7.5-5 4.5z" fill="white" stroke="black" stroke-width="1.2"/></svg>`;
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => (c.style.left = e.clientX + "px", c.style.top = e.clientY + "px"), true);
    addEventListener("mousedown", () => c.classList.add("down"), true);
    addEventListener("mouseup", () => c.classList.remove("down"), true);
    const cap = document.createElement("div"); cap.id = "__cap"; document.body.appendChild(cap);
  });
});

const sleep = (ms) => page.waitForTimeout(ms);
let mx = W / 2, my = H / 2;
const moveTo = async (x, y, steps = 22) => { await page.mouse.move(x, y, { steps }); mx = x; my = y; };
const click = async (loc, { pause = 350 } = {}) => {
  await loc.waitFor({ state: "visible", timeout: 60000 });
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await moveTo(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(pause);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
};
const type = async (loc, text, delay = 55) => { await click(loc); await loc.fill(""); await page.keyboard.type(text, { delay }); };
const caption = async (title, sub = "") => {
  await page.evaluate(([t, s]) => { const c = document.getElementById("__cap"); c.classList.remove("on"); setTimeout(() => { c.innerHTML = t + (s ? `<small>${s}</small>` : ""); c.classList.add("on"); }, 250); }, [title, sub]);
  await sleep(500);
};
const hideCaption = () => page.evaluate(() => document.getElementById("__cap").classList.remove("on"));
const closeDialog = async () => {
  const b = page.getByRole("button", { name: "Cerrar" }).last(); await b.waitFor({ timeout: 240000 });
  const txt = await page.locator(".fixed.inset-0.z-50").innerText();
  if (!txt.includes("Confirmado on-chain")) { console.log("DIALOG ERROR:", txt.replace(/\n/g, " | ")); throw new Error("acción falló"); }
  await sleep(1600); await click(b); await sleep(600);
};
const nav = (label) => click(page.locator("aside").first().getByRole("link", { name: label }));
const switchAccount = async (a) => { account = a; await page.evaluate((x) => window.__emit("accountsChanged", [x]), a); await sleep(1500); };
const onboard = async (ready) => {
  for (let i = 0; i < 60; i++) {
    if (await ready.isVisible().catch(() => false)) return;
    const u = page.getByRole("button", { name: "Firmar y derivar" });
    const r = page.getByRole("button", { name: "Registrar", exact: true });
    try {
      if (await u.isVisible().catch(() => false)) { await sleep(600); await click(u); await sleep(1500); continue; }
      if (await r.isVisible().catch(() => false)) { await sleep(600); await click(r); await closeDialog(); await sleep(1500); continue; }
    } catch (e) { if (!/not attached|detached/.test(e.message)) throw e; }
    await sleep(500);
  }
    throw new Error("onboarding no terminó");
};
const unlockIfNeeded = async () => { const u = page.getByRole("button", { name: "Firmar y derivar" }); if (await u.isVisible().catch(() => false)) { await click(u); await sleep(1800); } };
const registerIfNeeded = async () => { const r = page.getByRole("button", { name: "Registrar", exact: true }); await sleep(1200); if (await r.isVisible().catch(() => false)) { await click(r); await closeDialog(); await sleep(1500); } };

try {
// ── 0. Portada ──────────────────────────────────────────────────────────────
await page.goto(URL + "/");
await page.evaluate(() => {
  const t = document.createElement("div"); t.id = "__title";
  t.innerHTML = `<div><div style="display:flex;justify-content:center"><img src="/favicon.svg" width="120" height="120"/></div><h1>Trasluz<span style="color:#e84142">.</span></h1><p>Liquidación B2B confidencial sobre Avalanche eERC<br/><span style="color:#34d399">con ventana para el regulador</span></p></div>`;
  document.body.appendChild(t);
});
await sleep(3200);
await page.evaluate(() => { const t = document.getElementById("__title"); t.style.opacity = "0"; setTimeout(() => t.remove(), 900); });
await sleep(900);
await caption("Si pagás on-chain, tu competencia ve <b>cuánto</b> le pagás a cada proveedor.", "Trasluz: el monto viaja cifrado con eERC oficial de Ava Labs · un auditor designado concilia todo");
for (const [x, y] of [[1150, 260], [1250, 420], [980, 330], [1120, 300]]) await moveTo(x, y, 30);
await sleep(1200);

// ── 1. Proveedor se da de alta ─────────────────────────────────────────────
await caption("1 · El proveedor se da de alta", "Firma (sin gas) → clave BabyJubJub en memoria → prueba ZK de registro");
await switchAccount(PROV);
await nav("Proveedor");
await click(page.getByRole("button", { name: /Conectar/ }).first());
await page.locator("[role=dialog]").waitFor();
await sleep(1200);
await click(page.locator("[role=dialog]").getByRole("button", { name: /Core/ }).first());
await sleep(1000);
await onboard(page.getByText("Cobros confidencial"));

// ── 2. Empresa: alta + tesorería ───────────────────────────────────────────
await caption("2 · La empresa deposita tesorería: USDC → eERC", "El depósito es la rampa pública; desde acá cada pago es confidencial");
await switchAccount(EMP);
await nav("Empresa pagadora");
await onboard(page.getByRole("button", { name: "Faucet USDC" }));
await click(page.getByRole("button", { name: "Faucet USDC" }));
await closeDialog();
await click(page.getByRole("button", { name: "Depositar" }).first());
await type(page.getByPlaceholder("Monto en USDC"), "50000");
await click(page.locator("form").getByRole("button", { name: "Depositar" }));
await closeDialog();
await sleep(1800);

// ── 3. Crear y fondear ─────────────────────────────────────────────────────
await caption("3 · Nueva obligación contra factura: <b>18.750,25 USDC</b>", "Vault de escrow propio · transferencia eERC confidencial · pruebas Groth16 en un Web Worker");
const sel = page.locator("select");
await click(sel);
const opts = await sel.locator("option").allTextContents();
await sel.selectOption({ index: opts.findIndex((o) => o.toLowerCase().startsWith(PROV.slice(0, 8).toLowerCase())) });
await sleep(500);
await type(page.getByPlaceholder("25.000,00"), "18.750,25", 90);
await type(page.getByPlaceholder("Insumos — OC 4521"), "Insumos — OC 4521", 30);
await sleep(600);
await click(page.getByRole("button", { name: /Crear y fondear/ }));
await closeDialog();
await sleep(2500);
await moveTo(1150, 470, 30);
await sleep(2000);

// ── 4. Vista pública ───────────────────────────────────────────────────────
await caption("4 · Lo que ve el mercado: <b>el monto es ciphertext</b>", "Emisor, receptor y timestamp públicos · el monto, en ningún campo en claro");
await nav("Vista pública");
await sleep(2500);
await moveTo(700, 330, 25); await sleep(900);
await moveTo(1180, 470, 30); await sleep(2600);

// ── 5. Proveedor verifica y confirma ───────────────────────────────────────
await caption("5 · El proveedor verifica el escrow y confirma la entrega", "Descifra la clave del vault que el pagador cifró para él — nadie más ve el monto");
await switchAccount(PROV);
await nav("Proveedor");
await onboard(page.getByRole("button", { name: "Confirmar entrega" }));
await sleep(1500);
await moveTo(1250, 430, 25); await sleep(1500);
await click(page.getByRole("button", { name: "Confirmar entrega" }));
await closeDialog();

// ── 6. Empresa libera ──────────────────────────────────────────────────────
await caption("6 · La empresa libera el pago", "Transferencia confidencial vault → proveedor · destino fijado por el contrato");
await switchAccount(EMP);
await nav("Empresa pagadora");
await onboard(page.getByRole("button", { name: "Liberar pago" }));
await sleep(1200);
await click(page.getByRole("button", { name: "Liberar pago" }));
await closeDialog();
await sleep(1500);

// ── 7. Auditor ─────────────────────────────────────────────────────────────
await caption("7 · El momento clave: el auditor abre la ventana", "Viewing key en runtime · validada contra eERC.auditorPublicKey · nunca se guarda");
await nav("Portal auditor");
await sleep(1500);
await type(page.getByPlaceholder("0x… viewing key"), VK, 12);
await click(page.getByRole("button", { name: "Abrir" }));
await page.getByText("Ventana abierta").waitFor({ timeout: 30000 });
await caption("Montos reales y conciliación: <b>fondeado = liberado ✓</b>", "Confidencial para el mercado, transparente para el regulador");
await sleep(3500);
await moveTo(640, 440, 25); await sleep(1500);
await click(page.getByRole("button", { name: "Libro de movimientos" }));
await caption("Libro de movimientos: on-chain (ciphertext) vs. descifrado por el auditor");
await sleep(3800);
await click(page.getByRole("button", { name: "Exportar CSV" }));
await sleep(1500);

// ── 8. Seguridad ───────────────────────────────────────────────────────────
await caption("8 · Seguridad del cliente, verificable en vivo", "Circuitos oficiales con SHA-256 fijado · CSP estricta · claves sólo en memoria con auto-bloqueo");
await nav("Administración");
await sleep(1500);
await click(page.getByRole("button", { name: "Verificar ahora" }));
await page.getByText("Circuitos íntegros").waitFor({ timeout: 60000 });
await sleep(3000);

// ── Cierre ─────────────────────────────────────────────────────────────────
await hideCaption();
await page.evaluate(() => {
  const t = document.createElement("div"); t.id = "__title"; t.style.opacity = "0";
  t.innerHTML = `<div><div style="display:flex;justify-content:center"><img src="/favicon.svg" width="96" height="96"/></div><h1 style="font-size:54px">Confidencial para el mercado.<br/><span style="color:#34d399">Transparente para el regulador.</span></h1><p>Sin forks de la criptografía · eERC oficial · Avalanche</p></div>`;
  document.body.appendChild(t); requestAnimationFrame(() => (t.style.opacity = "1"));
});
await sleep(4500);

} catch (e) {
  console.log("FAIL", e.message.split("\n")[0]);
  await page.screenshot({ path: path.join(ROOT, "deck/.video/fail.png") });
  await browser.close();
  process.exit(1);
}
const video = page.video();
await ctx.close();
await browser.close();
console.log("video:", await video.path());
console.log("errores:", errors.join("\n") || "ninguno");
