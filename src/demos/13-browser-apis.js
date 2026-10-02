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
import { tr } from '../core/i18n.js';

/** Textos de interface (chrome) da demo: botões, rótulos e mensagens de status. */
const STRINGS = {
  'en-US': {
    'clip.unavailable': 'Clipboard API unavailable (requires HTTPS or localhost).',
    'clip.sample': 'Copied via the Clipboard API — Perfect JavaScript Example ✔',
    'clip.copied': '✔ text copied to the clipboard.',
    'clip.copyFail': '✖ copy failed: {erro}',
    'clip.readUnavailable': 'Reading the clipboard is unavailable here.',
    'clip.read': '✔ read: {trecho}',
    'clip.empty': 'clipboard empty.',
    'clip.readFail': '✖ permission denied/error: {erro}',
    'btn.copy': 'Copy text',
    'btn.read': 'Read from clipboard',
    'clip.note': 'Works on HTTPS/localhost; the browser may ask for permission before reading.',
    'media.title': 'matchMedia (system preferences)',
    'label.state': 'state: ',
    'media.unavailable': 'matchMedia unavailable in this browser.',
    'media.note': 'Switch the OS theme/contrast and watch the text change live.',
    'media.out': 'color scheme: {esquema} · reduced motion: {movimento}',
    yes: 'yes',
    no: 'no',
    'state.out': 'visibilityState: {visibility} · connection: {conexao}',
    'state.note': 'Switch tabs or go offline: visibilitychange/online/offline fire immediately.',
    'uuid.unavailable': 'crypto unavailable in this context.',
    'btn.uuid': 'Generate UUID v4',
    'uuid.note': 'No dependencies: 16 random bytes + version/variant bits formatted as 8-4-4-4-12.',
  },
  'pt-BR': {
    'clip.unavailable': 'Clipboard API indisponível (requer HTTPS ou localhost).',
    'clip.sample': 'Copiado pela Clipboard API — Perfect JavaScript Example ✔',
    'clip.copied': '✔ texto copiado para a área de transferência.',
    'clip.copyFail': '✖ falha ao copiar: {erro}',
    'clip.readUnavailable': 'Leitura da área de transferência indisponível aqui.',
    'clip.read': '✔ lido: {trecho}',
    'clip.empty': 'área de transferência vazia.',
    'clip.readFail': '✖ permissão negada/erro: {erro}',
    'btn.copy': 'Copiar texto',
    'btn.read': 'Ler da área de transferência',
    'clip.note': 'Funciona em HTTPS/localhost; o navegador pode pedir permissão antes de ler.',
    'media.title': 'matchMedia (preferências do sistema)',
    'label.state': 'estado: ',
    'media.unavailable': 'matchMedia indisponível neste navegador.',
    'media.note': 'Troque o tema/contraste do sistema operacional e veja o texto mudar ao vivo.',
    'media.out': 'esquema de cor: {esquema} · movimento reduzido: {movimento}',
    yes: 'sim',
    no: 'não',
    'state.out': 'visibilityState: {visibility} · conexão: {conexao}',
    'state.note':
      'Troque de aba ou desative a rede: visibilitychange/online/offline disparam na hora.',
    'uuid.unavailable': 'crypto indisponível neste contexto.',
    'btn.uuid': 'Gerar UUID v4',
    'uuid.note':
      'Sem dependências: 16 bytes aleatórios + bits de versão/variante formatados como 8-4-4-4-12.',
  },
};

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
      saidaClipboard.textContent = tr(STRINGS, 'clip.unavailable');
      return;
    }
    try {
      await navigator.clipboard.writeText(tr(STRINGS, 'clip.sample'));
      saidaClipboard.textContent = tr(STRINGS, 'clip.copied');
    } catch (erro) {
      saidaClipboard.textContent = tr(STRINGS, 'clip.copyFail', {
        erro: erro instanceof Error ? erro.message : String(erro),
      });
    }
  }

  /**
   * Lê o texto atual da área de transferência (pode pedir permissão).
   *
   * @returns {Promise<void>} resolve após ler (ou grava o erro na saída)
   */
  async function lerAreaDeTransferencia() {
    if (!podeLer) {
      saidaClipboard.textContent = tr(STRINGS, 'clip.readUnavailable');
      return;
    }
    try {
      const texto = await navigator.clipboard.readText();
      saidaClipboard.textContent = texto
        ? tr(STRINGS, 'clip.read', {
            trecho: `${texto.slice(0, 80)}${texto.length > 80 ? '…' : ''}`,
          })
        : tr(STRINGS, 'clip.empty');
    } catch (erro) {
      saidaClipboard.textContent = tr(STRINGS, 'clip.readFail', {
        erro: erro instanceof Error ? erro.message : String(erro),
      });
    }
  }

  const painelClipboard = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Clipboard API' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'btn.copy'),
        on: { click: () => void copiar() },
      }),
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'btn.read'),
        on: { click: () => void lerAreaDeTransferencia() },
      }),
      saidaClipboard,
    ),
    h('p', {
      class: 'nota',
      text: tr(STRINGS, 'clip.note'),
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
    saidaMedia.textContent = tr(STRINGS, 'media.out', {
      esquema: mqEsquema.matches ? 'dark' : 'light',
      movimento: mqMovimento.matches ? tr(STRINGS, 'yes') : tr(STRINGS, 'no'),
    });
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
    h('h3', { text: tr(STRINGS, 'media.title') }),
    temMatchMedia
      ? h('p', { class: 'nota' }, tr(STRINGS, 'label.state'), saidaMedia)
      : h('p', { class: 'nota', text: tr(STRINGS, 'media.unavailable') }),
    h('p', {
      class: 'nota',
      text: tr(STRINGS, 'media.note'),
    }),
  );

  // ── 3. Page Visibility + conectividade ──────────────────────────────────────
  const saidaEstado = h('output', { 'aria-live': 'polite' });

  function atualizarEstado() {
    // visibilityState: 'visible' | 'hidden' — onLine: boolean (melhor esforço)
    saidaEstado.textContent = tr(STRINGS, 'state.out', {
      visibility: document.visibilityState,
      conexao: navigator.onLine ? 'online' : 'offline',
    });
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
    h('p', { class: 'nota' }, tr(STRINGS, 'label.state'), saidaEstado),
    h('p', {
      class: 'nota',
      text: tr(STRINGS, 'state.note'),
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
    saidaUuid.textContent = tr(STRINGS, 'uuid.unavailable');
  }

  const painelUuid = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'crypto.randomUUID' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', { type: 'button', text: tr(STRINGS, 'btn.uuid'), on: { click: gerarUuid } }),
      saidaUuid,
    ),
    h('p', {
      class: 'nota',
      text: tr(STRINGS, 'uuid.note'),
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
