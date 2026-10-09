import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'docs', 'release', 'bench-results', 'app/main/generated'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['app/main/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Node scripts (release tooling)
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly' },
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      // Blueprint rule: all game randomness goes through the seeded RNG.
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in src/engine/rng.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Engine must be deterministic.' },
      ],
    },
  },
);
