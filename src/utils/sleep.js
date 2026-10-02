// @ts-check
/**
 * ARQUIVO: sleep.js
 * PROPÓSITO: pausar a execução de forma assíncrona, com suporte a cancelamento.
 * CONCEITOS DEMONSTRADOS: Promises, AbortController, async/await.
 * USADO EM: retry.js (backoff injetável — facilita os testes), demo 02, demo 03.
 * COMPLEXIDADE/OBSERVAÇÕES: o `signal` é opcional para manter a função pura o
 *   bastante para teste; nos testes injeta-se um sleep fake em retry().
 */

/**
 * Retorna uma Promise que resolve após `ms` milissegundos.
 * Se um AbortSignal for abortado durante a espera, rejeita com o erro do signal.
 *
 * @param {number} ms tempo de espera em ms (>= 0)
 * @param {{ signal?: AbortSignal }} [opções] signal para cancelar a espera
 * @returns {Promise<void>} Promise resolvida após o tempo
 * @throws {RangeError} se `ms` não for finito e >= 0
 * @example
 * await sleep(1000);                 // espera 1s
 * const ac = new AbortController();
 * sleep(5000, { signal: ac.signal }); // cancelável com ac.abort()
 */
export function sleep(ms, { signal } = {}) {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new RangeError('sleep: "ms" deve ser um número finito >= 0.');
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
