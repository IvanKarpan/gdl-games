// Nx inference plugin ("Project Crystal"): every games/<id>/game.yaml becomes an
// Nx project whose build/test/package/test-corpus targets drive the shared gdl CLI.
// No per-game config files are needed — a game stays just game.yaml + gameart.webp.
// Optional escape hatch: games/<id>/build.mjs replaces the default build/package
// commands (e.g. post-emit patches GDL cannot express yet). Caching inputs/outputs
// live in nx.json `targetDefaults`.
const { dirname, basename, join } = require('node:path');
const { existsSync } = require('node:fs');

exports.createNodesV2 = [
  'games/*/game.yaml',
  async (configFiles) =>
    configFiles.map((configFile) => {
      const root = dirname(configFile); // e.g. "games/solarpunk"
      const name = basename(root); //       e.g. "solarpunk"
      const hasCustomBuild = existsSync(join(root, 'build.mjs'));
      const buildCmd = hasCustomBuild
        ? 'node ./build.mjs'
        : 'node ../../gdl/dist/cli.js build';
      const packageCmd = hasCustomBuild
        ? 'node ./build.mjs --package'
        : 'node ../../gdl/dist/cli.js package';
      return [
        configFile,
        {
          projects: {
            [root]: {
              name,
              root,
              projectType: 'application',
              targets: {
                // Build/package run from inside the game folder.
                build: {
                  executor: 'nx:run-commands',
                  options: { command: buildCmd, cwd: root },
                },
                package: {
                  executor: 'nx:run-commands',
                  options: { command: packageCmd, cwd: root },
                },
                // Tests run from the workspace root so vitest picks up the root
                // vitest.config.ts (runtime aliases). Include optional
                // games/<id>/src/**/*.test.ts (harmless when absent —
                // passWithNoTests + include globs).
                test: {
                  executor: 'nx:run-commands',
                  options: {
                    command: `vitest run ${root}/.gdl-out ${root}/src`,
                  },
                },
                'test-corpus': {
                  executor: 'nx:run-commands',
                  options: { command: 'node ../../gdl/dist/cli.js test:corpus', cwd: root },
                },
              },
            },
          },
        },
      ];
    }),
];
