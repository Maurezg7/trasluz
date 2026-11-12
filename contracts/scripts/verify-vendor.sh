#!/usr/bin/env bash
# Verifica que contracts/contracts/vendor/eerc y circuits/ sean idénticos al upstream
# oficial ava-labs/EncryptedERC en el commit fijado en VENDOR.md.
set -euo pipefail

COMMIT="8dc98cd4d63ad3aa6d86b70b8f4bbcd70f1e8be1"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone -q https://github.com/ava-labs/EncryptedERC.git "$TMP/eerc"
git -C "$TMP/eerc" checkout -q "$COMMIT"

status=0
for f in $(cd "$ROOT/contracts/contracts/vendor/eerc" && find . -type f -name '*.sol'); do
  if ! cmp -s "$ROOT/contracts/contracts/vendor/eerc/$f" "$TMP/eerc/contracts/$f"; then
    echo "✗ difiere: $f"; status=1
  fi
done

check() { cmp -s "$ROOT/circuits/$1" "$TMP/eerc/circom/build/$1" || { echo "✗ difiere: circuits/$1"; status=1; }; }
check registration/registration.wasm
check registration/circuit_final.zkey
check transfer/transfer.wasm
check transfer/transfer.zkey
check withdraw/withdraw.wasm
check withdraw/circuit_final.zkey

[ $status -eq 0 ] && echo "✓ eERC vendorizado y circuitos idénticos a ava-labs/EncryptedERC@${COMMIT:0:7}"
exit $status
