import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";
import { SECURITY_HEADERS } from "./security-headers";

/** Emite dist/_headers (Netlify / Cloudflare Pages) con los mismos headers de seguridad. */
const headersFile = (): Plugin => ({
	name: "trasluz-security-headers",
	apply: "build",
	generateBundle() {
		const body = Object.entries(SECURITY_HEADERS)
			.map(([k, v]) => `  ${k}: ${v}`)
			.join("\n");
		this.emitFile({
			type: "asset",
			fileName: "_headers",
			source: `/*\n${body}\n\n/zk/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
		});
	},
});

export default defineConfig({
	plugins: [react(), tailwindcss(), headersFile()],
	server: { port: 5173 },
	preview: { port: 4173, headers: SECURITY_HEADERS },
	worker: { format: "es" },
	build: {
		target: "es2022",
		sourcemap: false,
		chunkSizeWarningLimit: 1500,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes("node_modules")) return;
					if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) return "react";
					if (/[\\/]node_modules[\\/](@zk-kit|poseidon-lite|blakejs|@noble)[\\/]/.test(id)) return "crypto";
				},
			},
		},
	},
	optimizeDeps: { esbuildOptions: { target: "es2022" } },
});
