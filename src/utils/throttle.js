// @ts-check
/**
 * ARQUIVO: throttle.js
 * PROPÓSITO: limitar a execução de uma função a no máximo uma vez por intervalo de tempo.
 * CONCEITOS DEMONSTRADOS: closures, timers, controle de frequência (complementar ao debounce).
 * USADO EM: demo 12 (debounce vs throttle visualizados), handlers de scroll/resize.
 * COMPLEXIDADE/OBSERVAÇÕES: leading + trailing garante que a última chamada do
 *   intervalo sempre execute (importante para scroll/resize não perderem o estado final).
 */

/**
 * Garante no máximo uma execução a cada `interval` ms.
 * Na primeira chamada executa imediatamente (`leading`); chamadas durante o
 * intervalo são agendadas para o fim dele (`trailing`), sempre com os args mais recentes.
 *
 * @param {(...args: any[]) => any} fn função a ser limitada
 * @param {number} interval intervalo mínimo em milissegundos (> 0)
 * @returns {((...args: any[]) => any) & { cancel: () => void }} função limitada com `cancel()`
 * @throws {TypeError} se `fn` não for função, ou `RangeError` se `interval` for inválido
 * @example
 * const onScroll = throttle(() => atualizar(), 100);
 * window.addEventListener('scroll', onScroll); // executa no máx. 10x/s
 */
export function throttle(fn, interval) {
  if (typeof fn !== 'function') {
    throw new TypeError('throttle: "fn" deve ser uma função.');
  }
  if (!Number.isFinite(interval) || interval <= 0) {
    throw new RangeError('throttle: "interval" deve ser um número finito > 0.');
  }

  // -Infinity garante leading na 1ª chamada mesmo com Date mockado em 0 (testes)
  let ultimoExec = Number.NEGATIVE_INFINITY;
  let timer = null;
  let argsPendentes = null;

  /** Agenda a execução trailing no restante do intervalo. */
  function agendarTrailing() {
    const restante = ultimoExec + interval - Date.now();
    timer = setTimeout(
      () => {
        timer = null;
        const args = argsPendentes;
        argsPendentes = null;
        ultimoExec = Date.now();
        fn(...args);
      },
      Math.max(restante, 0),
    );
  }

  function limitada(...args) {
    const agora = Date.now();
    const decorrido = agora - ultimoExec;

    if (decorrido >= interval) {
      // Fora do intervalo: executa imediatamente (leading)
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
        argsPendentes = null;
      }
      ultimoExec = agora;
      fn(...args);
    } else {
      // Dentro do intervalo: guarda a chamada mais recente para o trailing
      argsPendentes = args;
      if (timer === null) agendarTrailing();
    }
  }

  limitada.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    argsPendentes = null;
  };

  return limitada;
}
