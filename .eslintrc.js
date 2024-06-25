'use strict'
const eslintConfig = {
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    "ecmaVersion": "latest"
  },
  env: {
    "es6": true,
    "node": true
  },
  plugins: [
    'ava'
  ],
  rules: {
    'ava/no-import-test-files': 0,
    'ava/no-ignored-test-files': 0,
    indent: [
      'error',
      2,
      {
        CallExpression: {
          arguments: 'first'
        },
        SwitchCase: 1
      }
    ],
    'no-console': 0,
    strict: 'error',
    'comma-dangle': ['error', 'never'],
    semi: ['error', 'never'],
    'space-before-function-paren': ['error', 'always']
  },
  overrides: [
    {
      files: ["**/*.ts"],
      extends: [
        'eslint:recommended',
        'plugin:ava/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:promise/recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/typescript'
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        sourceType: 'module'
      },
      rules: {
        'comma-dangle': ['error', 'always-multiline'],
        semi: ['error', 'always'],
        'space-before-function-paren': ['error', {
          "anonymous": "never",
          "named": "never",
          "asyncArrow": "always"
        }]
      }
    }
  ]
}

module.exports = eslintConfig
