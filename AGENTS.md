# AGENTS.md — Trasluz

pnpm workspace (`pnpm-workspace.yaml`): `packages/zk`, `contracts`, `web`. Node ≥ 20, pnpm ≥ 9. No usar npm (no hay package-lock).

## Comandos
- Instalar: `pnpm install` (raíz). Scripts de instalación permitidos sólo vía `allowBuilds` en pnpm-workspace.yaml.
- Tests de contratos (pruebas ZK reales, ~30 s): `pnpm test`
- Typecheck (todo el workspace): `pnpm typecheck` · Build web: `pnpm build`
- Local: `pnpm node` → `pnpm deploy:local` → `pnpm e2e:local` → `pnpm dev`
- Fuji: `.env` con `DEPLOYER_PRIVATE_KEY` → `pnpm deploy:fuji` → `pnpm e2e:fuji`
- Verificar vendor eERC vs upstream: `pnpm verify-vendor`

## Reglas
- NO modificar `contracts/contracts/vendor/eerc/` ni `circuits/` (copias oficiales de ava-labs).
- `SettlementManager` nunca debe recibir/emitir montos (eventos, reverts, parámetros).
- Secretos (viewing key del auditor, wallets demo) sólo en `.secrets/` (gitignored). Nunca loguearlos.
- El deploy regenera `addresses.json`, `contracts/deployments/*.json`, `web/src/config/deployments.json` y `web/src/abi/*`. Los deploys locales (chainId 31337) van sólo a `web/src/config/deployments.local.json` (gitignored); al repo sólo entran redes públicas.
- Web: el hilo de UI sólo hace `import type` de `@trasluz/zk` (o `@trasluz/zk/src/pure`). Toda operación criptográfica va por `web/src/lib/prover.ts` (worker).
- Si cambian los circuitos, `pnpm --filter @trasluz/web sync-zk` regenera `web/src/config/zk-manifest.json` (hashes fijados).
- Headers/CSP en `web/security-headers.ts`. Para probar contra hardhat local con CSP: `TRASLUZ_ALLOW_LOCAL_RPC=1 pnpm build && pnpm preview`.
- Solc 0.8.27 (lo fija eERC upstream); nuestros contratos usan `^0.8.24`.
- Grabar demo: ver cabecera de `deck/record-demo.mjs` (cadena local limpia + `pnpm dev`).
- Medir rendimiento: `pnpm build && pnpm preview`, luego `node tools/perf.mjs` (JS, FCP/LCP, TBT, fps con CPU 4×). `tools/chunks.mjs` lista los chunks de la primera carga.
- Wallets: modal propio en `web/src/components/Wallet.tsx` (EIP-6963). No reintroducir RainbowKit/sonner (≈570 KB). WalletConnect se registra lazy (`walletConnectConnector` en `config/index.ts`): no agregarlo a `connectors` al inicio salvo sesión a restaurar. `state/keys.tsx` rechaza smart wallets / firmas no determinísticas: no relajar. Test: `node tools/wallets.mjs` (cadena local + `TRASLUZ_ALLOW_LOCAL_RPC=1 pnpm preview --port 4174`).
