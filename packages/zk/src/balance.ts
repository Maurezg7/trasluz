import { Base8, decryptPCT, decryptPoint, isEmptyPCT, mulPointEscalar } from "./crypto";
import type { FlatEGCT } from "./proofs";

type PointLike = { x: bigint; y: bigint } | readonly [bigint, bigint];
export type EGCTLike = { c1: PointLike; c2: PointLike };
export type AmountPCTLike = { pct: readonly bigint[] } | readonly [readonly bigint[], bigint];

const xy = (p: PointLike): [bigint, bigint] =>
	Array.isArray(p)
		? [BigInt(p[0]), BigInt(p[1])]
		: [BigInt((p as { x: bigint }).x), BigInt((p as { y: bigint }).y)];

export const flattenEGCT = (e: EGCTLike): FlatEGCT => {
	const [a, b] = xy(e.c1);
	const [c, d] = xy(e.c2);
	return [a, b, c, d];
};

const pctOf = (p: AmountPCTLike): readonly bigint[] =>
	Array.isArray(p) ? (p as readonly [readonly bigint[], bigint])[0] : (p as { pct: readonly bigint[] }).pct;

/**
 * Saldo descifrado = balancePCT + Σ amountPCTs (mismo algoritmo que el helper oficial
 * `getDecryptedBalance`), verificado contra el ciphertext ElGamal on-chain.
 */
export const decryptBalance = (
	privateKey: bigint,
	eGCT: EGCTLike,
	amountPCTs: readonly AmountPCTLike[],
	balancePCT: readonly bigint[],
) => {
	let total = 0n;
	if (!isEmptyPCT(balancePCT)) total += decryptPCT(privateKey, balancePCT);
	for (const a of amountPCTs) {
		const pct = pctOf(a).map(BigInt);
		if (!isEmptyPCT(pct)) total += decryptPCT(privateKey, pct);
	}
	const flat = flattenEGCT(eGCT);
	const isZeroCipher = flat.every((v) => v === 0n);
	let consistent = true;
	if (!isZeroCipher) {
		const point = decryptPoint(privateKey, flat.slice(0, 2), flat.slice(2, 4));
		const expected = total === 0n ? [0n, 1n] : mulPointEscalar(Base8, total);
		consistent = point[0] === expected[0] && point[1] === expected[1];
	}
	return { balance: total, encrypted: flat, consistent };
};
