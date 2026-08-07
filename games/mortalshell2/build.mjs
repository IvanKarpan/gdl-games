/**
 * Optional per-game build (discovered by tools/nx/gdl-plugin.js when present).
 *
 * GDL allows only one `stores.steam` value. After emit, patch main() to call
 * wrapApiForDualSteamDiscovery so runtime prefers retail AppID then Open Beta.
 * Health checks / ownership UX live in game.yaml `diagnostics:` (standard GDL).
 */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const gameRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(gameRoot, '../..');
const gdlCli = join(repoRoot, 'gdl', 'dist', 'cli.js');
const doPackage = process.argv.includes('--package');

const importGdl = async (rel) => import(pathToFileURL(join(repoRoot, 'gdl', 'dist', rel)).href);

const patchDualSteamWrap = async () => {
  const extPath = join(gameRoot, '.gdl-out', 'extension.ts');
  let src = await readFile(extPath, 'utf8');

  if (src.includes('wrapApiForDualSteamDiscovery(')) {
    return;
  }

  if (src.includes("import * as hooks from '../src/hooks.js';")) {
    src = src.replace(
      /import \* as hooks from '\.\.\/src\/hooks\.js';/,
      "import * as hooks from '../src/hooks.js';\nimport { wrapApiForDualSteamDiscovery } from '../src/hooks.js';",
    );
  } else {
    src = src.replace(
      /import \{ GdlRuntime \} from '@gdl\/runtime';/,
      "import { GdlRuntime } from '@gdl/runtime';\nimport { wrapApiForDualSteamDiscovery } from '../src/hooks.js';",
    );
  }

  // Tolerate CRLF from Windows emit (exact "\\n" replace previously no-op'd).
  src = src.replace(
    /export default function main\(api: IExtensionContext\): boolean \{\r?\n  const runtime = new GdlRuntime\(api\);/,
    'export default function main(api: IExtensionContext): boolean {\n  wrapApiForDualSteamDiscovery(api);\n  const runtime = new GdlRuntime(api);',
  );

  if (!src.includes('wrapApiForDualSteamDiscovery(')) {
    throw new Error('mortalshell2 build: failed to inject wrapApiForDualSteamDiscovery');
  }

  await writeFile(extPath, src, 'utf8');
};

try {
  await access(gdlCli);
} catch {
  const r = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['init-gdl'],
    { cwd: repoRoot, stdio: 'inherit', shell: true },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const { parseYaml } = await importGdl('parser/index.js');
const { validate } = await importGdl('schema/validator.js');
const { emit, writeEmittedFiles } = await importGdl('codegen/emit.js');
const { runBundler } = await importGdl('bundler/index.js');
const { BuildErrors, formatError } = await importGdl('errors.js');
const { resolveHooks } = await importGdl('codegen/hook-resolver.js');
const { resolveExtensionVersion } = await importGdl('version.js');
const { packageExtension } = await importGdl('commands/package.js');

try {
  const yamlPath = join(gameRoot, 'game.yaml');
  const source = await readFile(yamlPath, 'utf8');
  const doc = parseYaml(source, yamlPath);
  const errors = validate(doc);
  if (errors.length) throw new BuildErrors(errors);

  const collectHookIds = (d) => {
    const ids = new Set();
    if (d.discovery?.version?.kind === 'hookRef') ids.add(d.discovery.version.hookId);
    return [...ids];
  };
  const collectExportOnly = (d) => {
    const ids = new Set();
    for (const inst of d.installers ?? []) {
      if (inst.installHook) ids.add(inst.installHook);
    }
    for (const diag of d.diagnostics ?? []) ids.add(diag.hook);
    // Build-injected only — not referenced from game.yaml.
    ids.add('wrapApiForDualSteamDiscovery');
    return [...ids];
  };

  const hookErrors = await resolveHooks(gameRoot, collectHookIds(doc), collectExportOnly(doc));
  if (hookErrors.length) throw new BuildErrors(hookErrors);

  const extensionVersion = await resolveExtensionVersion(doc, gameRoot);
  const files = emit(doc, { extensionVersion });
  await writeEmittedFiles(gameRoot, files);
  await patchDualSteamWrap();
  await runBundler(gameRoot);

  await mkdir(join(gameRoot, 'dist'), { recursive: true });
  await copyFile(join(gameRoot, '.gdl-out', 'info.json'), join(gameRoot, 'dist', 'info.json'));
  if (doc.game.logo) {
    await copyFile(join(gameRoot, doc.game.logo), join(gameRoot, 'dist', doc.game.logo));
  }

  if (doPackage) {
    await packageExtension({ cwd: gameRoot });
  }

  console.log(`mortalshell2: build ok (v${extensionVersion})${doPackage ? ' + package' : ''}`);
} catch (err) {
  if (err instanceof BuildErrors) {
    console.error(err.errors.map(formatError).join('\n'));
  } else {
    console.error(err);
  }
  process.exit(1);
}
