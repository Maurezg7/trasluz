/**
 * Generación de pruebas Groth16 con los circuitos OFICIALES de ava-labs/EncryptedERC
 * (circom/build/*, ceremonia de producción). Los inputs replican exactamente los
 * helpers de test oficiales (test/helpers.ts).
 */
// @ts-ignore — snarkjs no publica tipos
import * as snarkjs from "snarkjs";
import { encryptMessage, processPoseidonEncryption } from "./crypto";
import { type KeyPair, registrationHash } from "./keys";

export type CircuitSource = { wasm: string | Uint8Array; zkey: string | Uint8Array };
export type Circuits = {
	registration: CircuitSource;
	transfer: CircuitSource;
	withdraw: CircuitSource;
};

export type ProofPoints = {
	a: [bigint, bigint];
	b: [[bigint, bigint], [bigint, bigint]];
	c: [bigint, bigint];
};
export type Proof = { proofPoints: ProofPoints; publicSignals: bigint[] };

/** Ciphertext ElGamal plano `[c1.x, c1.y, c2.x, c2.y]` tal como lo devuelve `balanceOf`. */
export type FlatEGCT = [bigint, bigint, bigint, bigint];

const prove = async (input: Record<string, unknown>, c: CircuitSource): Promise<Proof> => {
	const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, c.wasm, c.zkey);
	const calldata: string = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
	const [a, b, cc, pub] = JSON.parse(`[${calldata}]`) as [
		string[],
		string[][],
		string[],
		string[],
	];
	const big = (x: string) => BigInt(x);
	return {
		proofPoints: {
			a: [big(a[0]), big(a[1])],
			b: [
				[big(b[0][0]), big(b[0][1])],
				[big(b[1][0]), big(b[1][1])],
			],
			c: [big(cc[0]), big(cc[1])],
		},
		publicSignals: pub.map(big),
	};
};

/** Prueba de registro: liga la clave BabyJubJub a `address` (EOA o contrato vault). */
export const proveRegistration = (
	kp: KeyPair,
	address: string,
	chainId: bigint,
	circuit: CircuitSource,
) =>
	prove(
		{
			SenderPrivateKey: kp.formattedPrivateKey,
			SenderPublicKey: kp.publicKey,
			SenderAddress: BigInt(address),
			ChainID: chainId,
			RegistrationHash: registrationHash(kp, address, chainId),
		},
		circuit,
	);

export type TransferArgs = {
	sender: KeyPair;
	senderBalance: bigint;
	senderEncryptedBalance: FlatEGCT;
	receiverPublicKey: readonly bigint[];
	auditorPublicKey: readonly bigint[];
	amount: bigint;
};

/** Prueba de transferencia confidencial (monto oculto; PCTs para receptor y auditor). */
export const proveTransfer = async (
	{
		sender,
		senderBalance,
		senderEncryptedBalance,
		receiverPublicKey,
		auditorPublicKey,
		amount,
	}: TransferArgs,
	circuit: CircuitSource,
) => {
	if (amount <= 0n) throw new Error("Monto inválido");
	if (amount > senderBalance) throw new Error("Saldo cifrado insuficiente");
	const receiverPK = [...receiverPublicKey];
	const auditorPK = [...auditorPublicKey];
	const newBalance = senderBalance - amount;

	const { cipher: encSender } = encryptMessage(sender.publicKey, amount);
	const { cipher: encReceiver, random: encReceiverRandom } = encryptMessage(receiverPK, amount);
	const r = processPoseidonEncryption([amount], receiverPK);
	const au = processPoseidonEncryption([amount], auditorPK);
	const s = processPoseidonEncryption([newBalance], sender.publicKey);

	const proof = await prove(
		{
			ValueToTransfer: amount,
			SenderPrivateKey: sender.formattedPrivateKey,
			SenderPublicKey: sender.publicKey,
			SenderBalance: senderBalance,
			SenderBalanceC1: senderEncryptedBalance.slice(0, 2),
			SenderBalanceC2: senderEncryptedBalance.slice(2, 4),
			SenderVTTC1: encSender[0],
			SenderVTTC2: encSender[1],
			ReceiverPublicKey: receiverPK,
			ReceiverVTTC1: encReceiver[0],
			ReceiverVTTC2: encReceiver[1],
			ReceiverVTTRandom: encReceiverRandom,
			ReceiverPCT: r.ciphertext,
			ReceiverPCTAuthKey: r.authKey,
			ReceiverPCTNonce: r.nonce,
			ReceiverPCTRandom: r.encRandom,
			AuditorPublicKey: auditorPK,
			AuditorPCT: au.ciphertext,
			AuditorPCTAuthKey: au.authKey,
			AuditorPCTNonce: au.nonce,
			AuditorPCTRandom: au.encRandom,
		},
		circuit,
	);
	const balancePCT = [...s.ciphertext, ...s.authKey, s.nonce] as bigint[];
	return { proof, balancePCT };
};

export type WithdrawArgs = {
	user: KeyPair;
	balance: bigint;
	encryptedBalance: FlatEGCT;
	auditorPublicKey: readonly bigint[];
	amount: bigint;
};

/** Prueba de retiro eERC → ERC-20 público (el monto retirado es público por diseño). */
export const proveWithdraw = async (
	{ user, balance, encryptedBalance, auditorPublicKey, amount }: WithdrawArgs,
	circuit: CircuitSource,
) => {
	if (amount <= 0n) throw new Error("Monto inválido");
	if (amount > balance) throw new Error("Saldo cifrado insuficiente");
	const auditorPK = [...auditorPublicKey];
	const u = processPoseidonEncryption([balance - amount], user.publicKey);
	const au = processPoseidonEncryption([amount], auditorPK);
	const proof = await prove(
		{
			ValueToWithdraw: amount,
			SenderPrivateKey: user.formattedPrivateKey,
			SenderPublicKey: user.publicKey,
			SenderBalance: balance,
			SenderBalanceC1: encryptedBalance.slice(0, 2),
			SenderBalanceC2: encryptedBalance.slice(2, 4),
			AuditorPublicKey: auditorPK,
			AuditorPCT: au.ciphertext,
			AuditorPCTAuthKey: au.authKey,
			AuditorPCTNonce: au.nonce,
			AuditorPCTRandom: au.encRandom,
		},
		circuit,
	);
	const balancePCT = [...u.ciphertext, ...u.authKey, u.nonce] as bigint[];
	return { proof, balancePCT };
};

/** Libera los workers de snarkjs (necesario en Node para que el proceso termine). */
export const terminateProver = async () => {
	// biome-ignore lint/suspicious/noExplicitAny: global de ffjavascript
	const g = globalThis as any;
	if (g.curve_bn128?.terminate) await g.curve_bn128.terminate();
};
