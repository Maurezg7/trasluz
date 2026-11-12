import { poseidon3 } from "poseidon-lite/poseidon3";
import {
	Base8,
	SNARK_FIELD_SIZE,
	formatPrivKeyForBabyJub,
	genPrivKey,
	mulPointEscalar,
	subOrder,
} from "./crypto";

export { keyDerivationMessage, parseViewingKey, privateKeyToHex } from "./pure";

export type KeyPair = {
	/** Clave privada "cruda" (la viewing key). Es lo que nunca debe salir del cliente. */
	privateKey: bigint;
	/** Escalar BabyJubJub listo para los circuitos (`formatPrivKeyForBabyJub % subOrder`). */
	formattedPrivateKey: bigint;
	publicKey: [bigint, bigint];
};

const VAULT_DOMAIN = BigInt(
	`0x${Array.from(new TextEncoder().encode("trasluz.vault.v1"), (b) =>
		b.toString(16).padStart(2, "0"),
	).join("")}`,
);

export const keyPairFromPrivateKey = (privateKey: bigint): KeyPair => {
	const formattedPrivateKey = formatPrivKeyForBabyJub(privateKey) % subOrder;
	const pub = mulPointEscalar(Base8, formattedPrivateKey);
	return {
		privateKey,
		formattedPrivateKey,
		publicKey: [BigInt(pub[0]), BigInt(pub[1])],
	};
};

export const randomKeyPair = () => keyPairFromPrivateKey(genPrivKey());

/** `seed` = keccak256(firma) — el caller hashea la firma con su lib de preferencia. */
export const keyPairFromSeed = (seed: bigint) =>
	keyPairFromPrivateKey(seed % SNARK_FIELD_SIZE);

/**
 * Clave de prueba del vault de escrow de una obligación.
 * Determinística a partir de la clave maestra del pagador → no hay que guardarla.
 * Nota: esta clave NO es autoridad de gasto: el vault solo mueve fondos a través de
 * SettlementManager, que fija destinatario y estado.
 */
export const deriveVaultKeyPair = (masterPrivateKey: bigint, vault: string) =>
	keyPairFromPrivateKey(
		poseidon3([VAULT_DOMAIN, masterPrivateKey % SNARK_FIELD_SIZE, BigInt(vault)]),
	);

export const registrationHash = (
	kp: KeyPair,
	address: string,
	chainId: bigint,
): bigint => poseidon3([chainId, kp.formattedPrivateKey, BigInt(address)]);
