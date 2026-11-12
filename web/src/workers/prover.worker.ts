/// <reference lib="webworker" />
/**
 * Toda la criptografía de Trasluz corre en este Web Worker:
 *  - el hilo de UI no carga ~1.6 MB de constantes Poseidon/BabyJubJub ni snarkjs;
 *  - la UI no se congela mientras se calculan witness y pruebas Groth16;
 *  - cada wasm/zkey se verifica contra su SHA-256 fijado en build ANTES de usarse
 *    (si el hosting/CDN sirve un circuito alterado, la operación se aborta).
 */
import {
	type AmountPCTLike,
	type EGCTLike,
	type KeyPair,
	type TransferArgs,
	type WithdrawArgs,
	decryptBalance,
	decryptPCT,
	deriveVaultKeyPair,
	keyPairFromPrivateKey,
	keyPairFromSeed,
	processPoseidonEncryption,
	proveRegistration,
	proveTransfer,
	proveWithdraw,
} from "@trasluz/zk";
import { type CircuitName, ZK_CIRCUITS } from "../config/zk";
import manifest from "../config/zk-manifest.json";

const pinned = manifest as Record<string, string>;
const cache = new Map<string, Promise<Uint8Array>>();

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

const fetchVerified = (url: string) => {
	let p = cache.get(url);
	if (!p) {
		p = (async () => {
			const expected = pinned[url];
			if (!expected) throw new Error(`Circuito sin hash fijado: ${url}`);
			const res = await fetch(url, { cache: "force-cache", credentials: "omit" });
			if (!res.ok) throw new Error(`No se pudo descargar ${url}`);
			const buf = await res.arrayBuffer();
			const got = hex(await crypto.subtle.digest("SHA-256", buf));
			if (got !== expected) throw new Error(`Integridad comprometida en ${url}: el circuito no coincide con el oficial`);
			return new Uint8Array(buf);
		})();
		cache.set(url, p);
		p.catch(() => cache.delete(url));
	}
	return p;
};

const circuit = async (name: CircuitName) => {
	const c = ZK_CIRCUITS[name];
	const [wasm, zkey] = await Promise.all([fetchVerified(c.wasm), fetchVerified(c.zkey)]);
	return { wasm, zkey };
};

const pctOf = (inputs: bigint[], pub: readonly bigint[]) => {
	const e = processPoseidonEncryption(inputs, [...pub]);
	return [...e.ciphertext, ...e.authKey, e.nonce] as bigint[];
};

export type ZkRequest =
	| { op: "warm"; circuits: CircuitName[] }
	| { op: "integrity" }
	| { op: "registration"; kp: KeyPair; address: string; chainId: bigint }
	| { op: "transfer"; args: TransferArgs }
	| { op: "withdraw"; args: WithdrawArgs }
	| { op: "keyFromSeed"; seed: bigint }
	| { op: "keyFromPrivate"; privateKey: bigint }
	| { op: "vaultKey"; masterPrivateKey: bigint; vault: string }
	| { op: "encrypt"; inputs: bigint[]; publicKey: readonly bigint[] }
	| { op: "decryptBalance"; privateKey: bigint; eGCT: EGCTLike; amountPCTs: readonly AmountPCTLike[]; balancePCT: readonly bigint[] }
	| { op: "decryptPCTs"; privateKey: bigint; pcts: (readonly bigint[])[] };

const run = async (r: ZkRequest) => {
	switch (r.op) {
		case "warm":
			await Promise.all(r.circuits.map(circuit));
			return null;
		case "integrity":
			return Promise.all(
				Object.entries(pinned).map(async ([url, sha256]) => ({
					url,
					sha256,
					ok: await fetchVerified(url).then(
						() => true,
						() => false,
					),
				})),
			);
		case "registration":
			return proveRegistration(r.kp, r.address, r.chainId, await circuit("registration"));
		case "transfer":
			return proveTransfer(r.args, await circuit("transfer"));
		case "withdraw":
			return proveWithdraw(r.args, await circuit("withdraw"));
		case "keyFromSeed":
			return keyPairFromSeed(r.seed);
		case "keyFromPrivate":
			return keyPairFromPrivateKey(r.privateKey);
		case "vaultKey":
			return deriveVaultKeyPair(r.masterPrivateKey, r.vault);
		case "encrypt":
			return pctOf(r.inputs, r.publicKey);
		case "decryptBalance":
			return decryptBalance(r.privateKey, r.eGCT, r.amountPCTs, r.balancePCT);
		case "decryptPCTs":
			return r.pcts.map((p) => {
				try {
					return decryptPCT(r.privateKey, p);
				} catch {
					return null;
				}
			});
	}
};

self.onmessage = async (e: MessageEvent<{ id: number; req: ZkRequest }>) => {
	const { id, req } = e.data;
	try {
		self.postMessage({ id, ok: true, result: await run(req) });
	} catch (err) {
		self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
	}
};
