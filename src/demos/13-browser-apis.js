// @ts-check
/**
 * ARQUIVO: 13-browser-apis.js
 * PROPÓSITO: expor APIs do navegador que quase todo site deveria usar —
 *   Clipboard, matchMedia reativo, Page Visibility/online e crypto.randomUUID.
 * CONCEITOS DEMONSTRADOS: Clipboard API, MediaQueryList/change, visibilitychange,
 *   online/offline, crypto.randomUUID, feature detection com fallback.
 * USADO EM: seção 13 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: tudo degrada graciosamente quando a API não existe
 *   (contexto inseguro, navegador antigo); o cleanup remove TODOS os listeners
 *   criados com on() — inclusive os de document/window, que não morrem sozinhos.
 */
import { h, on } from '../core/dom.js';

/**
 * Inicializa a demo de APIs do navegador.
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — remove listeners de document/window
 * @example
 * const cleanup = init(document.querySelector('#demo13'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  const remocoes = [];

  // ── 1. Clipboard API ────────────────────────────────────────────────────────
  const saidaClipboard = h('output', { 'aria-live': 'polite' });
  // Feature detection: em contexto inseguro (http://) a API pode nem existir
  const podeCopiar = typeof navigator.clipboard?.writeText === 'function';
  const podeLer = typeof navigator.clipboard?.readText === 'function';

  /**
   * Copia um texto fixo para a área de transferência.
   * O que é: Clipboard API com fluxo de permissão do navegador; por que usei
   * aqui: substitui o `document.execCommand('copy')` deprecado.
   *
   * @returns {Promise<void>} resolve após copiar (ou grava o erro na saída)
   */
  async function copiar() {
    if (!podeCopiar) {
      saidaClipboard.textContent = 'Clipboard API indisponível (requer HTTPS ou localhost).';
      return;
    }
    try {
      await navigator.clipboard.writeText(
        'Copiado pela Clipboard API — Perfect JavaScript Example ✔',
      );
      saidaClipboard.textContent = '✔ texto copiado para a área de transferência.';
    } catch (erro) {
      saidaClipboard.textContent = `✖ falha ao copiar: ${erro instanceof Error ? erro.message : erro}`;
    }
  }

  /**
   * Lê o texto atual da área de transferência (pode pedir permissão).
   *
   * @returns {Promise<void>} resolve após ler (ou grava o erro na saída)
   */
  async function lerAreaDeTransferencia() {
    if (!podeLer) {
      saidaClipboard.textContent = 'Leitura da área de transferência indisponível aqui.';
      return;
    }
    try {
      const texto = await navigator.clipboard.readText();
      saidaClipboard.textContent = texto
        ? `✔ lido: ${texto.slice(0, 80)}${texto.length > 80 ? '…' : ''}`
        : 'área de transferência vazia.';
    } catch (erro) {
      saidaClipboard.textContent = `✖ permissão negada/erro: ${erro instanceof Error ? erro.message : erro}`;
    }
  }

  const painelClipboard = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Clipboard API' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', { type: 'button', text: 'Copiar texto', on: { click: () => void copiar() } }),
      h('button', {
        type: 'button',
        text: 'Ler da área de transferência',
        on: { click: () => void lerAreaDeTransferencia() },
      }),
      saidaClipboard,
    ),
    h('p', {
      class: 'nota',
      text: 'Funciona em HTTPS/localhost; o navegador pode pedir permissão antes de ler.',
    }),
  );

  // ── 2. matchMedia: estado reativo do sistema ────────────────────────────────
  const saidaMedia = h('output', { 'aria-live': 'polite' });
  // Feature detection: MediaQueryList só existe em navegadores com suporte
  const temMatchMedia = typeof window.matchMedia === 'function';
  // O que é: MediaQueryList observa uma query CSS e notifica mudanças do SO;
  // por que usei aqui: reage a "dark mode"/redução de movimento sem poluir
  // window com listeners soltos — e MediaQueryList é EventTarget (aceita on()).
  const mqEsquema = temMatchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const mqMovimento = temMatchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function atualizarMedia() {
    if (!mqEsquema || !mqMovimento) return;
    saidaMedia.textContent =
      `esquema de cor: ${mqEsquema.matches ? 'dark' : 'light'} · ` +
      `movimento reduzido: ${mqMovimento.matches ? 'sim' : 'não'}`;
  }

  if (mqEsquema && mqMovimento) {
    remocoes.push(
      on(mqEsquema, 'change', atualizarMedia),
      on(mqMovimento, 'change', atualizarMedia),
    );
    atualizarMedia();
  }

  const painelMedia = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'matchMedia (preferências do sistema)' }),
    temMatchMedia
      ? h('p', { class: 'nota' }, 'estado: ', saidaMedia)
      : h('p', { class: 'nota', text: 'matchMedia indisponível neste navegador.' }),
    h('p', {
      class: 'nota',
      text: 'Troque o tema/contraste do sistema operacional e veja o texto mudar ao vivo.',
    }),
  );

  // ── 3. Page Visibility + conectividade ──────────────────────────────────────
  const saidaEstado = h('output', { 'aria-live': 'polite' });

  function atualizarEstado() {
    // visibilityState: 'visible' | 'hidden' — onLine: boolean (melhor esforço)
    saidaEstado.textContent = `visibilityState: ${document.visibilityState} · conexão: ${navigator.onLine ? 'online' : 'offline'}`;
  }

  // Estes listeners são em document/window — NÃO morrem com o container,
  // então precisam entrar em remocoes para não vazar entre trocas de seção.
  remocoes.push(
    on(document, 'visibilitychange', atualizarEstado),
    on(window, 'online', atualizarEstado),
    on(window, 'offline', atualizarEstado),
  );
  atualizarEstado();

  const painelEstado = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Page Visibility + online/offline' }),
    h('p', { class: 'nota' }, 'estado: ', saidaEstado),
    h('p', {
      class: 'nota',
      text: 'Troque de aba ou desative a rede: visibilitychange/online/offline disparam na hora.',
    }),
  );

  // ── 4. crypto.randomUUID ────────────────────────────────────────────────────
  const saidaUuid = h('output', { 'aria-live': 'polite' });

  function gerarUuid() {
    // O que é: UUID v4 aleatório de verdade (CSPRNG); por que usei aqui:
    // Math.random() não serve para identificador único/seguro.
    if (typeof crypto.randomUUID === 'function') {
      saidaUuid.textContent = crypto.randomUUID();
      return;
    }
    // Fallback: monta o v4 à mão com getRandomValues (mesma entropia)
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // versão 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      saidaUuid.textContent =
        `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
        `${hex.slice(16, 20)}-${hex.slice(20)}`;
      return;
    }
    saidaUuid.textContent = 'crypto indisponível neste contexto.';
  }

  const painelUuid = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'crypto.randomUUID' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', { type: 'button', text: 'Gerar UUID v4', on: { click: gerarUuid } }),
      saidaUuid,
    ),
    h('p', {
      class: 'nota',
      text: 'Sem dependências: 16 bytes aleatórios + bits de versão/variante formatados como 8-4-4-4-12.',
    }),
  );

  gerarUuid();
  container.append(painelClipboard, painelMedia, painelEstado, painelUuid);

  // Cleanup: remove TODOS os listeners — os de document/window sobreviveriam
  // ao container se ficassem de fora (vazamento clássico entre trocas de seção).
  return () => {
    for (const remover of remocoes) remover();
  };
}
