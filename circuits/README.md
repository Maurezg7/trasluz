# Circuitos eERC oficiales

Artefactos compilados (`.wasm`) y claves de prueba (`.zkey`) de la ceremonia de producción
de [ava-labs/EncryptedERC](https://github.com/ava-labs/EncryptedERC) (`circom/build/`,
commit `8dc98cd`). Corresponden a los verifiers `contracts/prod/*` desplegados.

| Circuito | Uso en Trasluz |
|---|---|
| `registration` | Registro de claves de usuarios **y de cada vault de escrow** |
| `transfer` | Fondeo (empresa → vault), liberación (vault → proveedor), reembolso |
| `withdraw` | Retiro eERC → USDC |

No se generan ni modifican: no hay trusted setup propio. Ver `pnpm verify-vendor`.
El frontend los sirve desde `web/public/zk` (copiados por `web/scripts/sync-zk.mjs`).
