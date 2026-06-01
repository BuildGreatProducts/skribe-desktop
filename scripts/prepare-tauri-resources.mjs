import { cpSync, chmodSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resourcesDir = resolve(root, 'src-tauri', 'build-resources');
const nodeModulesDir = resolve(resourcesDir, 'node_modules');

rmSync(resourcesDir, { recursive: true, force: true });
mkdirSync(nodeModulesDir, { recursive: true });

function packageDir(packageName) {
  try {
    return dirname(require.resolve(`${packageName}/package.json`));
  } catch (error) {
    const entrypoint = require.resolve(packageName);
    let candidate = dirname(entrypoint);
    while (candidate !== dirname(candidate)) {
      if (existsSync(resolve(candidate, 'package.json'))) {
        return candidate;
      }
      candidate = dirname(candidate);
    }
    throw error;
  }
}

function packageDestination(packageName) {
  return resolve(nodeModulesDir, ...packageName.split('/'));
}

function copyPackage(packageName) {
  cpSync(packageDir(packageName), packageDestination(packageName), {
    recursive: true,
    dereference: false,
  });
}

function codexPlatformPackage() {
  const platforms = {
    darwin: {
      arm64: '@zed-industries/codex-acp-darwin-arm64',
      x64: '@zed-industries/codex-acp-darwin-x64',
    },
    linux: {
      arm64: '@zed-industries/codex-acp-linux-arm64',
      x64: '@zed-industries/codex-acp-linux-x64',
    },
    win32: {
      arm64: '@zed-industries/codex-acp-win32-arm64',
      x64: '@zed-industries/codex-acp-win32-x64',
    },
  };
  const packageName = platforms[process.platform]?.[process.arch];
  if (!packageName) {
    throw new Error(`Unsupported Codex ACP platform: ${process.platform}/${process.arch}`);
  }
  return packageName;
}

function markCodexBinaryExecutable(packageName) {
  if (process.platform === 'win32') return;
  chmodSync(resolve(packageDestination(packageName), 'bin', 'codex-acp'), 0o755);
}

copyPackage('@agentclientprotocol/sdk');
copyPackage('@agentclientprotocol/claude-agent-acp');
copyPackage('@anthropic-ai/claude-agent-sdk');
copyPackage('@zed-industries/codex-acp');
copyPackage('zod');

const codexBinaryPackage = codexPlatformPackage();
copyPackage(codexBinaryPackage);
markCodexBinaryExecutable(codexBinaryPackage);

console.log(`Prepared Tauri resources with ${codexBinaryPackage}`);
