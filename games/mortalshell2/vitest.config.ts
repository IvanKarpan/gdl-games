import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const workspaceRoot = resolve(import.meta.dirname, '../..');
const runtime = resolve(workspaceRoot, 'gdl/src/runtime/index.ts');
const runtimeTesting = resolve(workspaceRoot, 'gdl/src/runtime/testing/index.ts');
const vortexApiMock = resolve(
  workspaceRoot,
  'gdl/src/runtime/testing/vortex-api-mock.ts',
);

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: [
      '.gdl-out/{tests,templates,lifecycle}.gen.ts',
      'src/**/*.test.ts',
    ],
    passWithNoTests: true,
    alias: [
      { find: '@gdl/runtime/testing', replacement: runtimeTesting },
      { find: '@gdl/runtime', replacement: runtime },
      { find: /^\.\.\/gdl\/src\/runtime\/index\.js$/, replacement: runtime },
      { find: 'vortex-api', replacement: vortexApiMock },
    ],
  },
});
