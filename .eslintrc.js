const eslintConfig = {
  extends: [
    'eslint:recommended',
    'plugin:ava/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:promise/recommended',
    'standard',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/typescript',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
  },
  plugins: [
    'ava',
  ],
  rules: {
    'ava/no-import-test-files': 0,
    'ava/no-ignored-test-files': 0,
    indent: [
      'error',
      2,
      {
        CallExpression: {
          arguments: 'first',
        },
        SwitchCase: 1,
      },
    ],
    'no-console': 0,
    strict: 'error',
    'comma-dangle': ['error', 'only-multiline'],
    semi: ['error', 'always'],
    'space-before-function-paren': ['error', 'never']
  },
};

module.exports = eslintConfig;
