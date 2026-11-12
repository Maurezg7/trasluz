import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/io";

const ARTIFACTS = path.join(ROOT, "contracts/artifacts/contracts");
const OUT = path.join(ROOT, "web/src/abi");

const TARGETS: Record<string, string> = {
	SettlementManager: "SettlementManager.sol/SettlementManager.json",
	EscrowVault: "EscrowVault.sol/EscrowVault.json",
	MockUSDC: "MockUSDC.sol/MockUSDC.json",
	EncryptedERC: "vendor/eerc/EncryptedERC.sol/EncryptedERC.json",
	Registrar: "vendor/eerc/Registrar.sol/Registrar.json",
};

/** Exporta los ABIs como módulos TS `as const` para tipado estricto en wagmi/viem. */
export const exportAbis = () => {
	fs.mkdirSync(OUT, { recursive: true });
	const index: string[] = [];
	for (const [name, rel] of Object.entries(TARGETS)) {
		const { abi } = JSON.parse(fs.readFileSync(path.join(ARTIFACTS, rel), "utf8"));
		fs.writeFileSync(
			path.join(OUT, `${name}.ts`),
			`// Generado por contracts/scripts/export-abi.ts — no editar\nexport const ${name}Abi = ${JSON.stringify(abi, null, 2)} as const;\n`,
		);
		index.push(`export * from "./${name}";`);
	}
	fs.writeFileSync(path.join(OUT, "index.ts"), `${index.join("\n")}\n`);
};

if (require.main === module) {
	exportAbis();
	console.log(`ABIs exportados a ${path.relative(ROOT, OUT)}`);
}
