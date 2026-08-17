import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lowerRule } from '../../../gdl/src/commands/test-corpus';
import { localCachePaths } from '../../../gdl/src/corpus/archive';
import { runCorpus } from '../../../gdl/src/corpus/runner';
import { parseYaml } from '../../../gdl/src/parser/index';
import {
  GAME_ID,
  installDmlFramework,
  installLogicModsRootTriplet,
  installUe4ssModEnabled,
  installUe4ssModModsPrefix,
  installUe4ssModRooted,
  installUe4ssModScripts,
  installUe4ssModShared,
  installUnsupportedSave,
} from './hooks';

type InstallHook = (
  files: string[],
  destinationPath: string,
  gameId: string,
) => Promise<{ instructions: unknown[] }>;

type CopyInstruction = {
  type: 'copy';
  source: string;
  destination: string;
};

async function run(hook: InstallHook, files: string[]) {
  const result = await hook(files, 'C:/Vortex/staging', GAME_ID);
  const instructions = result.instructions as Array<
    CopyInstruction | { type: 'setmodtype'; value: string }
  >;
  return {
    copies: instructions.filter(
      (instruction): instruction is CopyInstruction => instruction.type === 'copy',
    ),
    modTypes: instructions
      .filter((instruction) => instruction.type === 'setmodtype')
      .map((instruction) => instruction.value),
  };
}

describe('Mortal Shell II local installer hooks', () => {
  it('routes a wrapped flat DML package below Content/Paks/dml', async () => {
    const files = [
      'wrapper\\dml.pak',
      'wrapper\\dml.ucas',
      'wrapper\\dml.utoc',
      'wrapper\\dmlcore_P.pak',
      'wrapper\\dmlcore_P.ucas',
      'wrapper\\dmlcore_P.utoc',
    ];

    const result = await run(installDmlFramework, files);

    expect(result.copies.map(({ destination }) => destination)).toEqual([
      'dml/dml.pak',
      'dml/dml.ucas',
      'dml/dml.utoc',
      'dml/dmlcore_P.pak',
      'dml/dmlcore_P.ucas',
      'dml/dmlcore_P.utoc',
    ]);
    expect(result.copies.map(({ source }) => source)).toEqual(files);
    expect(result.modTypes).toEqual(['mortalshell2-dml-framework']);
  });

  it('keeps a shared UE4SS mod archive together below ue4ss/Mods', async () => {
    const result = await run(installUe4ssModShared, [
      'MortalShell2Mod',
      'MortalShell2Mod/Scripts/main.lua',
      'shared/ModMenu/ModMenu.lua',
    ]);

    expect(result.copies.map(({ destination }) => destination)).toEqual([
      'ue4ss/Mods/MortalShell2Mod/Scripts/main.lua',
      'ue4ss/Mods/shared/ModMenu/ModMenu.lua',
    ]);
    expect(result.modTypes).toEqual(['mortalshell2-ue4ss-mod']);
  });

  it('does not double ue4ss for an archive already rooted at ue4ss/Mods', async () => {
    const result = await run(installUe4ssModRooted, [
      'wrapper/ue4ss/Mods',
      'wrapper/ue4ss/Mods/CoolMod/Scripts/main.lua',
      'wrapper/README.txt',
    ]);

    expect(result.copies).toEqual([
      {
        type: 'copy',
        source: 'wrapper/ue4ss/Mods/CoolMod/Scripts/main.lua',
        destination: 'ue4ss/Mods/CoolMod/Scripts/main.lua',
      },
    ]);
    expect(result.modTypes).toEqual(['mortalshell2-ue4ss-tree']);
  });

  it('adds ue4ss without doubling an archive rooted at Mods', async () => {
    const result = await run(installUe4ssModModsPrefix, [
      'wrapper\\Mods\\CoolMod\\Scripts\\main.lua',
      'wrapper\\Mods\\CoolMod\\enabled.txt',
    ]);

    expect(result.copies.map(({ destination }) => destination)).toEqual([
      'ue4ss/Mods/CoolMod/Scripts/main.lua',
      'ue4ss/Mods/CoolMod/enabled.txt',
    ]);
    expect(result.copies[0]?.source).toBe('wrapper\\Mods\\CoolMod\\Scripts\\main.lua');
    expect(result.modTypes).toEqual(['mortalshell2-ue4ss-tree']);
  });

  it('strips one wrapper around a ModName/Scripts package', async () => {
    const result = await run(installUe4ssModScripts, [
      'wrapper/CoolMod/Scripts/main.lua',
      'wrapper/CoolMod/enabled.txt',
      'outside.txt',
    ]);

    expect(result.copies.map(({ destination }) => destination)).toEqual([
      'ue4ss/Mods/CoolMod/Scripts/main.lua',
      'ue4ss/Mods/CoolMod/enabled.txt',
    ]);
    expect(result.modTypes).toEqual(['mortalshell2-ue4ss-mod']);
  });

  it('strips one wrapper around an enabled.txt-only UE4SS mod', async () => {
    const result = await run(installUe4ssModEnabled, [
      'wrapper/CoolMod/enabled.txt',
      'wrapper/CoolMod/config.json',
    ]);

    expect(result.copies.map(({ destination }) => destination)).toEqual([
      'ue4ss/Mods/CoolMod/enabled.txt',
      'ue4ss/Mods/CoolMod/config.json',
    ]);
    expect(result.modTypes).toEqual(['mortalshell2-ue4ss-mod']);
  });

  it('puts the exact flat AutoPickup package below LogicMods', async () => {
    const files = ['AutoPickup.pak', 'AutoPickup.ucas', 'AutoPickup.utoc'];
    const result = await run(installLogicModsRootTriplet, files);

    expect(result.copies.map(({ destination }) => destination)).toEqual([
      'LogicMods/AutoPickup.pak',
      'LogicMods/AutoPickup.ucas',
      'LogicMods/AutoPickup.utoc',
    ]);
    expect(result.copies.map(({ source }) => source)).toEqual(files);
    expect(result.modTypes).toEqual(['mortalshell2-logicmods']);
  });

  it('drops both spellings of the SaveGames directory marker', async () => {
    for (const marker of ['SaveGames', 'SaveGames/']) {
      const result = await run(installUnsupportedSave, [
        marker,
        'SaveGames/WorldState_0.sav',
      ]);

      expect(result.copies).toEqual([
        {
          type: 'copy',
          source: 'SaveGames/WorldState_0.sav',
          destination: 'SaveGames/WorldState_0.sav',
        },
      ]);
      expect(result.modTypes).toEqual(['mortalshell2-unsupported']);
    }
  });

  it('fails closed instead of emitting an unsafe relative destination', async () => {
    const result = await run(installUe4ssModScripts, [
      'CoolMod/Scripts/main.lua',
      '../outside.txt',
    ]);

    expect(result).toEqual({ copies: [], modTypes: [] });
  });
});

describe('Mortal Shell II local corpus attribution', () => {
  const gameRoot = resolve(import.meta.dirname, '..');
  const archives = localCachePaths(gameRoot);

  // The fetched Nexus manifests are intentionally ignored. Exercise the exact
  // release corpus when it is available locally without making clean CI clones
  // depend on uncommitted cache evidence.
  it.runIf(archives.length > 0)(
    'attributes every active cached record without an unmatched or failed archive',
    () => {
      const yamlPath = resolve(gameRoot, 'game.yaml');
      const document = parseYaml(readFileSync(yamlPath, 'utf8'), yamlPath);
      const rules = (document.installers ?? []).map(lowerRule);
      const installPath = '/games/mortalshell2';
      const gamePath = `${installPath}/MortalShell2`;
      const win64Path = `${gamePath}/Binaries/Win64`;
      const paksPath = `${gamePath}/Content/Paks`;

      const report = runCorpus(rules, archives, {
        vars: {
          store: 'steam',
          os: 'windows',
          arch: 'x64',
          installPath,
          executablePath: `${win64Path}/MortalShell2-Win64-Shipping.exe`,
          gamePath,
          win64Path,
          paksPath,
          pakModsPath: `${paksPath}/~mods`,
          dmlPath: `${paksPath}/dml`,
          logicModsPath: `${paksPath}/LogicMods`,
          ue4ssRootPath: `${win64Path}/ue4ss`,
          ue4ssModsPath: `${win64Path}/ue4ss/Mods`,
        },
      });

      expect(archives).toHaveLength(20);
      expect(report).toMatchObject({
        total: 20,
        matched: 20,
        unmatched: 0,
        failed: 0,
      });
    },
  );
});
