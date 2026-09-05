import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.agents']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // TypeScript: mismo set que JS más las reglas recomendadas de typescript-eslint
    // (sin type-checking, para que `make lint` siga siendo rápido).
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' },
      ],
      // Deuda visible, no bloqueante: `any` en catch/handlers heredados. Bajar a 'error'
      // cuando el conteo llegue a cero (`npx eslint . | grep no-explicit-any`).
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Primitivas shadcn exportan sus `*Variants` (cva) junto al componente, y los helpers de
    // test re-exportan Testing Library: fast refresh no aplica a ninguno de los dos.
    files: ['src/components/ui/**/*.{ts,tsx}', 'src/test/**/*.{ts,tsx}', 'src/**/__tests__/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
