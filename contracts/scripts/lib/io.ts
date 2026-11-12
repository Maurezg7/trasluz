import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(__dirname, "../../..");
export const SECRETS_DIR = path.join(ROOT, ".secrets");
export const WEB_DEPLOYMENTS = path.join(ROOT, "web/src/config/deployments.json");
/** Deployments locales (hardhat): gitignored, para no ensuciar el repo con direcciones descartables. */
export const WEB_DEPLOYMENTS_LOCAL = path.join(ROOT, "web/src/config/deployments.local.json");

export type Deployment = {
	network: string;
	chainId: number;
	deployBlock: number;
	deployedAt: string;
	explorer: string | null;
	owner: string;
	auditor: string;
	contracts: Record<string, string>;
};

export const explorerFor = (chainId: number) =>
	chainId === 43113 ? "https://testnet.snowtrace.io" : chainId === 43114 ? "https://snowtrace.io" : null;

const readJson = <T>(file: string, fallback: T): T =>
	fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : fallback;

const writeJson = (file: string, data: unknown) => {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

export const saveDeployment = (d: Deployment) => {
	writeJson(path.join(ROOT, "contracts/deployments", `${d.network}.json`), d);
	const local = d.chainId === 31337;
	const webFile = local ? WEB_DEPLOYMENTS_LOCAL : WEB_DEPLOYMENTS;
	const web = readJson<Record<string, Deployment>>(webFile, {});
	web[String(d.chainId)] = d;
	writeJson(webFile, web);
	if (local) return;
	// addresses.json en la raíz: lo que pide el entregable (redes públicas desplegadas)
	const all = readJson<Record<string, Deployment>>(path.join(ROOT, "addresses.json"), {});
	all[d.network] = d;
	writeJson(path.join(ROOT, "addresses.json"), all);
};

export const loadDeployment = (network: string): Deployment => {
	const file = path.join(ROOT, "contracts/deployments", `${network}.json`);
	if (!fs.existsSync(file)) throw new Error(`No hay deployment para "${network}". Corré primero el deploy.`);
	return JSON.parse(fs.readFileSync(file, "utf8"));
};

/** Secretos de demo (viewing key del auditor, wallets demo). Directorio gitignored, permisos 600. */
export const writeSecret = (name: string, value: string) => {
	fs.mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
	const file = path.join(SECRETS_DIR, name);
	fs.writeFileSync(file, `${value}\n`, { mode: 0o600 });
	return path.relative(ROOT, file);
};

export const readSecret = (name: string): string | null => {
	const file = path.join(SECRETS_DIR, name);
	return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : null;
};
