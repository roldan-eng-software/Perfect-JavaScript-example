// @ts-check
/**
 * ARQUIVO: retry.js
 * PROPÓSITO: repetir uma operação assíncrona falhável com backoff exponencial.
 * CONCEITOS DEMONSTRADOS: async/await, Promises, injeção de dependência (sleep),
 *   tratamento de erros, Error.cause.
 * USADO EM: demo 02 (retry visual com falha simulada), fetch de dados.
 * COMPLEXIDADE/OBSERVAÇÕES: o `sleep` é injetado por parâmetro (padrão: o sleep real)
 *   para que os testes rodem sem esperar tempo de verdade — sem fake timers.
 */

/**
 * Executa `attempt` até ele resolver, re-tentando após falhas com atraso
 * exponencial: `baseDelay * factor^tentativa` (0, 1, 2, ... `retries`).
 *
 * @param {() => Promise<any>} attempt função assíncrona a ser tentada
 * @param {object} [opções]
 * @param {number} [opções.retries] número de novas tentativas após a primeira (padrão: 3)
 * @param {number} [opções.baseDelay] atraso inicial em ms (padrão: 100)
 * @param {number} [opções.factor] multiplicador do backoff (padrão: 2)
 * @param {(ms: number) => Promise<void>} [opções.sleep] função de espera injetável
 * @param {(tentativa: number, erro: Error) => void} [opções.onRetry] callback a cada re-tentativa
 * @param {AbortSignal} [opções.signal] cancela o retry entre tentativas
 * @returns {Promise<any>} o resultado da primeira tentativa bem-sucedida
 * @throws {Error} a última falha, com `retries` tentativas esgotadas;
 *   a falha original fica em `error.cause`
 * @example
 * const dados = await retry(() => fetch('/api').then((r) => r.json()), {
 *   retries: 2,
 *   baseDelay: 50,
 *   onRetry: (n, erro) => console.warn(`tentativa ${n}:`, erro.message),
 * });
 */
export async function attemptWithRetry(
  attempt,
  { retries = 3, baseDelay = 100, factor = 2, sleep: sleepFn = defaultSleep, onRetry, signal } = {},
) {
  if (typeof attempt !== 'function') {
    throw new TypeError('retry: "attempt" deve ser uma função.');
  }

  let ultimoErro;

  for (let tentativa = 0; tentativa <= retries; tentativa++) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    try {
      return await attempt();
    } catch (erro) {
      ultimoErro = erro;
      const esgotadas = tentativa === retries;
      if (esgotadas) break;
      onRetry?.(tentativa + 1, erro);
      const atraso = baseDelay * factor ** tentativa;
      await sleepFn(atraso, { signal });
    }
  }

  throw new Error(`retry: todas as ${retries + 1} tentativas falharam: ${ultimoErro?.message}`, {
    cause: ultimoErro,
  });
}

/**
 * Sleep padrão usado quando nenhuma função é injetada.
 * Reexporta o módulo sleep para uso interno sem criar dependência circular.
 *
 * @param {number} ms milissegundos
 * @returns {Promise<void>} Promise resolvida após `ms`
 */
function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
