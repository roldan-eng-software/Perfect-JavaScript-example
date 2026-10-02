// @ts-check
/**
 * ARQUIVO: logger.js
 * PROPÓSITO: log estruturado com níveis, ativado por flag — sem console solto.
 * CONCEITOS DEMONSTRADOS: closures, níveis de log, ambiente (import.meta.env),
 *   programação defensiva.
 * USADO EM: main.js (debug por ?debug=1), demos para rastrear event loop.
 * COMPLEXIDADE/OBSERVAÇÕES: níveis em ordem de severidade; `silent` desliga
 *   tudo (usado nos testes para manter o console limpo).
 */

/** Níveis em ordem crescente de severidade. */
export const LOG_LEVELS = Object.freeze({
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
});

/**
 * Cria um logger com nível mínimo configurável.
 *
 * @param {object} [opcoes]
 * @param {keyof typeof LOG_LEVELS} [opcoes.nivel] nível mínimo (padrão 'info')
 * @param {string} [opcoes.prefixo] prefixo fixo das mensagens (padrão 'app')
 * @param {Console} [opcoes.console] console injetável (facilita teste/mocks)
 * @returns {{
 *   debug: (...args: any[]) => void,
 *   info: (...args: any[]) => void,
 *   warn: (...args: any[]) => void,
 *   error: (...args: any[]) => void,
 *   setNivel: (nivel: keyof typeof LOG_LEVELS) => void,
 *   getNivel: () => keyof typeof LOG_LEVELS,
 * }} API do logger
 * @throws {TypeError} se `nivel` não for conhecido
 * @example
 * const log = createLogger({ nivel: 'debug', prefixo: 'demo03' });
 * log.debug('microtask executou'); // aparece só com ?debug=1
 */
export function createLogger({ nivel = 'info', prefixo = 'app', console: alvo = console } = {}) {
  if (!(nivel in LOG_LEVELS)) {
    throw new TypeError(`createLogger: nível desconhecido "${nivel}".`);
  }
  let nivelAtual = nivel;

  /**
   * Log genérico respeitando o nível mínimo.
   * @param {keyof typeof LOG_LEVELS} nivelDaMensagem
   * @param {'debug'|'info'|'warn'|'error'} metodoConsole
   * @param {...any} args
   */
  function emitir(nivelDaMensagem, metodoConsole, ...args) {
    if (LOG_LEVELS[nivelDaMensagem] < LOG_LEVELS[nivelAtual]) return;
    alvo[metodoConsole](`[${prefixo}]`, ...args);
  }

  return {
    debug: (...args) => emitir('debug', 'debug', ...args),
    info: (...args) => emitir('info', 'info', ...args),
    warn: (...args) => emitir('warn', 'warn', ...args),
    error: (...args) => emitir('error', 'error', ...args),
    /**
     * Altera o nível em tempo de execução.
     * @param {keyof typeof LOG_LEVELS} novo
     */
    setNivel(novo) {
      if (!(novo in LOG_LEVELS)) {
        throw new TypeError(`logger.setNivel: nível desconhecido "${novo}".`);
      }
      nivelAtual = novo;
    },
    /** @returns {keyof typeof LOG_LEVELS} nível atual */
    getNivel() {
      return nivelAtual;
    },
  };
}

/**
 * Logger padrão da aplicação. Fica em 'debug' quando a URL tem `?debug=1`
 * (feature detection sem depender de módulo de ambiente).
 *
 * @example
 * import { logger } from './logger.js';
 * logger.debug('só aparece com ?debug=1');
 */
const temDebug =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

export const logger = createLogger({
  nivel: temDebug ? 'debug' : 'info',
  prefixo: 'pje',
});
