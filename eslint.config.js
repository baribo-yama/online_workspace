import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'server', 'test-websocket-server.js']),
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
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]|^motion$|^AnimatePresence$|^Form$|^Field$|^enableCameraAndMicrophone$|^disconnectFromRoom$' }],
    },
  },
  // Node/CommonJS files (Firebase Functions)
  {
    files: ['functions/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script', // CommonJS
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      // Keep default recommended rules; override only what differs from browser
    },
  },
])
