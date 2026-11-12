/**
 * Primitivas criptográficas de eERC.
 *
 * Port 1:1 de `src/jub/jub.ts` y `src/poseidon/poseidon.ts` del repo oficial
 * ava-labs/EncryptedERC. La única diferencia es la fuente de aleatoriedad:
 * `crypto.getRandomValues` (Web Crypto, disponible en browsers y Node >= 20)
 * en lugar de `node:crypto.randomBytes`, para poder correr en el frontend.
 * No se modifica ningún algoritmo.
 */
import {
	Base8,
	Fr,
	type Point,
	addPoint,
	mulPointEscalar,
	subOrder,
} from "@zk-kit/baby-jubjub";
import { deriveSecretScalar } from "@zk-kit/eddsa-poseidon";
import { poseidonDecrypt, poseidonEncrypt } from "@zk-kit/poseidon-cipher";

export const BASE_POINT_ORDER =
	2736030358979909402780800718157159386076813972158567259200215660948447373041n;
export const SNARK_FIELD_SIZE =
	21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export { Base8, subOrder, mulPointEscalar, addPoint };

const randomBytes = (n: number): Uint8Array => {
	const out = new Uint8Array(n);
	globalThis.crypto.getRandomValues(out);
	return out;
};

const bytesToBigInt = (b: Uint8Array): bigint =>
	BigInt(`0x${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`);

/** Igual a maci-crypto `formatPrivKeyForBabyJub`. */
export const formatPrivKeyForBabyJub = (privKey: bigint): bigint =>
	BigInt(deriveSecretScalar(privKey.toString()));

/** Igual a maci-crypto `genRandomBabyJubValue` (rejection sampling sin sesgo de módulo). */
export const genRandomBabyJubValue = (): bigint => {
	const min =
		6350874878119819312338956282401532410528162663560392320966563075034087161851n;
	let v = SNARK_FIELD_SIZE;
	do {
		const rand = bytesToBigInt(randomBytes(32));
		if (rand >= min) v = rand % SNARK_FIELD_SIZE;
	} while (v >= SNARK_FIELD_SIZE);
	return v;
};

/** Igual a maci-crypto `genPrivKey`. */
export const genPrivKey = (): bigint => bytesToBigInt(randomBytes(32));

export const randomNonce = (): bigint => bytesToBigInt(randomBytes(16)) + 1n;

export const encryptPoint = (
	publicKey: bigint[],
	point: bigint[],
	random = genRandomBabyJubValue(),
): [Point<bigint>, Point<bigint>] => {
	const c1 = mulPointEscalar(Base8, random);
	const pky = mulPointEscalar(publicKey as Point<bigint>, random);
	const c2 = addPoint(point as Point<bigint>, pky);
	return [c1, c2];
};

export const encryptMessage = (
	publicKey: bigint[],
	message: bigint,
	random = genRandomBabyJubValue(),
): { cipher: [bigint[], bigint[]]; random: bigint } => {
	let encRandom = random;
	if (encRandom >= BASE_POINT_ORDER) {
		encRandom = genRandomBabyJubValue() / 100n;
	}
	const p = mulPointEscalar(Base8, message);
	return { cipher: encryptPoint(publicKey, p, encRandom), random: encRandom };
};

export const decryptPoint = (
	privateKey: bigint,
	c1: bigint[],
	c2: bigint[],
): bigint[] => {
	const privKey = formatPrivKeyForBabyJub(privateKey);
	const c1x = mulPointEscalar(c1 as Point<bigint>, privKey);
	const c1xInverse = [Fr.e(c1x[0] * -1n), c1x[1]];
	return addPoint(c2 as Point<bigint>, c1xInverse as Point<bigint>);
};

export const processPoseidonEncryption = (
	inputs: bigint[],
	publicKey: bigint[],
) => {
	const nonce = randomNonce();
	let encRandom = genRandomBabyJubValue();
	if (encRandom >= BASE_POINT_ORDER) {
		encRandom = genRandomBabyJubValue() / 10n;
	}
	const poseidonEncryptionKey = mulPointEscalar(
		publicKey as Point<bigint>,
		encRandom,
	);
	const authKey = mulPointEscalar(Base8, encRandom);
	const ciphertext = poseidonEncrypt(inputs, poseidonEncryptionKey, nonce);
	return { ciphertext, nonce, encRandom, poseidonEncryptionKey, authKey };
};

export const processPoseidonDecryption = (
	ciphertext: bigint[],
	authKey: bigint[],
	nonce: bigint,
	privateKey: bigint,
	length: number,
) => {
	const sharedKey = mulPointEscalar(
		authKey as Point<bigint>,
		formatPrivKeyForBabyJub(privateKey),
	);
	const decrypted = poseidonDecrypt(ciphertext, sharedKey, nonce, length);
	return decrypted.slice(0, length);
};

/** Descifra un PCT de 7 elementos `[ciphertext(4), authKey(2), nonce]`. */
export const decryptPCT = (privateKey: bigint, pct: readonly bigint[]): bigint => {
	const [v] = processPoseidonDecryption(
		pct.slice(0, 4),
		pct.slice(4, 6),
		pct[6],
		privateKey,
		1,
	);
	return BigInt(v);
};

export const isEmptyPCT = (pct: readonly bigint[]) => pct.every((x) => x === 0n);
