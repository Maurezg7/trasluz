/**
 * Headers de seguridad para producción (y `vite preview`).
 * CSP estricta: sin scripts inline ni eval. `wasm-unsafe-eval` es lo mínimo para compilar
 * los circuitos WebAssembly; `blob:` en worker-src lo usa el prover multihilo de snarkjs.
 */
const RPCS = ["https://api.avax-test.network", "https://api.avax.network"];
const WALLETCONNECT = [
	"https://*.walletconnect.com",
	"wss://*.walletconnect.com",
	"https://*.walletconnect.org",
	"wss://*.walletconnect.org",
	"https://*.reown.com",
	"wss://*.reown.com",
	// Config y listado de wallets del modal QR (AppKit).
	"https://*.web3modal.org",
	"https://*.web3modal.com",
];
const extraRpc = process.env.VITE_FUJI_RPC_URL ? [new URL(process.env.VITE_FUJI_RPC_URL).origin] : [];
const localRpc = process.env.TRASLUZ_ALLOW_LOCAL_RPC ? ["http://127.0.0.1:8545", "http://localhost:8545"] : [];

const csp = [
	"default-src 'self'",
	"script-src 'self' 'wasm-unsafe-eval'",
	"worker-src 'self' blob:",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https:",
	"font-src 'self' data: https://fonts.reown.com",
	`connect-src 'self' ${[...RPCS, ...extraRpc, ...localRpc, ...WALLETCONNECT].join(" ")}`,
	"frame-src https://verify.walletconnect.com https://verify.walletconnect.org",
	"frame-ancestors 'none'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"upgrade-insecure-requests",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
	"Content-Security-Policy": process.env.TRASLUZ_ALLOW_LOCAL_RPC ? csp.replace("; upgrade-insecure-requests", "") : csp,
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Referrer-Policy": "no-referrer",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
	"Cross-Origin-Opener-Policy": "same-origin-allow-popups",
	"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};
