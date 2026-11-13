import { type KeyPair, decryptPCT, processPoseidonDecryption, randomKeyPair, terminateProver } from "@trasluz/zk";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import type { ContractTransactionReceipt, ContractTransactionResponse } from "ethers";
import { ethers } from "hardhat";
import {
	type Core,
	deployCore,
	depositUSDC,
	prepararObligacion,
	privateTransfer,
	proveVaultTransfer,
	readBalance,
	registerUser,
	withdrawUSDC,
} from "../scripts/lib/core";
import { EscrowVault__factory } from "../typechain-types";

const USDC = (n: number) => BigInt(Math.round(n * 1e6));
const Estado = { Inexistente: 0n, Creada: 1n, Fondeada: 2n, Liberada: 3n, Cancelada: 4n };

describe("Trasluz · SettlementManager sobre eERC oficial", () => {
	let core: Core;
	let owner: HardhatEthersSigner;
	let auditor: HardhatEthersSigner;
	let empresa: HardhatEthersSigner;
	let proveedor: HardhatEthersSigner;
	let intruso: HardhatEthersSigner;
	const kp: Record<string, KeyPair> = {};

	/** Recibos de todas las txs del flujo confidencial (para buscar fugas del monto). */
	const receipts: ContractTransactionReceipt[] = [];
	const track = async (p: Promise<ContractTransactionResponse>) => {
		const tx = await p;
		const r = (await tx.wait()) as ContractTransactionReceipt;
		receipts.push(r);
		return r;
	};

	const MONTO = USDC(2_537.42);

	const crearObligacion = async (pagador = empresa, prov = proveedor, ref = "FAC-0001") => {
		const prep = await prepararObligacion(core, kp[pagador.address], pagador.address, prov.address);
		await track(
			core.manager
				.connect(pagador)
				.crear(prov.address, ethers.id(`${ref}|salt`), prep.vaultProof as never, prep.claveCifrada as never),
		);
		const id = await core.manager.totalObligaciones();
		return { id, ...prep };
	};

	before(async () => {
		[owner, auditor, empresa, proveedor, intruso] = await ethers.getSigners();
		core = await deployCore(owner);

		for (const s of [auditor, empresa, proveedor, intruso]) {
			kp[s.address] = randomKeyPair();
			await registerUser(core, s, kp[s.address]);
		}
		await (await core.eerc.connect(owner).setAuditorPublicKey(auditor.address)).wait();
		await (await core.manager.connect(owner).setEntidades([empresa.address, proveedor.address], true)).wait();

		await (await core.usdc.connect(empresa).faucet()).wait();
		await depositUSDC(core, empresa, USDC(10_000));
	});

	after(terminateProver);

	describe("flujo feliz: crear → fondear → confirmar → liberar", () => {
		let ob: Awaited<ReturnType<typeof crearObligacion>>;

		it("crea la obligación y registra el vault en el Registrar oficial", async () => {
			ob = await crearObligacion();
			const o = await core.manager.obligacion(ob.id);
			expect(o.estado).to.equal(Estado.Creada);
			expect(o.vault).to.equal(ob.vault);
			expect(await core.registrar.isUserRegistered(ob.vault)).to.equal(true);
			expect(await core.manager.obligacionDeVault(ob.vault)).to.equal(ob.id);
		});

		it("no se puede fondear sin transferencia confidencial al vault", async () => {
			await expect(core.manager.connect(empresa).fondear(ob.id)).to.be.revertedWithCustomError(
				core.manager,
				"SinFondos",
			);
		});

		it("el pagador fondea con una transferencia eERC confidencial", async () => {
			receipts.push(await privateTransfer(core, empresa, kp[empresa.address], ob.vault, MONTO));
			await track(core.manager.connect(empresa).fondear(ob.id));
			expect((await core.manager.obligacion(ob.id)).estado).to.equal(Estado.Fondeada);
			expect((await readBalance(core, empresa.address, kp[empresa.address])).balance).to.equal(USDC(10_000) - MONTO);
		});

		it("el proveedor descifra la clave del vault y verifica el fondeo antes de entregar", async () => {
			const enc = await core.manager.claveVaultCifrada(ob.id);
			const [vaultKey] = processPoseidonDecryption(
				[...enc.slice(0, 4)],
				[...enc.slice(4, 6)],
				enc[6],
				kp[proveedor.address].privateKey,
				1,
			);
			expect(BigInt(vaultKey)).to.equal(ob.vaultKp.privateKey);
			const vaultBal = await readBalance(core, ob.vault, ob.vaultKp);
			expect(vaultBal.balance).to.equal(MONTO);
			expect(vaultBal.consistent).to.equal(true);
		});

		it("no se puede liberar sin confirmación de entrega", async () => {
			const { proof, balancePCT } = await proveVaultTransfer(core, ob.vaultKp, ob.vault, proveedor.address);
			await expect(
				core.manager.connect(empresa).liberar(ob.id, proof, balancePCT as never),
			).to.be.revertedWithCustomError(core.manager, "EstadoInvalido");
		});

		it("sólo el proveedor confirma la entrega", async () => {
			await expect(core.manager.connect(empresa).confirmarEntrega(ob.id)).to.be.revertedWithCustomError(
				core.manager,
				"NoAutorizado",
			);
			await track(core.manager.connect(proveedor).confirmarEntrega(ob.id));
			expect((await core.manager.obligacion(ob.id)).entregaConfirmada).to.equal(true);
			await expect(core.manager.connect(empresa).cancelar(ob.id)).to.be.revertedWithCustomError(
				core.manager,
				"EstadoInvalido",
			);
		});

		it("el pagador NO puede desviar el escrow a otra cuenta (la prueba queda ligada al proveedor)", async () => {
			const { proof, balancePCT } = await proveVaultTransfer(core, ob.vaultKp, ob.vault, empresa.address);
			await expect(core.manager.connect(empresa).liberar(ob.id, proof, balancePCT as never)).to.be.reverted;
		});

		it("el vault sólo obedece al SettlementManager", async () => {
			const { proof, balancePCT } = await proveVaultTransfer(core, ob.vaultKp, ob.vault, proveedor.address);
			const vault = EscrowVault__factory.connect(ob.vault, empresa);
			const tokenId = await core.manager.tokenId();
			await expect(vault.transferir(proveedor.address, tokenId, proof, balancePCT as never)).to.be.revertedWithCustomError(
				vault,
				"SoloManager",
			);
		});

		it("libera: transferencia confidencial vault → proveedor", async () => {
			const { proof, balancePCT } = await proveVaultTransfer(core, ob.vaultKp, ob.vault, proveedor.address);
			await expect(core.manager.connect(intruso).liberar(ob.id, proof, balancePCT as never)).to.be.revertedWithCustomError(
				core.manager,
				"NoAutorizado",
			);
			await track(core.manager.connect(empresa).liberar(ob.id, proof, balancePCT as never));
			expect((await core.manager.obligacion(ob.id)).estado).to.equal(Estado.Liberada);
			expect((await readBalance(core, proveedor.address, kp[proveedor.address])).balance).to.equal(MONTO);
			expect((await readBalance(core, ob.vault, ob.vaultKp)).balance).to.equal(0n);
		});

		it("doble liberación imposible", async () => {
			// La máquina de estados rechaza antes de tocar eERC, sin importar la prueba.
			const dummy = {
				proofPoints: { a: [0n, 0n], b: [[0n, 0n], [0n, 0n]], c: [0n, 0n] },
				publicSignals: Array(32).fill(0n),
			};
			await expect(
				core.manager.connect(empresa).liberar(ob.id, dummy as never, Array(7).fill(0n) as never),
			).to.be.revertedWithCustomError(core.manager, "EstadoInvalido");
			// Y el vault ya no tiene saldo: no existe prueba válida para volver a mover fondos.
			const err = await proveVaultTransfer(core, ob.vaultKp, ob.vault, proveedor.address, 1n).then(
				() => null,
				(e: Error) => e,
			);
			expect(err?.message).to.equal("Saldo cifrado insuficiente");
		});

		it("el proveedor puede retirar a USDC público", async () => {
			const before = await core.usdc.balanceOf(proveedor.address);
			await withdrawUSDC(core, proveedor, kp[proveedor.address], USDC(500));
			expect(await core.usdc.balanceOf(proveedor.address)).to.equal(before + USDC(500));
			expect((await readBalance(core, proveedor.address, kp[proveedor.address])).balance).to.equal(MONTO - USDC(500));
		});
	});

	describe("allowlist KYC", () => {
		it("un no-habilitado no puede crear", async () => {
			const prep = await prepararObligacion(core, kp[intruso.address], intruso.address, proveedor.address);
			await expect(
				core.manager
					.connect(intruso)
					.crear(proveedor.address, ethers.id("x"), prep.vaultProof as never, prep.claveCifrada as never),
			).to.be.revertedWithCustomError(core.manager, "NoHabilitada");
		});

		it("no se puede crear una obligación a favor de un no-habilitado", async () => {
			const prep = await prepararObligacion(core, kp[empresa.address], empresa.address, intruso.address);
			await expect(
				core.manager.connect(empresa).crear(intruso.address, ethers.id("x"), prep.vaultProof as never, prep.claveCifrada as never),
			).to.be.revertedWithCustomError(core.manager, "NoHabilitada");
		});

		it("un proveedor des-habilitado no puede recibir la liberación", async () => {
			const ob = await crearObligacion(empresa, proveedor, "FAC-KYC");
			await privateTransfer(core, empresa, kp[empresa.address], ob.vault, USDC(10));
			await (await core.manager.connect(empresa).fondear(ob.id)).wait();
			await (await core.manager.connect(proveedor).confirmarEntrega(ob.id)).wait();
			await (await core.manager.connect(owner).setEntidad(proveedor.address, false)).wait();
			const { proof, balancePCT } = await proveVaultTransfer(core, ob.vaultKp, ob.vault, proveedor.address);
			await expect(
				core.manager.connect(empresa).liberar(ob.id, proof, balancePCT as never),
			).to.be.revertedWithCustomError(core.manager, "NoHabilitada");
			await (await core.manager.connect(owner).setEntidad(proveedor.address, true)).wait();
		});

		it("sólo el owner gestiona la allowlist", async () => {
			await expect(core.manager.connect(empresa).setEntidad(intruso.address, true)).to.be.revertedWithCustomError(
				core.manager,
				"OwnableUnauthorizedAccount",
			);
		});
	});

	describe("cancelación y reembolso", () => {
		it("cancela una obligación fondeada sin entrega y reembolsa al pagador", async () => {
			const ob = await crearObligacion(empresa, proveedor, "FAC-CANCEL");
			const antes = (await readBalance(core, empresa.address, kp[empresa.address])).balance;
			await privateTransfer(core, empresa, kp[empresa.address], ob.vault, USDC(321));
			await (await core.manager.connect(empresa).fondear(ob.id)).wait();
			await expect(core.manager.connect(proveedor).cancelar(ob.id)).to.be.revertedWithCustomError(
				core.manager,
				"NoAutorizado",
			);
			await (await core.manager.connect(empresa).cancelar(ob.id)).wait();
			const { proof, balancePCT } = await proveVaultTransfer(core, ob.vaultKp, ob.vault, empresa.address);
			await (await core.manager.connect(empresa).reembolsar(ob.id, proof, balancePCT as never)).wait();
			expect((await readBalance(core, empresa.address, kp[empresa.address])).balance).to.equal(antes);
			expect((await core.manager.obligacion(ob.id)).estado).to.equal(Estado.Cancelada);
		});
	});

	describe("liberación parcial", () => {
		it("tras la entrega confirmada el pagador no puede reembolsarse el remanente", async () => {
			const ob = await crearObligacion(empresa, proveedor, "FAC-PARCIAL");
			await privateTransfer(core, empresa, kp[empresa.address], ob.vault, USDC(500));
			await (await core.manager.connect(empresa).fondear(ob.id)).wait();
			await (await core.manager.connect(proveedor).confirmarEntrega(ob.id)).wait();
			const parcial = await proveVaultTransfer(core, ob.vaultKp, ob.vault, proveedor.address, USDC(1));
			await (await core.manager.connect(empresa).liberar(ob.id, parcial.proof, parcial.balancePCT as never)).wait();
			const resto = await proveVaultTransfer(core, ob.vaultKp, ob.vault, empresa.address);
			await expect(core.manager.connect(empresa).reembolsar(ob.id, resto.proof, resto.balancePCT as never)).to.be.revertedWithCustomError(
				core.manager,
				"EstadoInvalido",
			);
			expect((await readBalance(core, ob.vault, ob.vaultKp)).balance).to.equal(USDC(499));
		});
	});

	describe("confidencialidad y auditoría", () => {
		const wordsOf = (hex: string) => {
			const h = hex.startsWith("0x") ? hex.slice(2) : hex;
			const out: bigint[] = [];
			for (let i = 0; i + 64 <= h.length; i += 64) out.push(BigInt(`0x${h.slice(i, i + 64)}`));
			return out;
		};

		it("ningún evento (SettlementManager ni eERC) contiene el monto en claro", async () => {
			expect(receipts.length).to.be.greaterThan(4);
			for (const r of receipts) {
				for (const log of r.logs) {
					const words = [...log.topics.map((t) => BigInt(t)), ...wordsOf(log.data)];
					expect(words, `log de ${log.address} filtra el monto`).to.not.include(MONTO);
				}
			}
		});

		it("el calldata de fondeo/liberación tampoco contiene el monto en claro", async () => {
			for (const r of receipts) {
				const tx = await ethers.provider.getTransaction(r.hash);
				expect(wordsOf(`0x${tx!.data.slice(10)}`)).to.not.include(MONTO);
			}
		});

		it("los eventos del SettlementManager sólo exponen {id, pagador, proveedor, estado, timestamp}", async () => {
			const ev = core.manager.interface.getEvent("ObligacionActualizada");
			expect(ev.inputs.map((i) => i.name)).to.deep.equal(["id", "pagador", "proveedor", "estado", "timestamp"]);
		});

		it("el auditor designado descifra el monto real con su viewing key", async () => {
			const logs = await core.eerc.queryFilter(core.eerc.filters.PrivateTransfer(), core.deployBlock);
			const audit = kp[auditor.address].privateKey;
			const decoded = logs.map((l) => ({
				from: l.args.from,
				to: l.args.to,
				amount: decryptPCT(audit, l.args.auditorPCT.map(BigInt)),
			}));
			const vault = (await core.manager.obligacion(1n)).vault;
			const fondeo = decoded.find((d) => d.from === empresa.address && d.to === vault);
			const liberacion = decoded.find((d) => d.from === vault && d.to === proveedor.address);
			expect(fondeo?.amount).to.equal(MONTO);
			expect(liberacion?.amount).to.equal(MONTO);
		});

		it("una clave que no es la del auditor no descifra nada", async () => {
			const [l] = await core.eerc.queryFilter(core.eerc.filters.PrivateTransfer(), core.deployBlock);
			expect(() => decryptPCT(kp[intruso.address].privateKey, l.args.auditorPCT.map(BigInt))).to.throw();
		});
	});
});
