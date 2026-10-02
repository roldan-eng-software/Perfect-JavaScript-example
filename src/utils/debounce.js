// @ts-check
/**
 * ARQUIVO: debounce.js
 * PROPÓSITO: atrasar a execução de uma função até que as chamadas parem por `wait` ms.
 * CONCEITOS DEMONSTRADOS: closures, cancelamento de timers, API de alta ordem.
 * USADO EM: demo 09 (validação em tempo real), demo 12 (debounce vs throttle), search inputs.
 * COMPLEXIDADE/OBSERVAÇÕES: retorna também `cancel()` para liberar o timer —
 *   essencial nos cleanups das demos, senão o timer vaza após a seção sair da tela.
 */

/**
 * Limita a frequência de execução: só chama `fn` depois de `wait` ms sem novas invocações.
 *
 * @param {(...args: any[]) => any} fn função a ser adiada
 * @param {number} wait tempo de espera em milissegundos (deve ser >= 0)
 * @param {{ leading?: boolean }} [opções] `leading: true` executa também na primeira chamada
 * @returns {((...args: any[]) => any) & { cancel: () => void }} função adiada com `cancel()`
 * @throws {TypeError} se `fn` não for função, ou `RangeError` se `wait` for inválido
 * @example
 * const buscar = debounce((termo) => console.log(termo), 300);
 * buscar('a'); buscar('ab'); buscar('abc'); // loga apenas 'abc' após 300ms
 */
export function debounce(fn, wait, { leading = false } = {}) {
  if (typeof fn !== 'function') {
    throw new TypeError('debounce: "fn" deve ser uma função.');
  }
  if (!Number.isFinite(wait) || wait < 0) {
    throw new RangeError('debounce: "wait" deve ser um número finito >= 0.');
  }

  let timer = null;
  let ultimaChamadaArgs = null;

  /** Executa `fn` com os argumentos da última chamada, se houver. */
  function executar() {
    timer = null;
    if (leading && ultimaChamadaArgs === null) return;
    const args = ultimaChamadaArgs ?? [];
    ultimaChamadaArgs = null;
    fn(...args);
  }

  function adiada(...args) {
    ultimaChamadaArgs = args;
    const primeiro = timer === null;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(executar, wait);
    if (leading && primeiro) {
      // leading executa imediatamente, mas o timer garante o intervalo mínimo
      const argsOriginais = ultimaChamadaArgs;
      ultimaChamadaArgs = null;
      fn(...argsOriginais);
    }
  }

  adiada.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    ultimaChamadaArgs = null;
  };

  return adiada;
}
