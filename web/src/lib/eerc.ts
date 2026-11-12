/**
 * Cliente eERC para el browser: lecturas de saldo cifrado + operaciones con prueba ZK
 * generada localmente (las claves nunca salen del navegador).
 */
import type { KeyPair } from "@trasluz/zk";
import type { Address, Hash, PublicClient, WalletClient } from "viem";
import { getWalletClient } from "wagmi/actions";
import { EncryptedERCAbi, MockUSDCAbi, RegistrarAbi, SettlementManagerAbi } from "../abi";
import { type Deployment, wagmiConfig } from "../config";
import { zk } from "./prover";

/** `account` = cuenta activa en la wallet. El WalletClient se obtiene en el momento de firmar. */
export type Ctx = { pc: PublicClient; account?: Address; d: Deployment };

const need = (ctx: Ctx) => {
	if (!ctx.account) throw new Error("Conectá tu wallet");
	return ctx.account;
};

const send = async (ctx: Ctx, req: Parameters<WalletClient["writeContract"]>[0]): Promise<Hash> => {
	// Cliente fresco ligado explícitamente a la cuenta activa: tras un cambio de cuenta en la
	// wallet nunca se firma con la anterior.
	const wc = await getWalletClient(wagmiConfig, { account: need(ctx), chainId: ctx.d.chainId });
	const { request } = await ctx.pc.simulateContract({ ...(req as object), account: wc.account } as never);
	const hash = await wc.writeContract(request as never);
	const r = await ctx.pc.waitForTransactionReceipt({ hash });
	if (r.status !== "success") throw new Error("La transacción revirtió");
	return hash;
};

export const getTokenId = (ctx: Ctx) =>
	ctx.pc.readContract({
		address: ctx.d.contracts.encryptedERC,
		abi: EncryptedERCAbi,
		functionName: "tokenIds",
		args: [ctx.d.contracts.usdc],
	});

export const getPublicKey = async (ctx: Ctx, who: Address): Promise<[bigint, bigint]> => {
	const pk = await ctx.pc.readContract({
		address: ctx.d.contracts.registrar,
		abi: RegistrarAbi,
		functionName: "getUserPublicKey",
		args: [who],
	});
	return [pk[0], pk[1]];
};

export const isRegistered = (ctx: Ctx, who: Address) =>
	ctx.pc.readContract({ address: ctx.d.contracts.registrar, abi: RegistrarAbi, functionName: "isUserRegistered", args: [who] });

export const getAuditorPublicKey = async (ctx: Ctx): Promise<[bigint, bigint]> => {
	const pk = await ctx.pc.readContract({
		address: ctx.d.contracts.encryptedERC,
		abi: EncryptedERCAbi,
		functionName: "auditorPublicKey",
	});
	return [pk[0], pk[1]];
};

export const readEncryptedBalance = async (ctx: Ctx, owner: Address) => {
	const tokenId = await getTokenId(ctx);
	const [eGCT, nonce, amountPCTs, balancePCT, transactionIndex] = await ctx.pc.readContract({
		address: ctx.d.contracts.encryptedERC,
		abi: EncryptedERCAbi,
		functionName: "balanceOf",
		args: [owner, tokenId],
	});
	return { tokenId, eGCT, nonce, amountPCTs, balancePCT, transactionIndex };
};

export const readDecryptedBalance = async (ctx: Ctx, owner: Address, kp: KeyPair) => {
	const raw = await readEncryptedBalance(ctx, owner);
	return { ...(await zk.decryptBalance(kp.privateKey, raw.eGCT, raw.amountPCTs, raw.balancePCT)), raw };
};

export type Progress = (msg: string) => void;

export const register = async (ctx: Ctx, kp: KeyPair, onStep: Progress = () => {}) => {
	const me = need(ctx);
	onStep("Generando prueba de registro (Groth16)…");
	const proof = await zk.registration(kp, me, BigInt(ctx.d.chainId));
	onStep("Firmá la transacción de registro");
	return send(ctx, {
		address: ctx.d.contracts.registrar,
		abi: RegistrarAbi,
		functionName: "register",
		args: [proof as never],
	} as never);
};

export const faucet = (ctx: Ctx) =>
	send(ctx, { address: ctx.d.contracts.usdc, abi: MockUSDCAbi, functionName: "faucet" } as never);

export const deposit = async (ctx: Ctx, kp: KeyPair, amount: bigint, onStep: Progress = () => {}) => {
	const me = need(ctx);
	const allowance = await ctx.pc.readContract({
		address: ctx.d.contracts.usdc,
		abi: MockUSDCAbi,
		functionName: "allowance",
		args: [me, ctx.d.contracts.encryptedERC],
	});
	if (allowance < amount) {
		onStep("Aprobá el uso de USDC");
		await send(ctx, {
			address: ctx.d.contracts.usdc,
			abi: MockUSDCAbi,
			functionName: "approve",
			args: [ctx.d.contracts.encryptedERC, amount],
		} as never);
	}
	const amountPCT = await zk.encrypt([amount], kp.publicKey);
	onStep("Firmá el depósito a eERC");
	return send(ctx, {
		address: ctx.d.contracts.encryptedERC,
		abi: EncryptedERCAbi,
		functionName: "deposit",
		args: [amount, ctx.d.contracts.usdc, amountPCT],
	} as never);
};

/** Transferencia confidencial directa (msg.sender = dueño de la clave). */
export const privateTransfer = async (
	ctx: Ctx,
	kp: KeyPair,
	to: Address,
	amount: bigint,
	onStep: Progress = () => {},
) => {
	const me = need(ctx);
	const bal = await readDecryptedBalance(ctx, me, kp);
	onStep("Generando prueba de transferencia confidencial (Groth16)…");
	const { proof, balancePCT } = await zk.transfer(
		{
			sender: kp,
			senderBalance: bal.balance,
			senderEncryptedBalance: bal.encrypted,
			receiverPublicKey: await getPublicKey(ctx, to),
			auditorPublicKey: await getAuditorPublicKey(ctx),
			amount,
		},
	);
	onStep("Firmá la transferencia confidencial");
	return send(ctx, {
		address: ctx.d.contracts.encryptedERC,
		abi: EncryptedERCAbi,
		functionName: "transfer",
		args: [to, bal.raw.tokenId, proof, balancePCT],
	} as never);
};

export const withdraw = async (ctx: Ctx, kp: KeyPair, amount: bigint, onStep: Progress = () => {}) => {
	const me = need(ctx);
	const bal = await readDecryptedBalance(ctx, me, kp);
	onStep("Generando prueba de retiro (Groth16)…");
	const { proof, balancePCT } = await zk.withdraw(
		{
			user: kp,
			balance: bal.balance,
			encryptedBalance: bal.encrypted,
			auditorPublicKey: await getAuditorPublicKey(ctx),
			amount,
		},
	);
	onStep("Firmá el retiro");
	return send(ctx, {
		address: ctx.d.contracts.encryptedERC,
		abi: EncryptedERCAbi,
		functionName: "withdraw",
		args: [bal.raw.tokenId, proof, balancePCT],
	} as never);
};

// ── SettlementManager ─────────────────────────────────────────────────────────

const sm = (ctx: Ctx) => ({ address: ctx.d.contracts.settlementManager, abi: SettlementManagerAbi }) as const;

export const vaultKeyFor = (masterKp: KeyPair, vault: Address) => zk.vaultKey(masterKp, vault);

export const crearObligacion = async (
	ctx: Ctx,
	kp: KeyPair,
	proveedor: Address,
	refFactura: `0x${string}`,
	onStep: Progress = () => {},
) => {
	const me = need(ctx);
	const vault = await ctx.pc.readContract({ ...sm(ctx), functionName: "predecirVault", args: [me] });
	const vaultKp = await vaultKeyFor(kp, vault);
	onStep("Generando prueba de registro del vault de escrow…");
	const vaultProof = await zk.registration(vaultKp, vault, BigInt(ctx.d.chainId));
	const claveCifrada = await zk.encrypt([vaultKp.privateKey], await getPublicKey(ctx, proveedor));
	onStep("Firmá la creación de la obligación");
	const hash = await send(ctx, {
		...sm(ctx),
		functionName: "crear",
		args: [proveedor, refFactura, vaultProof, claveCifrada],
	} as never);
	const id = await ctx.pc.readContract({ ...sm(ctx), functionName: "obligacionDeVault", args: [vault] });
	return { hash, id, vault };
};

export const fondear = async (ctx: Ctx, kp: KeyPair, id: bigint, vault: Address, amount: bigint, onStep: Progress = () => {}) => {
	const bal = await readEncryptedBalance(ctx, vault);
	if (bal.amountPCTs.length === 0) {
		await privateTransfer(ctx, kp, vault, amount, onStep);
	}
	onStep("Firmá el fondeo de la obligación");
	return send(ctx, { ...sm(ctx), functionName: "fondear", args: [id] } as never);
};

export const confirmarEntrega = (ctx: Ctx, id: bigint) =>
	send(ctx, { ...sm(ctx), functionName: "confirmarEntrega", args: [id] } as never);

export const cancelar = (ctx: Ctx, id: bigint) => send(ctx, { ...sm(ctx), functionName: "cancelar", args: [id] } as never);

const vaultTransferProof = async (ctx: Ctx, vaultKp: KeyPair, vault: Address, to: Address, onStep: Progress) => {
	const bal = await readDecryptedBalance(ctx, vault, vaultKp);
	if (bal.balance === 0n) throw new Error("El vault no tiene saldo");
	onStep("Generando prueba de transferencia desde el vault (Groth16)…");
	return zk.transfer(
		{
			sender: vaultKp,
			senderBalance: bal.balance,
			senderEncryptedBalance: bal.encrypted,
			receiverPublicKey: await getPublicKey(ctx, to),
			auditorPublicKey: await getAuditorPublicKey(ctx),
			amount: bal.balance,
		},
	);
};

export const liberar = async (ctx: Ctx, kp: KeyPair, id: bigint, vault: Address, proveedor: Address, onStep: Progress = () => {}) => {
	const { proof, balancePCT } = await vaultTransferProof(ctx, await vaultKeyFor(kp, vault), vault, proveedor, onStep);
	onStep("Firmá la liberación");
	return send(ctx, { ...sm(ctx), functionName: "liberar", args: [id, proof, balancePCT] } as never);
};

export const reembolsar = async (ctx: Ctx, kp: KeyPair, id: bigint, vault: Address, pagador: Address, onStep: Progress = () => {}) => {
	const { proof, balancePCT } = await vaultTransferProof(ctx, await vaultKeyFor(kp, vault), vault, pagador, onStep);
	onStep("Firmá el reembolso");
	return send(ctx, { ...sm(ctx), functionName: "reembolsar", args: [id, proof, balancePCT] } as never);
};

/** El proveedor descifra la clave del vault (que el pagador cifró para él) y lee el saldo en escrow. */
export const verificarFondeo = async (ctx: Ctx, providerKp: KeyPair, id: bigint, vault: Address) => {
	const enc = await ctx.pc.readContract({ ...sm(ctx), functionName: "claveVaultCifrada", args: [id] });
	const [vaultPriv] = await zk.decryptPCTs(providerKp.privateKey, [[...enc]]);
	if (vaultPriv === null) throw new Error("La clave del vault no está cifrada para esta cuenta");
	const vaultKp = await zk.keyFromPrivate(vaultPriv);
	return readDecryptedBalance(ctx, vault, vaultKp);
};

export const setEntidad = (ctx: Ctx, entidad: Address, habilitar: boolean) =>
	send(ctx, { ...sm(ctx), functionName: "setEntidad", args: [entidad, habilitar] } as never);
