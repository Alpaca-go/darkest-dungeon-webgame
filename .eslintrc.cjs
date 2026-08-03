module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: '18.3' },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'no-unused-vars': 'off',
    'no-empty': 'off',
    'no-useless-escape': 'off',
    'no-control-regex': 'off',
  },
  overrides: [
    {
      // 纯 TS 模块(非 React 组件)不应被 react-hooks 规则干扰
      // 我们的 useSkill / useHero / useRng 等是普通函数,不是 React hooks
      files: ['src/game-engine/**/*.ts', 'src/content/**/*.ts', 'tests/**/*.ts', 'scripts/**/*.ts'],
      rules: {
        'react-hooks/rules-of-hooks': 'off',
      },
    },
    {
      files: ['*.ts'],
      excludedFiles: ['*.tsx'],
      rules: {
        'react/react-in-jsx-scope': 'off',
      },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', '*.cjs', 'vite.config.ts', 'vitest.config.ts', 'scripts/simulate-battles.ts', 'docs'],
};
