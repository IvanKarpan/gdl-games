# Mortal Shell II

Vortex extension for the retail Steam release of Mortal Shell II.

## Supported game layout

- Steam AppID: `2584270`.
- Steam supplies the install directory. The supported layout has `MortalShell2.exe`
  at its root and the game project under `MortalShell2/`.
- The shipping launch target is
  `MortalShell2/Binaries/Win64/MortalShell2-Win64-Shipping.exe`.

## Archive handling

The installer recognizes structural archive shapes, not mod names. It supports:

| Archive family | Destination | Notes |
| --- | --- | --- |
| UE4SS framework and UE4SS mod trees | `MortalShell2/Binaries/Win64` and `ue4ss/Mods` below it | Framework ownership and enabled-profile state are considered for ordinary UE4SS consumers. |
| DmgModLoader (DML) | `MortalShell2/Content/Paks/dml` | LogicMods can use a healthy DML installation or UE4SS's enabled `BPModLoaderMod`. |
| LogicMods | `MortalShell2/Content/Paks/LogicMods` | The extension gives per-mod dependency guidance without altering external runtimes. |
| Ordinary IoStore/PAK payloads | `MortalShell2/Content/Paks/~mods` | `.pak`, `.ucas`, and `.utoc` payloads are deployed as Vortex-managed files. |
| ReShade presets and binary add-ons | `MortalShell2/Binaries/Win64` | Presets can link to ReShade's official downloads when a runtime is missing; Vortex does not install, adopt, or remove ReShade itself. |
| Root/project game trees | The archive's represented game location | Existing Vortex conflict rules decide file conflicts. |

Self-contained archives that bundle UE4SS are installed according to their complete
tree, but receive deliberately minimal treatment. The extension does not merge,
repair, validate, or otherwise arbitrate a bundled runtime against a prior manual
or Vortex-managed UE4SS installation.

Some exact, known shapes are recognized as unsuitable for game-file installation:
standalone external applications, `Engine.ini` payloads, and save payloads. They
are deployed unchanged under the default `~mods` folder and show a practical
installation-instructions warning. A Nexus Mods button is offered only when the
archive has trustworthy Nexus provenance. These payloads remain the mod author's
and user's responsibility.

Unknown archive shapes fail closed. Quarantined or uninspectable archives are not
part of the active corpus and receive no special handling.

## Runtime ownership and dependency guidance

- UE4SS, DML, ReShade, Ultra+, and other manually installed runtimes keep their
  own ownership. Vortex manages only files it deploys.
- Dependency notifications are scoped to enabled consumers in the active profile;
  resolving, disabling, or removing a consumer reconciles obsolete warnings.
- Managing a blank game creates only the ordinary `~mods` directory. Optional
  UE4SS, DML, and LogicMods directories appear only when deployed content needs
  them.

## Developer verification

From the repository root:

```bash
pnpm --dir gdl test
pnpm --dir gdl typecheck
NX_ISOLATE_PLUGINS=false NX_SKIP_NX_CACHE=true ./node_modules/.bin/nx run mortalshell2:build
NX_ISOLATE_PLUGINS=false NX_SKIP_NX_CACHE=true ./node_modules/.bin/nx run mortalshell2:test
NX_ISOLATE_PLUGINS=false NX_SKIP_NX_CACHE=true ./node_modules/.bin/nx run mortalshell2:test-corpus
NX_ISOLATE_PLUGINS=false NX_SKIP_NX_CACHE=true ./node_modules/.bin/nx run mortalshell2:package
node tools/audit-docs.mjs
```

## Release decision

**GO** — Package 05 retail release-candidate validation passed on 2026-08-17 for
retail build `24772279`, Vortex `2.5.0`, and extension `0.1.5`
(`7feadff2908def0d0124e8a424bccbd2d5d64317`). The validated artifact is
`games/mortalshell2/out/mortalshell2-vortex-v0.1.5.zip`; its SHA-256 is a
build-instance value and is recorded with the release handoff rather than here.

Automated verification: 253 GDL tests, 37 generated extension tests, and 20/20
matched Nexus corpus records, plus packaging and the documentation audit. Manual
Vortex validation covered blank-game management, hardlink and symlink deployment,
deploy/redeploy/purge/uninstall lifecycle, ordinary PAKs, UE4SS and DML/LogicMod
dependencies, self-contained UE4SS bundles, ReShade presets and add-ons, and
recognized unsupported archive shapes. Representative in-game checks confirmed
UE4SS, DML, BPModLoader, cheat-menu, and ReShade-preset behavior. Mod-specific
runtime incompatibilities and external-tool behavior are outside extension scope.

## Current limitations

- Dependency health checks remain post-deploy notifications while GDL's generated
  lifecycle test fake lacks `registerHealthCheck` support.
- The extension does not install or configure external applications, user-config
  locations, save locations, ReShade runtimes, or arbitrary `Engine.ini` files.
