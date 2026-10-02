/**
 * ARQUIVO: memoize.test.js
 * PROPÓSITO: testar cache de resultados, resolver customizado e limpeza.
 * CONCEITOS DEMONSTRADOS: Map, closures, funções de alta ordem.
 * USADO EM: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { memoize } from '../src/utils/memoize.js';

describe('memoize', () => {
  it('retorna o valor cacheado sem reexecutar a função', () => {
    let execucoes = 0;
    const soma = memoize((a, b) => {
      execucoes += 1;
      return a + b;
    });

    assert.equal(soma(2, 3), 5);
    assert.equal(soma(2, 3), 5);
    assert.equal(execucoes, 1, 'segunda chamada deve vir do cache');
    assert.equal(soma(3, 3), 6);
    assert.equal(execucoes, 2, 'argumentos diferentes reexecutam');
  });

  it('diferencia argumentos por tipo (1 !== "1")', () => {
    const fn = memoize((x) => ({ valor: x }));
    assert.notEqual(fn(1), fn('1'), 'chaves devem ser distintas por tipo');
  });

  it('aceita um resolver customizado para chave composta', () => {
    let execucoes = 0;
    const busca = memoize(
      (a, b) => {
        execucoes += 1;
        return `${a}-${b}`;
      },
      (a, b) => `${b}:${a}`, // chave inverte a ordem de propósito
    );

    busca('x', 'y');
    busca('x', 'y');
    assert.equal(execucoes, 1);
    assert.equal(busca.cache.size, 1, 'um único item no cache');
  });

  it('expõe o cache e clearCache() para inspeção', () => {
    const fn = memoize((n) => n * 2);
    fn(2);
    assert.ok(fn.cache instanceof Map);
    assert.equal(fn.cache.size, 1);
    fn.clearCache();
    assert.equal(fn.cache.size, 0);
  });

  it('lança TypeError para entradas inválidas', () => {
    assert.throws(() => memoize(/** @type {any} */ ('nope')), TypeError);
    assert.throws(() => memoize(() => {}, /** @type {any} */ (42)), TypeError);
  });
});
