// @ts-check
/**
 * ARQUIVO: deep-clone.js
 * PROPÓSITO: copiar profundamente valores imutáveis sem referências compartilhadas.
 * CONCEITOS DEMONSTRADOS: structuredClone (nativo), recursão defensiva com fallback,
 *   WeakMap para ciclos, tratamento de Date/Map/Set/Array/objetos simples.
 * USADO EM: demo 05 (imutabilidade da store), demo 06 (comparação de cópias).
 * COMPLEXIDADE/OBSERVAÇÕES: usa `structuredClone` quando disponível (nativo, rápido,
 *   lida com ciclos); o fallback recursão cobre navegadores antigos e nunca clona
 *   funções (lança TypeError, como o nativo).
 */

/**
 * Clona profundamente `valor`.
 *
 * Tipos suportados no fallback: primitivos, Date, RegExp, Array, Map, Set,
 * objetos simples (com protótipo Object) e ciclos de referência.
 * Funções dentro do objeto lançam `TypeError` (mesmo comportamento do structuredClone).
 *
 * @param {any} valor valor a ser clonado
 * @returns {any} cópia profunda, sem referências compartilhadas com o original
 * @throws {TypeError} se o valor contiver funções (no fallback) ou for incloneável
 * @example
 * const original = { data: new Date(), tags: ['a'] };
 * const copia = deepClone(original);
 * copia.tags !== original.tags; // true — arrays são distintos
 */
export function deepClone(valor) {
  // Caminho nativo: mais rápido e suporta mais tipos (BigInt, ciclos, etc.)
  if (typeof structuredClone === 'function') {
    return structuredClone(valor);
  }
  return cloneComRecursao(valor, new WeakMap());
}

/**
 * Fallback recursivo usado quando `structuredClone` não existe.
 *
 * @param {any} valor valor atual na recursão
 * @param {WeakMap<object, object>} visitados mapa de ciclos (original → clone)
 * @returns {any} clone do valor
 * @throws {TypeError} ao encontrar função ou tipo não suportado
 */
function cloneComRecursao(valor, visitados) {
  // Primitivos (e null) são copiados por valor
  if (valor === null || typeof valor !== 'object') {
    if (typeof valor === 'function') {
      throw new TypeError('deepClone: não é possível clonar funções.');
    }
    return valor;
  }

  // Ciclo: se já clonamos este objeto, devolve a cópia existente
  if (visitados.has(valor)) return visitados.get(valor);

  if (valor instanceof Date) return new Date(valor.getTime());
  if (valor instanceof RegExp) return new RegExp(valor.source, valor.flags);

  if (Array.isArray(valor)) {
    const copia = [];
    visitados.set(valor, copia);
    for (const item of valor) copia.push(cloneComRecursao(item, visitados));
    return copia;
  }

  if (valor instanceof Map) {
    const copia = new Map();
    visitados.set(valor, copia);
    for (const [chave, v] of valor) {
      copia.set(cloneComRecursao(chave, visitados), cloneComRecursao(v, visitados));
    }
    return copia;
  }

  if (valor instanceof Set) {
    const copia = new Set();
    visitados.set(valor, copia);
    for (const v of valor) copia.add(cloneComRecursao(v, visitados));
    return copia;
  }

  // Objetos simples apenas (protótipo Object ou null — evita clonar DOM/erro estranho)
  const proto = Object.getPrototypeOf(valor);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError(`deepClone: tipo não suportado: ${valor.constructor?.name}`);
  }

  const copia = {};
  visitados.set(valor, copia);
  for (const [chave, v] of Object.entries(valor)) {
    copia[chave] = cloneComRecursao(v, visitados);
  }
  return copia;
}
