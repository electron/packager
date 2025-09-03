const eslintConfig = {
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  env: {
    es6: true,
    node: true,
  },
  rules: {
    'no-console': 0,
    strict: 'error',
  },
  overrides: [
    {
      files: ['**/*.ts'],
      extends: [
        'eslint:recommended',
        'plugin:promise/recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/warnings',
        'plugin:import/typescript',
        'prettier',
      ],
      parser: '@typescript-eslint/parser',
    },
  ],
};

module.exports = eslintConfig;
