import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // ── Ignored paths ──────────────────────────────────────────────────────────
  {
    ignores: ['.output/**', '.wxt/**', 'node_modules/**', '*.config.ts', 'commitlint.config.ts'],
  },

  // ── Base JS recommended ────────────────────────────────────────────────────
  eslint.configs.recommended,

  // ── TypeScript strict ──────────────────────────────────────────────────────
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // ── Global browser/extension env ──────────────────────────────────────────
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── Project rules ──────────────────────────────────────────────────────────
  {
    rules: {
      // Allow intentionally unused vars prefixed with _
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // WXT define* helpers are injected globals — allow them
      '@typescript-eslint/no-unsafe-call': 'off',
      // Allow void return in event listeners
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false, attributes: false } },
      ],
      // Prefer explicit return types on exported functions
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true, allowHigherOrderFunctions: true },
      ],
      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ── Prettier last (disables conflicting formatting rules) ──────────────────
  eslintConfigPrettier,
);
