# Trasluz — guion de demo (3-4 min)

**Setup previo:** deploy en Fuji hecho, dos wallets KYC (Empresa y Proveedor) registradas en la
app y con tesorería depositada, viewing key del auditor a mano (`.secrets/`). Pestañas abiertas:
app (Empresa), app (Proveedor, otra ventana/perfil), Snowtrace.

1. **Problema (20 s).** "Si pagás on-chain, tu competencia ve cuánto le pagás a cada proveedor y
   reconstruye tu flujo de caja. Si te vas a privacidad total, el regulador no puede auditar."
2. **Empresa (45 s).** `/empresa` → Nueva obligación: proveedor, factura, *18.750,25 USDC* →
   *Crear y fondear*. Mostrar el diálogo: "la prueba Groth16 se genera en el navegador".
3. **Snowtrace (30 s).** Abrir la transferencia: emisor, receptor, timestamp visibles; el monto es
   ciphertext. `/publico` muestra lo mismo decodificado. "Tu competencia no sabe cuánto moviste."
4. **Proveedor (30 s).** `/proveedor` → la obligación muestra *escrow verificado* con el monto
   (descifró la clave del vault que el pagador cifró para él) → *Confirmar entrega*.
5. **Liberar (20 s).** Empresa → *Liberar pago*: transferencia confidencial vault → proveedor.
6. **El momento fuerte (40 s).** `/auditor` → pegar la viewing key → se abre el diafragma:
   montos reales, conciliación *fondeado = liberado ✓*, libro de movimientos con
   *on-chain (ciphertext)* al lado de *descifrado*. Exportar CSV.
   "Confidencial para el mercado, transparente para el regulador. Sin un fork de la cripto."
7. **Cierre (15 s).** "Un riel de liquidación B2B que un banco o AFIP puede adoptar sin reescribir
   su compliance." Mostrar tabla de riesgos del README si preguntan.

## Preguntas esperables

- *¿Rodaron su propia cripto?* No: eERC oficial vendorizado byte a byte + verifiers de producción;
  `pnpm verify-vendor` lo prueba.
- *¿Quién custodia el escrow?* Nadie con una clave: la clave del vault no es autoridad de gasto;
  sólo el SettlementManager lo mueve y con destino fijo.
- *¿Y los depósitos?* Son públicos por diseño (rampa ERC-20). La confidencialidad está en las transferencias.
- *¿KYC?* Allowlist manual en la demo, dicho como tal. Producción: multisig + proveedor KYC + L1 permisionada.
