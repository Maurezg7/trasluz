import type { Address } from "viem";
import type { EERCLog, Obligacion } from "./chain";
import { sameAddr } from "./format";

export type Movimiento = EERCLog & {
	amount: bigint | null;
	confidencial: boolean;
	obligacionId?: bigint;
	rol?: "fondeo" | "liberacion" | "reembolso";
	error?: boolean;
};

export type Conciliacion = {
	o: Obligacion;
	fondeado: bigint;
	liberado: bigint;
	reembolsado: bigint;
	enEscrow: bigint;
	estado: "Concilia" | "En escrow" | "Pendiente de fondeo" | "Reembolsada" | "Remanente" | "Discrepancia";
};

/** PCTs a descifrar (en el worker), en el mismo orden que `logs`; null para depósitos. */
export const pctsOf = (logs: EERCLog[]) => logs.map((l) => (l.kind === "Deposit" ? null : l.auditorPCT.map(BigInt)));

/** Concilia por obligación a partir de los montos ya descifrados localmente con la viewing key. */
export const auditar = (decrypted: (bigint | null)[], logs: EERCLog[], obligaciones: Obligacion[]) => {
	const byVault = new Map<string, Obligacion>(obligaciones.map((o) => [o.vault.toLowerCase(), o]));
	const movs: Movimiento[] = logs.map((l, i) => {
		if (l.kind === "Deposit") return { ...l, amount: l.amount, confidencial: false };
		const amount = decrypted[i] ?? null;
		const error = amount === null;
		if (l.kind === "Withdraw") return { ...l, amount: amount ?? l.amount, confidencial: false, error };
		const toV = byVault.get(l.to.toLowerCase());
		const fromV = byVault.get(l.from.toLowerCase());
		const rol: Movimiento["rol"] = toV ? "fondeo" : fromV ? (sameAddr(l.to, fromV.proveedor) ? "liberacion" : "reembolso") : undefined;
		return { ...l, amount, confidencial: true, error, obligacionId: (toV ?? fromV)?.id, rol };
	});

	const conc: Conciliacion[] = obligaciones.map((o) => {
		const mine = movs.filter((m) => m.obligacionId === o.id && m.amount !== null);
		const sum = (r: Movimiento["rol"]) => mine.filter((m) => m.rol === r).reduce((a, m) => a + (m.amount ?? 0n), 0n);
		const fondeado = sum("fondeo");
		const liberado = sum("liberacion");
		const reembolsado = sum("reembolso");
		const enEscrow = fondeado - liberado - reembolsado;
		let estado: Conciliacion["estado"];
		if (enEscrow < 0n) estado = "Discrepancia";
		else if (o.estado === "Creada" && fondeado === 0n) estado = "Pendiente de fondeo";
		else if (o.estado === "Liberada") estado = enEscrow === 0n && liberado > 0n ? "Concilia" : enEscrow > 0n ? "Remanente" : "Discrepancia";
		else if (o.estado === "Cancelada") estado = enEscrow === 0n ? "Reembolsada" : "Remanente";
		else estado = "En escrow";
		return { o, fondeado, liberado, reembolsado, enEscrow, estado };
	});

	const confidenciales = movs.filter((m) => m.confidencial);
	return {
		movs,
		conc,
		totales: {
			liquidado: conc.reduce((a, c) => a + c.liberado, 0n),
			enEscrow: conc.reduce((a, c) => a + (c.enEscrow > 0n ? c.enEscrow : 0n), 0n),
			volumenConfidencial: confidenciales.reduce((a, m) => a + (m.amount ?? 0n), 0n),
			depositos: movs.filter((m) => m.kind === "Deposit").reduce((a, m) => a + (m.amount ?? 0n), 0n),
			retiros: movs.filter((m) => m.kind === "Withdraw").reduce((a, m) => a + (m.amount ?? 0n), 0n),
			conciliadas: conc.filter((c) => c.estado === "Concilia" || c.estado === "Reembolsada").length,
			discrepancias: conc.filter((c) => c.estado === "Discrepancia").length,
			noDescifrables: movs.filter((m) => m.error).length,
		},
	};
};

export const toCSV = (conc: Conciliacion[], movs: Movimiento[], fmt: (v: bigint) => string) => {
	const esc = (s: unknown) => `"${String(s).replace(/"/g, '""')}"`;
	const a = [
		["obligacion", "pagador", "proveedor", "vault", "estado", "entrega", "fondeado", "liberado", "reembolsado", "en_escrow", "conciliacion", "ref_factura"],
		...conc.map((c) => [c.o.id, c.o.pagador, c.o.proveedor, c.o.vault, c.o.estado, c.o.entregaConfirmada, fmt(c.fondeado), fmt(c.liberado), fmt(c.reembolsado), fmt(c.enEscrow), c.estado, c.o.refFactura]),
		[],
		["tx", "bloque", "tipo", "desde", "hacia", "monto", "obligacion", "rol"],
		...movs.map((m) => [
			m.txHash,
			m.blockNumber,
			m.kind,
			m.kind === "PrivateTransfer" ? m.from : m.user,
			m.kind === "PrivateTransfer" ? m.to : "",
			m.amount === null ? "NO_DESCIFRABLE" : fmt(m.amount),
			m.obligacionId ?? "",
			m.rol ?? "",
		]),
	];
	return a.map((r) => r.map(esc).join(",")).join("\n");
};

export const labelFor = (a: Address, obligaciones: Obligacion[]) => {
	const o = obligaciones.find((x) => sameAddr(x.vault, a));
	return o ? `Vault #${o.id}` : undefined;
};
