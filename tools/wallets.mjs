import { chromium } from "playwright";

const RPC = "http://127.0.0.1:8545";
const APP = process.env.APP ?? "http://localhost:4174";
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const rpc = async (method, params) => {
	const j = await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json();
	if (j.error) throw new Error(j.error.message);
	return j.result;
};
const accts = await rpc("eth_accounts", []);
const malleate = (sig) => {
	const r = sig.slice(2, 66), s = BigInt(`0x${sig.slice(66, 130)}`), v = Number.parseInt(sig.slice(130), 16);
	return `0x${r}${(N - s).toString(16).padStart(64, "0")}${(v === 27 ? 28 : 27).toString(16)}`;
};

const b = await chromium.launch();
const results = [];

async function scenario(name, mode, expect) {
	const page = await b.newPage();
	const errors = [];
	page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
	page.on("pageerror", (e) => errors.push(String(e)));
	const account = accts[4];
	let signs = 0;
	let authorized = false;
	await page.exposeFunction("__rpc", async (method, params) => {
		if (method === "eth_requestAccounts") return (authorized = true), [account];
		if (method === "eth_accounts") return authorized ? [account] : [];
		if (method === "eth_chainId") return "0x7a69";
		if (method.startsWith("wallet_")) return method.includes("Permissions") ? [{ parentCapability: "eth_accounts" }] : null;
		if (method === "personal_sign") {
			signs++;
			if (mode === "smart") return `0x${"ab".repeat(200)}`;
			if (mode === "other") return rpc("personal_sign", [params[0], accts[6]]);
			const sig = await rpc("personal_sign", params);
			return mode === "mpc" && signs === 2 ? malleate(sig) : sig;
		}
		return rpc(method, params);
	});
	await page.addInitScript(() => {
		const L = {};
		const provider = { request: async ({ method, params }) => window.__rpc(method, params || []), on: (e, f) => ((L[e] ||= []).push(f), provider), removeListener: () => provider };
		window.ethereum = provider;
		const info = { uuid: "1f0e0e0e-0000-4000-8000-000000000002", name: "Test Wallet", icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>", rdns: "test.wallet" };
		const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
		window.addEventListener("eip6963:requestProvider", announce);
		announce();
	});
	await page.goto(`${APP}/proveedor`);
	await page.getByRole("button", { name: "Conectar wallet" }).first().click();
	const dlg = page.getByRole("dialog");
	await dlg.getByRole("button", { name: /Test Wallet/ }).click();
	await page.getByRole("button", { name: "Firmar y derivar" }).click();
	await page.waitForTimeout(2500);
	const text = await page.locator("main").innerText();
	const ok = expect.test(text);
	results.push({ name, ok, signs, errors: errors.filter((e) => !/Wallet no compatible|UserRejected|IncompatibleWallet/.test(e)) });
	await page.close();
}

await scenario("EOA normal (doble firma)", "eoa", /Clave pública registrada|Registrar/);
await scenario("Smart wallet (firma ERC-1271)", "smart", /firma como contrato/);
await scenario("Firma de otra clave", "other", /no corresponde a la clave/);
await scenario("MPC no determinística", "mpc", /firma distinto cada vez/);

// WalletConnect: sin wallet inyectada, el modal QR debe abrir sin violaciones de CSP.
{
	const page = await b.newPage();
	const csp = [];
	page.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && csp.push(m.text().slice(0, 160)));
	await page.goto(APP);
	await page.getByRole("button", { name: "Conectar wallet" }).first().click();
	const wc = page.getByRole("dialog").getByRole("button", { name: /WalletConnect \(QR\)/ });
	const has = await wc.isVisible();
	if (has) await wc.click();
	await page.waitForTimeout(6000);
	const modal = await page.locator("w3m-modal").count();
	results.push({ name: "WalletConnect: opción + modal QR", ok: has && modal > 0, csp });
	await page.close();
}

// Celular sin wallet: debe ofrecer abrir en MetaMask.
{
	const ctx = await b.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", viewport: { width: 390, height: 844 } });
	const page = await ctx.newPage();
	await page.goto(`${APP}/proveedor`);
	await page.getByRole("button", { name: "Conectar wallet" }).first().click();
	const link = await page.getByRole("link", { name: /Abrir en la app de MetaMask/ }).getAttribute("href");
	results.push({ name: "Celular sin wallet: deep link", ok: link === "https://metamask.app.link/dapp/localhost:4174/proveedor", link });
	await ctx.close();
}

console.log(JSON.stringify(results, null, 1));
await b.close();
