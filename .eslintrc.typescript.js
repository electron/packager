const eslintConfig = require('./.eslintrc')
eslintConfig.parser = '@typescript-eslint/parser'
eslintConfig.parserOptions.sourceType = 'module'
eslintConfig.extends.push(
  'plugin:@typescript-eslint/eslint-recommended',
  'plugin:@typescript-eslint/recommended'
)

eslintConfig.rules['comma-dangle'] = ['error', 'only-multiline']
eslintConfig.rules.semi = ['error', 'always']
eslintConfig.rules['space-before-function-paren'] = ['error', 'never']

module.exports = eslintConfig
