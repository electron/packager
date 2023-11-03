const eslintConfig = {
  extends: [
    'eslint:recommended',
    'plugin:ava/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:promise/recommended',
    'standard',
  ],
  parserOptions: {
    sourceType: 'script',
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
  },
};

eslintConfig.parser = '@typescript-eslint/parser';
eslintConfig.parserOptions.sourceType = 'module';
eslintConfig.extends.push(
  'plugin:@typescript-eslint/eslint-recommended',
  'plugin:@typescript-eslint/recommended',
  'plugin:import/typescript',
);

eslintConfig.rules['comma-dangle'] = ['error', 'only-multiline'];
eslintConfig.rules.semi = ['error', 'always'];
eslintConfig.rules['space-before-function-paren'] = ['error', 'never'];

module.exports = eslintConfig;
