// @ts-check
/**
 * ARQUIVO: eslint.config.js
 * PROPÓSITO: configuração flat do ESLint (v9) para o projeto inteiro.
 * CONCEITOS DEMONSTRADOS: ESLint flat config, ESM, regras de qualidade.
 * USADO EM: npm run lint
 * COMPLEXIDADE/OBSERVAÇÕES: define globals de navegador e Node manualmente,
 *   sem pacote extra `globals`, para manter as devDependencies mínimas.
 */
import js from '@eslint/js';

/** Globals clássicos usados em navegador (demos, components) e Node (tests). */
const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  queueMicrotask: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  requestIdleCallback: 'readonly',
  cancelIdleCallback: 'readonly',
  fetch: 'readonly',
  AbortController: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  EventTarget: 'readonly',
  HTMLElement: 'readonly',
  HTMLAnchorElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLFormElement: 'readonly',
  HTMLTemplateElement: 'readonly',
  HTMLDivElement: 'readonly',
  HTMLButtonElement: 'readonly',
  HTMLSelectElement: 'readonly',
  HTMLTextAreaElement: 'readonly',
  customElements: 'readonly',
  ShadowRoot: 'readonly',
  Node: 'readonly',
  Element: 'readonly',
  MutationObserver: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',
  Worker: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  structuredClone: 'readonly',
  performance: 'readonly',
  matchMedia: 'readonly',
  getComputedStyle: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  crypto: 'readonly',
  TextEncoder: 'readonly',
  DOMException: 'readonly',
  BroadcastChannel: 'readonly',
};

/** Globals usados nos testes e scripts Node. */
const nodeGlobals = {
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
};

export default [
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    rules: {
      // Regras de qualidade do projeto
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-implicit-globals': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    // Testes e configurações podem usar console livremente
    files: ['tests/**/*.js', '*.config.js', 'eslint.config.js'],
    rules: {
      'no-console': 'off',
    },
  },
];
