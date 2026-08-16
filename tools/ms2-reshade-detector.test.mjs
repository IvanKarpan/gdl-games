import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Review verification for the Package 02 hasReShadeRuntime fix. Lives under tools/
// (already in the root vitest include — no new test infrastructure) and drives the
// hook source directly with fixture dirs, like changelog.test.mjs does for
// tools/changelog.mjs.
const hooks = await import('../games/mortalshell2/src/hooks.js');

describe('ms2 hasReShadeRuntime', () => {
  const win64Dir = (root) => join(root, 'MortalShell2', 'Binaries', 'Win64');

  async function withGameDir(name, populate) {
    const root = await mkdtemp(join(tmpdir(), `ms2-reshade-${name}-`));
    try {
      await mkdir(win64Dir(root), { recursive: true });
      for (const [rel, content] of Object.entries(populate ?? {})) {
        await writeFile(join(win64Dir(root), rel), content);
      }
      return root;
    } catch (err) {
      await rm(root, { recursive: true, force: true });
      throw err;
    }
  }

  it('no markers -> false', async () => {
    const root = await withGameDir('empty', {});
    try {
      expect(await hooks.hasReShadeRuntime(root)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('normal ReShade installation evidence -> true', async () => {
    const root = await withGameDir('installed', {
      // Per-game config maintained by the ReShade setup, plus a proxy module
      // under its graphics-API name beside the shipping exe.
      'ReShade.ini': 'ReShadeEffect=...\n',
      'dxgi.dll': '',
    });
    try {
      expect(await hooks.hasReShadeRuntime(root)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('unrelated dxgi.dll alone -> false', async () => {
    const root = await withGameDir('dxgi-only', { 'dxgi.dll': '' });
    try {
      expect(await hooks.hasReShadeRuntime(root)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('ReShade preset .ini alone -> false', async () => {
    const root = await withGameDir('preset-only', {
      'Vibrant Reshade - Mortal Shell II.ini': '[General]\nEnabled=true\n',
    });
    try {
      expect(await hooks.hasReShadeRuntime(root)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
