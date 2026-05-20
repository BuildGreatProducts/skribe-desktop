#!/usr/bin/env bash
# Helper: base64-encode a .p12 for the APPLE_CERTIFICATE GitHub secret.
# Usage: ./scripts/export-apple-cert-for-ci.sh /path/to/DeveloperID.p12

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/certificate.p12" >&2
  echo "Export Developer ID Application from Keychain Access first." >&2
  exit 1
fi

P12="$1"
OUT="${P12%.p12}-base64.txt"

openssl base64 -A -in "$P12" -out "$OUT"
echo "Wrote base64 to: $OUT"
echo "Copy its contents into GitHub secret APPLE_CERTIFICATE."
