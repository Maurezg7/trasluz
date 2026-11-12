# EncryptedERC oficial (vendorizado, sin modificar)

- Upstream: https://github.com/ava-labs/EncryptedERC
- Commit: `8dc98cd4d63ad3aa6d86b70b8f4bbcd70f1e8be1`
- Licencia: ver `LICENSE.md` (Ecosystem License, Ava Labs)

Copia byte a byte de `contracts/` del upstream (sin `mocks/` ni los verifiers de dev
`verifiers/`). Se usan los **verifiers de producción** (`prod/`), que corresponden a las
zkeys de la ceremonia oficial en `circom/build/` (copiadas a `/circuits`).

Verificación: `pnpm verify-vendor`.

Trasluz **no** modifica nada de este directorio. `SettlementManager` y `EscrowVault`
sólo importan y llaman a `EncryptedERC` y `Registrar`.
