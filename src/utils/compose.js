// @ts-check
/**
 * ARQUIVO: compose.js
 * PROPÓSITO: composição e currying de funções no estilo funcional.
 * CONCEITOS DEMONSTRADOS: funções de alta ordem, closures, programação ponta a ponta,
 *   arrow functions encadeadas.
 * USADO EM: demo 01 (compose/pipe/curry interativos).
 * COMPLEXIDADE/OBSERVAÇÕES: compose aplica da direita para a esquerda; pipe,
 *   da esquerda para a direita (leitura na ordem de execução). curry usa arity
 *   da função para decidir quando aplicar de fato.
 */

/**
 * Composição clássica: `compose(f, g)(x)` equivale a `f(g(x))` — aplica da direita p/ esquerda.
 *
 * @param {...Function} fns funções de um argumento (ou que ignoram args extras)
 * @returns {(arg: any) => any} função que recebe o argumento inicial e devolve o resultado final
 * @throws {TypeError} se algum item não for função, ou se nenhuma função for passada
 * @example
 * const dobro = (n) => n * 2;
 * const inc = (n) => n + 1;
 * compose(dobro, inc)(5); // dobro(inc(5)) === 12
 */
export function compose(...fns) {
  validarFuncoes('compose', fns);
  return (arg) => fns.reduceRight((acc, fn) => fn(acc), arg);
}

/**
 * Pipe: `pipe(f, g)(x)` equivale a `g(f(x))` — aplica da esquerda p/ direita.
 *
 * @param {...Function} fns funções de um argumento
 * @returns {(arg: any) => any} função encadeada
 * @throws {TypeError} se algum item não for função, ou se nenhuma função for passada
 * @example
 * pipe(inc, dobro)(5); // dobro(inc(5)) === 12
 */
export function pipe(...fns) {
  validarFuncoes('pipe', fns);
  return (arg) => fns.reduce((acc, fn) => fn(acc), arg);
}

/**
 * Curry: converte `fn(a, b, c)` em funções unárias parciais até todos os args chegarem.
 * Usa a `length` (arity) da função como critério de aplicação total.
 *
 * @param {Function} fn função a ser convertida
 * @returns {Function} função curried (aceita args um a um ou de uma vez)
 * @throws {TypeError} se `fn` não for função
 * @example
 * const soma3 = curry((a, b, c) => a + b + c);
 * soma3(1)(2)(3);   // 6
 * soma3(1, 2)(3);   // 6 — híbrido também funciona
 */
export function curry(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('curry: "fn" deve ser uma função.');
  }
  const arity = fn.length;

  function curried(...args) {
    if (args.length >= arity) return fn(...args);
    // Retorna parcial que acumula args via closure
    return (...novos) => curried(...args, ...novos);
  }

  return curried;
}

/**
 * Valida a lista de funções recebida por compose/pipe.
 *
 * @param {string} nome nome da função chamadora (para a mensagem de erro)
 * @param {Function[]} fns lista validada
 * @throws {TypeError} se algum item não for função ou a lista estiver vazia
 */
function validarFuncoes(nome, fns) {
  if (fns.length === 0) {
    throw new TypeError(`${nome}: informe ao menos uma função.`);
  }
  for (const fn of fns) {
    if (typeof fn !== 'function') {
      throw new TypeError(`${nome}: todos os itens devem ser funções.`);
    }
  }
}
