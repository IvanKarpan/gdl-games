/**
 * Unit tests for UE4SS / Ultra+ / DML ownership helpers (no live game required).
 * Run: pnpm exec vitest run games/mortalshell2/src/ownership.test.ts
 */
import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assessBpModLoader,
  assessDmlRuntime,
  assessUe4ssRuntime,
  detectUltraPlus,
  hasEnabledLogicMod,
  hasEnabledUe4ssDependentMod,
  hasLogicModLoader,
  hasLogicModPaksOnDisk,
  isDmlDependentPath,
  pickNexusMainFile,
  UE4SS_NEXUS_MOD_ID,
  DML_NEXUS_MOD_ID,
} from './hooks.js';

async function fixture(layout: {
  proxy?: boolean;
  core?: boolean;
  modsDir?: boolean;
  settings?: boolean;
  ultraMod?: boolean;
  ultraPak?: boolean;
  ultraAppData?: boolean;
  /** Microsoft DirectML under Binaries/Win64/DML — must not count as DmgModLoader. */
  directMl?: boolean;
  /** Real DmgModLoader under Content/Paks/dml. */
  dmlDir?: boolean;
  dmlPak?: boolean;
  /** BPModLoaderMod under ue4ss/Mods. */
  bpModLoader?: boolean;
  bpModLoaderEnabledTxt?: boolean;
  bpModLoaderModsTxt?: '1' | '0' | null;
}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ms2-ue4ss-'));
  // Isolate AppData so the developer's real UltraPlusManager is not detected.
  const fakeAppData = join(root, '_AppData');
  await mkdir(fakeAppData, { recursive: true });
  process.env.LOCALAPPDATA = fakeAppData;

  const w64 = join(root, 'MortalShell2', 'Binaries', 'Win64');
  const ue4ss = join(w64, 'ue4ss');
  const mods = join(ue4ss, 'Mods');
  if (layout.modsDir !== false) {
    await mkdir(mods, { recursive: true });
  } else {
    await mkdir(ue4ss, { recursive: true });
  }
  if (layout.proxy) await writeFile(join(w64, 'dwmapi.dll'), 'x');
  if (layout.core) await writeFile(join(ue4ss, 'UE4SS.dll'), 'x');
  if (layout.settings) await writeFile(join(ue4ss, 'UE4SS-settings.ini'), 'x');
  if (layout.ultraMod) {
    await mkdir(join(mods, 'UltraPlusExtensions'), { recursive: true });
  }
  if (layout.ultraPak) {
    const pakMods = join(root, 'MortalShell2', 'Content', 'Paks', '~mods');
    await mkdir(pakMods, { recursive: true });
    await writeFile(join(pakMods, '~UltraPlus_MortalShell2_P.pak'), 'x');
  }
  if (layout.ultraAppData) {
    await mkdir(join(fakeAppData, 'UltraPlusManager'), { recursive: true });
  }
  if (layout.directMl) {
    await mkdir(join(w64, 'DML'), { recursive: true });
    await writeFile(join(w64, 'DML', 'DirectML.dll'), 'x');
  }
  if (layout.dmlDir || layout.dmlPak) {
    const dml = join(root, 'MortalShell2', 'Content', 'Paks', 'dml');
    await mkdir(dml, { recursive: true });
    if (layout.dmlPak) {
      await writeFile(join(dml, 'DML.pak'), 'x');
    }
  }
  if (layout.bpModLoader) {
    const bp = join(mods, 'BPModLoaderMod', 'Scripts');
    await mkdir(bp, { recursive: true });
    await writeFile(join(bp, 'main.lua'), '-- bp');
    if (layout.bpModLoaderEnabledTxt) {
      await writeFile(join(mods, 'BPModLoaderMod', 'enabled.txt'), '');
    }
    if (layout.bpModLoaderModsTxt != null) {
      await writeFile(
        join(mods, 'mods.txt'),
        `BPModLoaderMod : ${layout.bpModLoaderModsTxt}\n`,
      );
    }
  }
  return root;
}

describe('UE4SS ownership assessment', () => {
  it('absent when nothing is installed', async () => {
    const root = await fixture({ modsDir: false });
    const a = await assessUe4ssRuntime(root);
    expect(a.health).toBe('absent');
    expect(a.ownership).toBe('absent');
    expect(a.guidance ?? '').toMatch(/UE4SS/i);
  });

  it('partial when only dwmapi.dll exists', async () => {
    const root = await fixture({ proxy: true, modsDir: false });
    const a = await assessUe4ssRuntime(root);
    expect(a.health).toBe('partial');
    expect(a.hasProxy).toBe(true);
    expect(a.hasCoreDll).toBe(false);
    expect(a.guidance ?? '').toMatch(/partial/i);
  });

  it('healthy externally-managed without Ultra+', async () => {
    const root = await fixture({ proxy: true, core: true, settings: true });
    const a = await assessUe4ssRuntime(root);
    expect(a.health).toBe('healthy');
    expect(a.ownership).toBe('externally-managed');
    expect(a.ultraPlusDetected).toBe(false);
    expect(a.message ?? '').toMatch(/externally managed|manual\/external/i);
  });

  it('ultra-managed when UltraPlusExtensions present', async () => {
    const root = await fixture({
      proxy: true,
      core: true,
      ultraMod: true,
    });
    expect(await detectUltraPlus(root)).toBe(true);
    const a = await assessUe4ssRuntime(root);
    expect(a.ownership).toBe('ultra-managed');
    expect(a.health).toBe('healthy');
    expect(a.message ?? '').toMatch(/Ultra\+/i);
  });

  it('detects Ultra+ via ~UltraPlus pak', async () => {
    const root = await fixture({ ultraPak: true });
    expect(await detectUltraPlus(root)).toBe(true);
  });

  it('partial + Ultra+ suggests Ultra+ repair', async () => {
    const root = await fixture({ proxy: true, ultraMod: true, modsDir: true, core: false });
    const a = await assessUe4ssRuntime(root);
    expect(a.health).toBe('partial');
    expect(a.message ?? '').toMatch(/Ultra\+/i);
  });
});

describe('DmgModLoader vs DirectML', () => {
  it('ignores Microsoft DirectML under Binaries/Win64/DML', async () => {
    const root = await fixture({ modsDir: false, directMl: true });
    const a = await assessDmlRuntime(root);
    expect(a.directMlPresent).toBe(true);
    expect(a.health).toBe('absent');
    expect(a.ownership).toBe('absent');
  });

  it('detects healthy DmgModLoader under Content/Paks/dml', async () => {
    const root = await fixture({ modsDir: false, dmlPak: true });
    const a = await assessDmlRuntime(root);
    expect(a.health).toBe('healthy');
    expect(a.ownership).toBe('externally-managed');
    expect(a.hasPakPayload).toBe(true);
  });

  it('partial when dml dir has no pak payload', async () => {
    const root = await fixture({ modsDir: false, dmlDir: true });
    const a = await assessDmlRuntime(root);
    expect(a.health).toBe('partial');
    expect(a.guidance ?? '').toMatch(/DirectML/i);
  });

  it('treats dml.pak under ~mods as misplaced/partial', async () => {
    const root = await fixture({ modsDir: false });
    const pakMods = join(root, 'MortalShell2', 'Content', 'Paks', '~mods');
    await mkdir(pakMods, { recursive: true });
    await writeFile(join(pakMods, 'dml.pak'), 'x');
    const a = await assessDmlRuntime(root);
    expect(a.health).toBe('partial');
    expect(a.guidance ?? '').toMatch(/~mods/i);
    expect((await hasLogicModLoader(root)).ok).toBe(false);
  });

  it('healthy DML alone satisfies LogicMod loader', async () => {
    const root = await fixture({ modsDir: false, dmlPak: true });
    expect((await hasLogicModLoader(root)).ok).toBe(true);
  });

  it('isDmlDependentPath ignores bare LogicMods paths', () => {
    expect(isDmlDependentPath('LogicMods/AutoPickup/AutoPickup.pak')).toBe(false);
    expect(isDmlDependentPath('Content/Paks/dml/DML.pak')).toBe(true);
    expect(isDmlDependentPath('dml/DML.pak')).toBe(true);
  });
});

describe('BPModLoaderMod vs bare UE4SS', () => {
  it('healthy Ultra+ UE4SS without BPModLoader is not enough for LogicMods', async () => {
    const root = await fixture({
      proxy: true,
      core: true,
      ultraMod: true,
    });
    const ue4ss = await assessUe4ssRuntime(root);
    expect(ue4ss.health).toBe('healthy');
    expect(ue4ss.ownership).toBe('ultra-managed');
    const loaders = await hasLogicModLoader(root);
    expect(loaders.ok).toBe(false);
    expect(loaders.bp.present).toBe(false);
    expect(loaders.bp.guidance).toMatch(/BPModLoaderMod/i);
    expect(loaders.bp.guidance).toMatch(/mods\/5|mortalshell2\/mods\/5/i);
  });

  it('detects enabled BPModLoaderMod via enabled.txt', async () => {
    const root = await fixture({
      proxy: true,
      core: true,
      bpModLoader: true,
      bpModLoaderEnabledTxt: true,
    });
    const bp = await assessBpModLoader(root);
    expect(bp.present).toBe(true);
    expect(bp.enabled).toBe(true);
    expect((await hasLogicModLoader(root)).ok).toBe(true);
  });

  it('treats mods.txt : 0 as disabled', async () => {
    const root = await fixture({
      proxy: true,
      core: true,
      bpModLoader: true,
      bpModLoaderModsTxt: '0',
    });
    const bp = await assessBpModLoader(root);
    expect(bp.present).toBe(true);
    expect(bp.enabled).toBe(false);
    expect((await hasLogicModLoader(root)).ok).toBe(false);
  });

  it('hasLogicModPaksOnDisk detects flat AutoPickup triplet', async () => {
    const root = await fixture({ modsDir: false });
    const logic = join(root, 'MortalShell2', 'Content', 'Paks', 'LogicMods');
    await mkdir(logic, { recursive: true });
    await writeFile(join(logic, 'AutoPickup.pak'), 'x');
    await writeFile(join(logic, 'vortex.deployment.mortalshell2-logicmods.json'), '{}');
    expect(await hasLogicModPaksOnDisk(root)).toBe(true);
  });
});

describe('Nexus fix helpers', () => {
  it('exposes Nexus mod ids for UE4SS and DML', () => {
    expect(UE4SS_NEXUS_MOD_ID).toBe(5);
    expect(DML_NEXUS_MOD_ID).toBe(4);
  });

  it('pickNexusMainFile prefers is_primary then name hint', () => {
    expect(
      pickNexusMainFile([
        { file_id: 1, file_name: 'other.zip' },
        { file_id: 2, file_name: 'dml-0.5.zip', is_primary: true },
      ]),
    ).toBe(2);
    expect(
      pickNexusMainFile(
        [
          { file_id: 9, file_name: 'readme.zip' },
          { file_id: 5, file_name: 'UE4SS-experimental.zip' },
        ],
        /ue4ss/i,
      ),
    ).toBe(5);
  });

  it('hasEnabledLogicMod / hasEnabledUe4ssDependentMod respect types', () => {
    const api = {
      getState: () => ({
        settings: { profiles: { activeProfileId: 'p1' } },
        persistent: {
          mods: {
            mortalshell2: {
              logic1: { type: 'mortalshell2-logicmods', state: 'installed' },
              lua1: { type: 'mortalshell2-ue4ss-mod', state: 'installed' },
            },
          },
          profiles: {
            p1: {
              gameId: 'mortalshell2',
              modState: { logic1: { enabled: true }, lua1: { enabled: true } },
            },
          },
        },
      }),
    };
    expect(hasEnabledLogicMod(api as never)).toBe(true);
    expect(hasEnabledUe4ssDependentMod(api as never)).toBe(true);

    const disabled = {
      getState: () => ({
        settings: { profiles: { activeProfileId: 'p1' } },
        persistent: {
          mods: {
            mortalshell2: {
              logic1: { type: 'mortalshell2-logicmods', state: 'installed' },
            },
          },
          profiles: {
            p1: {
              gameId: 'mortalshell2',
              modState: { logic1: { enabled: false } },
            },
          },
        },
      }),
    };
    expect(hasEnabledLogicMod(disabled as never)).toBe(false);
  });
});
