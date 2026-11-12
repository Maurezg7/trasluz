import type { AmountPCTLike, EGCTLike, FlatEGCT, KeyPair, Proof, TransferArgs, WithdrawArgs } from "@trasluz/zk";
import type { CircuitName } from "../config/zk";
import type { ZkRequest } from "../workers/prover.worker";

/**
 * Cliente del worker criptográfico. El hilo de UI sólo importa TIPOS de @trasluz/zk:
 * ninguna constante Poseidon, curva ni snarkjs entra al bundle principal.
 */
type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

const getWorker = () => {
	if (!worker) {
		worker = new Worker(new URL("../workers/prover.worker.ts", import.meta.url), { type: "module", name: "trasluz-zk" });
		worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
			const p = pending.get(e.data.id);
			if (!p) return;
			pending.delete(e.data.id);
			e.data.ok ? p.resolve(e.data.result) : p.reject(new Error(e.data.error));
		};
		worker.onerror = (e) => {
			for (const p of pending.values()) p.reject(new Error(e.message || "Fallo del worker criptográfico"));
			pending.clear();
			worker?.terminate();
			worker = null;
		};
	}
	return worker;
};

const call = <T>(req: ZkRequest) =>
	new Promise<T>((resolve, reject) => {
		const id = ++seq;
		pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
		getWorker().postMessage({ id, req });
	});

type WithBalance = { proof: Proof; balancePCT: bigint[] };
export type DecryptedBalance = { balance: bigint; encrypted: FlatEGCT; consistent: boolean };

export const zk = {
	registration: (kp: KeyPair, address: string, chainId: bigint) => call<Proof>({ op: "registration", kp, address, chainId }),
	transfer: (args: TransferArgs) => call<WithBalance>({ op: "transfer", args }),
	withdraw: (args: WithdrawArgs) => call<WithBalance>({ op: "withdraw", args }),
	keyFromSeed: (seed: bigint) => call<KeyPair>({ op: "keyFromSeed", seed }),
	keyFromPrivate: (privateKey: bigint) => call<KeyPair>({ op: "keyFromPrivate", privateKey }),
	vaultKey: (master: KeyPair, vault: string) => call<KeyPair>({ op: "vaultKey", masterPrivateKey: master.privateKey, vault }),
	/** PCT Poseidon de 7 elementos `[ciphertext(4), authKey(2), nonce]`. */
	encrypt: (inputs: bigint[], publicKey: readonly bigint[]) => call<bigint[]>({ op: "encrypt", inputs, publicKey }),
	decryptBalance: (privateKey: bigint, eGCT: EGCTLike, amountPCTs: readonly AmountPCTLike[], balancePCT: readonly bigint[]) =>
		call<DecryptedBalance>({ op: "decryptBalance", privateKey, eGCT, amountPCTs, balancePCT }),
	/** Descifra en lote; `null` si el PCT no corresponde a la clave. */
	decryptPCTs: (privateKey: bigint, pcts: (readonly bigint[])[]) => call<(bigint | null)[]>({ op: "decryptPCTs", privateKey, pcts }),
	/** Verifica los 6 artefactos de circuito contra su SHA-256 fijado. */
	integrity: () => call<{ url: string; sha256: string; ok: boolean }[]>({ op: "integrity" }),
	/** Descarga y verifica circuitos en segundo plano (la primera prueba deja de esperar 15 MB). */
	warm: (circuits: CircuitName[]) => {
		const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
		idle(() => void call({ op: "warm", circuits }).catch(() => {}));
	},
};
