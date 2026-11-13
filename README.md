<p align="center">
  <img src="web/public/favicon.svg" width="96" alt="Trasluz" />
</p>

<h1 align="center">Trasluz</h1>
<p align="center"><b>Liquidación B2B confidencial sobre Avalanche eERC, con ventana para el regulador.</b><br/>
Track Avalanche · Argentina Space 2026</p>

---

> **¿Por qué "Trasluz"?** *Mirar algo al trasluz* es ponerlo contra la luz para ver lo que a simple vista
> no se ve — como la marca de agua de un billete. Eso hace el auditor: para el resto, el monto es ruido
> cifrado; para quien tiene la viewing key, el documento se lee en claro. El logo lo dice en una forma:
> dos paneles opacos (rojo Avalanche) y una rendija de luz (verde) entre ellos — lo cifrado queda tapado,
> sólo se ve lo que deja pasar la ventana. En la app la rendija late mientras se genera una prueba ZK y
> los paneles se abren cuando el auditor abre su ventana.

Una empresa le paga a su proveedor **contra entrega** (escrow). El **monto queda cifrado on-chain**:
nadie en el mercado ve cuánto le pagás a quién ni tu flujo de caja. Un **auditor designado**
tiene una ventana de solo lectura (su *viewing key*) para descifrar y **conciliar** cada operación.
Sólo entidades habilitadas (KYC) operan el riel.

> El diferenciador del eERC no es "privacidad": es **auditabilidad selectiva**.
> Confidencial para la competencia, transparente para AFIP/auditoría.

## Regla de oro: no tocamos la criptografía

Los contratos y circuitos de [`ava-labs/EncryptedERC`](https://github.com/ava-labs/EncryptedERC)
están **vendorizados byte a byte** (commit `8dc98cd`) y se usan los **verifiers de producción**
con las zkeys de la ceremonia oficial. `pnpm verify-vendor` lo comprueba contra upstream.
`SettlementManager.sol` **compone** con el estándar: sólo llama a `EncryptedERC.transfer` y
`Registrar.register`. Nunca reimplementa el cifrado ni las pruebas.

## Arquitectura

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Frontend React + wagmi (EIP-6963) · pruebas Groth16 en un Web Worker       │
│  Empresa · Proveedor · Auditor (viewing key en runtime) · Vista pública    │
└──────────────┬───────────────────────────────────────┬────────────────────┘
               │                                       │ auditorPCT (Poseidon)
               ▼                                       ▼
┌──────────────────────────────────┐        ┌───────────────────────────────┐
│ SettlementManager.sol (Trasluz)  │        │ Portal auditor (100% local)   │
│ · allowlist KYC (owner)          │        │ descifra cada PrivateTransfer │
│ · crear → clon EscrowVault/oblig.│        │ concilia fondeado vs liberado │
│ · fondear / confirmarEntrega     │        │ export CSV                    │
│ · liberar (CEI + nonReentrant)   │        └───────────────────────────────┘
│ · eventos y reverts SIN montos   │
└──────────────┬───────────────────┘
               │ EscrowVault.transferir()  (sólo el manager puede)
               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ EncryptedERC OFICIAL (converter mode) — sin modificar                      │
│ deposit USDC → saldo cifrado · transfer confidencial · withdraw → USDC     │
│ Registrar · verifiers Groth16 de producción · auditor designado            │
└──────────────┬────────────────────────────────────────────────────────────┘
               ▼
          Mock USDC (6 dec.) en Fuji
```

### La decisión de diseño clave: un vault eERC por obligación

En eERC cada movimiento de valor es una prueba ZK generada por **quien conoce la clave privada**
del emisor, y `EncryptedERC.transfer` usa `msg.sender` como emisor. Un contrato no tiene clave,
así que "el escrow" no puede ser simplemente el SettlementManager. La solución:

1. `crear()` despliega un **`EscrowVault`** (clon EIP-1167, dirección determinística) y lo registra
   en el `Registrar` oficial con una clave BabyJubJub propia. El Registrar verifica que la prueba
   esté hecha para la dirección del vault.
2. La clave del vault se **deriva** de la clave maestra del pagador
   (`poseidon(dominio, clave, vault)`), así que no hay que guardarla.
3. **La clave del vault no es autoridad de gasto.** Sólo sirve para descifrar el saldo y generar
   pruebas. El vault únicamente obedece a `SettlementManager`, que fija el destinatario
   (proveedor al liberar, pagador al reembolsar) y el estado. `EncryptedERC` además verifica que
   la prueba esté hecha para la clave pública del destinatario: el pagador **no puede desviar**
   el escrow ni siquiera con una prueba válida (hay test para esto).
4. El pagador cifra la clave del vault para el proveedor (Poseidon, on-chain). Así el proveedor
   **verifica el fondeo antes de entregar**, sin que nadie más vea el monto.
5. Un vault por obligación ⇒ los fondos de una obligación nunca se mezclan con otra.

Máquina de estados: `Creada → Fondeada → (entrega confirmada) → Liberada`, y `Cancelada` sólo si
no hubo entrega confirmada. El reembolso devuelve el saldo del vault al pagador y sólo existe en
`Cancelada`: después de `Liberada` el pagador no puede recuperar nada del escrow.

### Quién ve qué

| Dato | Mercado / Snowtrace | Proveedor | Auditor designado |
|---|---|---|---|
| Pagador, proveedor, estado, timestamps | visible | visible | visible |
| Monto de cada pago | **ciphertext** | el suyo | **descifrado** |
| Saldos / flujo de caja | **ciphertext** | el suyo | conciliable |
| Factura | `keccak(n° ‖ salt)` | hash | hash |
| Depósito/retiro USDC (rampa) | visible | visible | visible |

## Seguridad y riesgos

| Riesgo | Mitigación |
|---|---|
| Rodar cripto propia | **No.** eERC oficial vendorizado sin cambios + verifiers/zkeys de producción. Script de verificación contra upstream. Las primitivas de cliente (`packages/zk`) son un port 1:1 de `src/` oficial; sólo cambia la fuente de aleatoriedad a Web Crypto. |
| Fuga de monto por eventos/reverts | `SettlementManager` **no tiene parámetro de monto** en ninguna función. Eventos `{id, pagador, proveedor, estado, timestamp}`. Errores custom sin datos. Tests escanean todos los logs **y el calldata** del flujo buscando el monto. |
| Desvío del escrow | El destino lo fija el contrato; eERC valida la clave pública del receptor en la prueba. Vault `onlyManager`. Tests: desvío al pagador revierte; llamada directa al vault revierte. |
| Doble liberación / reentrancy | `require(Fondeada && entregaConfirmada)`, estado `Liberada` **antes** de la llamada externa (CEI) + `nonReentrant`. Además el vault queda en 0: no existe prueba válida para volver a moverlo. |
| Griefing del pagador post-entrega | Tras `confirmarEntrega` el pagador ya no puede cancelar. |
| Custodia de la viewing key del auditor | Se genera en el deploy y se escribe en `.secrets/` (gitignored, permisos 600); **nunca** se imprime. En el portal se ingresa en runtime, vive sólo en memoria, se valida contra `eERC.auditorPublicKey`. En prod: HSM / MPC. |
| Claves de usuario | Derivadas de una firma determinística de la wallet (RFC 6979), sólo en memoria; nada en localStorage salvo n° de factura + salt (no sensibles). |
| Admin del allowlist = punto único de control | `Ownable2Step`. En producción: Safe multisig + timelock. |
| Gating real de KYC | Allowlist manual (stub honesto). Gatea **el riel**, no el token: eERC es permissionless. Para gatear el token → L1 permisionada (ver roadmap). |
| Montos de depósito/retiro | Son públicos por diseño del converter (es la rampa ERC-20). La confidencialidad está en las transferencias. Recomendación: depósitos de tesorería agregados, no por factura. |
| Ciphertexts deterministas en deposit | Limitación documentada upstream (`BabyJubJub.encrypt` usa aleatoriedad fija en el contrato). Mitigado porque las cuentas reciben transferencias privadas con aleatoriedad real. |
| Trusted setup (Groth16) | Se usa la ceremonia oficial de ava-labs; no hay ceremonia propia. |
| Pago parcial | El monto es confidencial, así que el contrato no puede exigir que se libere todo. Si el pagador libera menos que lo fondeado, el remanente queda en el vault y **no es reembolsable** (no gana nada reteniéndolo), y el **auditor lo marca** como "Remanente" en la conciliación. |

## Quickstart (local)

Requisitos: Node ≥ 20 y pnpm ≥ 9 (`corepack enable` lo activa).

```bash
pnpm install
pnpm test                     # 21 tests con pruebas ZK reales (≈30 s)

pnpm node                      # terminal 1: hardhat node (chainId 31337)
pnpm deploy:local              # terminal 2: deploy + auditor + KYC de cuentas #2..#5
pnpm e2e:local                 # flujo completo por CLI: público vs. auditor
pnpm dev                       # http://localhost:5173
```

En MetaMask/Core agregá la red `http://127.0.0.1:8545` (chainId 31337) e importá las cuentas
de prueba de Hardhat **#2 y #3** (ya habilitadas en KYC): una como empresa, otra como proveedor.
La viewing key del auditor quedó en `.secrets/auditor-viewing-key-localhost.txt`.

> Si reiniciás el nodo, volvé a correr `deploy:local` y reseteá la actividad de la cuenta en la wallet (nonces).

## Demo grabada

[`deck/trasluz-demo.mp4`](deck/trasluz-demo.mp4) (≈2:10 min, 1440×900): alta de proveedor y empresa, depósito,
obligación por 18.750,25 USDC con pruebas ZK en el navegador, vista pública (ciphertext), confirmación de
entrega, liberación, portal del auditor (conciliación + libro + CSV) y verificación de integridad de circuitos.
Se regenera con [`deck/record-demo.mjs`](deck/record-demo.mjs).

## Deploy en Fuji

```bash
cp .env.example .env          # completar DEPLOYER_PRIVATE_KEY (con AVAX de testnet del Builder Hub)
pnpm deploy:fuji               # escribe addresses.json + web/src/config/deployments.json
pnpm e2e:fuji                  # flujo end-to-end con wallets efímeras; links a Snowtrace
pnpm build                     # frontend estático en web/dist (servir con cualquier hosting)
```

Para habilitar entidades: `KYC_ADDRESSES=0x..,0x..` en el deploy o desde **Administración** en la app (owner).

## Estructura

```
contracts/
  contracts/SettlementManager.sol   orquestación del escrow confidencial (nuestro)
  contracts/EscrowVault.sol         cuenta eERC por obligación (nuestro)
  contracts/MockUSDC.sol            ERC-20 de test con faucet
  contracts/vendor/eerc/            EncryptedERC oficial, SIN modificar
  test/                             tests Hardhat con pruebas Groth16 reales
  scripts/deploy.ts · e2e.ts        deploy (local/Fuji) y flujo end-to-end
packages/zk/                        primitivas eERC + prover (snarkjs) para Node y browser
circuits/                           wasm + zkey oficiales (ceremonia de producción)
web/                                React + Vite + Tailwind + wagmi (sin RainbowKit)
tools/                              perf.mjs (métricas de carga y fps), chunks.mjs (chunks de la 1ª carga)
deck/                               guion de demo y pitch
addresses.json                      direcciones desplegadas por red
```

## Frontend: rendimiento y seguridad del cliente

| | |
|---|---|
| **Criptografía en Web Worker** | Derivación de claves, cifrado Poseidon/ElGamal, descifrado de saldos/auditoría y pruebas Groth16 corren en `web/src/workers/prover.worker.ts`. La UI nunca se congela y el bundle principal **no incluye** curvas, constantes Poseidon ni snarkjs (≈300 KB gzip vs. 1,3 MB antes). |
| **Sin RainbowKit ni sonner** | Modal de conexión propio sobre wagmi con descubrimiento EIP-6963 (Core, MetaMask, Rabby…); WalletConnect sólo si hay `VITE_WALLETCONNECT_PROJECT_ID` y se carga al conectar. −500 KB de JS inicial. |
| **Render barato** | Sin `backdrop-filter` en tarjetas ni `filter: blur` animado (gradientes radiales equivalentes); ciphertext animado con **un solo ticker** que escribe directo al DOM, sólo para elementos visibles y nunca con la pestaña oculta; escenas 3D en pausa fuera de pantalla; `content-visibility` bajo el pliegue. |
| **Red** | JSON-RPC batch (lecturas paralelas en un request), logs con **cache incremental** (sólo bloques nuevos tras el primer escaneo), prefetch de rutas al pasar el mouse y en idle, `preconnect` al RPC de Fuji. |
| **Integridad de circuitos** | `sync-zk` fija el SHA-256 de cada `wasm`/`zkey` oficial en `web/src/config/zk-manifest.json`. El worker hashea cada archivo descargado y **aborta** si no coincide (circuito alterado en hosting/CDN). Verificable en vivo en *Administración → Seguridad del cliente*. |
| **CSP estricta** | `web/security-headers.ts` → `dist/_headers` (Netlify / Cloudflare Pages) y `vite preview`: sin scripts inline ni `eval` (sólo `wasm-unsafe-eval`), `frame-ancestors 'none'`, `no-referrer`, HSTS, `nosniff`, Permissions-Policy. |
| **Claves efímeras** | Sólo en memoria. Auto-bloqueo: clave eERC tras 15 min sin actividad / 5 min con la pestaña oculta; viewing key del auditor 10 min / 2 min. Se borran al desconectar la wallet. Nunca entran en cache keys ni storage. |
| **Carga progresiva** | Code-splitting por ruta; los circuitos (≈29 MB, cache inmutable) se precargan y verifican en *idle* al desbloquear la clave, así la primera prueba no espera la descarga. |
| **3D sin peso** | Escena del hero y tarjetas con inclinación en CSS 3D puro (`perspective`/`preserve-3d`), un rAF por frame, sólo `transform`. Respeta `prefers-reduced-motion` y se desactiva en pantallas táctiles. Sin WebGL ni librerías. |

Medido con `node tools/perf.mjs` (Chromium, CPU 4× más lenta, sin GPU): JS inicial 1,58 MB → 0,77 MB, bloqueo del hilo principal −50/−68 %, scroll en Inicio 8 → 47 fps y en Vista pública/Auditor 8 → 60 fps.

Build de producción con un RPC propio: `VITE_FUJI_RPC_URL=https://… pnpm build` (se agrega automáticamente a `connect-src`).

### Wallets compatibles

| Cómo se conecta | Wallets | Estado |
|---|---|---|
| Extensión de escritorio (EIP-6963) | Core, MetaMask, Rabby, Brave, Coinbase Wallet (extensión), OKX, Phantom, Trust… | Se detectan solas. Fallback "Wallet del navegador" para wallets sin EIP-6963. |
| Hardware wallet | Ledger / Trezor vía MetaMask, Rabby o Core | Compatibles (firma ECDSA determinística). |
| Navegador interno del celular | MetaMask, Core, Trust, OKX… | Inyectan la wallet. En celular sin wallet, el modal ofrece *Abrir en la app de MetaMask*. |
| WalletConnect (QR) | Cualquier wallet móvil con WalletConnect v2 y soporte de Fuji | Requiere `VITE_WALLETCONNECT_PROJECT_ID` (gratis en cloud.reown.com, agregando el dominio a la allowlist). El SDK se descarga recién al elegirlo. |
| Smart wallets / MPC | Safe, Coinbase Smart Wallet, wallets MPC o de "login social" | **No compatibles, y la app lo detecta.** |

La clave de cifrado eERC es `keccak256(firma)`. Por eso, al desbloquearla la app exige tres cosas: firma ECDSA de 65 bytes (no ERC-1271/6492), que la firma recupere la dirección conectada y, antes del primer registro, **dos firmas idénticas** (determinismo RFC 6979). Si algo falla, explica por qué y no registra nada. Esto evita que una cuenta registre una clave que después no pueda volver a derivar. La firma se normaliza (`v` 27/28) para que la misma cuenta dé la misma clave en cualquier wallet.

`node tools/wallets.mjs` verifica estos casos con wallets simuladas: EOA, smart wallet, firma de otra clave, MPC no determinística, modal de WalletConnect y deep link en celular. Necesita la cadena local, `deploy:local` y un `preview` con `TRASLUZ_ALLOW_LOCAL_RPC=1` en el puerto 4174.

**Prueba manual antes de presentar** (Fuji, con wallets reales):
1. Core y MetaMask (extensión): conectar, aceptar el cambio o alta de la red Fuji, *Firmar y derivar* (pide dos firmas la primera vez) y registrar.
2. Recargar la página y desbloquear de nuevo: tiene que entrar directo, sin el aviso "registrada con otra clave".
3. Cambiar de cuenta en la wallet: la app tiene que pedir la clave de la cuenta nueva.
4. Rabby y, si hay, una Ledger vía MetaMask: repetir los pasos 1 y 2.
5. Celular: abrir la URL desde el navegador interno de MetaMask o Core y repetir los pasos 1 y 2. Con el project ID configurado, probar también el QR de WalletConnect desde el escritorio.
6. Un flujo completo (depósito → obligación → liberación) con al menos una wallet real.

### Nota sobre `@avalabs/eerc-sdk`

El SDK oficial asume que el emisor de cada prueba es la wallet conectada (`msg.sender`), lo que
no cubre cuentas eERC **de contratos** (los vaults), y su `auditorDecrypt` sólo mira los últimos
1000 bloques. Por eso el frontend usa `packages/zk`: mismas primitivas (BabyJubJub, ElGamal,
Poseidon) y los **mismos circuitos oficiales**, con soporte para pruebas en nombre del vault y
escaneo completo de eventos para el auditor.

## Roadmap / bonus

- **L1 permisionada** (Subnet-EVM con `txAllowList`/`contractDeployerAllowList` vía `avalanche-cli`):
  desplegar el mismo stack para que el **token** confidencial, no sólo el riel, quede gateado por
  allowlist. Los contratos no cambian.
- Owner → Safe multisig + timelock. KYC real (proveedor de identidad / credenciales verificables).
- Liberación por confirmación firmada del proveedor (meta-tx) y deadlines con auto-reembolso.
- Mainnet C-Chain con USDC nativo.
