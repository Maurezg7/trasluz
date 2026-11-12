import {
	type Circuits,
	type KeyPair,
	decryptBalance,
	deriveVaultKeyPair,
	processPoseidonEncryption,
	proveRegistration,
	proveTransfer,
	proveWithdraw,
} from "@trasluz/zk";
import type { ContractTransactionReceipt, ContractTransactionResponse, Signer } from "ethers";
import { ethers } from "hardhat";
import path from "node:path";
import {
	EncryptedERC__factory,
	type EncryptedERC,
	MockUSDC__factory,
	type MockUSDC,
	Registrar__factory,
	type Registrar,
	SettlementManager__factory,
	type SettlementManager,
} from "../../typechain-types";
import { BabyJubJub__factory } from "../../typechain-types/factories/contracts/vendor/eerc/libraries";
import {
	BurnVerifier__factory,
	MintVerifier__factory,
	RegistrationVerifier__factory,
	TransferVerifier__factory,
	WithdrawVerifier__factory,
} from "../../typechain-types/factories/contracts/vendor/eerc/prod";

const CIRCUITS_DIR = path.resolve(__dirname, "../../../circuits");

/** Circuitos oficiales (ceremonia de producción) — ver circuits/README.md */
export const circuits: Circuits = {
	registration: {
		wasm: path.join(CIRCUITS_DIR, "registration/registration.wasm"),
		zkey: path.join(CIRCUITS_DIR, "registration/circuit_final.zkey"),
	},
	transfer: {
		wasm: path.join(CIRCUITS_DIR, "transfer/transfer.wasm"),
		zkey: path.join(CIRCUITS_DIR, "transfer/transfer.zkey"),
	},
	withdraw: {
		wasm: path.join(CIRCUITS_DIR, "withdraw/withdraw.wasm"),
		zkey: path.join(CIRCUITS_DIR, "withdraw/circuit_final.zkey"),
	},
};

export const EERC_DECIMALS = 6;

export type Core = {
	registrar: Registrar;
	eerc: EncryptedERC;
	usdc: MockUSDC;
	manager: SettlementManager;
	verifiers: Record<string, string>;
	babyJubJub: string;
	deployBlock: number;
};

export const wait = async (p: Promise<ContractTransactionResponse>) => {
	const tx = await p;
	return (await tx.wait()) as ContractTransactionReceipt;
};

/** Despliega eERC OFICIAL (verifiers de producción, converter mode) + MockUSDC + SettlementManager. */
export const deployCore = async (deployer: Signer, log = false): Promise<Core> => {
	const say = (...a: unknown[]) => log && console.log(...a);
	const deployBlock = await ethers.provider.getBlockNumber();

	const deployed = async <C extends { waitForDeployment: () => Promise<unknown>; getAddress: () => Promise<string> }>(
		name: string,
		p: Promise<C>,
	) => {
		const c = await p;
		await c.waitForDeployment();
		say(`  ✓ ${name.padEnd(22)} ${await c.getAddress()}`);
		return c;
	};

	const registrationVerifier = await deployed("RegistrationVerifier", new RegistrationVerifier__factory(deployer).deploy());
	const mintVerifier = await deployed("MintVerifier", new MintVerifier__factory(deployer).deploy());
	const withdrawVerifier = await deployed("WithdrawVerifier", new WithdrawVerifier__factory(deployer).deploy());
	const transferVerifier = await deployed("TransferVerifier", new TransferVerifier__factory(deployer).deploy());
	const burnVerifier = await deployed("BurnVerifier", new BurnVerifier__factory(deployer).deploy());
	const lib = await deployed("BabyJubJub", new BabyJubJub__factory(deployer).deploy());
	const babyJubJub = await lib.getAddress();

	const registrar = await deployed(
		"Registrar",
		new Registrar__factory(deployer).deploy(await registrationVerifier.getAddress()),
	);
	const eerc = await deployed(
		"EncryptedERC",
		new EncryptedERC__factory({ "contracts/vendor/eerc/libraries/BabyJubJub.sol:BabyJubJub": babyJubJub }, deployer).deploy({
			registrar: await registrar.getAddress(),
			isConverter: true,
			name: "",
			symbol: "",
			mintVerifier: await mintVerifier.getAddress(),
			withdrawVerifier: await withdrawVerifier.getAddress(),
			transferVerifier: await transferVerifier.getAddress(),
			burnVerifier: await burnVerifier.getAddress(),
			decimals: EERC_DECIMALS,
		}),
	);
	const usdc = await deployed("MockUSDC", new MockUSDC__factory(deployer).deploy());
	const manager = await deployed(
		"SettlementManager",
		new SettlementManager__factory(deployer).deploy(
			await eerc.getAddress(),
			await registrar.getAddress(),
			await usdc.getAddress(),
			await deployer.getAddress(),
		),
	);

	return {
		registrar,
		eerc,
		usdc,
		manager,
		babyJubJub,
		deployBlock,
		verifiers: {
			registrationVerifier: await registrationVerifier.getAddress(),
			mintVerifier: await mintVerifier.getAddress(),
			withdrawVerifier: await withdrawVerifier.getAddress(),
			transferVerifier: await transferVerifier.getAddress(),
			burnVerifier: await burnVerifier.getAddress(),
		},
	};
};

const chainId = async () => (await ethers.provider.getNetwork()).chainId;

export const registerUser = async (core: Core, signer: Signer, kp: KeyPair) => {
	const addr = await signer.getAddress();
	if (await core.registrar.isUserRegistered(addr)) return;
	const proof = await proveRegistration(kp, addr, await chainId(), circuits.registration);
	await wait(core.registrar.connect(signer).register(proof as never));
};

export const auditorPublicKey = async (core: Core): Promise<[bigint, bigint]> => {
	const pk = await core.eerc.auditorPublicKey();
	return [pk.x, pk.y];
};

export const readBalance = async (core: Core, owner: string, kp: KeyPair) => {
	const tokenId = await core.eerc.tokenIds(await core.usdc.getAddress());
	const [eGCT, , amountPCTs, balancePCT] = await core.eerc.balanceOf(owner, tokenId);
	return decryptBalance(kp.privateKey, eGCT, amountPCTs, balancePCT);
};

/** Deposit converter: USDC público → saldo eERC cifrado. El monto de un deposit ES público. */
export const depositUSDC = async (core: Core, signer: Signer, amount: bigint) => {
	const usdcAddr = await core.usdc.getAddress();
	await wait(core.usdc.connect(signer).approve(await core.eerc.getAddress(), amount));
	// amountPCT del depósito: cifrado con la clave del propio usuario (igual que los tests oficiales)
	const pub = await core.registrar.getUserPublicKey(await signer.getAddress());
	const pct = processPoseidonEncryption([amount], [pub[0], pub[1]]);
	const amountPCT = [...pct.ciphertext, ...pct.authKey, pct.nonce];
	return wait(core.eerc.connect(signer)["deposit(uint256,address,uint256[7])"](amount, usdcAddr, amountPCT as never));
};

/** Transferencia confidencial directa en eERC (msg.sender = dueño de la clave). */
export const privateTransfer = async (core: Core, signer: Signer, kp: KeyPair, to: string, amount: bigint) => {
	const from = await signer.getAddress();
	const bal = await readBalance(core, from, kp);
	const receiverPK = await core.registrar.getUserPublicKey(to);
	const { proof, balancePCT } = await proveTransfer(
		{
			sender: kp,
			senderBalance: bal.balance,
			senderEncryptedBalance: bal.encrypted,
			receiverPublicKey: [receiverPK[0], receiverPK[1]],
			auditorPublicKey: await auditorPublicKey(core),
			amount,
		},
		circuits.transfer,
	);
	const tokenId = await core.eerc.tokenIds(await core.usdc.getAddress());
	return wait(
		core.eerc
			.connect(signer)
			["transfer(address,uint256,((uint256[2],uint256[2][2],uint256[2]),uint256[32]),uint256[7])"](
				to,
				tokenId,
				proof,
				balancePCT as never,
			),
	);
};

export const withdrawUSDC = async (core: Core, signer: Signer, kp: KeyPair, amount: bigint) => {
	const addr = await signer.getAddress();
	const bal = await readBalance(core, addr, kp);
	const { proof, balancePCT } = await proveWithdraw(
		{
			user: kp,
			balance: bal.balance,
			encryptedBalance: bal.encrypted,
			auditorPublicKey: await auditorPublicKey(core),
			amount,
		},
		circuits.withdraw,
	);
	const tokenId = await core.eerc.tokenIds(await core.usdc.getAddress());
	return wait(
		core.eerc
			.connect(signer)
			["withdraw(uint256,((uint256[2],uint256[2][2],uint256[2]),uint256[16]),uint256[7])"](
				tokenId,
				proof,
				balancePCT as never,
			),
	);
};

/** Prepara los argumentos de `crear`: vault predicho, prueba de registro y clave cifrada para el proveedor. */
export const prepararObligacion = async (core: Core, payerKp: KeyPair, pagador: string, proveedor: string) => {
	const vault = await core.manager.predecirVault(pagador);
	const vaultKp = deriveVaultKeyPair(payerKp.privateKey, vault);
	const vaultProof = await proveRegistration(vaultKp, vault, await chainId(), circuits.registration);
	const provPK = await core.registrar.getUserPublicKey(proveedor);
	const enc = processPoseidonEncryption([vaultKp.privateKey], [provPK[0], provPK[1]]);
	const claveCifrada = [...enc.ciphertext, ...enc.authKey, enc.nonce];
	return { vault, vaultKp, vaultProof, claveCifrada };
};

/** Prueba de transferencia DESDE el vault (la genera el pagador con la clave derivada). */
export const proveVaultTransfer = async (core: Core, vaultKp: KeyPair, vault: string, to: string, amount?: bigint) => {
	const bal = await readBalance(core, vault, vaultKp);
	const receiverPK = await core.registrar.getUserPublicKey(to);
	return proveTransfer(
		{
			sender: vaultKp,
			senderBalance: bal.balance,
			senderEncryptedBalance: bal.encrypted,
			receiverPublicKey: [receiverPK[0], receiverPK[1]],
			auditorPublicKey: await auditorPublicKey(core),
			amount: amount ?? bal.balance,
		},
		circuits.transfer,
	);
};

export const attachCore = (
	c: Record<string, string>,
	deployBlock: number,
	runner: Signer,
): Core => ({
	registrar: Registrar__factory.connect(c.registrar, runner),
	eerc: EncryptedERC__factory.connect(c.encryptedERC, runner),
	usdc: MockUSDC__factory.connect(c.usdc, runner),
	manager: SettlementManager__factory.connect(c.settlementManager, runner),
	babyJubJub: c.babyJubJub,
	deployBlock,
	verifiers: {},
});

export const addressesOf = async (core: Core) => ({
	registrar: await core.registrar.getAddress(),
	encryptedERC: await core.eerc.getAddress(),
	usdc: await core.usdc.getAddress(),
	settlementManager: await core.manager.getAddress(),
	vaultImplementation: await core.manager.vaultImplementation(),
	babyJubJub: core.babyJubJub,
	...core.verifiers,
});
