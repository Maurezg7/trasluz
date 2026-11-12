import type { Address, Hash, PublicClient } from "viem";
import { EncryptedERCAbi, SettlementManagerAbi } from "../abi";
import type { Deployment } from "../config";

export const ESTADOS = ["Inexistente", "Creada", "Fondeada", "Liberada", "Cancelada"] as const;
export type EstadoNombre = (typeof ESTADOS)[number];

export type Obligacion = {
	id: bigint;
	pagador: Address;
	proveedor: Address;
	vault: Address;
	refFactura: `0x${string}`;
	estado: EstadoNombre;
	entregaConfirmada: boolean;
	creadaEn: number;
	actualizadaEn: number;
};

export const fetchObligaciones = async (pc: PublicClient, d: Deployment): Promise<Obligacion[]> => {
	const base = { address: d.contracts.settlementManager, abi: SettlementManagerAbi } as const;
	const total = await pc.readContract({ ...base, functionName: "totalObligaciones" });
	const ids = Array.from({ length: Number(total) }, (_, i) => BigInt(i + 1));
	const rows = await Promise.all(ids.map((id) => pc.readContract({ ...base, functionName: "obligacion", args: [id] })));
	return rows
		.map((o, i) => ({
			id: ids[i],
			pagador: o.pagador,
			proveedor: o.proveedor,
			vault: o.vault,
			refFactura: o.refFactura,
			estado: ESTADOS[o.estado],
			entregaConfirmada: o.entregaConfirmada,
			creadaEn: Number(o.creadaEn),
			actualizadaEn: Number(o.actualizadaEn),
		}))
		.reverse();
};

type LogRange = { fromBlock: bigint; toBlock: bigint };

/**
 * getLogs incremental con cache en memoria: la primera vez escanea desde el bloque de deploy
 * en tramos de 2048 (límite del RPC público de Fuji); después sólo pide los bloques nuevos.
 * Si la cadena retrocede (nodo local reiniciado / reorg), se descarta la cache.
 */
const logCache = new Map<string, { to: bigint; logs: unknown[] }>();
const chunked = async <T>(pc: PublicClient, key: string, from: bigint, fetch: (r: LogRange) => Promise<T[]>) => {
	const latest = await pc.getBlockNumber();
	const k = `${pc.chain?.id}:${key}`;
	let entry = logCache.get(k) as { to: bigint; logs: T[] } | undefined;
	if (entry && entry.to > latest) entry = undefined;
	const start = entry ? entry.to + 1n : from;
	const logs: T[] = entry ? [...entry.logs] : [];
	const step = 2048n;
	const ranges: LogRange[] = [];
	for (let b = start; b <= latest; b += step) ranges.push({ fromBlock: b, toBlock: b + step - 1n > latest ? latest : b + step - 1n });
	for (let i = 0; i < ranges.length; i += 6) {
		const batch = await Promise.all(ranges.slice(i, i + 6).map(fetch));
		for (const x of batch) logs.push(...x);
	}
	logCache.set(k, { to: latest, logs });
	return logs;
};

const ev = (name: string) => EncryptedERCAbi.find((x) => x.type === "event" && x.name === name) as never;
const smEv = (name: string) => SettlementManagerAbi.find((x) => x.type === "event" && x.name === name) as never;

export type PrivateTransferLog = {
	kind: "PrivateTransfer";
	from: Address;
	to: Address;
	auditorPCT: readonly bigint[];
	txHash: Hash;
	blockNumber: bigint;
	logIndex: number;
};
export type WithdrawLog = {
	kind: "Withdraw";
	user: Address;
	amount: bigint;
	auditorPCT: readonly bigint[];
	txHash: Hash;
	blockNumber: bigint;
	logIndex: number;
};
export type DepositLog = { kind: "Deposit"; user: Address; amount: bigint; txHash: Hash; blockNumber: bigint; logIndex: number };
export type EERCLog = PrivateTransferLog | WithdrawLog | DepositLog;

export const fetchEERCLogs = async (pc: PublicClient, d: Deployment): Promise<EERCLog[]> => {
	const from = BigInt(d.deployBlock);
	const address = d.contracts.encryptedERC;
	const [pt, wd, dp] = await Promise.all([
		chunked(pc, `${address}:PrivateTransfer`, from, (r) => pc.getLogs({ address, event: ev("PrivateTransfer"), ...r })),
		chunked(pc, `${address}:Withdraw`, from, (r) => pc.getLogs({ address, event: ev("Withdraw"), ...r })),
		chunked(pc, `${address}:Deposit`, from, (r) => pc.getLogs({ address, event: ev("Deposit"), ...r })),
	]);
	// biome-ignore lint/suspicious/noExplicitAny: args tipados por ABI dinámico
	const meta = (l: any) => ({ txHash: l.transactionHash as Hash, blockNumber: l.blockNumber as bigint, logIndex: l.logIndex as number });
	const logs: EERCLog[] = [
		// biome-ignore lint/suspicious/noExplicitAny: idem
		...pt.map((l: any) => ({ kind: "PrivateTransfer" as const, from: l.args.from, to: l.args.to, auditorPCT: l.args.auditorPCT, ...meta(l) })),
		// biome-ignore lint/suspicious/noExplicitAny: idem
		...wd.map((l: any) => ({ kind: "Withdraw" as const, user: l.args.user, amount: l.args.amount, auditorPCT: l.args.auditorPCT, ...meta(l) })),
		// biome-ignore lint/suspicious/noExplicitAny: idem
		...dp.map((l: any) => ({ kind: "Deposit" as const, user: l.args.user, amount: l.args.amount, ...meta(l) })),
	];
	return logs.sort((a, b) => Number(b.blockNumber - a.blockNumber) || b.logIndex - a.logIndex);
};

export const fetchEntidades = async (pc: PublicClient, d: Deployment) => {
	const logs = await chunked(pc, `${d.contracts.settlementManager}:EntidadActualizada`, BigInt(d.deployBlock), (r) =>
		pc.getLogs({ address: d.contracts.settlementManager, event: smEv("EntidadActualizada"), ...r }),
	);
	const map = new Map<Address, boolean>();
	// biome-ignore lint/suspicious/noExplicitAny: idem
	for (const l of logs as any[]) map.set(l.args.entidad, l.args.habilitada);
	return [...map.entries()].filter(([, on]) => on).map(([a]) => a);
};

const blockTimes = new Map<string, number>();
export const blockTime = async (pc: PublicClient, n: bigint) => {
	const k = `${pc.chain?.id}:${n}`;
	const cached = blockTimes.get(k);
	if (cached) return cached;
	const b = await pc.getBlock({ blockNumber: n });
	blockTimes.set(k, Number(b.timestamp));
	return Number(b.timestamp);
};
