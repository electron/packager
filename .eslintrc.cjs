'use strict';
const eslintConfig = {
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  env: {
    es6: true,
    node: true,
  },
  rules: {
    'no-console': 0,
    strict: 'error',
    // 'import/enforce-node-protocol-usage': ['error', 'always'],
  },
  overrides: [
    {
      files: ['**/*.ts'],
      extends: [
        'eslint:recommended',
        'plugin:promise/recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/typescript',
        'prettier',
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        sourceType: 'module',
      },
    },
  ],
};

module.exports = eslintConfig;
