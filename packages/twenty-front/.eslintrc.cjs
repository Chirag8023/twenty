const folderStructureConfig = require('./project-structure.cjs');
module.exports = {
  extends: ['../../.eslintrc.cjs', '../../.eslintrc.react.cjs'],
  ignorePatterns: [
    '!**/*',
    'node_modules',
    'mockServiceWorker.js',
    '**/generated*/*',
    '**/generated/standard-metadata-query-result.ts',
    'tsup.config.ts',
    'build',
    'coverage',
    'storybook-static',
    '**/*config.js',
    'codegen*',
    'tsup.ui.index.tsx',
    '__mocks__',
  ],
  plugins: ['project-structure'],
  rules: {
    'project-structure/folder-structure': ['warn', folderStructureConfig],
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parserOptions: {
        project: ['packages/twenty-front/tsconfig.{json,*.json}'],
      },
      rules: {},
    },
  ],
};
