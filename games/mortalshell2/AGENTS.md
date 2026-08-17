# Mortal Shell II maintainer guidance

This file applies to `games/mortalshell2/**` only. It is discovered as a nested
`AGENTS.md` instruction file, so guidance here supplements repository-level
instructions only while working in this game directory.

- Treat `game.yaml` as the declarative source. Generated files and `dist/`,
  `.gdl-out/`, and `out/` are build outputs, not hand-edited sources.
- Support retail Steam AppID `2584270` only. Steam discovery identifies the install
  root; the game itself keeps its internal `Sparta/MortalShell2` layout and the
  shipping executable under `MortalShell2/Binaries/Win64`.
- Optional UE4SS, DML, and LogicMods mod types stay rooted at shipped Win64/Paks
  ancestors. Their narrow custom installer hooks add the optional child path to
  each copy destination. Managing a blank game must not scaffold optional runtime
  directories; only the default `~mods` root may be created.
- Keep custom installer placement and the complete 20-record static attribution
  check in `src/installers.test.ts`. Base GDL's generated static planner cannot
  execute install hooks, while corpus execution replay exercises the real bundle.
- `project.json` intentionally overrides only this game's inferred Nx test target
  so the normal target runs both generated and `src/**/*.test.ts` suites through
  the local Vitest config. Preserve the other inferred targets.
- Preserve installer precedence, exact strong signatures, and fail-closed behavior.
  Do not broaden a known signature into a catch-all based on a weak filename.
- Preserve runtime ownership and active-profile/deployment provenance. Never adopt,
  repair, overwrite, or remove external/manual runtime files.
- Self-contained UE4SS bundles receive minimal structural handling only. Do not add
  merge, repair, conflict-resolution, or consistency policy for them.
- Exact unsupported `Engine.ini`, external-app, and save shapes deploy unchanged to
  default `~mods` with stable practical warnings. Offer a Nexus action only with
  trustworthy Nexus provenance.
- Keep quarantined or uninspectable archives outside the active corpus.
- Before handoff, run the Mortal Shell II build, generated tests, corpus replay,
  package, and documentation audit listed in `README.md`. Do not commit caches,
  downloaded archives, generated evidence, or packaging outputs.
