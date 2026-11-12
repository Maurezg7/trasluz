/**
 * Flujo end-to-end sobre la red desplegada (local o Fuji):
 *   Empresa deposita → crea obligación → fondea confidencial → Proveedor verifica y
 *   confirma → Empresa libera → lo público vs. lo que ve el auditor.
 *
 *   npx hardhat run scripts/e2e.ts --network localhost|fuji
 */
import { decryptPCT, parseViewingKey, randomKeyPair, terminateProver } from "@trasluz/zk";
import type { Signer } from "ethers";
import { ethers, network } from "hardhat";
import {
	attachCore,
	depositUSDC,
	prepararObligacion,
	privateTransfer,
	proveVaultTransfer,
	readBalance,
	registerUser,
	wait,
} from "./lib/core";
import { loadDeployment, readSecret, writeSecret } from "./lib/io";

const fmt = (v: bigint) => `${ethers.formatUnits(v, 6)} USDC`;
const step = (n: number, s: string) => console.log(`\n\x1b[1;31m▲ ${n}.\x1b[0m \x1b[1m${s}\x1b[0m`);

async function main() {
	const d = loadDeployment(network.name);
	const signers = await ethers.getSigners();
	const deployer = signers[0];
	const core = attachCore(d.contracts, d.deployBlock, deployer);
	const link = (h: string) => (d.explorer ? `${d.explorer}/tx/${h}` : h);
	const isLocal = d.chainId === 31337;

	// Wallets demo: en local las cuentas de hardhat; en Fuji, wallets efímeras fondeadas por el deployer.
	const demoWallet = async (name: string, idx: number): Promise<Signer> => {
		if (isLocal) return signers[idx];
		const file = `e2e-${name}-${network.name}.txt`;
		const pk = readSecret(file);
		const w = pk ? new ethers.Wallet(pk, ethers.provider) : ethers.Wallet.createRandom().connect(ethers.provider);
		if (!pk) writeSecret(file, w.privateKey);
		if ((await ethers.provider.getBalance(w.address)) < ethers.parseEther("0.15")) {
			await (await deployer.sendTransaction({ to: w.address, value: ethers.parseEther("0.25") })).wait();
		}
		return w;
	};
	const empresa = await demoWallet("empresa", 6);
	const proveedor = await demoWallet("proveedor", 7);
	const [ea, pa] = [await empresa.getAddress(), await proveedor.getAddress()];
	const kpE = randomKeyPair();
	const kpP = randomKeyPair();
	const MONTO = ethers.parseUnits("18750.25", 6);

	step(1, "Alta de entidades (KYC allowlist + registro de claves eERC)");
	if (!(await core.manager.habilitada(ea)) || !(await core.manager.habilitada(pa))) {
		await wait(core.manager.setEntidades([ea, pa], true));
	}
	// Las wallets demo de una corrida previa ya tienen clave: en ese caso usamos wallets nuevas.
	if ((await core.registrar.isUserRegistered(ea)) || (await core.registrar.isUserRegistered(pa))) {
		throw new Error("Las wallets demo ya están registradas con otra clave. Borrá .secrets/e2e-* o usá un deploy limpio.");
	}
	await registerUser(core, empresa, kpE);
	await registerUser(core, proveedor, kpP);
	console.log(`  empresa   ${ea}\n  proveedor ${pa}`);

	step(2, "Empresa deposita tesorería: USDC → eERC (monto PÚBLICO, es la rampa de entrada)");
	await wait(core.usdc.connect(empresa).faucet());
	const dep = await depositUSDC(core, empresa, ethers.parseUnits("50000", 6));
	console.log(`  deposit  ${link(dep.hash)}`);

	step(3, "Empresa crea la obligación (vault de escrow propio, registrado en eERC)");
	const prep = await prepararObligacion(core, kpE, ea, pa);
	const rc = await wait(
		core.manager.connect(empresa).crear(pa, ethers.id(`FAC-A-0001-00004521|${Date.now()}`), prep.vaultProof as never, prep.claveCifrada as never),
	);
	const id = await core.manager.totalObligaciones();
	console.log(`  obligación #${id}  vault ${prep.vault}\n  crear    ${link(rc.hash)}`);

	step(4, `Empresa fondea confidencialmente (${fmt(MONTO)} — nadie más lo ve)`);
	const t = await privateTransfer(core, empresa, kpE, prep.vault, MONTO);
	const f = await wait(core.manager.connect(empresa).fondear(id));
	console.log(`  transfer ${link(t.hash)}\n  fondear  ${link(f.hash)}`);

	step(5, "Proveedor descifra la clave del vault, verifica el fondeo y confirma entrega");
	const enc = await core.manager.claveVaultCifrada(id);
	const vaultKey = decryptPCT(kpP.privateKey, [...enc]);
	const vb = await readBalance(core, prep.vault, { ...prep.vaultKp, privateKey: vaultKey });
	console.log(`  saldo del vault visto por el proveedor: ${fmt(vb.balance)} (consistente con ElGamal: ${vb.consistent})`);
	const c = await wait(core.manager.connect(proveedor).confirmarEntrega(id));
	console.log(`  confirmar ${link(c.hash)}`);

	step(6, "Empresa libera: transferencia confidencial vault → proveedor");
	const { proof, balancePCT } = await proveVaultTransfer(core, prep.vaultKp, prep.vault, pa);
	const l = await wait(core.manager.connect(empresa).liberar(id, proof, balancePCT as never));
	console.log(`  liberar  ${link(l.hash)}`);
	console.log(`  saldo eERC del proveedor (descifrado por él): ${fmt((await readBalance(core, pa, kpP)).balance)}`);

	step(7, "Vista PÚBLICA (lo que ve cualquiera en el explorer)");
	const logs = await core.eerc.queryFilter(core.eerc.filters.PrivateTransfer(), d.deployBlock);
	const mine = logs.filter((x) => [prep.vault, pa].includes(x.args.to) && [ea, prep.vault].includes(x.args.from));
	for (const x of mine) {
		console.log(`  ${x.args.from.slice(0, 10)}… → ${x.args.to.slice(0, 10)}…  monto: 0x${x.args.auditorPCT[0].toString(16).slice(0, 24)}… (ciphertext)`);
	}

	step(8, "Vista AUDITOR (con la viewing key designada)");
	const vk = readSecret(`auditor-viewing-key-${network.name}.txt`);
	if (!vk) {
		console.log("  (no hay viewing key local para esta red; el auditor la carga en el portal)");
	} else {
		const key = parseViewingKey(vk);
		let fondeado = 0n;
		let liberado = 0n;
		for (const x of mine) {
			const amt = decryptPCT(key, x.args.auditorPCT.map(BigInt));
			if (x.args.to === prep.vault) fondeado += amt;
			if (x.args.from === prep.vault) liberado += amt;
			console.log(`  ${x.args.from.slice(0, 10)}… → ${x.args.to.slice(0, 10)}…  monto: \x1b[1;32m${fmt(amt)}\x1b[0m`);
		}
		const ok = fondeado === liberado && fondeado === MONTO;
		console.log(`\n  Reconciliación #${id}: fondeado ${fmt(fondeado)} · liberado ${fmt(liberado)} → ${ok ? "\x1b[1;32mCONCILIA ✓\x1b[0m" : "\x1b[1;31mNO CONCILIA ✗\x1b[0m"}`);
		if (!ok) process.exitCode = 1;
	}
	console.log("\n  Confidencial para el mercado, transparente para el regulador.\n");
}

main()
	.then(terminateProver)
	.catch(async (e) => {
		console.error(e);
		await terminateProver();
		process.exitCode = 1;
	});
