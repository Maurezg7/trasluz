import { type Address, formatUnits, parseUnits } from "viem";
import { USDC_DECIMALS } from "../config";

export const fmtUSDC = (v: bigint, opts: { symbol?: boolean } = {}) => {
	const n = Number(formatUnits(v, USDC_DECIMALS));
	const s = n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	return opts.symbol === false ? s : `${s} USDC`;
};

export const parseUSDC = (s: string) => {
	// Acepta "1234.56", "1234,56" y "1.234,56"
	const t = s.replace(/\s/g, "");
	const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
	if (!/^\d+(\.\d{0,6})?$/.test(normalized)) throw new Error("Monto inválido");
	const v = parseUnits(normalized, USDC_DECIMALS);
	if (v <= 0n) throw new Error("El monto debe ser mayor a 0");
	return v;
};

export const short = (a?: string, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : "—");

export const sameAddr = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export const fmtDate = (ts: number) =>
	new Date(ts * 1000).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const hexOf = (v: bigint, len = 64) => `0x${v.toString(16).padStart(len, "0")}`;

export const explorerTx = (explorer: string | null, hash: string) => (explorer ? `${explorer}/tx/${hash}` : null);
export const explorerAddr = (explorer: string | null, a: Address) => (explorer ? `${explorer}/address/${a}` : null);

export const errMsg = (e: unknown): string => {
	// biome-ignore lint/suspicious/noExplicitAny: errores de viem
	const x = e as any;
	const name = x?.cause?.data?.errorName || x?.data?.errorName;
	const known: Record<string, string> = {
		NoHabilitada: "La entidad no está habilitada (KYC)",
		NoRegistradaEnEERC: "La contraparte no registró su clave eERC",
		NoAutorizado: "No tenés permiso para esta acción",
		EstadoInvalido: "La obligación no está en el estado requerido",
		SinFondos: "El vault todavía no recibió fondos",
		TokenNoInicializado: "Todavía nadie depositó USDC en eERC",
		ParametroInvalido: "Parámetro inválido",
		UserAlreadyRegistered: "Ya estás registrado",
		InvalidProof: "Prueba ZK inválida",
		UserNotRegistered: "Usuario no registrado en eERC",
	};
	if (name && known[name]) return known[name];
	if (x?.shortMessage?.includes("User rejected") || x?.name === "UserRejectedRequestError") return "Firma rechazada";
	return x?.shortMessage || x?.message || String(e);
};
