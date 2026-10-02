/**
 * ARQUIVO: compose.test.js
 * PROPÓSITO: testar compose, pipe e curry — ordem de execução e erros.
 * CONCEITOS DEMONSTRADOS: funções de alta ordem, reduce/reduceRight.
 * USADO EM: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compose, pipe, curry } from '../src/utils/compose.js';

const dobro = (n) => n * 2;
const inc = (n) => n + 1;
const quadrado = (n) => n * n;

describe('compose', () => {
  it('aplica da direita para a esquerda', () => {
    // compose(dobro, inc)(5) === dobro(inc(5)) === 12
    assert.equal(compose(dobro, inc)(5), 12);
    assert.equal(compose(quadrado, dobro, inc)(1), 16, '((1+1)*2)² = 16');
  });

  it('funciona com uma única função (identidade com função)', () => {
    assert.equal(compose(dobro)(3), 6);
  });

  it('lança erros para lista vazia ou itens não-função', () => {
    assert.throws(() => compose(), TypeError);
    assert.throws(() => compose(dobro, /** @type {any} */ ('x')), TypeError);
  });
});

describe('pipe', () => {
  it('aplica da esquerda para a direita', () => {
    // pipe(inc, dobro)(5) === dobro(inc(5)) === 12
    assert.equal(pipe(inc, dobro)(5), 12);
    assert.equal(pipe(inc, dobro, quadrado)(1), 16);
  });

  it('compose(f, g) equivale a pipe(g, f)', () => {
    assert.equal(compose(dobro, inc)(7), pipe(inc, dobro)(7));
  });

  it('lança erros para lista vazia ou itens não-função', () => {
    assert.throws(() => pipe(), TypeError);
    assert.throws(() => pipe(/** @type {any} */ (null)), TypeError);
  });
});

describe('curry', () => {
  it('acumula argumentos até completar a arity', () => {
    const soma3 = curry((a, b, c) => a + b + c);
    assert.equal(soma3(1)(2)(3), 6);
    assert.equal(soma3(1, 2)(3), 6, 'chamada híbrida funciona');
    assert.equal(soma3(1)(2, 3), 6);
    assert.equal(soma3(1, 2, 3), 6, 'chamada completa funciona');
  });

  it('lança TypeError quando não é função', () => {
    assert.throws(() => curry(/** @type {any} */ (42)), TypeError);
  });
});
