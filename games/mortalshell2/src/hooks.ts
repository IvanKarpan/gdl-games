/**
 * Mortal Shell II — TypeScript hooks (GDL escape hatches).
 *
 * Archive routing and Steam discovery live in game.yaml. Hooks cover:
 * - UE4SS / Ultra+ / manual ownership assessment + diagnostics
 * - DmgModLoader (DML) awareness (Content/Paks/dml) — never confuse with DirectML
 * - idempotent mods.txt merge
 *
 * Product backlog: PLAN.md (not shipped in the zip).
 */
import { access, readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fs, log, selectors, types, util } from 'vortex-api';

export const GAME_ID = 'mortalshell2';

/**
 * Nexus mod ids on mortalshell2 (verified against live packages):
 *   5 = UE4SS runtime (dwmapi + ue4ss/, includes BPModLoaderMod) — LogicMods Fix target
 *   4 = DmgModLoader (DML) — IoStore paks → Content/Paks/dml/ (NOT ~mods); not the Fix path
 * Microsoft DirectML lives at Binaries/Win64/DML — ignore for loader detection.
 */
export const DML_NEXUS_MOD_ID = 4;
export const UE4SS_NEXUS_MOD_ID = 5;
export const UE4SS_NEXUS_PAGE =
  `https://www.nexusmods.com/mortalshell2/mods/${UE4SS_NEXUS_MOD_ID}`;

const BPMOD_LOADER_DIR = 'BPModLoaderMod';

export type Ue4ssOwnership =
  | 'absent'
  | 'partial'
  | 'vortex-managed'
  | 'externally-managed'
  | 'ultra-managed';

export type DmlOwnership =
  | 'absent'
  | 'partial'
  | 'vortex-managed'
  | 'externally-managed';

export type RuntimeHealth = 'healthy' | 'partial' | 'absent';

const VORTEX_UE4SS_MODTYPE = 'mortalshell2-ue4ss-framework';
const VORTEX_DML_MODTYPES = ['mortalshell2-dml-framework', 'mortalshell2-dml-tree'] as const;
const ULTRA_MOD_DIR = 'UltraPlusExtensions';
const ULTRA_PAK_PREFIX = '~ultraplus_';

interface VortexDiscovery {
  path?: string;
  store?: string;
}

export interface Ue4ssRuntimeAssessment {
  ownership: Ue4ssOwnership;
  health: RuntimeHealth;
  hasProxy: boolean;
  hasCoreDll: boolean;
  hasModsDir: boolean;
  hasSettings: boolean;
  ultraPlusDetected: boolean;
  message?: string;
  /** Short actionable guidance for missing/partial states. */
  guidance?: string;
}

export interface DmlRuntimeAssessment {
  ownership: DmlOwnership;
  health: RuntimeHealth;
  hasDmlDir: boolean;
  hasPakPayload: boolean;
  /** True when Binaries/Win64/DML exists (Microsoft DirectML — not DmgModLoader). */
  directMlPresent: boolean;
  message?: string;
  guidance?: string;
}

/** BPModLoaderMod — required for LogicMods under UE4SS (not implied by a healthy runtime). */
export interface BpModLoaderAssessment {
  present: boolean;
  /** false when missing, disabled in mods.txt, or no enable signal. */
  enabled: boolean;
  modDir?: string;
  guidance: string;
}

function getDiscovery(api: types.IExtensionApi): VortexDiscovery | undefined {
  return (
    selectors.discoveryByGame as unknown as (
      s: unknown,
      g: string,
    ) => VortexDiscovery | undefined
  )(api.getState(), GAME_ID);
}

function getActiveGameId(api: types.IExtensionApi): string | undefined {
  return (selectors.activeGameId as unknown as (s: unknown) => string | undefined)(
    api.getState(),
  );
}

function win64(discoveryPath: string): string {
  return join(discoveryPath, 'MortalShell2', 'Binaries', 'Win64');
}

function ue4ssRoot(discoveryPath: string): string {
  return join(win64(discoveryPath), 'ue4ss');
}

function ue4ssModsDir(discoveryPath: string): string {
  return join(ue4ssRoot(discoveryPath), 'Mods');
}

/** DmgModLoader lives under Content/Paks/dml — never Binaries/Win64/DML (DirectML). */
function dmgModLoaderDir(discoveryPath: string): string {
  return join(discoveryPath, 'MortalShell2', 'Content', 'Paks', 'dml');
}

function microsoftDirectMlDir(discoveryPath: string): string {
  return join(win64(discoveryPath), 'DML');
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function norm(p: string): string {
  return p.replace(/\\/g, '/');
}

function isUe4ssDependentPath(file: string): boolean {
  const f = norm(file);
  // Narrow evidence — do not treat arbitrary .lua as UE4SS.
  if (/\/scripts\/main\.lua$/i.test(f)) return true;
  if (/\/ue4ss\/mods\/[^/]+\/scripts\/.+\.lua$/i.test(f)) return true;
  if (/\/mods\/[^/]+\/scripts\/main\.lua$/i.test(f)) return true;
  if (/\/enabled\.txt$/i.test(f) && /\/(ue4ss\/)?mods\//i.test(f)) return true;
  return false;
}

/** Strong DML-framework / DML-only evidence — never LogicMods alone. */
export function isDmlDependentPath(file: string): boolean {
  const f = norm(file).toLowerCase();
  if (f.includes('/content/paks/dml/') || f.includes('/paks/dml/')) return true;
  if (/(^|\/)dml\//.test(f) && /\.(pak|ucas|utoc)$/.test(f)) return true;
  if (/(^|\/)dml[-_]/i.test(basename(f)) && /\.(pak|ucas|utoc)$/.test(f)) return true;
  return false;
}

/** LogicMod payload (needs BPModLoaderMod and/or DML — not bare UE4SS). */
export function isLogicModPath(file: string): boolean {
  const f = norm(file).toLowerCase();
  if (f.includes('/logicmods/')) return true;
  return false;
}

export function bpModLoaderGuidance(a: BpModLoaderAssessment, ultraPlus = false): string {
  if (a.present && a.enabled) {
    return 'BPModLoaderMod is present and enabled — LogicMods under Content/Paks/LogicMods can load.';
  }
  if (a.present && !a.enabled) {
    return (
      'BPModLoaderMod is installed but not enabled. Enable it in ue4ss/Mods/mods.txt ' +
      '(BPModLoaderMod : 1) or add enabled.txt inside BPModLoaderMod/, then redeploy/restart. ' +
      (ultraPlus
        ? 'Ultra+ owns the UE4SS runtime — enabling this Lua mod is safe and does not replace Ultra+.'
        : '')
    );
  }
  return (
    'UE4SS is installed but BPModLoaderMod is missing under ue4ss/Mods. ' +
    'LogicMods need that Lua mod. Install or repair the tested UE4SS package from Nexus ' +
    `(mortalshell2/mods/${UE4SS_NEXUS_MOD_ID}) — it includes BPModLoaderMod. ` +
    (ultraPlus
      ? 'If Ultra+ owns your runtime, copy BPModLoaderMod into ue4ss/Mods from that package instead of replacing Ultra+.'
      : '')
  );
}

/** Guidance when LogicMods need a loader and UE4SS itself is missing/unhealthy. */
export function logicModsNeedUe4ssGuidance(ue4ss: Ue4ssRuntimeAssessment): string {
  if (
    ue4ss.ultraPlusDetected ||
    ue4ss.ownership === 'ultra-managed' ||
    ue4ss.ownership === 'externally-managed'
  ) {
    return (
      ue4ss.guidance ??
      'UE4SS is incomplete while Ultra+/external ownership is present. Repair that runtime, ' +
        `then ensure BPModLoaderMod is present (included in Nexus mortalshell2/mods/${UE4SS_NEXUS_MOD_ID}).`
    );
  }
  return (
    'LogicMods require UE4SS with BPModLoaderMod. ' +
    `Download and install the tested package from Nexus (mortalshell2/mods/${UE4SS_NEXUS_MOD_ID}), then deploy.`
  );
}

/**
 * Detect BPModLoaderMod. Ultra+ (and slim UE4SS builds) often omit it — LogicMods
 * then land correctly but never run.
 */
export async function assessBpModLoader(
  discoveryPath: string,
): Promise<BpModLoaderAssessment> {
  const modDir = join(ue4ssModsDir(discoveryPath), BPMOD_LOADER_DIR);
  const present =
    (await pathExists(join(modDir, 'Scripts', 'main.lua'))) ||
    (await pathExists(join(modDir, 'scripts', 'main.lua')));

  if (!present) {
    const empty: BpModLoaderAssessment = {
      present: false,
      enabled: false,
      guidance: '',
    };
    empty.guidance = bpModLoaderGuidance(empty);
    return empty;
  }

  const hasEnabledTxt = await pathExists(join(modDir, 'enabled.txt'));
  let modsTxtEnabled: boolean | null = null;
  try {
    const txt = await readFile(join(ue4ssModsDir(discoveryPath), 'mods.txt'), 'utf8');
    const line = txt.split(/\r?\n/).find((l) => /^BPModLoaderMod\s*:/i.test(l.trim()));
    if (line) {
      const m = line.match(/:\s*(\d+)/);
      modsTxtEnabled = m ? m[1] !== '0' : true;
    }
  } catch {
    // no mods.txt
  }

  let enabled = false;
  if (modsTxtEnabled === false) {
    enabled = false;
  } else if (modsTxtEnabled === true || hasEnabledTxt) {
    enabled = true;
  } else {
    // Present but no enable signal — common after manual copy; treat as disabled.
    enabled = false;
  }

  const result: BpModLoaderAssessment = { present: true, enabled, modDir, guidance: '' };
  result.guidance = bpModLoaderGuidance(result);
  return result;
}

/** True when LogicMods can load: enabled BPModLoaderMod and/or healthy DML. */
export async function hasLogicModLoader(discoveryPath: string): Promise<{
  ok: boolean;
  bp: BpModLoaderAssessment;
  dml: DmlRuntimeAssessment;
}> {
  const bp = await assessBpModLoader(discoveryPath);
  const dml = await assessDmlRuntime(discoveryPath);
  return { ok: (bp.present && bp.enabled) || dml.health === 'healthy', bp, dml };
}

function vortexManagesModType(
  api: types.IExtensionApi | undefined,
  modType: string,
): boolean {
  if (!api) return false;
  try {
    const state = api.getState() as {
      persistent?: {
        mods?: Record<string, Record<string, { type?: string; state?: string }>>;
      };
    };
    const modsForGame = state?.persistent?.mods?.[GAME_ID] ?? {};
    return Object.values(modsForGame).some(
      (m) => m?.type === modType && m?.state !== 'uninstalled',
    );
  } catch {
    return false;
  }
}

/**
 * Detect Ultra+ using multiple stable signals (not a single fragile filename).
 */
export async function detectUltraPlus(discoveryPath: string): Promise<boolean> {
  const mods = ue4ssModsDir(discoveryPath);
  if (await pathExists(join(mods, ULTRA_MOD_DIR))) return true;

  const pakMods = join(
    discoveryPath,
    'MortalShell2',
    'Content',
    'Paks',
    '~mods',
  );
  try {
    const entries = await readdir(pakMods);
    if (entries.some((e) => e.toLowerCase().startsWith(ULTRA_PAK_PREFIX))) {
      return true;
    }
  } catch {
    // no ~mods
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData && (await pathExists(join(localAppData, 'UltraPlusManager')))) {
    return true;
  }
  return false;
}

export function ue4ssGuidance(a: Ue4ssRuntimeAssessment): string {
  if (a.health === 'healthy' && a.ownership === 'ultra-managed') {
    return (
      'UE4SS appears to be managed by Ultra+ Manager. Vortex will manage individual ' +
      'UE4SS mods but will not replace or update the UE4SS runtime. Use Ultra+ Manager ' +
      'to update or repair it.'
    );
  }
  if (a.health === 'healthy' && a.ownership === 'externally-managed') {
    return (
      'UE4SS detected as a manual/external install. Vortex will manage UE4SS mods only ' +
      'and will not update, adopt, or purge that runtime.'
    );
  }
  if (a.health === 'healthy' && a.ownership === 'vortex-managed') {
    return 'UE4SS is Vortex-managed. Update or remove it through the Vortex UE4SS framework package.';
  }
  if (a.ultraPlusDetected || a.ownership === 'ultra-managed') {
    return (
      'UE4SS is missing or incomplete while Ultra+ Manager appears present. Repair or ' +
      'reinstall UE4SS through Ultra+ Manager — Vortex will not overwrite that runtime. ' +
      'Then re-enable the dependent mod.'
    );
  }
  if (a.health === 'partial') {
    return (
      'UE4SS looks partial. A healthy layout needs dwmapi.dll, ue4ss/UE4SS.dll, and ' +
      'ue4ss/Mods under MortalShell2/Binaries/Win64 (beside the shipping exe). Repair ' +
      'the manual install, use Ultra+ Manager if that owns your runtime, or use Fix to ' +
      `install the Nexus UE4SS package (mortalshell2/mods/${UE4SS_NEXUS_MOD_ID}).`
    );
  }
  return (
    'This mod needs UE4SS. Use Fix to download the Nexus UE4SS package ' +
    `(mortalshell2/mods/${UE4SS_NEXUS_MOD_ID}), install manually ` +
    '(dwmapi.dll + ue4ss/UE4SS.dll + ue4ss/Mods under MortalShell2/Binaries/Win64), ' +
    'or repair via Ultra+ Manager if that owns your runtime. Managing the game in ' +
    'Vortex does not install frameworks by itself.'
  );
}

/**
 * Assess on-disk UE4SS runtime. Ownership uses Vortex deployment state when
 * available; otherwise external/ultra. Never infers ownership from hashes.
 */
export async function assessUe4ssRuntime(
  discoveryPath: string,
  api?: types.IExtensionApi,
): Promise<Ue4ssRuntimeAssessment> {
  const w64 = win64(discoveryPath);
  const root = ue4ssRoot(discoveryPath);
  const mods = ue4ssModsDir(discoveryPath);

  const hasProxy = await pathExists(join(w64, 'dwmapi.dll'));
  const hasCoreDll =
    (await pathExists(join(root, 'UE4SS.dll'))) ||
    (await pathExists(join(root, 'ue4ss.dll')));
  const hasSettings = await pathExists(join(root, 'UE4SS-settings.ini'));
  const hasModsDir = await pathExists(mods);
  const ultraPlusDetected = await detectUltraPlus(discoveryPath);

  let health: RuntimeHealth = 'absent';
  if (hasProxy && hasCoreDll && hasModsDir) {
    health = 'healthy';
  } else if (hasProxy || hasCoreDll || hasModsDir || hasSettings) {
    health = 'partial';
  }

  const vortexManaged = vortexManagesModType(api, VORTEX_UE4SS_MODTYPE);

  let ownership: Ue4ssOwnership = 'absent';
  if (health === 'absent') {
    ownership = 'absent';
  } else if (vortexManaged) {
    ownership = 'vortex-managed';
  } else if (ultraPlusDetected) {
    ownership = 'ultra-managed';
  } else if (health === 'partial') {
    ownership = 'partial';
  } else {
    ownership = 'externally-managed';
  }

  const base: Ue4ssRuntimeAssessment = {
    ownership,
    health,
    hasProxy,
    hasCoreDll,
    hasModsDir,
    hasSettings,
    ultraPlusDetected,
  };
  const guidance = ue4ssGuidance(base);
  // Surface message for healthy external/ultra (info) and for problems.
  if (
    health !== 'healthy' ||
    ownership === 'ultra-managed' ||
    ownership === 'externally-managed'
  ) {
    return { ...base, message: guidance, guidance };
  }
  return { ...base, guidance };
}

export function dmlGuidance(
  a: DmlRuntimeAssessment,
  extras?: { misplacedInPakMods?: boolean },
): string {
  if (extras?.misplacedInPakMods) {
    return (
      'DmgModLoader files were found under Content/Paks/~mods but must live in ' +
      'Content/Paks/dml/. Reinstall/redeploy DML with the current extension (mod type ' +
      'mortalshell2-dml-framework), or move dml*.pak/ucas/utoc into Content/Paks/dml/.'
    );
  }
  if (a.health === 'healthy' && a.ownership === 'externally-managed') {
    return (
      'DmgModLoader (DML) detected under Content/Paks/dml. Vortex will install compatible ' +
      'LogicMods but will not replace or purge that DML runtime.'
    );
  }
  if (a.health === 'healthy' && a.ownership === 'vortex-managed') {
    return 'DML is Vortex-managed. Update or remove it through the Vortex DML package.';
  }
  if (a.health === 'partial') {
    return (
      'DmgModLoader looks partial under Content/Paks/dml (folder present but no .pak payload). ' +
      `Repair or reinstall from Nexus mortalshell2/mods/${DML_NEXUS_MOD_ID}. ` +
      'Note: MortalShell2/Binaries/Win64/DML is Microsoft DirectML, not DmgModLoader.'
    );
  }
  return (
    'DmgModLoader was not found under MortalShell2/Content/Paks/dml. ' +
    `Install Nexus mortalshell2/mods/${DML_NEXUS_MOD_ID} (routes to Content/Paks/dml/). ` +
    'Do not use Binaries/Win64/DML (Microsoft DirectML) and do not leave dml*.pak in ~mods. ' +
    'Alternate LogicMod loader: enabled BPModLoaderMod under ue4ss/Mods.'
  );
}

/**
 * Assess DmgModLoader. Ignores Microsoft DirectML at Binaries/Win64/DML.
 * Detects misplaced installs under ~mods (old pak routing bug).
 */
export async function assessDmlRuntime(
  discoveryPath: string,
  api?: types.IExtensionApi,
): Promise<DmlRuntimeAssessment> {
  const dmlDir = dmgModLoaderDir(discoveryPath);
  const hasDmlDir = await pathExists(dmlDir);
  const directMlPresent = await pathExists(microsoftDirectMlDir(discoveryPath));
  const misplacedInPakMods = await pathExists(
    join(discoveryPath, 'MortalShell2', 'Content', 'Paks', '~mods', 'dml.pak'),
  );

  let hasPakPayload = false;
  if (hasDmlDir) {
    try {
      const entries = await readdir(dmlDir);
      hasPakPayload = entries.some((e) => /\.(pak|ucas|utoc)$/i.test(e));
    } catch {
      hasPakPayload = false;
    }
  }

  let health: RuntimeHealth = 'absent';
  if (hasDmlDir && hasPakPayload) {
    health = 'healthy';
  } else if (hasDmlDir || misplacedInPakMods) {
    health = 'partial';
  }

  const vortexManaged = VORTEX_DML_MODTYPES.some((t) => vortexManagesModType(api, t));

  let ownership: DmlOwnership = 'absent';
  if (health === 'absent') {
    ownership = 'absent';
  } else if (vortexManaged) {
    ownership = 'vortex-managed';
  } else if (health === 'partial') {
    ownership = 'partial';
  } else {
    ownership = 'externally-managed';
  }

  const base: DmlRuntimeAssessment = {
    ownership,
    health,
    hasDmlDir,
    hasPakPayload,
    directMlPresent,
  };
  const guidance = dmlGuidance(base, { misplacedInPakMods });
  if (health !== 'healthy' || ownership === 'externally-managed') {
    return { ...base, message: guidance, guidance };
  }
  return { ...base, guidance };
}

export async function detectGameVersion(ctx: {
  installPath: string;
}): Promise<string | null> {
  try {
    const exe = join(
      ctx.installPath,
      'MortalShell2',
      'Binaries',
      'Win64',
      'MortalShell2-Win64-Shipping.exe',
    );
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    const ps =
      `(Get-Item -LiteralPath '${exe.replace(/'/g, "''")}').VersionInfo.ProductVersion`;
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-Command', ps],
      { windowsHide: true },
    );
    const v = stdout.trim();
    return v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export async function listModDirs(modsDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdirAsync(modsDir);
  } catch {
    return [];
  }
  const skip = new Set(['mods.txt', 'mods.json', 'shared']);
  const candidates = entries.filter((e: string) => !skip.has(e));
  const checked = await Promise.all(
    candidates.map(async (entry: string) => {
      try {
        const stat = (await fs.statAsync(`${modsDir}/${entry}`)) as {
          isDirectory: () => boolean;
        };
        return stat.isDirectory() ? entry : null;
      } catch {
        return null;
      }
    }),
  );
  return checked.filter((e): e is string => e !== null);
}

/**
 * Idempotent mods.txt merge: add missing mod dirs as enabled; never erase
 * existing Ultra+/manual lines; do not reorder unrelated entries.
 */
export async function regenerateModsTxt(ctx: {
  profileId: string;
  deployment: unknown;
  api: unknown;
}): Promise<void> {
  const api = ctx.api as types.IExtensionApi;
  if (getActiveGameId(api) !== GAME_ID) return;
  const discovery = getDiscovery(api);
  if (!discovery?.path) return;

  const modsDir = ue4ssModsDir(discovery.path);
  const dirs = await listModDirs(modsDir);
  if (dirs.length === 0) return;

  let existing = '';
  try {
    existing = await readFile(join(modsDir, 'mods.txt'), 'utf8');
  } catch {
    existing = '';
  }

  const lines = existing.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const have = new Set(
    lines.map((l) => l.split(':')[0]?.trim()).filter(Boolean) as string[],
  );

  let changed = false;
  for (const dir of dirs) {
    if (!have.has(dir)) {
      lines.push(`${dir} : 1`);
      changed = true;
    }
  }
  if (!changed) return;

  await fs.writeFileAsync(join(modsDir, 'mods.txt'), `${lines.join('\n')}\n`);
}

/** True when Content/Paks/LogicMods has real mod paks (not just Vortex metadata). */
export async function hasLogicModPaksOnDisk(discoveryPath: string): Promise<boolean> {
  const dir = join(discoveryPath, 'MortalShell2', 'Content', 'Paks', 'LogicMods');
  try {
    const entries = await readdir(dir);
    return entries.some(
      (e) => /\.(pak|ucas|utoc)$/i.test(e) && !/^vortex\./i.test(e),
    );
  } catch {
    return false;
  }
}

async function logicModsRequireLoader(api: types.IExtensionApi): Promise<boolean> {
  if (hasEnabledLogicMod(api)) return true;
  const discovery = getDiscovery(api);
  if (!discovery?.path) return false;
  return hasLogicModPaksOnDisk(discovery.path);
}

function dismissNotification(api: types.IExtensionApi, id: string): void {
  const anyApi = api as types.IExtensionApi & {
    dismissNotification?: (nid: string) => void;
  };
  anyApi.dismissNotification?.(id);
}

/**
 * Toast + action buttons. Vortex health checks often stay on the Health page
 * without a popup — did-deploy uses this so missing UE4SS / BPModLoaderMod is obvious.
 *
 * LogicMods: need healthy UE4SS + enabled BPModLoaderMod. Both Fix paths point at
 * Nexus mortalshell2/mods/5 (the verified pack includes BPModLoaderMod).
 */
export async function notifyMissingFrameworks(
  api: types.IExtensionApi,
): Promise<void> {
  if (getActiveGameId(api) !== GAME_ID) return;
  const discovery = getDiscovery(api);
  if (!discovery?.path) return;

  const needsUe4ssMod = hasEnabledUe4ssDependentMod(api);
  const needsLogicLoader = await logicModsRequireLoader(api);
  if (!needsUe4ssMod && !needsLogicLoader) {
    dismissNotification(api, 'mortalshell2-need-ue4ss');
    dismissNotification(api, 'mortalshell2-need-dml');
    dismissNotification(api, 'mortalshell2-need-bpmodloader');
    return;
  }

  const ue4ss = await assessUe4ssRuntime(discovery.path, api);
  const { ok: hasLoader, bp } = await hasLogicModLoader(discovery.path);
  const anyApi = api as types.IExtensionApi & {
    sendNotification?: (n: Record<string, unknown>) => void;
  };
  if (typeof anyApi.sendNotification !== 'function') return;

  const ultraOrExternal =
    ue4ss.ultraPlusDetected ||
    ue4ss.ownership === 'ultra-managed' ||
    ue4ss.ownership === 'externally-managed';

  const openUe4ssNexus = (dismiss: () => void) => {
    void util.opn(`${UE4SS_NEXUS_PAGE}?tab=files`).finally(() => dismiss());
  };

  // UE4SS-dependent Lua mods (non-LogicMods) still need a healthy runtime.
  if (needsUe4ssMod && !needsLogicLoader && ue4ss.health !== 'healthy') {
    if (ultraOrExternal) {
      anyApi.sendNotification({
        id: 'mortalshell2-need-ue4ss',
        type: 'warning',
        title: 'UE4SS needs repair',
        message:
          ue4ss.guidance ??
          'UE4SS is incomplete while Ultra+/external ownership is present. Repair it there — Vortex will not replace that runtime.',
        noDismiss: true,
        actions: [
          {
            title: 'Dismiss',
            action: (dismiss: () => void) => dismiss(),
          },
        ],
      });
    } else {
      anyApi.sendNotification({
        id: 'mortalshell2-need-ue4ss',
        type: 'warning',
        title: 'UE4SS runtime required',
        message:
          'Enabled mods need UE4SS. Download the tested package from Nexus (mortalshell2/mods/5), then deploy.',
        noDismiss: true,
        actions: [
          {
            title: 'Download UE4SS',
            action: (dismiss: () => void) => {
              void fixMissingUe4ssRuntime(api).finally(() => dismiss());
            },
          },
          {
            title: 'Open Nexus',
            action: openUe4ssNexus,
          },
        ],
      });
    }
  } else if (!needsLogicLoader || ue4ss.health === 'healthy') {
    dismissNotification(api, 'mortalshell2-need-ue4ss');
  }

  dismissNotification(api, 'mortalshell2-need-dml');
  if (needsLogicLoader && !hasLoader) {
    if (ue4ss.health !== 'healthy') {
      anyApi.sendNotification({
        id: 'mortalshell2-need-ue4ss',
        type: 'warning',
        title: 'UE4SS required for LogicMods',
        message: logicModsNeedUe4ssGuidance(ue4ss),
        noDismiss: true,
        actions: ultraOrExternal
          ? [
              { title: 'Open Nexus', action: openUe4ssNexus },
              { title: 'Dismiss', action: (dismiss: () => void) => dismiss() },
            ]
          : [
              {
                title: 'Download UE4SS',
                action: (dismiss: () => void) => {
                  void fixLogicModLoaderStack(api).finally(() => dismiss());
                },
              },
              { title: 'Open Nexus', action: openUe4ssNexus },
            ],
      });
      dismissNotification(api, 'mortalshell2-need-bpmodloader');
    } else {
      dismissNotification(api, 'mortalshell2-need-ue4ss');
      anyApi.sendNotification({
        id: 'mortalshell2-need-bpmodloader',
        type: 'warning',
        title: 'BPModLoaderMod missing',
        message: bpModLoaderGuidance(
          bp,
          ue4ss.ultraPlusDetected || ue4ss.ownership === 'ultra-managed',
        ),
        noDismiss: true,
        actions: [
          {
            title: 'Download UE4SS',
            action: (dismiss: () => void) => {
              void fixLogicModLoaderStack(api).finally(() => dismiss());
            },
          },
          { title: 'Open Nexus', action: openUe4ssNexus },
        ],
      });
    }
  } else {
    dismissNotification(api, 'mortalshell2-need-bpmodloader');
    if (!needsUe4ssMod || ue4ss.health === 'healthy') {
      dismissNotification(api, 'mortalshell2-need-ue4ss');
    }
  }
}

/**
 * did-deploy: merge mods.txt, then toast if LogicMods/UE4SS mods need frameworks.
 * Health-check Fix actions alone often never surface as notifications.
 */
export async function afterDeploy(ctx: {
  profileId: string;
  deployment: unknown;
  api: unknown;
}): Promise<void> {
  await regenerateModsTxt(ctx);
  try {
    await notifyMissingFrameworks(ctx.api as types.IExtensionApi);
  } catch (err) {
    log('warn', 'mortalshell2: framework notify failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Vortex 2.4+ IModHealthCheck shape. Missing `triggers` (array) crashes the
 * HealthCheckRegistry (`triggers.forEach` on undefined) and bricks Vortex startup.
 * Use `checkMod(api, modCtx)` — not the old `(mod, instructions, api)` form.
 */
type ModCheckCtx = {
  modId?: string;
  files?: string[];
  attributes?: Record<string, unknown>;
};

type HealthResult = {
  checkId: string;
  status: 'passed' | 'failed' | 'warning' | 'error';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: string;
  executionTime: number;
  timestamp: Date;
  fixAvailable?: boolean;
};

type NexusFileInfo = {
  file_id?: number;
  fileId?: number;
  is_primary?: boolean;
  category_id?: number;
  name?: string;
  file_name?: string;
};

function passResult(id: string, message = 'OK'): HealthResult {
  return {
    checkId: id,
    status: 'passed',
    severity: 'info',
    message,
    executionTime: 0,
    timestamp: new Date(),
  };
}

function failResult(
  id: string,
  message: string,
  severity: HealthResult['severity'] = 'warning',
  fixAvailable = false,
): HealthResult {
  return {
    checkId: id,
    status: 'failed',
    severity,
    message,
    executionTime: 0,
    timestamp: new Date(),
    ...(fixAvailable ? { fixAvailable: true } : {}),
  };
}

/** Pick a Nexus file id to download (exported for unit tests). */
export function pickNexusMainFile(
  files: NexusFileInfo[],
  nameHint: RegExp = /bpmodloader|ue4ss/i,
): number | null {
  if (!files?.length) return null;
  const primary =
    files.find((f) => f.is_primary) ??
    files.find((f) => nameHint.test(f.file_name ?? f.name ?? '')) ??
    files.find((f) => f.category_id === 1) ??
    files[0];
  const id = primary?.file_id ?? primary?.fileId;
  return typeof id === 'number' && id > 0 ? id : null;
}

async function emitAndAwait(
  api: types.IExtensionApi,
  event: string,
  ...args: unknown[]
): Promise<unknown> {
  const anyApi = api as types.IExtensionApi & {
    emitAndAwait?: (ev: string, ...a: unknown[]) => Promise<unknown>;
    events: {
      emit: (ev: string, ...a: unknown[]) => void;
      on: (ev: string, handler: (...a: unknown[]) => void) => void;
    };
  };
  if (typeof anyApi.emitAndAwait === 'function') {
    return anyApi.emitAndAwait(event, ...args);
  }
  return new Promise((resolve, reject) => {
    try {
      anyApi.events.emit(event, ...args, (err: Error | null, result: unknown) => {
        if (err) reject(err);
        else resolve(result);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function notify(
  api: types.IExtensionApi,
  type: 'info' | 'success' | 'warning' | 'error',
  message: string,
  opts: Record<string, unknown> = {},
): void {
  const anyApi = api as types.IExtensionApi & {
    sendNotification?: (n: Record<string, unknown>) => void;
  };
  if (typeof anyApi.sendNotification === 'function') {
    anyApi.sendNotification({
      id: (opts.id as string) ?? 'mortalshell2-framework-fix',
      type,
      message,
      displayMS: type === 'error' ? 10000 : 6000,
      ...opts,
    });
  } else {
    log(type === 'error' ? 'error' : 'info', `mortalshell2: ${message}`);
  }
}

async function installNexusMod(
  api: types.IExtensionApi,
  modId: number,
  opts: {
    label: string;
    nameHint: RegExp;
    successHint: string;
    notifyId: string;
  },
): Promise<void> {
  const domain = 'mortalshell2';
  const pageUrl = `https://www.nexusmods.com/${domain}/mods/${modId}?tab=files`;
  const anyApi = api as types.IExtensionApi & {
    ext?: { ensureLoggedIn?: () => Promise<void> };
  };

  try {
    if (typeof anyApi.ext?.ensureLoggedIn === 'function') {
      await anyApi.ext.ensureLoggedIn();
    }

    const raw = await emitAndAwait(api, 'get-mod-files', domain, modId);
    const files: NexusFileInfo[] = Array.isArray(raw)
      ? raw
      : ((raw as { files?: NexusFileInfo[] })?.files ?? []);
    const fileId = pickNexusMainFile(files, opts.nameHint);

    if (fileId == null) {
      notify(
        api,
        'warning',
        `Could not resolve a ${opts.label} file on Nexus — opening the download page.`,
        { id: opts.notifyId },
      );
      await util.opn(pageUrl);
      return;
    }

    notify(api, 'info', `Downloading ${opts.label} from Nexus Mods…`, {
      id: opts.notifyId,
    });
    await emitAndAwait(api, 'nexus-download', domain, modId, fileId);
    notify(api, 'success', opts.successHint, { id: opts.notifyId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warn', `mortalshell2: ${opts.label} auto-download failed; opening Nexus page`, {
      err: msg,
      modId,
    });
    notify(
      api,
      'warning',
      `Automatic download failed (${msg}). Opening the Nexus page for manual install.`,
      { id: opts.notifyId },
    );
    try {
      await util.opn(pageUrl);
    } catch {
      // ignore
    }
  }
}

/** Download UE4SS runtime from Nexus (mortalshell2/mods/5) — includes BPModLoaderMod. */
export async function installUe4ssFromNexus(api: types.IExtensionApi): Promise<void> {
  await installNexusMod(api, UE4SS_NEXUS_MOD_ID, {
    label: 'UE4SS',
    nameHint: /ue4ss/i,
    successHint:
      'UE4SS download started. Install/enable the Vortex UE4SS framework package (mod type ' +
      'mortalshell2-ue4ss-framework → Binaries/Win64), then redeploy. That pack includes BPModLoaderMod.',
    notifyId: 'mortalshell2-ue4ss-fix',
  });
}

/** Download DmgModLoader from Nexus (mortalshell2/mods/4) → Content/Paks/dml/. */
export async function installDmlFromNexus(api: types.IExtensionApi): Promise<void> {
  await installNexusMod(api, DML_NEXUS_MOD_ID, {
    label: 'DmgModLoader (DML)',
    nameHint: /dml/i,
    successHint:
      'DML download started. Install/enable it so files land in Content/Paks/dml/ (not ~mods), then redeploy.',
    notifyId: 'mortalshell2-dml-fix',
  });
}

/** LogicMods Fix — always the UE4SS pack (mod 5); it ships BPModLoaderMod. */
export async function installBpModLoaderFromNexus(
  api: types.IExtensionApi,
): Promise<void> {
  await installUe4ssFromNexus(api);
}

/**
 * Fix for LogicMods: download Nexus mod 5 (UE4SS + BPModLoaderMod).
 * Never downloads a Vortex UE4SS package over Ultra+/external ownership — open the page instead.
 */
export async function fixLogicModLoaderStack(
  api: types.IExtensionApi,
): Promise<void> {
  const discovery = getDiscovery(api);
  if (!discovery?.path) {
    notify(api, 'warning', 'Game path not discovered — cannot install framework mods yet.');
    return;
  }

  const { ok, bp } = await hasLogicModLoader(discovery.path);
  if (ok) {
    notify(api, 'success', 'A LogicMod loader is already present (BPModLoaderMod and/or DML).', {
      id: 'mortalshell2-logicmod-fix',
    });
    return;
  }

  const ue4ss = await assessUe4ssRuntime(discovery.path, api);
  const ultraOrExternal =
    ue4ss.ultraPlusDetected ||
    ue4ss.ownership === 'ultra-managed' ||
    ue4ss.ownership === 'externally-managed';

  if (ue4ss.health !== 'healthy') {
    if (ultraOrExternal) {
      notify(api, 'warning', logicModsNeedUe4ssGuidance(ue4ss), {
        id: 'mortalshell2-logicmod-fix',
      });
      try {
        await util.opn(`${UE4SS_NEXUS_PAGE}?tab=files`);
      } catch {
        // ignore
      }
      return;
    }
    await installUe4ssFromNexus(api);
    return;
  }

  // UE4SS healthy but BPModLoaderMod missing/disabled — same Nexus pack.
  notify(
    api,
    'warning',
    bpModLoaderGuidance(
      bp,
      ue4ss.ultraPlusDetected || ue4ss.ownership === 'ultra-managed',
    ),
    { id: 'mortalshell2-logicmod-fix' },
  );
  if (ultraOrExternal) {
    try {
      await util.opn(`${UE4SS_NEXUS_PAGE}?tab=files`);
    } catch {
      // ignore
    }
    return;
  }
  await installUe4ssFromNexus(api);
}

const LOGIC_MOD_TYPES = new Set([
  'mortalshell2-logicmods',
  'mortalshell2-logicmods-tree',
]);

const UE4SS_DEPENDENT_MOD_TYPES = new Set([
  'mortalshell2-ue4ss-mod',
  'mortalshell2-ue4ss-tree',
]);

function profileModEnabled(
  api: types.IExtensionApi,
  modId: string,
): boolean | undefined {
  const state = api.getState() as {
    persistent?: {
      profiles?: Record<
        string,
        { gameId?: string; modState?: Record<string, { enabled?: boolean }> }
      >;
    };
    settings?: { profiles?: { activeProfileId?: string } };
  };
  const profileId = state?.settings?.profiles?.activeProfileId;
  const profile = profileId ? state?.persistent?.profiles?.[profileId] : undefined;
  const profileForGame =
    profile?.gameId === GAME_ID
      ? profile
      : Object.values(state?.persistent?.profiles ?? {}).find((p) => p?.gameId === GAME_ID);
  return profileForGame?.modState?.[modId]?.enabled;
}

function hasEnabledModOfTypes(
  api: types.IExtensionApi,
  typesSet: Set<string>,
): boolean {
  const state = api.getState() as {
    persistent?: {
      mods?: Record<string, Record<string, { type?: string; state?: string }>>;
    };
  };
  const mods = state?.persistent?.mods?.[GAME_ID] ?? {};
  for (const [modId, mod] of Object.entries(mods)) {
    if (!mod || mod.state === 'uninstalled') continue;
    if (!typesSet.has(mod.type ?? '')) continue;
    if (profileModEnabled(api, modId) === false) continue;
    return true;
  }
  return false;
}

/** True when Vortex has an enabled LogicMod for this game. */
export function hasEnabledLogicMod(api: types.IExtensionApi): boolean {
  return hasEnabledModOfTypes(api, LOGIC_MOD_TYPES);
}

/** True when Vortex has an enabled UE4SS Lua/C++ mod (not the runtime package). */
export function hasEnabledUe4ssDependentMod(api: types.IExtensionApi): boolean {
  return hasEnabledModOfTypes(api, UE4SS_DEPENDENT_MOD_TYPES);
}

/**
 * Install UE4SS from Nexus unless Ultra+/external ownership says leave it alone.
 */
export async function fixMissingUe4ssRuntime(
  api: types.IExtensionApi,
): Promise<void> {
  const discovery = getDiscovery(api);
  if (discovery?.path) {
    const ue4ss = await assessUe4ssRuntime(discovery.path, api);
    if (
      ue4ss.ultraPlusDetected ||
      ue4ss.ownership === 'ultra-managed' ||
      (ue4ss.ownership === 'externally-managed' && ue4ss.health !== 'absent')
    ) {
      notify(
        api,
        'warning',
        ue4ss.guidance ??
          'UE4SS is managed outside Vortex (Ultra+/manual). Repair it there — Vortex will not replace that runtime.',
        { id: 'mortalshell2-ue4ss-fix' },
      );
      return;
    }
  }
  await installUe4ssFromNexus(api);
}

function modFiles(mod: ModCheckCtx | undefined): string[] {
  return (mod?.files ?? []).map((f) => String(f).replace(/\\/g, '/'));
}

function hasDest(files: string[], name: string): boolean {
  const lower = name.toLowerCase();
  return files.some(
    (f) =>
      f.toLowerCase() === lower ||
      f.toLowerCase().endsWith(`/${lower}`) ||
      basename(f).toLowerCase() === lower,
  );
}

function makeModHealthCheck(spec: {
  id: string;
  name: string;
  description: string;
  severity?: HealthResult['severity'];
  check: (
    api: types.IExtensionApi,
    files: string[],
  ) => Promise<{ ok: boolean; message?: string; severity?: HealthResult['severity'] }>;
}): types.IModHealthCheck {
  const severity = spec.severity ?? 'warning';
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: 'mods',
    severity,
    triggers: ['mods-changed', 'game-changed', 'startup'],
    gameId: GAME_ID,
    checkMod: async (api: types.IExtensionApi, mod: ModCheckCtx) => {
      const result = await spec.check(api, modFiles(mod));
      if (result.ok) {
        return passResult(spec.id, result.message ?? 'OK');
      }
      return failResult(spec.id, result.message ?? 'Failed', result.severity ?? severity);
    },
  };
}

/**
 * UE4SS runtime missing/unhealthy while an enabled UE4SS-dependent mod needs it.
 * LogicMods are covered by logicModLoaderCheck (DML and/or BPModLoaderMod).
 */
export const missingUe4ssCheck: types.IModHealthCheck = {
  id: 'mortalshell2-missing-ue4ss',
  name: 'UE4SS runtime required',
  description:
    'Raises when an enabled UE4SS-dependent mod needs UE4SS and the runtime is not healthy. ' +
    'Fix downloads the tested UE4SS package from Nexus (mortalshell2/mods/5).',
  category: 'requirements',
  severity: 'error',
  triggers: ['mods-changed', 'game-changed', 'startup'],
  gameId: GAME_ID,
  check: async (api: types.IExtensionApi, _signal?: AbortSignal) => {
    if (!hasEnabledUe4ssDependentMod(api)) {
      return passResult('mortalshell2-missing-ue4ss');
    }
    const discovery = getDiscovery(api);
    if (!discovery?.path) {
      return passResult('mortalshell2-missing-ue4ss');
    }
    const assessment = await assessUe4ssRuntime(discovery.path, api);
    if (assessment.health === 'healthy') {
      return passResult('mortalshell2-missing-ue4ss');
    }

    const ultraOrExternal =
      assessment.ultraPlusDetected ||
      assessment.ownership === 'ultra-managed' ||
      assessment.ownership === 'externally-managed';

    const parts = [
      assessment.guidance ?? ue4ssGuidance(assessment),
      ultraOrExternal
        ? 'Fix will not replace an Ultra+/external runtime — repair it with its owner.'
        : 'Use Fix to download UE4SS from Nexus (mortalshell2/mods/5).',
    ];

    return failResult(
      'mortalshell2-missing-ue4ss',
      parts.join(' '),
      'error',
      !ultraOrExternal,
    );
  },
  fix: async (api: types.IExtensionApi) => {
    await fixMissingUe4ssRuntime(api);
  },
};

/** Partial runtime / nested paths / Vortex takeover of external UE4SS. */
export const ue4ssOwnershipCheck = makeModHealthCheck({
  id: 'mortalshell2-ue4ss-ownership',
  name: 'UE4SS ownership and integrity',
  description:
    'Detects partial runtimes, nested path bugs, and Vortex framework packages that would overwrite an external runtime.',
  severity: 'error',
  check: async (api, files) => {
    const issues: string[] = [];
    if (files.some((f) => /\/ue4ss\/mods\/ue4ss\/mods\//i.test(f))) {
      issues.push('Duplicated ue4ss/Mods nesting detected in deploy plan.');
    }
    if (files.some((f) => /pakchunk\d+-windows\.(pak|ucas|utoc)$/i.test(f))) {
      issues.push('Mod attempts to deploy stock pakchunk* game archives.');
    }

    const deploysRuntime =
      hasDest(files, 'dwmapi.dll') || files.some((f) => /ue4ss\.dll$/i.test(f));

    if (deploysRuntime) {
      const discovery = getDiscovery(api);
      if (discovery?.path) {
        const assessment = await assessUe4ssRuntime(discovery.path, api);
        if (
          assessment.health === 'healthy' &&
          (assessment.ownership === 'externally-managed' ||
            assessment.ownership === 'ultra-managed')
        ) {
          issues.push(
            'A Vortex UE4SS runtime package would overwrite an externally managed runtime ' +
              `(${assessment.ownership}). Cancel the Vortex runtime install, or remove the external ` +
              'runtime manually and retry. Vortex will not delete external files automatically. ' +
              (assessment.ownership === 'ultra-managed'
                ? 'Repair UE4SS through Ultra+ Manager instead.'
                : ''),
          );
        }
        if (assessment.health === 'partial') {
          issues.push(assessment.guidance ?? ue4ssGuidance(assessment));
        }
      }
    }

    if (files.filter((f) => /\.addon64$/i.test(f)).length > 1) {
      issues.push(
        'Multiple RenoDX .addon64 files in one package — prefer a single implementation.',
      );
    }

    if (issues.length === 0) return { ok: true };
    return { ok: false, message: issues.join(' '), severity: 'error' };
  },
});

/** Soft Ultra+/manual UE4SS note — never fails. */
export const ue4ssExternalInfoCheck = makeModHealthCheck({
  id: 'mortalshell2-ue4ss-external-info',
  name: 'UE4SS external ownership info',
  description:
    'Records externally managed / Ultra+ ownership without treating it as an error.',
  severity: 'info',
  check: async (api) => {
    const discovery = getDiscovery(api);
    if (!discovery?.path) return { ok: true };
    const assessment = await assessUe4ssRuntime(discovery.path, api);
    if (
      assessment.health === 'healthy' &&
      (assessment.ownership === 'externally-managed' ||
        assessment.ownership === 'ultra-managed')
    ) {
      return { ok: true, message: assessment.message };
    }
    return { ok: true };
  },
});

/** DML-specific payload without DmgModLoader (never LogicMods alone). */
export const missingDmlCheck = makeModHealthCheck({
  id: 'mortalshell2-missing-dml',
  name: 'DmgModLoader (DML) required',
  description:
    'Raises only for DML-specific archives/paths — never because LogicMods/ exists.',
  severity: 'error',
  check: async (api, files) => {
    if (!files.some(isDmlDependentPath)) return { ok: true };
    const discovery = getDiscovery(api);
    if (!discovery?.path) return { ok: true };
    const assessment = await assessDmlRuntime(discovery.path, api);
    if (assessment.health === 'healthy') return { ok: true };
    const ue4ss = await assessUe4ssRuntime(discovery.path, api);
    let message = assessment.guidance ?? dmlGuidance(assessment);
    if (ue4ss.health === 'healthy') {
      const bp = await assessBpModLoader(discovery.path);
      if (bp.present && bp.enabled) {
        message +=
          ' Enabled BPModLoaderMod is already present — if this mod is dual-compatible ' +
          '(LogicMods via UE4SS or DML), you may not need DML.';
      }
    }
    return { ok: false, message, severity: 'error' };
  },
});

/**
 * LogicMod without UE4SS + BPModLoaderMod.
 *
 * Uses game-level IHealthCheck (`check` + `fix`) so Vortex can show a Fix
 * action. IModHealthCheck cannot carry `fix` in Vortex 2.4.
 * Fix always points at Nexus mortalshell2/mods/5.
 */
export const logicModLoaderCheck: types.IModHealthCheck = {
  id: 'mortalshell2-logicmod-loader',
  name: 'LogicMod loader availability',
  description:
    'LogicMods need a healthy UE4SS runtime with enabled BPModLoaderMod under ue4ss/Mods. ' +
    'Fix downloads the tested UE4SS package from Nexus (mortalshell2/mods/5).',
  category: 'requirements',
  severity: 'warning',
  triggers: ['mods-changed', 'game-changed', 'startup'],
  gameId: GAME_ID,
  check: async (api: types.IExtensionApi, _signal?: AbortSignal) => {
    const discovery = getDiscovery(api);
    if (!discovery?.path) {
      return passResult('mortalshell2-logicmod-loader');
    }
    // Vortex mod-type detection can lag; also trust on-disk LogicMods paks
    // (AutoPickup.pak etc. after a successful logicmods deploy).
    if (!(await logicModsRequireLoader(api))) {
      return passResult('mortalshell2-logicmod-loader');
    }

    const ue4ss = await assessUe4ssRuntime(discovery.path, api);
    const { ok, bp } = await hasLogicModLoader(discovery.path);
    if (ok) {
      return passResult('mortalshell2-logicmod-loader', bp.guidance);
    }

    const ultra =
      ue4ss.ultraPlusDetected || ue4ss.ownership === 'ultra-managed';
    const parts =
      ue4ss.health !== 'healthy'
        ? [logicModsNeedUe4ssGuidance(ue4ss)]
        : [bpModLoaderGuidance(bp, ultra)];

    const canAutoFix =
      ue4ss.health !== 'healthy'
        ? !(
            ue4ss.ultraPlusDetected ||
            ue4ss.ownership === 'ultra-managed' ||
            ue4ss.ownership === 'externally-managed'
          )
        : !(ue4ss.ultraPlusDetected || ue4ss.ownership === 'ultra-managed');

    return failResult(
      'mortalshell2-logicmod-loader',
      parts.join(' '),
      'warning',
      canAutoFix,
    );
  },
  fix: async (api: types.IExtensionApi) => {
    await fixLogicModLoaderStack(api);
  },
};

/** Soft note when healthy external DML is present. */
export const dmlExternalInfoCheck = makeModHealthCheck({
  id: 'mortalshell2-dml-external-info',
  name: 'DML external ownership info',
  description: 'Records externally managed DML without treating it as an error.',
  severity: 'info',
  check: async (api) => {
    const discovery = getDiscovery(api);
    if (!discovery?.path) return { ok: true };
    const assessment = await assessDmlRuntime(discovery.path, api);
    if (assessment.health === 'healthy' && assessment.ownership === 'externally-managed') {
      return { ok: true, message: assessment.message };
    }
    return { ok: true };
  },
});
