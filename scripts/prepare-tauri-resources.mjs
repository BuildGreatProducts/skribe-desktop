import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
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

copyPackage('@agentclientprotocol/sdk');
copyPackage('@agentclientprotocol/claude-agent-acp');
copyPackage('@anthropic-ai/claude-agent-sdk');
copyPackage('zod');

console.log('Prepared Tauri resources');
