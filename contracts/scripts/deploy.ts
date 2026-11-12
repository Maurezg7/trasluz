/**
 * Despliega Trasluz: eERC OFICIAL (converter, verifiers de producción) + MockUSDC +
 * SettlementManager, registra al auditor designado y habilita las entidades KYC.
 *
 *   npx hardhat run scripts/deploy.ts --network localhost|fuji
 *
 * Variables (.env en la raíz):
 *   DEPLOYER_PRIVATE_KEY   owner / deployer (Fuji)
 *   AUDITOR_PRIVATE_KEY    EOA del auditor (opcional: si falta se genera y se fondea)
 *   KYC_ADDRESSES          lista separada por comas de entidades a habilitar
 */
import { privateKeyToHex, randomKeyPair, terminateProver } from "@trasluz/zk";
import { ethers, network } from "hardhat";
import { addressesOf, deployCore, registerUser } from "./lib/core";
import { explorerFor, readSecret, saveDeployment, writeSecret } from "./lib/io";
import { exportAbis } from "./export-abi";

async function main() {
	const signers = await ethers.getSigners();
	const deployer = signers[0];
	if (!deployer) throw new Error("Falta DEPLOYER_PRIVATE_KEY en .env");
	const { chainId } = await ethers.provider.getNetwork();
	const isLocal = chainId === 31337n;

	console.log(`\n▲ Trasluz · deploy en ${network.name} (chainId ${chainId})`);
	console.log(`  deployer ${deployer.address}  (${ethers.formatEther(await ethers.provider.getBalance(deployer))} AVAX)\n`);

	const core = await deployCore(deployer, true);

	// ── Auditor designado ────────────────────────────────────────────────────────
	let auditor = isLocal ? signers[1] : undefined;
	if (!auditor) {
		const pk = process.env.AUDITOR_PRIVATE_KEY || readSecret(`auditor-evm-key-${network.name}.txt`);
		const wallet = pk ? new ethers.Wallet(pk, ethers.provider) : ethers.Wallet.createRandom().connect(ethers.provider);
		if (!pk) writeSecret(`auditor-evm-key-${network.name}.txt`, wallet.privateKey);
		const bal = await ethers.provider.getBalance(wallet.address);
		if (bal < ethers.parseEther("0.05")) {
			await (await deployer.sendTransaction({ to: wallet.address, value: ethers.parseEther("0.1") })).wait();
		}
		auditor = wallet as unknown as typeof deployer;
	}
	const auditorKp = randomKeyPair();
	await registerUser(core, auditor, auditorKp);
	await (await core.eerc.connect(deployer).setAuditorPublicKey(auditor.address)).wait();
	const keyFile = writeSecret(`auditor-viewing-key-${network.name}.txt`, privateKeyToHex(auditorKp.privateKey));
	console.log(`\n  ✓ Auditor designado       ${auditor.address}`);
	console.log(`    viewing key guardada en ${keyFile} (gitignored — NO se imprime)`);

	// ── Allowlist KYC ────────────────────────────────────────────────────────────
	const kyc = (process.env.KYC_ADDRESSES || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (isLocal) kyc.push(...signers.slice(2, 6).map((s) => s.address));
	if (kyc.length) {
		await (await core.manager.connect(deployer).setEntidades(kyc, true)).wait();
		console.log(`  ✓ Entidades KYC habilitadas: ${kyc.length}`);
	}

	const contracts = await addressesOf(core);
	saveDeployment({
		network: network.name,
		chainId: Number(chainId),
		deployBlock: core.deployBlock,
		deployedAt: new Date().toISOString(),
		explorer: explorerFor(Number(chainId)),
		owner: deployer.address,
		auditor: auditor.address,
		contracts,
	});
	exportAbis();
	console.log("\n  ✓ addresses.json, contracts/deployments/ y web/src/config/deployments.json actualizados\n");
	console.table(contracts);
}

main()
	.then(terminateProver)
	.catch(async (e) => {
		console.error(e);
		await terminateProver();
		process.exitCode = 1;
	});
