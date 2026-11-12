// Copia los circuitos oficiales (circuits/) a web/public/zk y genera el manifiesto de
// integridad (SHA-256) que el prover verifica ANTES de usar cada wasm/zkey.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../../circuits");
const dst = path.resolve(here, "../public/zk");
const manifestFile = path.resolve(here, "../src/config/zk-manifest.json");

const manifest = {};
for (const circuit of fs.readdirSync(src).sort()) {
	const from = path.join(src, circuit);
	if (!fs.statSync(from).isDirectory()) continue;
	fs.mkdirSync(path.join(dst, circuit), { recursive: true });
	for (const f of fs.readdirSync(from).sort()) {
		const a = path.join(from, f);
		const b = path.join(dst, circuit, f);
		const bytes = fs.readFileSync(a);
		manifest[`/zk/${circuit}/${f}`] = crypto.createHash("sha256").update(bytes).digest("hex");
		if (!fs.existsSync(b) || fs.statSync(b).size !== bytes.length) fs.writeFileSync(b, bytes);
	}
}
const json = `${JSON.stringify(manifest, null, 2)}\n`;
if (!fs.existsSync(manifestFile) || fs.readFileSync(manifestFile, "utf8") !== json) fs.writeFileSync(manifestFile, json);
console.log(`✓ circuitos eERC sincronizados en web/public/zk (${Object.keys(manifest).length} archivos con SHA-256 fijado)`);
