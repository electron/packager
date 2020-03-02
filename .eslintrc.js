module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:ava/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:promise/recommended',
    'standard'
  ],
  parserOptions: {
    sourceType: 'script'
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
        'CallExpression': {
          'arguments': 'first'
        },
        'SwitchCase': 1
      }
    ],
    'no-console': 0,
    strict: 'error'
  }
}
