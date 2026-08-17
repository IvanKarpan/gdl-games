# Mortal Shell II Compatibility and Release-Candidate Evidence

## Retail Contract

Package 05 targets the retail Steam release of Mortal Shell II. The Steam AppID is `2584270`. On `2026-08-17`, the installed Steam manifest recorded build ID `24772279`, depot `2584271`, installed state `StateFlags 4`, and the observed install leaf `Sparta`. The leaf is recorded here as observed evidence only; Steam metadata supplies the install path and source configuration does not hardcode it.

The retail install retains the internal `MortalShell2` folder. Required executables are `MortalShell2.exe` at the install root and `MortalShell2/Binaries/Win64/MortalShell2-Win64-Shipping.exe`; the latter is the shipping launch target. The observed retail Paks directory is `MortalShell2/Content/Paks` (26 top-level files at validation).

## Current Catalogue Inventory

Scope status: approved and locked for Package 05 on 2026-08-17.

The published accounting source is the 21 current selected Nexus identities plus two material optional variants. Nexus game `9366`/`mortalshell2` reported a headline of 19 mods while the paginated published catalogue enumerated 21 IDs; the enumerated set is used here: `2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23`.

| Mod/file | Description | Archive type | Intended handling | Readiness | Scope | Evidence | Reason |
|---|---|---|---|---|---|---|---|
| 2/11 | No-HUD-No-Effects current main | ZIP | Root game-tree UE4SS mod | ready | in | Exact local archive; 6 listed entries; corpus root match | Current main is structurally covered by the game-root rule. |
| 3/2 | Auto Gold Pickup mod-only current main | ZIP | UE4SS mod under ue4ss/Mods | ready | in | Exact local archive; 4 listed entries; corpus root match | Main requires an existing UE4SS runtime and its current structure is covered. |
| 3/3 | Auto Gold Pickup optional all-in-one | ZIP | Opaque self-contained UE4SS complete tree | ready | in | Downloaded optional archive; 9 listed entries; SHA-256 `76d3f4f169108b6f026b29a9588308699582905b5deb78365b8b49b7b0967d92` | Complete tree installs correctly, but Package 05 provides no runtime health, ownership, merge, repair, conflict, or consistency assistance. |
| 4/5 | DML - DmgModLoader current main | ZIP | Content/Paks/dml framework | ready | in | Exact local archive; 6 listed entries; corpus dml-framework-rooted match | Current DML triplet is covered as a managed framework. |
| 5/6 | UE4SS for MortalShell2 current main | ZIP | Binaries/Win64 UE4SS framework | ready | in | Exact local archive; 20 listed entries; corpus ue4ss-framework match | Current framework runtime is covered and establishes managed ownership. |
| 6/7 | AutoPickup current main | ZIP | Content/Paks/LogicMods named mod | ready | in | Exact local archive; 3 listed entries; corpus logicmods-root-triplet match | Current LogicMod triplet is structurally covered with DML/BPModLoader dependency expectations. |
| 7/19 | Health and Resolve Numbers all-in-one current main | ZIP | Opaque self-contained UE4SS complete tree | ready | in | Fallback-downloaded archive; 9 listed entries; corpus root match | Latest of two active MAIN files; complete tree installs correctly without Package 05 runtime assistance. |
| 8/12 | Controller remapping for Mortal Shell 2 current main | RAR | Recognize strong signature; unchanged archive tree to default ~mods; non-blocking once-per-stable-mod warning | needs correction | in | Exact local archive; 92 listed entries; corpus intentionally unmatched | Task 4 must add recognition/warning only; payload functionality remains unsupported. |
| 9/13 | Vibrant Reshade current main | 7z | Binaries/Win64 ReShade preset | ready | in | Exact local archive; 2 listed entries; corpus reshade-preset match | Preset-only structure is covered; ReShade runtime remains externally installed. |
| 10/14 | FOV / ultrawide HUD current main | 7z | Binaries/Win64 RHI/ReShade-family add-on | ready | in | Existing local cache evidence; 10 listed entries; corpus binaries-addon match | Current binary/addon tree is structurally covered. |
| 11/17 | DarkSky current active update | ZIP | Root game tree UE4SS mod | ready | in | Exact local archive; 6 listed entries; corpus root match | No MAIN category exists; latest active UPDATE is the selected current active file and is covered. |
| 12/16 | Mortal Shell II Demo Trainer current main | ZIP | Excluded from active corpus and all handling | ready | out | Nexus direct-download fallback returned 403 quarantined; no listing | Quarantined and uninspectable; excluded from active corpus and all handling. |
| 13/20 | Cleaner Sharper Visuals current main | ZIP | Recognize strong signature; unchanged archive tree to default ~mods; non-blocking once-per-stable-mod warning | needs correction | in | Exact local archive; sole listed entry Engine.ini; corpus unmatched | Task 4 must add recognition/warning only; payload functionality remains unsupported. |
| 14/22 | Fast Travel Anywhere mod-only current main | ZIP | Root game-tree UE4SS mod | ready | in | Exact local archive; 5 listed entries; corpus root match | Latest active MAIN mod-only package is structurally covered. |
| 15/24 | Custom Parry and Guard Windows mod-only current main | ZIP | Root game-tree UE4SS mod | ready | in | Exact local archive; 4 listed entries; corpus root match | Latest active MAIN mod-only package is structurally covered. |
| 17/25 | Disable depth of field current main | RAR | Recognize strong signature; unchanged archive tree to default ~mods; non-blocking once-per-stable-mod warning | needs correction | in | Exact local archive; sole listed entry Engine.ini; corpus unmatched | Task 4 must add recognition/warning only; payload functionality remains unsupported. |
| 18/26 | No Fall Damage current main | ZIP | Content/Paks/~mods asset pak | ready | in | Exact local archive; 3 listed entries; corpus pak match | Current IoStore asset payload is structurally covered. |
| 19/27 | No Status Effect Stacks current main | ZIP | Content/Paks/~mods asset pak | ready | in | Exact local archive; 3 listed entries; corpus pak match | Current IoStore asset payload is structurally covered. |
| 20/28 | UE4SS Cheat Menu all-in-one current main | ZIP | Opaque self-contained UE4SS complete tree | ready | in | Fallback-downloaded archive; 24 listed entries; corpus ue4ss-framework match | Complete tree installs correctly, but Package 05 provides no runtime health, ownership, merge, repair, conflict, or consistency assistance. |
| 20/29 | UE4SS Cheat Menu optional mod-only | ZIP | Complete MortalShell2Mod plus sibling shared/ tree under ue4ss/Mods with normal UE4SS-mod servicing | needs correction | in | Downloaded optional archive; 5 listed entries; SHA-256 `fd78a62fcd37904f7427b28610021a8537815f4bf786e04bfb3430de29f013a8` | Task 4 must add an explicit complete-tree rule; it requires an existing UE4SS runtime and then receives normal UE4SS-mod servicing. |
| 21/30 | Ultrawide Fix current main | 7z | Opaque self-contained UE4SS complete tree | ready | in | Fallback-downloaded archive; 15 listed entries; corpus ue4ss-framework match | Complete tree installs correctly, but Package 05 provides no runtime health, ownership, merge, repair, conflict, or consistency assistance. |
| 22/31 | Better Dash current main | ZIP | Content/Paks/~mods asset pak | ready | in | Fallback-downloaded archive; 3 listed entries; corpus pak match | Current IoStore asset payload is structurally covered. |
| 23/32 | Ultimate Starter Save current main | ZIP | Recognize strong signature; unchanged archive tree to default ~mods; non-blocking once-per-stable-mod warning | needs correction | in | Fallback-downloaded archive; sole listed entry SaveGames/WorldState_0.sav; corpus unmatched | Task 4 must add recognition/warning only; payload functionality remains unsupported. |

Corpus totals: 23 accounted rows: 17 ready/in rows; 5 needs correction/in rows (`8/12`, `13/20`, `17/25`, `20/29`, `23/32`); 1 ready/out row (`12/16`); and 0 decision-required rows. The active current corpus replay recorded 16 matched, 4 unmatched, 0 failed, 20 total; `12/16` is unavailable/quarantined rather than an omitted corpus entry.

## Supported Structural Variations

- **Normal serviced root game-tree UE4SS payload (`root`)** — representative `3/2` Auto Gold Pickup; destination `${installPath}`; modType `mortalshell2-root`; dependency family: existing UE4SS runtime; lifecycle expectation: normal UE4SS-mod dependency/ownership guidance applies. Equivalent ready payloads: `2/11`, `11/17`, `14/22`, and `15/24`.
- **Normal serviced UE4SS framework (`ue4ss-framework`)** — representative `5/6` UE4SS for MortalShell2; destination `${win64Path}` (`MortalShell2/Binaries/Win64`); modType `mortalshell2-ue4ss-framework`; dependency family: managed UE4SS runtime, including BPModLoaderMod; lifecycle expectation: establishes Vortex-managed runtime ownership and supports consumers after deploy/redeploy.
- **DmgModLoader framework (`dml-framework-rooted`)** — representative `4/5` DML - DmgModLoader; destination `${paksPath}` (`MortalShell2/Content/Paks`) from its rooted `dml/` tree; modType `mortalshell2-dml-tree`; dependency family: DML; lifecycle expectation: managed DML triplet supports LogicMods and is removed by purge when Vortex owns it. No other current in-scope row is equivalent.
- **Bare AutoPickup LogicMod triplet (`logicmods-root-triplet`)** — representative `6/7` AutoPickup; destination `${logicModsPath}` (`MortalShell2/Content/Paks/LogicMods`); modType `mortalshell2-logicmods`; dependency family: healthy DML or enabled UE4SS BPModLoaderMod; lifecycle expectation: deploy only after dependency guidance is reconciled, then verify the documented pickup effect. No other current in-scope row is equivalent.
- **ReShade preset (`reshade-preset`)** — representative `9/13` Vibrant Reshade; destination `${win64Path}`; modType `mortalshell2-reshade-preset`; dependency family: externally installed ReShade runtime; lifecycle expectation: Vortex owns only the preset and never claims ownership of an externally installed runtime. No other current in-scope row is equivalent.
- **RHI/ReShade-family binaries add-on (`binaries-addon`)** — representative `10/14` FOV / ultrawide HUD; destination `${win64Path}`; modType `mortalshell2-binaries`; dependency family: binary add-on / RHI-ReShade family; lifecycle expectation: deploy as a managed Win64 add-on and inspect conflicts with external runtime files before launch. No other current in-scope row is equivalent.
- **IoStore asset PAK (`pak`)** — representative `18/26` No Fall Damage; destination `${pakModsPath}` (`MortalShell2/Content/Paks/~mods`); modType `mortalshell2-pak`; dependency family: none; lifecycle expectation: deploy the `.pak`/`.ucas`/`.utoc` triplet as managed files and remove it by purge. Equivalent ready payloads: `19/27` and `22/31`.
- **Opaque self-contained UE4SS complete tree (`root` or `ue4ss-framework`)** — representative `7/19` Health and Resolve Numbers; installer ID `root`; destination `${installPath}`; modType `mortalshell2-root`; dependency family: self-contained UE4SS. Equivalent opaque package `3/3` uses installer ID `root`, destination `${installPath}`, and modType `mortalshell2-root`; `20/28` and `21/30` use installer ID `ue4ss-framework`, destination `${win64Path}`, and modType `mortalshell2-ue4ss-framework`. Lifecycle expectation: complete trees install correctly, but consistency and ownership servicing is bypassed: Package 05 provides no runtime health, ownership, merge, repair, conflict, or consistency assistance, and Vortex rules plus interactions with prior manual UE4SS are the user's responsibility. Task 4 locks this bypass behavior and corrects it only if tests reproduce a gap.
- **UE4SS mod with sibling shared tree (correction required)** — representative `20/29` UE4SS Cheat Menu optional mod-only; installer ID `ue4ss-mod-shared`; destination `${ue4ssModsPath}` (`MortalShell2/Binaries/Win64/ue4ss/Mods`); modType `mortalshell2-ue4ss-mod`; dependency family: existing UE4SS runtime plus shared ModMenu dependency; lifecycle expectation: the installer preserves the complete archive root so both `MortalShell2Mod/` and sibling `shared/` land under `ue4ss/Mods`, then receive normal UE4SS-mod servicing.
- **Recognized-but-unsupported strong signatures (correction required)** — representative `13/20` Cleaner Sharper Visuals uses installer ID `unsupported-engine-ini`; equivalent `17/25` uses `unsupported-engine-ini`, `8/12` uses `unsupported-external-app`, and `23/32` uses `unsupported-save`; all have destination `${pakModsPath}` (`MortalShell2/Content/Paks/~mods`) with unchanged archive tree and modType `mortalshell2-unsupported`. Dependency family: none; lifecycle expectation: emit a non-blocking once-per-stable-mod warning to read the author's instructions. Payload functionality, relocation, dependency, correctness, and lifecycle servicing remain unsupported.

`12/16` has no deploy representative: it is quarantined and uninspectable, so it remains excluded from active corpus and all handling. Unknown archives remain fail-closed; Package 05 adds no broad catch-all.

## Manual Vortex and Gameplay Procedure

The user operates Vortex and the game. Vortex purge restores a clean managed state; no separate full-install backup is required.

1. Confirm Vortex discovers `D:\SteamLibrary\steamapps\common\Sparta` through Steam metadata.
2. Install/update Package 05 RC extension ZIP.
3. Install an approved representative archive: `3/2` (normal serviced root UE4SS consumer), `5/6` (managed UE4SS framework), `4/5` (DML), `6/7` (LogicMod), `9/13` (ReShade preset), `10/14` (binaries add-on), `18/26` (PAK), `7/19` (opaque `root` / `mortalshell2-root`), `20/29` (`ue4ss-mod-shared` / `mortalshell2-ue4ss-mod`), `13/20` (`unsupported-engine-ini` / `mortalshell2-unsupported`), `8/12` (`unsupported-external-app` / `mortalshell2-unsupported`), or `23/32` (`unsupported-save` / `mortalshell2-unsupported`).
4. Confirm installer/mod type and destination, including `${ue4ssModsPath}` for `ue4ss-mod-shared` and `${pakModsPath}` for all `unsupported-*` installers.
5. Deploy.
6. Inspect deployed files and dependency/ownership UX.
7. Redeploy; verify idempotence and notification reconciliation.
8. Add/remove/enable/disable selected external or Vortex framework state when required.
9. Launch through `MortalShell2/Binaries/Win64/MortalShell2-Win64-Shipping.exe`.
10. Verify author-documented gameplay effect.
11. Purge; verify managed files removed and external ownership preserved.
12. Uninstall test mod when applicable.
13. Record `pass`, `fail`, or `blocked` with short observation.

Use normal serviced representatives (`3/2`, `5/6`, `4/5`, `6/7`, `9/13`, `10/14`, `18/26`) for full dependency/ownership/gameplay checks. Record opaque-package (`7/19`, plus `3/3`, `20/28`, `21/30`) installation as complete-tree behavior only; Package 05 provides no runtime assistance. For recognized-but-unsupported shapes (`8/12`, `13/20`, `17/25`, `23/32`), verify only exact recognition, unchanged default `~mods` archive-tree deployment, and the once-per-stable-mod warning; payload functionality remains unsupported. Do not create a case, installer, or tailored warning for `12/16`.

## Release-Candidate Results

No Package 05 release-candidate session has been recorded; release gate remains open.

| Validation date | Retail build ID | Extension version/commit | Vortex version | Representative mod/file | Structural class | Expected | Observed | Result |
|---|---|---|---|---|---|---|---|---|

## Known Limitations

- `diagnostics:` remains disabled because GDL's generated lifecycle fake does not implement `registerHealthCheck`. `modFrameworkDependencyCheck` remains implemented but unregistered. Active per-mod dependency guidance continues through the accepted post-deploy notification path. This is not a Package 05 release blocker.

Extension limitations:

- `20/29` remains needs correction until Task 4 implements the complete-tree rule under `ue4ss/Mods`; after that it receives normal UE4SS-mod servicing.
- `8/12`, `13/20`, `17/25`, and `23/32` remain needs correction until Task 4 adds exact strong-signature recognition and a non-blocking once-per-stable-mod warning. Their unchanged default `~mods` deployment does not support payload functionality, relocation, dependency, correctness, or lifecycle behavior.
- Opaque self-contained UE4SS packages `3/3`, `7/19`, `20/28`, and `21/30` install their complete trees but receive no Package 05 runtime health, ownership, merge, repair, conflict, or consistency assistance; user-managed Vortex rules and interactions with prior manual UE4SS are the user's responsibility.
- The results ledger is empty, so the release gate remains open until a user-operated RC session is recorded.

Mod/game behavior and out-of-scope limitations:

- `9/13` is preset-only; its ReShade runtime is externally installed and must remain externally owned.
- `12/16` is quarantined and uninspectable: Nexus direct-download fallback returned `403`, so it is excluded from active corpus and all handling until inspectable. It has no archive case, installer, or tailored warning.
- Unknown archives remain fail-closed; Package 05 intentionally adds no broad catch-all.
