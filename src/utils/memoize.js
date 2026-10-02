// @ts-check
/**
 * ARQUIVO: memoize.js
 * PROPÓSITO: cachear o resultado de uma função pura por seus argumentos.
 * CONCEITOS DEMONSTRADOS: closures, Maps, funções de alta ordem, desempenho.
 * USADO EM: demo 01 (comparação visual com/sem cache via performance.now()).
 * COMPLEXIDADE/OBSERVAÇÕES: cache ilimitado por padrão — em produção considere
 *   limitar o tamanho (LRU). O resolver customizado permite chaves compostas.
 */

/**
 * Cria uma versão memoizada de `fn`: argumentos iguais retornam o resultado
 * cacheado sem reexecutar o corpo da função.
 *
 * @param {(...args: any[]) => any} fn função pura a ser cacheada
 * @param {(...args: any[]) => string} [resolver] função que mapeia args → chave de cache
 *   (padrão: JSON dos argumentos na ordem)
 * @returns {((...args: any[]) => any) & { cache: Map<string, any>, clearCache: () => void }}
 *   função memoizada, com expõe o `cache` (Map) e `clearCache()` para inspeção/testes
 * @throws {TypeError} se `fn` não for função
 * @example
 * const fib = memoize((n) => (n < 2 ? n : fib(n - 1) + fib(n - 2)));
 * fib(40); // calcula; fib(40) de novo → retorna na hora do Map
 */
export function memoize(fn, resolver) {
  if (typeof fn !== 'function') {
    throw new TypeError('memoize: "fn" deve ser uma função.');
  }
  if (resolver !== undefined && typeof resolver !== 'function') {
    throw new TypeError('memoize: "resolver" deve ser uma função, se fornecido.');
  }

  // Map (não objeto) aceita qualquer tipo primitivo como chave, incluindo Symbol
  const cache = new Map();

  function memoizada(...args) {
    const chave = resolver ? resolver(...args) : JSON.stringify(args);
    if (cache.has(chave)) return cache.get(chave);
    const resultado = fn(...args);
    cache.set(chave, resultado);
    return resultado;
  }

  memoizada.cache = cache;
  memoizada.clearCache = () => cache.clear();

  return memoizada;
}
