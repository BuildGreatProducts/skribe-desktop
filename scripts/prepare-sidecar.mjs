import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'src-tauri', 'binaries');
const triple = execFileSync('rustc', ['--print', 'host-tuple'], {
  encoding: 'utf8',
}).trim();

mkdirSync(outDir, { recursive: true });

const script = `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

for INDEX_JS in \\
  "$SCRIPT_DIR/../../sidecar-acp/dist/index.js" \\
  "$SCRIPT_DIR/../../../sidecar-acp/dist/index.js" \\
  "$SCRIPT_DIR/../Resources/sidecar-acp/dist/index.js" \\
  "$SCRIPT_DIR/../Resources/_up_/sidecar-acp/dist/index.js"
do
  if [ -f "$INDEX_JS" ]; then
    exec node "$INDEX_JS" "$@"
  fi
done

echo "Skribe ACP sidecar could not locate sidecar-acp/dist/index.js" >&2
exit 127
`;

const base = resolve(outDir, `acp-sidecar-${triple}`);
writeFileSync(base, script);
chmodSync(base, 0o755);

const plain = resolve(outDir, 'acp-sidecar');
writeFileSync(plain, script);
chmodSync(plain, 0o755);

console.log(`Prepared ACP sidecar for ${triple}`);
